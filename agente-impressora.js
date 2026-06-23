const net = require('net');
const { gerarZPL } = require('./lib/zpl');
const { formatarDataBR } = require('./lib/data');

const PRINTER_IP = process.env.PRINTER_IP || '10.40.5.143';
const PRINTER_PORT = Number(process.env.PRINTER_PORT) || 9100;
const INTERVALO_MS = 5000;

// supabase e enviar são injetáveis para testes (ver agente-impressora.test.js). Em produção,
// são preenchidos no bloco `require.main === module` no final do arquivo.
let supabase = null;
let enviar = null;

const TIMEOUT_MS = 10000;

const enviarParaImpressora = (zpl) => new Promise((resolve, reject) => {
    const cliente = new net.Socket();
    let finalizado = false;
    const finalizar = (fn, arg) => { if (!finalizado) { finalizado = true; cliente.destroy(); fn(arg); } };

    // Sem timeout, uma impressora que aceita a conexão mas trava na escrita deixaria a Promise
    // pendente para sempre e o agente preso. O timeout garante que o item seja marcado como erro.
    cliente.setTimeout(TIMEOUT_MS);
    cliente.on('timeout', () => finalizar(reject, new Error(`Tempo esgotado (${TIMEOUT_MS}ms) ao falar com a impressora.`)));
    cliente.on('error', (err) => finalizar(reject, err));

    cliente.connect(PRINTER_PORT, PRINTER_IP, () => {
        cliente.write(zpl, () => {
            cliente.end();
            finalizar(resolve);
        });
    });
});
enviar = enviarParaImpressora;

// Guarda de reentrância: imprimir um lote pode demorar mais que INTERVALO_MS. Sem isso, o tick
// seguinte do setInterval começaria a rodar por cima da execução anterior, pegaria as MESMAS
// linhas 'pendente' (ainda não marcadas) e mandaria os mesmos nomes para a impressora de novo.
let rodando = false;

const processarFila = async () => {
    if (rodando) return;
    rodando = true;
    try {
        // 1. Lê os pendentes mais antigos primeiro
        const { data: pendentes, error } = await supabase
            .from('fila_impressao')
            .select('id, etiqueta_id')
            .eq('status', 'pendente')
            .order('id', { ascending: true })
            .limit(20);

        if (error) {
            console.error('Erro ao buscar fila:', error.message);
            return;
        }
        if (!pendentes || pendentes.length === 0) return;

        // 2. Reivindica de forma atômica: marca como 'processando' só as linhas que ainda estavam
        //    'pendente'. O .eq('status','pendente') no UPDATE usa o lock de linha do Postgres, então
        //    se outro processo (ou tick) já reivindicou, este recebe 0 linhas e não reimprime.
        const ids = pendentes.map(j => j.id);
        const { data: reivindicados, error: erroClaim } = await supabase
            .from('fila_impressao')
            .update({ status: 'processando' })
            .in('id', ids)
            .eq('status', 'pendente')
            .select('id, etiqueta_id');

        if (erroClaim) {
            console.error('Erro ao reivindicar fila:', erroClaim.message);
            return;
        }
        if (!reivindicados || reivindicados.length === 0) return;

        // 3. Agrupa por etiqueta_id: imprime UMA etiqueta por servidor, mesmo que a fila tenha
        //    linhas duplicadas para a mesma pessoa — garante "um nome = uma impressão" por lote.
        const porEtiqueta = new Map();
        for (const job of reivindicados) {
            if (!porEtiqueta.has(job.etiqueta_id)) porEtiqueta.set(job.etiqueta_id, []);
            porEtiqueta.get(job.etiqueta_id).push(job.id);
        }

        console.log(`Reivindiquei ${reivindicados.length} item(ns) (${porEtiqueta.size} etiqueta(s) única(s)). Imprimindo...`);

        for (const [etiquetaId, jobIds] of porEtiqueta) {
            try {
                const { data: etiqueta, error: erroEtiqueta } = await supabase
                    .from('etiquetas')
                    .select('nome, matricula, cpf, data_admissao')
                    .eq('id', etiquetaId)
                    .single();
                if (erroEtiqueta || !etiqueta) throw new Error(erroEtiqueta ? erroEtiqueta.message : 'Etiqueta não encontrada');

                const zpl = gerarZPL(etiqueta.nome, etiqueta.matricula, formatarDataBR(etiqueta.data_admissao), etiqueta.cpf);
                await enviar(zpl);

                await supabase.from('etiquetas').update({ status: 'Impresso' }).eq('id', etiquetaId);
                await supabase.from('fila_impressao').update({ status: 'enviado', processado_em: new Date().toISOString() }).in('id', jobIds);

                console.log(`✅ Etiqueta de "${etiqueta.nome}" impressa (1x).`);
            } catch (err) {
                console.error(`❌ Erro ao imprimir etiqueta ${etiquetaId}:`, err.message);
                await supabase.from('fila_impressao').update({ status: 'erro', erro: err.message, processado_em: new Date().toISOString() }).in('id', jobIds);
            }
        }
    } finally {
        rodando = false;
    }
};

// Recuperação na inicialização: se o agente caiu no meio de um lote, sobram linhas em
// 'processando' que nunca seriam impressas. No arranque NÃO há nada em andamento (assume-se um
// único agente local, conforme a arquitetura), então é seguro devolvê-las para 'pendente'.
const recuperarPresas = async () => {
    const { data, error } = await supabase
        .from('fila_impressao')
        .update({ status: 'pendente' })
        .eq('status', 'processando')
        .select('id');
    if (error) console.error('Erro ao recuperar itens presos:', error.message);
    else if (data && data.length) console.log(`Recuperei ${data.length} item(ns) preso(s) em 'processando' → 'pendente'.`);
};

// Injeção de dependências para testes (não altera o comportamento de produção).
const configurarParaTeste = ({ client, enviar: enviarFn, resetRodando } = {}) => {
    if (client) supabase = client;
    if (enviarFn) enviar = enviarFn;
    if (resetRodando) rodando = false;
};

module.exports = { processarFila, recuperarPresas, configurarParaTeste };

// Só inicia de verdade quando executado como programa (node agente-impressora.js), não quando
// importado por um teste.
if (require.main === module) {
    const path = require('path');
    // Caminho absoluto do .env: como serviço do Windows o cwd não é a pasta do projeto.
    require('dotenv').config({ path: path.join(__dirname, '.env') });
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log(`Agente de impressão iniciado. Verificando a fila a cada ${INTERVALO_MS / 1000}s... (Ctrl+C para parar)`);
    recuperarPresas().then(processarFila);
    setInterval(processarFila, INTERVALO_MS);
}
