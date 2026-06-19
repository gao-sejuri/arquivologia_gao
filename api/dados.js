const { supabase } = require('../lib/supabase');
const { autenticar } = require('../lib/auth');
const { formatarDataBR } = require('../lib/data');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const { data, error } = await supabase
        .from('etiquetas')
        .select('id, nome, matricula, cpf, data_admissao, status')
        .order('id', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    res.json(data.map(item => ({
        id: item.id,
        nome: item.nome,
        matricula: item.matricula,
        cpf: item.cpf,
        dataAdmissao: formatarDataBR(item.data_admissao),
        status: item.status
    })));
};
