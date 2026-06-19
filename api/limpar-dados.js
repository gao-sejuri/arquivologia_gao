const { supabase } = require('../lib/supabase');
const { autenticar } = require('../lib/auth');
const { registrarLog } = require('../lib/logs');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!perfil || perfil.role !== 'admin') return res.status(403).json({ error: 'Sem permissão.' });

    await supabase.from('fila_impressao').delete().gte('id', 0);
    const { error } = await supabase.from('etiquetas').delete().gte('id', 0);
    if (error) return res.status(500).json({ error: error.message });

    await registrarLog(req, user.id, user.email, 'limpar_dados', {});

    res.json({ success: true });
};
