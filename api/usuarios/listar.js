const { supabase } = require('../../lib/supabase');
const { autenticar } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!perfil || perfil.role !== 'admin') return res.status(403).json({ error: 'Acesso negado.' });

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });

    const { data: perfis } = await supabase.from('profiles').select('*');
    const perfisMap = new Map((perfis || []).map(p => [p.id, p]));

    const usuarios = users.map(u => {
        const p = perfisMap.get(u.id) || { role: 'user', force_password_change: true };
        return { id: u.id, email: u.email, role: p.role, force_password_change: p.force_password_change, created_at: u.created_at };
    });

    res.json({ usuarios });
};
