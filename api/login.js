const { supabase } = require('../lib/supabase');
const { registrarLog } = require('../lib/logs');

const MAX_TENTATIVAS = 5;   // por IP
const JANELA_MIN = 15;      // dentro desta janela (minutos)

const ipDoRequest = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '';

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { email, senha } = req.body || {};
    if (!email || !senha) return res.status(400).json({ error: 'Informe email e senha.' });

    const ip = ipDoRequest(req);

    // Rate limit: bloqueia após MAX_TENTATIVAS falhas do mesmo IP na janela. Conta direto na
    // tabela de logs (acao='login_falha') — funciona em ambiente serverless (sem estado em memória).
    if (ip) {
        const desde = new Date(Date.now() - JANELA_MIN * 60 * 1000).toISOString();
        const { count } = await supabase
            .from('logs')
            .select('id', { count: 'exact', head: true })
            .eq('acao', 'login_falha')
            .eq('ip', ip)
            .gte('criado_em', desde);
        if ((count || 0) >= MAX_TENTATIVAS) {
            return res.status(429).json({ error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' });
        }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data.session) {
        await registrarLog(req, null, email, 'login_falha', { email });
        return res.status(401).json({ error: 'Login ou senha inválidos.' });
    }

    await registrarLog(req, data.user.id, data.user.email, 'login', { email });

    res.json({ success: true, token: data.session.access_token });
};
