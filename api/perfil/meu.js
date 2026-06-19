const { supabase } = require('../../lib/supabase');
const { autenticar } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const { data: perfil, error } = await supabase
        .from('profiles')
        .select('role, force_password_change, created_at')
        .eq('id', user.id)
        .single();

    if (error || !perfil) {
        // Cria perfil automaticamente para usuários sem registro
        const { data: novo } = await supabase
            .from('profiles')
            .insert({ id: user.id, role: 'user', force_password_change: true })
            .select('role, force_password_change, created_at')
            .single();
        return res.json(novo || { role: 'user', force_password_change: true });
    }

    res.json(perfil);
};
