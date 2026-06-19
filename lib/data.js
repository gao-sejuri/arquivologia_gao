// Converte uma data no padrão BR ("DD/MM/AAAA") ou ISO ("AAAA-MM-DD") vinda da planilha
// para o formato ISO usado pela coluna `date` do Postgres.
const parseDataBRParaISO = (dataStr) => {
    if (!dataStr) return null;
    const partes = String(dataStr).split(/[\/\-]/);
    if (partes.length !== 3) return null;

    const [a, b, c] = partes;
    const [dia, mes, ano] = a.length === 4 ? [c, b, a] : [a, b, c];
    const diaNum = parseInt(dia, 10);
    const mesNum = parseInt(mes, 10);
    const anoNum = parseInt(ano, 10);
    if (!diaNum || !mesNum || !anoNum) return null;

    const pad = (n) => String(n).padStart(2, '0');
    return `${anoNum}-${pad(mesNum)}-${pad(diaNum)}`;
};

// Converte a data ISO vinda do Postgres de volta para o formato BR usado na tela e na etiqueta.
const formatarDataBR = (isoDate) => {
    if (!isoDate) return '';
    const [ano, mes, dia] = String(isoDate).split('-');
    return `${dia}/${mes}/${ano}`;
};

module.exports = { parseDataBRParaISO, formatarDataBR };
