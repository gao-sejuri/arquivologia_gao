# Etiquetas — Painel de Impressao de Identificacao Governamental

## O que e este projeto

Sistema web de gestao e impressao de etiquetas de identificacao funcional para servidores publicos.
Tecnologia atual: React (CDN/Babel) + Supabase Auth + API Vercel Serverless + Zebra Printer porta 9100.
Migracao planejada: Vite + TypeScript + React (build local) + mesma API.

Dados sensiveis manipulados: **CPF, Matricula, Nome, Data de Admissao** (LGPD Art. 46 aplicavel).

---

## ORQUESTRADOR: regras de agentes automaticos

> Claude deve ler esta secao antes de qualquer tarefa e decidir quais agentes disparar em paralelo
> SEM precisar perguntar ao usuario. Dispare sempre que as condicoes abaixo forem atendidas.

### Catalogo de Agentes

| Agente | Skill/Tipo | Quando disparar | Modo |
|--------|-----------|-----------------|------|
| **Security** | `/code-review` + `/security-review` | Qualquer mudanca em: `/api/*`, auth, token, upload, CPF/Matricula | Background enquanto continua |
| **UX/UI** | `Agent(Explore)` | Qualquer mudanca em componente React visivel | Background |
| **Simplify** | `/simplify` | Apos completar qualquer feature | Background |
| **Verify** | `/verify` | Apos mudancas de UI ou logica de filtro | Foreground se mudanca critica |
| **Memory** | `Write` para memory/ | Ao final de toda sessao com mudancas | Sempre |

### Regras de paralelismo

```
SE mudanca toca API + UI ao mesmo tempo:
  → disparar Security (background) + UX (background) em paralelo
  → aguardar ambos antes de marcar tarefa como completa

SE mudanca e so UI:
  → disparar UX (background) + Simplify (background) em paralelo

SE mudanca e so backend/API:
  → disparar Security (foreground, bloqueante) primeiro
  → depois Simplify (background)

NUNCA commitar sem Security ter rodado em mudancas de API/auth
```

### Trigger automatico de Security (sem usuario pedir)

Disparar `/security-review` automaticamente se qualquer Edit/Write tocar:
- `api/`, `server/`, `middleware/`, qualquer arquivo com `token`, `auth`, `cpf`, `senha`, `password`, `upload`

### Trigger automatico de Memory (sem usuario pedir)

Ao final de cada sessao que fez mudancas: escrever em `C:\Users\wescleygarrett\.claude\projects\c--Users-wescleygarrett-Desktop-etiquetas\memory\` o que foi decidido, por que, e o que ficou pendente.

---

## Arquitetura alvo (post-migracao)

```
etiquetas/
  src/
    components/
      Login.tsx
      Dashboard.tsx
      Paginacao.tsx
      TabelaServidor.tsx
      FiltrosBar.tsx
      FiltrosAnos.tsx
    hooks/
      useAuth.ts        (token httpOnly cookie)
      useDados.ts       (fetch + cache)
    utils/
      parsers.ts        (parseAdmissao)
      api.ts            (chamarApi centralizado)
      masks.ts          (mascaramento CPF)
    types/
      index.ts          (Servidor, Status, FiltrosState)
  api/
    login.ts
    dados.ts
    upload.ts
    imprimir.ts
    marcar-pendente.ts
  public/
    index.html
  vite.config.ts
  tsconfig.json
```

---

## Padrao de seguranca (nivel governo)

Toda mudanca de codigo DEVE respeitar:

1. **CSP**: `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'`
2. **Token**: nunca em localStorage/sessionStorage — httpOnly cookie com SameSite=Strict
3. **CPF**: sempre mascarado na exibicao (mostrar so 3 ultimos digitos)
4. **Upload**: validar magic bytes do XLSX antes de processar (nao so extensao)
5. **Rate limit**: max 5 tentativas de login por IP/15min
6. **Audit log**: registrar toda impressao (quem, quando, quais IDs, IP)
7. **SRI**: todo script externo com `integrity` e `crossorigin="anonymous"`
8. **Input sanitization**: sanitizar toda celula da planilha antes de persistir no Supabase

Referencias: OWASP Top 10, LGPD Art. 46, NBR ISO/IEC 27001.

---

## Padrao de UX/UI

- Acessibilidade: WCAG 2.1 AA (aria-labels, contraste 4.5:1, navegacao por teclado)
- Feedback imediato: toda acao async tem estado de loading visivel
- Erros: mensagens em portugues, sem expor detalhes tecnicos ao usuario
- Impressao em lote: maximo 50 por vez (ja implementado, manter)
- Mobile: layout responsivo (tabela com scroll horizontal em telas pequenas)
- Nenhum `alert()` ou `confirm()` nativo — substituir por modais React

---

## Eficiencia de tokens

- Ler so o arquivo relevante para a tarefa, nunca o projeto inteiro
- Usar `Explore` agent para pesquisa aberta (protege contexto principal)
- Spawn de agentes especializados para tarefas pesadas (code-review, security)
- Memoria persiste decisoes para nao re-derivar em proximas sessoes
- Cada componente maximo 120 linhas — se ultrapassar, dividir

---

## Comandos rapidos

```bash
# Dev
npm run dev

# Build
npm run build

# Type check
npx tsc --noEmit

# Security audit
npm audit --audit-level=moderate
```

---

## Contexto de impressao (nao mudar sem entender)

A impressora Zebra recebe ZPL via socket TCP na porta 9100.
O agente local (rodando na rede interna) faz polling em `/api/fila` e envia para a impressora.
A Vercel nao fala diretamente com a impressora — apenas enfileira.
Nunca expor a porta 9100 para a internet.
