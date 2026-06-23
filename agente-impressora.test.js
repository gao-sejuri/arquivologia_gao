// Teste do agente de impressão SEM Supabase nem impressora reais.
// Mock em memória que replica a API fluente do supabase-js (incluindo a semântica atômica do
// claim: o UPDATE muta de forma síncrona no ponto do await, como o lock de linha do Postgres).
// Roda com: node agente-impressora.test.js

const path = require('path');

// ---- Mock do cliente Supabase ----
function makeClient(db) {
    class Q {
        constructor(table) {
            this.table = table;
            this.op = 'select';
            this.cols = '*';
            this.filters = [];
            this._order = null;
            this._limit = null;
            this._single = false;
            this._returning = false;
            this._payload = null;
        }
        select(cols) {
            if (this.op === 'select') { this.cols = cols; } else { this._returning = true; }
            return this;
        }
        update(payload) { this.op = 'update'; this._payload = payload; return this; }
        delete() { this.op = 'delete'; return this; }
        insert(rows) { this.op = 'insert'; this._payload = rows; return this; }
        eq(col, val) { this.filters.push(r => r[col] === val); return this; }
        in(col, arr) { this.filters.push(r => arr.includes(r[col])); return this; }
        order(col, opts) { this._order = { col, asc: !opts || opts.ascending !== false }; return this; }
        limit(n) { this._limit = n; return this; }
        single() { this._single = true; return this; }

        _matched() {
            return db[this.table].filter(r => this.filters.every(f => f(r)));
        }
        _exec() {
            if (this.op === 'select') {
                let res = this._matched();
                if (this._order) res = res.slice().sort((a, b) => this._order.asc ? a[this._order.col] - b[this._order.col] : b[this._order.col] - a[this._order.col]);
                if (this._limit != null) res = res.slice(0, this._limit);
                res = res.map(r => ({ ...r }));
                return this._single ? (res[0] || null) : res;
            }
            if (this.op === 'update') {
                const m = this._matched();                 // mutação SÍNCRONA = atômica no await
                m.forEach(r => Object.assign(r, this._payload));
                return this._returning ? m.map(r => ({ ...r })) : null;
            }
            if (this.op === 'delete') {
                const m = new Set(this._matched());
                db[this.table] = db[this.table].filter(r => !m.has(r));
                return null;
            }
            if (this.op === 'insert') {
                let maxId = db[this.table].reduce((mx, r) => Math.max(mx, r.id || 0), 0);
                const rows = Array.isArray(this._payload) ? this._payload : [this._payload];
                rows.forEach(r => db[this.table].push({ id: ++maxId, ...r }));
                return null;
            }
        }
        then(resolve) {
            let data, error = null;
            try { data = this._exec(); } catch (e) { error = e; data = null; }
            resolve({ data, error });   // resolve síncrono: _exec já rodou neste tick
        }
    }
    return { from: (table) => new Q(table) };
}

// ---- Impressora falsa: registra o nome de cada etiqueta impressa ----
function makePrinter(delayMs = 5) {
    const impressos = [];
    const enviar = (zpl) => new Promise(resolve => {
        const m = zpl.match(/\^FD([^\^]*?)\^FS/);   // 1º campo = nome
        impressos.push(m ? m[1] : '?');
        setTimeout(resolve, delayMs);
    });
    return { impressos, enviar };
}

// ---- Helpers de cenário ----
function seed(n, { duplicarPrimeiro = 0 } = {}) {
    const etiquetas = [];
    const fila = [];
    let filaId = 0;
    for (let i = 1; i <= n; i++) {
        etiquetas.push({ id: i, nome: `Pessoa${String(i).padStart(2, '0')}`, matricula: `00${i}`, cpf: `1112223334${i}`, data_admissao: '2020-03-05', status: 'Pendente' });
        fila.push({ id: ++filaId, etiqueta_id: i, status: 'pendente', erro: null, processado_em: null });
    }
    // linhas duplicadas na fila para a mesma pessoa (#1)
    for (let k = 0; k < duplicarPrimeiro; k++) fila.push({ id: ++filaId, etiqueta_id: 1, status: 'pendente', erro: null, processado_em: null });
    return { etiquetas, fila_impressao: fila };
}

// mirror do que api/imprimir.js faz ao reenfileirar os mesmos IDs
async function reenfileirar(client, ids) {
    await client.from('etiquetas').update({ status: 'Na fila' }).in('id', ids);
    await client.from('fila_impressao').delete().in('etiqueta_id', ids).in('status', ['pendente', 'processando']);
    await client.from('fila_impressao').insert(ids.map(id => ({ etiqueta_id: id, status: 'pendente', erro: null, processado_em: null })));
}

function contar(arr) {
    const m = {};
    arr.forEach(x => { m[x] = (m[x] || 0) + 1; });
    return m;
}
function duplicados(arr) {
    const c = contar(arr);
    return Object.entries(c).filter(([, n]) => n > 1).map(([k, n]) => `${k}×${n}`);
}

// silencia os console.log do agente durante o teste
const logOriginal = console.log;
console.log = () => {};

let falhas = 0;
function check(nome, cond, extra = '') {
    logOriginal(`  ${cond ? '✅' : '❌'} ${nome}${extra ? ' — ' + extra : ''}`);
    if (!cond) falhas++;
}

async function freshAgent(db, printer) {
    // carrega uma instância NOVA do módulo (cache limpo) para simular processos independentes
    delete require.cache[require.resolve('./agente-impressora')];
    const agente = require('./agente-impressora');
    agente.configurarParaTeste({ client: makeClient(db), enviar: printer.enviar, resetRodando: true });
    return agente;
}

(async () => {
    logOriginal('\n=== Teste do agente de impressão (anti-duplicação) ===\n');

    // Teste 1: reentrância — dois ciclos concorrentes na MESMA instância (o bug original)
    {
        const db = seed(10);
        const printer = makePrinter(15);
        const agente = await freshAgent(db, printer);
        await Promise.all([agente.processarFila(), agente.processarFila()]);
        logOriginal('Teste 1 — 10 na fila, dois ciclos concorrentes (reentrância):');
        check('imprimiu exatamente 10', printer.impressos.length === 10, `imprimiu ${printer.impressos.length}`);
        check('nenhum nome repetido', duplicados(printer.impressos).length === 0, duplicados(printer.impressos).join(', '));
    }

    // Teste 2: linhas duplicadas na fila para a mesma pessoa → 1 impressão por pessoa
    {
        const db = seed(10, { duplicarPrimeiro: 2 }); // Pessoa01 aparece 3× na fila
        const printer = makePrinter(2);
        const agente = await freshAgent(db, printer);
        await agente.processarFila();
        logOriginal('\nTeste 2 — fila com Pessoa01 triplicada:');
        check('imprimiu exatamente 10 (1 por pessoa)', printer.impressos.length === 10, `imprimiu ${printer.impressos.length}`);
        check('Pessoa01 impressa só 1×', (contar(printer.impressos)['Pessoa01'] || 0) === 1, `Pessoa01 ×${contar(printer.impressos)['Pessoa01'] || 0}`);
        check('todas as linhas da fila viraram enviado', db.fila_impressao.every(r => r.status === 'enviado'));
    }

    // Teste 3: cenário do usuário — imprime 10, depois reenfileira os MESMOS 10
    {
        const db = seed(10);
        const printer = makePrinter(2);
        let agente = await freshAgent(db, printer);
        await agente.processarFila();
        const ordem1 = printer.impressos.slice();
        await reenfileirar(makeClient(db), db.etiquetas.map(e => e.id));
        agente.configurarParaTeste({ resetRodando: true });
        await agente.processarFila();
        const ordem2 = printer.impressos.slice(10);
        logOriginal('\nTeste 3 — imprime 10, reenfileira os mesmos 10:');
        check('1ª ordem: 10 nomes, sem repetição', ordem1.length === 10 && duplicados(ordem1).length === 0, duplicados(ordem1).join(', '));
        check('2ª ordem: 10 nomes, sem repetição', ordem2.length === 10 && duplicados(ordem2).length === 0, duplicados(ordem2).join(', '));
        check('total 20 impressões (reimpressão proposital)', printer.impressos.length === 20, `total ${printer.impressos.length}`);
    }

    // Teste 4: DOIS agentes independentes lendo a MESMA fila ao mesmo tempo
    {
        const db = seed(10);
        const printer = makePrinter(10);
        const clienteCompartilhado = makeClient(db);
        const agenteA = await freshAgent(db, printer);
        agenteA.configurarParaTeste({ client: clienteCompartilhado, enviar: printer.enviar, resetRodando: true });
        const agenteB = await freshAgent(db, printer); // nova instância (cache limpo) = outro processo
        agenteB.configurarParaTeste({ client: clienteCompartilhado, enviar: printer.enviar, resetRodando: true });
        await Promise.all([agenteA.processarFila(), agenteB.processarFila()]);
        logOriginal('\nTeste 4 — dois agentes simultâneos na mesma fila (claim atômico):');
        check('imprimiu exatamente 10', printer.impressos.length === 10, `imprimiu ${printer.impressos.length}`);
        check('nenhum nome repetido', duplicados(printer.impressos).length === 0, duplicados(printer.impressos).join(', '));
    }

    logOriginal(`\n=== ${falhas === 0 ? 'TODOS OS TESTES PASSARAM ✅' : falhas + ' VERIFICAÇÃO(ÕES) FALHARAM ❌'} ===\n`);
    console.log = logOriginal;
    process.exit(falhas === 0 ? 0 : 1);
})();
