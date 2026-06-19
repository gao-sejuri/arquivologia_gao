const { supabase } = require('../lib/supabase');
const { autenticar } = require('../lib/auth');
const { formatarDataBR } = require('../lib/data');
const { registrarLog } = require('../lib/logs');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Nenhum id informado.' });
    }

    const { error: erroUpdate } = await supabase
        .from('etiquetas')
        .update({ status: 'Pendente' })
        .in('id', ids);
    if (erroUpdate) return res.status(500).json({ error: erroUpdate.message });

    const { data, error } = await supabase
        .from('etiquetas')
        .select('id, nome, matricula, cpf, data_admissao, status')
        .order('id', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    await registrarLog(req, user.id, user.email, 'marcar_pendente', { ids });

    res.json({
        success: true,
        dados: data.map(item => ({
            id: item.id,
            nome: item.nome,
            matricula: item.matricula,
            cpf: item.cpf,
            dataAdmissao: formatarDataBR(item.data_admissao),
            status: item.status
        }))
    });
};
