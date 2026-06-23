const xlsx = require('xlsx');
const { supabase } = require('../lib/supabase');
const { autenticar } = require('../lib/auth');
const { normalizarCpf, normalizarMatricula } = require('../lib/zpl');
const { parseDataBRParaISO, formatarDataBR } = require('../lib/data');
const { registrarLog } = require('../lib/logs');
const { fetchAllEtiquetas } = require('../lib/fetchAll');

// Casa a planilha nova com o que já existe no Supabase (por CPF ou Matrícula) e preserva
// quem já estava "Na fila"/"Impresso" — evita resetar o histórico de impressão a cada upload.
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    try {
        const { conteudoBase64 } = req.body || {};
        if (!conteudoBase64) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

        const buffer = Buffer.from(conteudoBase64, 'base64');

        // Valida tamanho (max 5MB)
        if (buffer.length > 5 * 1024 * 1024) {
            return res.status(400).json({ error: 'Arquivo muito grande. Limite de 5MB.' });
        }

        // Valida magic bytes do XLSX (ZIP: PK\x03\x04 = 50 4B 03 04)
        if (buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
            return res.status(400).json({ error: 'Arquivo invalido. Envie um arquivo .xlsx valido.' });
        }
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const aba = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = xlsx.utils.sheet_to_json(aba, { raw: false });

        let existentes;
        try { existentes = await fetchAllEtiquetas('id, nome, matricula, cpf, status'); }
        catch (e) { return res.status(500).json({ error: e.message }); }

        const porCpf = new Map();
        const porMatricula = new Map();
        (existentes || []).forEach(item => {
            const cpfKey = normalizarCpf(item.cpf);
            const matriculaKey = normalizarMatricula(item.matricula);
            if (cpfKey) porCpf.set(cpfKey, item);
            if (matriculaKey) porMatricula.set(matriculaKey, item);
        });

        const jaImpressos = [];
        const paraInserir = [];
        const paraAtualizar = [];

        // Deduplica o Excel antes de processar: CPF ou matrícula como chave, última linha vence.
        // As chaves recebem prefixo (c:/m:/n:) para que um CPF "123" e uma matrícula "123" não
        // colidam no mesmo Map e façam uma das pessoas sumir da importação.
        const vistoNoPlanilha = new Map();
        rawData.forEach(row => {
            const cpfKey = normalizarCpf(row['CPF'] || '');
            const matKey = normalizarMatricula(row['Matrícula'] || '');
            const chave = cpfKey ? `c:${cpfKey}` : matKey ? `m:${matKey}` : `n:${(row['Nome'] || '').trim().toLowerCase()}`;
            if (chave !== 'n:') vistoNoPlanilha.set(chave, row);
        });
        const rowsDedupados = Array.from(vistoNoPlanilha.values());

        // Remove caracteres de controle e espaços nas pontas antes de persistir no banco
        const sanitizar = (v) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();

        rowsDedupados.forEach(row => {
            const nome = sanitizar(row['Nome']);
            const matricula = sanitizar(row['Matrícula']);
            const cpf = sanitizar(row['CPF']);
            const dataAdmissaoIso = parseDataBRParaISO(sanitizar(row['Data de admissão cargo atual']).split(' ')[0]);

            const existente = porCpf.get(normalizarCpf(cpf)) || porMatricula.get(normalizarMatricula(matricula));
            const statusFinal = (existente && existente.status !== 'Pendente') ? existente.status : 'Pendente';

            if (existente && existente.status !== 'Pendente') {
                jaImpressos.push({ id: existente.id, nome, matricula });
            }

            const registro = { nome, matricula, cpf, data_admissao: dataAdmissaoIso, status: statusFinal };
            if (existente) {
                paraAtualizar.push({ id: existente.id, ...registro });
            } else {
                paraInserir.push(registro);
            }
        });

        if (paraAtualizar.length > 0) {
            const { error: erroUpdate } = await supabase.from('etiquetas').upsert(paraAtualizar);
            if (erroUpdate) return res.status(500).json({ error: erroUpdate.message });
        }
        if (paraInserir.length > 0) {
            const { error: erroInsert } = await supabase.from('etiquetas').insert(paraInserir);
            if (erroInsert) return res.status(500).json({ error: erroInsert.message });
        }

        let todos;
        try { todos = await fetchAllEtiquetas(); }
        catch (e) { return res.status(500).json({ error: e.message }); }

        await registrarLog(req, user.id, user.email, 'upload_planilha', {
            inseridos: paraInserir.length,
            atualizados: paraAtualizar.length
        });

        res.json({
            success: true,
            dados: todos.map(item => ({
                id: item.id,
                nome: item.nome,
                matricula: item.matricula,
                cpf: item.cpf,
                dataAdmissao: formatarDataBR(item.data_admissao),
                status: item.status
            })),
            jaImpressos
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao ler Excel: ' + error.message });
    }
};
