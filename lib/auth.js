const { supabase } = require('./supabase');

// Lê o header Authorization: Bearer <token> e valida contra o Supabase Auth.
// Retorna o usuário autenticado, ou null se o token faltar/for inválido.
async function autenticar(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
}

module.exports = { autenticar };
