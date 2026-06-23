const { supabase } = require('../lib/supabase');
const { autenticar } = require('../lib/auth');
const { registrarLog } = require('../lib/logs');

// Não imprime direto (a Vercel não alcança a impressora na rede local) — só enfileira.
// O agente local (agente-impressora.js) é quem observa fila_impressao e imprime de fato.
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const { idsParaImprimir } = req.body || {};
    if (!Array.isArray(idsParaImprimir) || idsParaImprimir.length === 0) {
        return res.status(400).json({ error: 'Selecione ao menos um registro.' });
    }
    // Dedup defensivo: garante que cada servidor entre na fila uma única vez por lote.
    const ids = [...new Set(idsParaImprimir)];
    if (ids.length > 20) {
        return res.status(400).json({ error: 'Selecione no máximo 20 etiquetas por lote para não sobrecarregar a memória da impressora.' });
    }

    const { error: erroUpdate } = await supabase
        .from('etiquetas')
        .update({ status: 'Na fila' })
        .in('id', ids);
    if (erroUpdate) return res.status(500).json({ error: erroUpdate.message });

    // Remove entradas anteriores ainda não impressas dos mesmos IDs (pendente OU processando presa)
    // antes de reenfileirar — evita acúmulo do pedido anterior e reimpressão do mesmo nome.
    await supabase.from('fila_impressao').delete().in('etiqueta_id', ids).in('status', ['pendente', 'processando']);

    const filas = ids.map(id => ({ etiqueta_id: id, status: 'pendente' }));
    const { error: erroFila } = await supabase.from('fila_impressao').insert(filas);
    if (erroFila) return res.status(500).json({ error: erroFila.message });

    await registrarLog(req, user.id, user.email, 'impressao_lote', { quantidade: ids.length, ids });

    res.json({ success: true, mensagem: `${ids.length} etiqueta(s) enviada(s) para a fila de impressão.` });
};
