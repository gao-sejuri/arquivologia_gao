const { supabase } = require('../../lib/supabase');
const { autenticar } = require('../../lib/auth');
const { registrarLog } = require('../../lib/logs');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const { novaSenha } = req.body || {};
    if (!novaSenha || novaSenha.length < 8) {
        return res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres.' });
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, { password: novaSenha });
    if (error) return res.status(500).json({ error: 'Erro ao atualizar senha.' });

    await supabase.from('profiles').update({ force_password_change: false }).eq('id', user.id);
    await registrarLog(req, user.id, user.email, 'trocar_senha', {});

    res.json({ success: true });
};
