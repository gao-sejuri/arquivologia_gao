const { supabase } = require('./supabase');

const registrarLog = async (req, userId, userEmail, acao, detalhes = {}) => {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '';
    try {
        await supabase.from('logs').insert({ user_id: userId, user_email: userEmail, acao, detalhes, ip });
    } catch (_) {}
};

module.exports = { registrarLog };
