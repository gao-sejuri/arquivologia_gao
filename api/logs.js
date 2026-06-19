const { supabase } = require('../lib/supabase');
const { autenticar } = require('../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!perfil || perfil.role !== 'admin') return res.status(403).json({ error: 'Acesso negado.' });

    const { data, error } = await supabase
        .from('logs')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(500);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
};
