const { supabase } = require('../lib/supabase');
const { autenticar } = require('../lib/auth');
const { formatarDataBR } = require('../lib/data');
const { registrarLog } = require('../lib/logs');
const { fetchAllEtiquetas } = require('../lib/fetchAll');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!perfil || perfil.role !== 'admin') return res.status(403).json({ error: 'Sem permissão.' });

    const { error } = await supabase.from('etiquetas').update({ status: 'Pendente' }).gte('id', 0);
    if (error) return res.status(500).json({ error: error.message });

    await supabase.from('fila_impressao').delete().gte('id', 0);

    let data;
    try { data = await fetchAllEtiquetas(); }
    catch (e) { return res.status(500).json({ error: e.message }); }

    await registrarLog(req, user.id, user.email, 'resetar_impressoes', { total: data?.length || 0 });

    res.json({
        success: true,
        dados: (data || []).map(item => ({
            id: item.id,
            nome: item.nome,
            matricula: item.matricula,
            cpf: item.cpf,
            dataAdmissao: formatarDataBR(item.data_admissao),
            status: item.status
        }))
    });
};
