// Instala o agente de impressão como SERVIÇO do Windows (inicia no boot, roda em segundo plano
// sem terminal aberto e reinicia sozinho se cair).
//
// EXECUTAR EM UM TERMINAL COMO ADMINISTRADOR:
//   npm run service:install
// (vai aparecer um aviso do Windows/UAC — aceite.)

const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
    name: 'AgenteImpressoraEtiquetas',
    description: 'Agente local que envia etiquetas ZPL para a impressora Zebra (porta 9100). GAO/ACAPS.',
    script: path.join(__dirname, 'agente-impressora.js'),
    workingDirectory: __dirname,
    // Reinicia automaticamente se o processo cair
    wait: 2,
    grow: 0.5,
    maxRestarts: 10
});

svc.on('install', () => {
    console.log('Serviço instalado. Iniciando...');
    svc.start();
});
svc.on('alreadyinstalled', () => console.log('O serviço já está instalado.'));
svc.on('start', () => console.log('✅ Serviço "AgenteImpressoraEtiquetas" iniciado e rodando em segundo plano.'));
svc.on('error', (e) => console.error('Erro no serviço:', e));

svc.install();
