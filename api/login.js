const { supabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { email, senha } = req.body || {};
    if (!email || !senha) return res.status(400).json({ error: 'Informe email e senha.' });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data.session) return res.status(401).json({ error: 'Login ou senha inválidos.' });

    res.json({ success: true, token: data.session.access_token });
};
