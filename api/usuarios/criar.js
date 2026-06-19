const { supabase } = require('../../lib/supabase');
const { autenticar } = require('../../lib/auth');
const { registrarLog } = require('../../lib/logs');

const gerarSenha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!perfil || perfil.role !== 'admin') return res.status(403).json({ error: 'Acesso negado.' });

    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Informe o e-mail.' });

    const senhaTemporaria = gerarSenha();
    const { data: novoUser, error } = await supabase.auth.admin.createUser({
        email,
        password: senhaTemporaria,
        email_confirm: true
    });
    if (error) return res.status(400).json({ error: error.message });

    await supabase.from('profiles').insert({ id: novoUser.user.id, role: 'user', force_password_change: true });
    await registrarLog(req, user.id, user.email, 'criar_usuario', { email_criado: email });

    res.json({
        success: true,
        senhaTemporaria,
        usuario: { id: novoUser.user.id, email: novoUser.user.email, role: 'user', force_password_change: true, created_at: novoUser.user.created_at }
    });
};
