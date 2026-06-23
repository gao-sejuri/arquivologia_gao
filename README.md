# Painel de Impressão de Identificação Funcional — GAO/ACAPS

Sistema web governamental desenvolvido para a **Gerência de Apoio Operacional (GAO)** da
**ACAPS/SC**, destinado ao gerenciamento e impressão de etiquetas de identificação funcional
de servidores públicos.

## O que faz

O sistema recebe uma planilha Excel com os dados dos servidores (nome, matrícula, CPF e data
de admissão), armazena esses dados em nuvem e permite que operadores selecionem e enviem
etiquetas para impressão em uma impressora Zebra instalada na rede interna do órgão.

> Dados sensíveis manipulados: **CPF, Matrícula, Nome, Data de Admissão** (LGPD Art. 46 aplicável).

## Funcionalidades principais

### Gestão de planilha
- Upload de arquivo `.xlsx` com dados dos servidores
- Deduplicação automática de registros repetidos
- Preservação do histórico de impressão ao recarregar a planilha
- Botão para limpar o histórico (volta tudo a "Pendente") ou apagar todos os dados

### Impressão
- Seleção de até **20 etiquetas por lote** (limite da memória da impressora)
- Fila de impressão gerenciada via banco de dados
- Agente local que lê a fila e envia ZPL para a impressora Zebra na porta 9100
- Status de cada servidor: **Pendente → Na fila → Impresso**

### Filtros e navegação
- Busca por nome, matrícula ou CPF
- Filtro por status, mês de admissão e letra inicial do nome
- Paginação de **20 registros por página**

### Gestão de usuários (admin)
- Admin cria outros usuários com senha temporária gerada automaticamente
- Troca de senha obrigatória no primeiro acesso
- Qualquer usuário pode trocar a própria senha a qualquer momento

### Logs de auditoria
- Registro completo de todas as ações do sistema: login, upload, impressão, criação de
  usuário, troca de senha, reset de dados
- Exibe data/hora, usuário, IP e detalhes de cada evento

## Arquitetura

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 via CDN + Tailwind CSS |
| Backend (API) | Vercel Serverless Functions (Node.js) |
| Banco de dados | Supabase (PostgreSQL) com RLS |
| Autenticação | Supabase Auth (JWT) |
| Impressão | Agente Node.js local → TCP socket → Zebra porta 9100 |
| Deploy | Vercel (CI/CD automático via GitHub) |

> A Vercel não fala diretamente com a impressora — apenas enfileira. O agente local, rodando
> na rede interna, faz polling na fila e envia para a porta 9100. **Nunca expor a porta 9100
> à internet.**

## Segurança

- Autenticação obrigatória em todas as rotas
- CPF mascarado na exibição
- Validação de magic bytes no upload (garante que o arquivo é realmente XLSX)
- Controle de acesso por perfil (admin/usuário)
- Auditoria completa de todas as operações

Referências: OWASP Top 10, LGPD Art. 46, NBR ISO/IEC 27001.

## Documentação

- [Requisitos Funcionais (RF01–RF10)](REQUISITOS.md) — especificação completa de comportamento do sistema

## Comandos rápidos

```bash
npm run dev                          # Dev
npm run build                        # Build
npx tsc --noEmit                     # Type check
npm audit --audit-level=moderate     # Security audit
```
