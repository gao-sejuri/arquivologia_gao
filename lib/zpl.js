const normalizarCpf = (cpf) => String(cpf || '').replace(/\D/g, '');
const normalizarMatricula = (matricula) => String(matricula || '').trim();

// '^' e '~' são caracteres de controle do ZPL. Se vierem dentro de um campo (nome, CPF…)
// quebram o layout ou injetam comandos na impressora — removemos antes de montar a etiqueta.
const limparZpl = (valor) => String(valor || '').replace(/[\^~]/g, ' ');

const gerarZPL = (nome, matriculaRaw, dataAdmissao, cpfRaw) => {
    let matricula = matriculaRaw ? String(matriculaRaw).trim() : '';
    if (matricula.startsWith('0')) matricula = matricula.substring(1);
    if (matricula.length >= 3) matricula = matricula.slice(0, 3) + '.' + matricula.slice(3);

    nome = limparZpl(nome);
    matricula = limparZpl(matricula);
    dataAdmissao = limparZpl(dataAdmissao);
    const cpf = limparZpl(cpfRaw ? String(cpfRaw).trim() : '');

    return `
^XA
^PW480
^FO0,30^A0N,36,20^FB480,1,0,C^FD${nome}^FS
^FO0,90^A0N,36,20^FB480,1,0,C^FD${matricula} | ADM: ${dataAdmissao}^FS
^FO0,145^A0N,36,20^FB480,1,0,C^FDCPF: ${cpf}^FS
^XZ
`;
};

module.exports = { gerarZPL, normalizarCpf, normalizarMatricula };
