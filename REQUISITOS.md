# Requisitos Funcionais — Painel de Impressão de Identificação GAO/ACAPS

## RF01 — Autenticação de Usuários
- **RF01.1** O sistema deve exigir autenticação (e-mail e senha) para acesso a qualquer funcionalidade.
- **RF01.2** O sistema deve bloquear o acesso após credenciais inválidas e retornar mensagem de erro em português.
- **RF01.3** O sistema deve encerrar a sessão automaticamente quando o token de acesso expirar.
- **RF01.4** O sistema deve permitir logout manual a qualquer momento.

## RF02 — Controle de Acesso por Perfil
- **RF02.1** O sistema deve suportar dois perfis de acesso: Administrador e Usuário.
- **RF02.2** Usuários com perfil Administrador devem ter acesso a todas as funcionalidades do sistema.
- **RF02.3** Usuários com perfil Usuário devem ter acesso apenas ao painel de etiquetas e à troca de senha.

## RF03 — Primeiro Acesso e Troca de Senha
- **RF03.1** Todo usuário criado pelo administrador deve ser obrigado a definir uma nova senha antes de acessar o sistema.
- **RF03.2** A senha deve ter no mínimo 8 caracteres.
- **RF03.3** Qualquer usuário autenticado deve poder trocar sua senha a qualquer momento pelo painel.

## RF04 — Gestão de Usuários (Administrador)
- **RF04.1** O administrador deve poder criar novos usuários informando apenas o e-mail.
- **RF04.2** O sistema deve gerar automaticamente uma senha temporária para o novo usuário e exibi-la ao administrador no ato da criação.
- **RF04.3** O administrador deve poder visualizar a lista de todos os usuários cadastrados, com perfil, status do primeiro acesso e data de criação.

## RF05 — Upload de Planilha
- **RF05.1** O sistema deve aceitar arquivos no formato `.xlsx` com os dados dos servidores.
- **RF05.2** O sistema deve validar se o arquivo enviado é genuinamente um XLSX (verificação de assinatura binária), recusando arquivos com extensão adulterada.
- **RF05.3** O sistema deve rejeitar arquivos com tamanho superior a 5 MB.
- **RF05.4** O sistema deve importar os campos: Nome, Matrícula, CPF e Data de Admissão no Cargo Atual.
- **RF05.5** O sistema deve deduplicar automaticamente linhas repetidas na planilha antes de processar, utilizando CPF ou matrícula como chave de identificação.
- **RF05.6** Ao recarregar uma planilha, o sistema deve preservar o status de impressão de registros já processados (Na fila, Impresso), atualizando apenas os dados cadastrais.
- **RF05.7** Registros novos na planilha que não existem no banco devem ser inseridos com status Pendente.

## RF06 — Visualização e Filtragem de Registros
- **RF06.1** O sistema deve exibir todos os servidores cadastrados em tabela paginada com 20 registros por página.
- **RF06.2** O sistema deve permitir busca por nome, matrícula ou CPF em tempo real.
- **RF06.3** O sistema deve permitir filtragem por status de impressão: Todos, Pendente, Na fila, Impresso.
- **RF06.4** O sistema deve permitir filtragem por mês de admissão.
- **RF06.5** O sistema deve permitir filtragem por letra inicial do nome.
- **RF06.6** O sistema deve exibir contadores em tempo real: Total, Pendentes, Na fila e Impressos.

## RF07 — Seleção e Impressão em Lote
- **RF07.1** O sistema deve permitir a seleção individual ou coletiva de registros para impressão.
- **RF07.2** O sistema deve limitar a seleção a no máximo 20 etiquetas por lote, respeitando a capacidade de memória da impressora.
- **RF07.3** Ao confirmar a impressão, o sistema deve atualizar o status dos registros selecionados para Na fila e enfileirá-los no banco de dados.
- **RF07.4** O sistema deve garantir que cada clique em "Imprimir" substitua eventuais entradas pendentes anteriores dos mesmos registros, evitando reimpressão acumulada.

## RF08 — Agente de Impressão Local
- **RF08.1** Um agente local deve monitorar a fila de impressão no banco de dados a cada 5 segundos.
- **RF08.2** O agente deve enviar os dados de cada etiqueta no formato ZPL para a impressora Zebra via conexão TCP na porta 9100.
- **RF08.3** Após impressão bem-sucedida, o agente deve atualizar o status do registro para Impresso.
- **RF08.4** Em caso de falha na impressão, o agente deve registrar o erro e marcar o item como erro na fila, sem interromper o processamento dos demais.

## RF09 — Gestão do Histórico de Impressão
- **RF09.1** O administrador deve poder resetar o histórico de impressão, devolvendo todos os registros ao status Pendente sem apagar os dados cadastrais.
- **RF09.2** O administrador deve poder limpar todos os dados, removendo completamente os registros importados para permitir novo início do ciclo.
- **RF09.3** O usuário deve poder marcar registros individualmente como Pendente para reimpressão.

## RF10 — Logs de Auditoria
- **RF10.1** O sistema deve registrar automaticamente todas as ações relevantes: login, upload de planilha, impressão em lote, criação de usuário, troca de senha, reset e limpeza de dados.
- **RF10.2** Cada registro de log deve conter: data/hora, e-mail do usuário, ação executada, detalhes da operação e endereço IP de origem.
- **RF10.3** O administrador deve poder consultar os últimos 500 registros de log pelo painel.
