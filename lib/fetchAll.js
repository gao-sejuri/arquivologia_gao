const { supabase } = require('./supabase');

const PAGE = 1000;

async function fetchAllEtiquetas(select = 'id, nome, matricula, cpf, data_admissao, status') {
    let all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('etiquetas')
            .select(select)
            .order('id', { ascending: true })
            .range(from, from + PAGE - 1);
        if (error) throw error;
        all = all.concat(data || []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

module.exports = { fetchAllEtiquetas };
