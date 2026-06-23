// Remove o serviço do Windows do agente de impressão.
// EXECUTAR EM UM TERMINAL COMO ADMINISTRADOR:
//   npm run service:uninstall

const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
    name: 'AgenteImpressoraEtiquetas',
    script: path.join(__dirname, 'agente-impressora.js')
});

svc.on('uninstall', () => console.log('✅ Serviço removido.'));
svc.on('error', (e) => console.error('Erro:', e));

svc.uninstall();
