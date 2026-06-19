const { autenticar } = require('../lib/auth');
const { formatarDataBR } = require('../lib/data');
const { fetchAllEtiquetas } = require('../lib/fetchAll');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    const user = await autenticar(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    try {
        const data = await fetchAllEtiquetas();
        res.json(data.map(item => ({
            id: item.id,
            nome: item.nome,
            matricula: item.matricula,
            cpf: item.cpf,
            dataAdmissao: formatarDataBR(item.data_admissao),
            status: item.status
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
