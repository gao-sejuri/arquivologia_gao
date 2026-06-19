require('dotenv').config();
const net = require('net');
const { createClient } = require('@supabase/supabase-js');
const { gerarZPL } = require('./lib/zpl');
const { formatarDataBR } = require('./lib/data');

const PRINTER_IP = process.env.PRINTER_IP || '10.40.5.143';
const PRINTER_PORT = Number(process.env.PRINTER_PORT) || 9100;
const INTERVALO_MS = 5000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const enviarParaImpressora = (zpl) => new Promise((resolve, reject) => {
    const cliente = new net.Socket();
    cliente.connect(PRINTER_PORT, PRINTER_IP, () => {
        cliente.write(zpl, () => {
            cliente.end();
            resolve();
        });
    });
    cliente.on('error', reject);
});

const processarFila = async () => {
    const { data: pendentes, error } = await supabase
        .from('fila_impressao')
        .select('id, etiqueta_id')
        .eq('status', 'pendente')
        .limit(20);

    if (error) {
        console.error('Erro ao buscar fila:', error.message);
        return;
    }
    if (!pendentes || pendentes.length === 0) return;

    console.log(`Encontrei ${pendentes.length} etiqueta(s) na fila. Imprimindo...`);

    for (const job of pendentes) {
        try {
            const { data: etiqueta, error: erroEtiqueta } = await supabase
                .from('etiquetas')
                .select('nome, matricula, cpf, data_admissao')
                .eq('id', job.etiqueta_id)
                .single();
            if (erroEtiqueta || !etiqueta) throw new Error(erroEtiqueta ? erroEtiqueta.message : 'Etiqueta não encontrada');

            const zpl = gerarZPL(etiqueta.nome, etiqueta.matricula, formatarDataBR(etiqueta.data_admissao), etiqueta.cpf);
            await enviarParaImpressora(zpl);

            await supabase.from('etiquetas').update({ status: 'Impresso' }).eq('id', job.etiqueta_id);
            await supabase.from('fila_impressao').update({ status: 'enviado', processado_em: new Date().toISOString() }).eq('id', job.id);

            console.log(`✅ Etiqueta de "${etiqueta.nome}" impressa.`);
        } catch (err) {
            console.error(`❌ Erro ao imprimir item ${job.id}:`, err.message);
            await supabase.from('fila_impressao').update({ status: 'erro', erro: err.message, processado_em: new Date().toISOString() }).eq('id', job.id);
        }
    }
};

console.log(`Agente de impressão iniciado. Verificando a fila a cada ${INTERVALO_MS / 1000}s... (Ctrl+C para parar)`);
processarFila();
setInterval(processarFila, INTERVALO_MS);
