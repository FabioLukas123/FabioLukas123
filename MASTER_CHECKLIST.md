# MASTER_CHECKLIST.md — O Checklist Supremo para Qualquer Tarefa de Programação

> O checklist definitivo, dividido pelas fases reais do trabalho. Uso: execute a seção correspondente ao momento em que está; itens não aplicáveis são pulados **conscientemente** (lendo e descartando), nunca por esquecimento. Cobre arquitetura, segurança, performance, testes, manutenção, legibilidade, documentação e compatibilidade. Parte da série iniciada em `WORKFLOW.md`.

---

## Índice

1. [Antes de começar](#1-antes-de-começar)
2. [Durante o desenvolvimento](#2-durante-o-desenvolvimento)
3. [Antes de alterar arquivos](#3-antes-de-alterar-arquivos)
4. [Antes de criar novos componentes](#4-antes-de-criar-novos-componentes)
5. [Antes de fazer commit](#5-antes-de-fazer-commit)
6. [Antes de responder ao usuário](#6-antes-de-responder-ao-usuário)
7. [Antes de finalizar](#7-antes-de-finalizar)
8. [Checklists especiais por tipo de mudança](#8-checklists-especiais)

---

## 1. Antes de começar

### 1.1 Entendimento
- [ ] Classifiquei o pedido: **pergunta** (responder, não mudar código) / **diagnóstico** (investigar e reportar, não corrigir) / **implementação** (fluxo completo) / **revisão** (achados, não correções).
- [ ] Identifiquei o problema real por trás do texto do pedido.
- [ ] Defini o critério de sucesso em uma frase verificável: "pronto quando ___".
- [ ] Identifiquei o que **não** pode quebrar (contratos, consumidores, dados).

### 1.2 Contexto
- [ ] Li os arquivos citados no pedido — inteiros ou a região relevante + imports.
- [ ] Li 2+ exemplos análogos no projeto (o padrão local real).
- [ ] Verifiquei as dependências e versões reais (manifesto + lockfile), não as da memória.
- [ ] Chequei README/CONTRIBUTING/configs de lint e CI por regras do projeto.
- [ ] Registrei o estado inicial: a suíte de testes passa ANTES de eu tocar em algo? (Falhas pré-existentes anotadas para não me serem atribuídas.)

### 1.3 Ambiguidade e risco
- [ ] Ambiguidades classificadas: descobrível no código (descobri) / convenção (assumi e vou declarar) / negócio ou irreversível (perguntei ANTES de implementar).
- [ ] Varredura de riscos: contrato? dados persistidos? concorrência? dependência nova? segurança? irreversibilidade?
- [ ] Tarefa não trivial (3+ arquivos, contrato, schema)? → plano escrito com objetivo, arquivos, etapas, verificação e riscos.
- [ ] Plano ordenado pela **maior incerteza primeiro**.
- [ ] Mudança arquitetural significativa? → aval explícito do usuário obtido.

---

## 2. Durante o desenvolvimento

### 2.1 Disciplina de ciclo
- [ ] Estou implementando **uma etapa por vez**, terminando em estado que compila/roda.
- [ ] Rodo algo (build, teste, script) a cada arquivo alterado — nunca acumulo código não verificado.
- [ ] Erro encontrado é corrigido antes de empilhar mais código por cima.
- [ ] O plano continua válido? Se a realidade o desmentiu: parei, atualizei, vou comunicar.
- [ ] Descobertas fora do escopo estão indo para as notas do relatório — não para o diff.

### 2.2 Qualidade em linha
- [ ] Toda chamada que pode falhar (rede/arquivo/banco/parse) ganhou tratamento de erro **no momento da escrita**.
- [ ] Todo recurso aberto tem liberação garantida também no caminho de erro (finally/defer/with).
- [ ] Nenhuma API usada sem eu ter visto sua assinatura real (fonte instalada/doc da versão).
- [ ] Nomes dizem a verdade completa (efeitos colaterais incluídos); zero números/strings mágicos.
- [ ] Antes de cada helper novo: procurei o equivalente existente no projeto.
- [ ] Estou imitando o estilo do arquivo — sem imitar defeitos (SQL concatenado, catch vazio, segredo hardcoded: nunca, nem "por consistência").

### 2.3 Os quatro domínios traiçoeiros (verificação contínua)
- [ ] Dinheiro → inteiro em centavos/decimal, nunca float.
- [ ] Datas → UTC no armazenamento, timezone só na borda de apresentação.
- [ ] Concorrência → "e se dois rodarem juntos?" respondido por construção (atomicidade), não por probabilidade.
- [ ] Texto externo → tratado como hostil (validação/escape), inclusive unicode.

---

## 3. Antes de alterar arquivos

- [ ] **Li o arquivo** que vou alterar — não apenas o trecho do grep.
- [ ] Entendi por que o código atual é como é (git log/blame se estranho; Chesterton: comportamento antigo esquisito sustenta algo até prova em contrário).
- [ ] **Encontrei todos os usos** do que vou mudar (busca por referência; atenção a uso via string, reflexão, serialização, configuração).
- [ ] A mudança é a **menor** que resolve por inteiro? Prefiro adicionar (parâmetro opcional, endpoint novo) a modificar semântica existente?
- [ ] Isto é superfície pública (API, evento, schema, export, CLI, env var)? → regras de compatibilidade da §8.3.
- [ ] Não vou reformatar o arquivo inteiro (o diff mostra a mudança real, não ruído de formatação).
- [ ] Vou sobrescrever/deletar algo? → olhei o conteúdo atual primeiro; se contradiz o que foi descrito, paro e pergunto.
- [ ] Testes existentes cobrem o que vou alterar? Se não e a mudança é arriscada → teste de caracterização antes.

---

## 4. Antes de criar novos componentes

*(função, classe, módulo, serviço, tabela, endpoint, dependência)*

### 4.1 Justificativa
- [ ] Já existe algo no projeto que faz isso? (Procurei de verdade: por nome, por conceito, nos vizinhos.)
- [ ] A stdlib ou uma dependência já instalada resolve?
- [ ] Se é abstração: é a 3ª ocorrência do mesmo **conceito**? (Antes disso: duplicar é mais barato que a abstração errada.)
- [ ] Se é dependência nova: necessária, mantida, auditada, nome exato conferido, licença ok, proporcional ao uso?
- [ ] Se é serviço/infra nova: há dor nomeada e medida que o monolito modular não resolve?
- [ ] Se é configuração nova: existe um segundo valor real necessário? (Senão: constante nomeada.)

### 4.2 Design
- [ ] Responsabilidade descritível em uma frase sem "e".
- [ ] Nome revela intenção e efeitos (o leitor confia no nome sem abrir o corpo).
- [ ] Na camada certa; dependências apontando na direção certa (domínio não importa infraestrutura); nenhum ciclo de imports novo.
- [ ] Interface mínima: só o necessário é público.
- [ ] Estados ilegais irrepresentáveis onde possível (tipos/enums/constraints em vez de convenção verbal).
- [ ] Testável sem heroísmo (dependências voláteis — relógio, random, I/O — injetáveis).
- [ ] Como falha? O erro emitido diagnostica sem debugger?
- [ ] Coleções/buffers/caches novos têm limite nomeável (paginação, TTL, teto).

---

## 5. Antes de fazer commit

### 5.1 O diff
- [ ] `git diff` relido **hunk por hunk**; para cada um: "necessário para a tarefa?"
- [ ] Zero sobras: console.log/print de debug, imports mortos, código comentado, arquivos temporários, dados de teste.
- [ ] Zero mudanças acidentais (formatação em massa, arquivo tocado sem querer).
- [ ] Zero segredos/credenciais/URLs internas no diff.
- [ ] Comentários novos explicam **porquês**; comentários vizinhos ainda são verdade após minha mudança.

### 5.2 Verificação
- [ ] Testes relacionados + suíte relevante executados e verdes (ou falhas pré-existentes documentadas).
- [ ] Teste novo comprovadamente falha sem a mudança e passa com ela.
- [ ] Lint/typecheck/build rodados quando existem no projeto.
- [ ] Comportamento exercitado da forma mais real disponível (app/endpoint/CLI — não apenas testes de unidade).
- [ ] Correção de bug? → teste de regressão + varredura por instâncias irmãs do mesmo padrão.

### 5.3 O commit em si
- [ ] Um commit = uma preocupação (refactor/formatação separados de comportamento).
- [ ] Mensagem explica **o quê e por quê** (não "fix", "updates", "wip").
- [ ] Na branch designada — e somente nela.
- [ ] Migração incluída se schema mudou; doc atualizada se comportamento documentado mudou. No mesmo commit/PR.

---

## 6. Antes de responder ao usuário

### 6.1 Conteúdo
- [ ] A **primeira frase responde o que aconteceu / o que encontrei** (o TL;DR primeiro).
- [ ] Relato cobre: o que mudou → por quê → **como verifiquei (comandos e saídas reais)** → o que não verifiquei e por quê → suposições → descobertas fora do escopo.
- [ ] Falhas e limitações com a evidência crua, sem paráfrase otimista.
- [ ] Nenhuma afirmação de "funciona" sem observação correspondente.
- [ ] Nenhuma promessa no lugar de trabalho ("depois posso fazer X" só para o que está genuinamente fora do escopo).
- [ ] Se era pergunta/diagnóstico: respondi/diagnostiquei **sem ter aplicado correções não pedidas**.

### 6.2 Forma
- [ ] Legível para quem não acompanhou a sessão: sem codinomes internos, sem abreviações da conversa, frases completas.
- [ ] Decisões apresentadas com recomendação clara e justificada — não um menu neutro.
- [ ] Proporcional: pergunta simples = resposta direta; trabalho grande = relatório estruturado.

---

## 7. Antes de finalizar

- [ ] Critério de sucesso definido no início: **atendido e demonstrado**.
- [ ] Push feito para a branch designada (retry com backoff se rede falhou) — e para nenhuma outra.
- [ ] Nenhuma ação externa não autorizada executada (PR, deploy, publicação, e-mail — só com pedido explícito).
- [ ] Repositório em estado limpo: sem arquivos órfãos, sem mudanças não commitadas acidentais, sem instrumentação de debug esquecida.
- [ ] Pendências e follow-ups listados explicitamente no relatório (nada ficou implícito).
- [ ] Se assinei subscrição/monitoramento de algo: o ciclo está fechado ou o próximo passo está agendado/declarado.

---

## 8. Checklists especiais

### 8.1 Mudança toca entrada externa / endpoint
- [ ] Validação por schema no servidor; campos desconhecidos rejeitados em contexto sensível; limites de tamanho/quantidade/profundidade.
- [ ] Query parametrizada; saída escapada no contexto (HTML/atributo/URL/shell); caminho confinado; URL de usuário com allowlist (SSRF).
- [ ] Autenticação exigida; **autorização no recurso específico** (teste mental: usuário A com o ID do recurso de B → 403/404?).
- [ ] Campos de privilégio (role, owner_id, tenant_id) impossíveis de definir via payload.
- [ ] Mutação nunca via GET; proteção CSRF do padrão do projeto; rate limit se credencial/caro.
- [ ] Erro ao cliente sem stack/SQL/caminho/versão.
- [ ] Listagem paginada; N+1 verificado; índice para o novo padrão de consulta.

### 8.2 Mudança toca schema / dados persistidos
- [ ] Migração versionada, com plano de rollback.
- [ ] Compatível durante o deploy: expand → migrate → contract (código velho e novo convivem).
- [ ] Constraints no banco (NOT NULL/UNIQUE/FK/CHECK), não só validação na aplicação.
- [ ] Dados existentes no formato antigo: migrados ou lidos pelo código novo.
- [ ] Operação destrutiva (DROP/DELETE/UPDATE em massa): alvo confirmado, ambiente confirmado, backup/reversão à mão, autorização explícita.
- [ ] `EXPLAIN` nas queries novas sobre tabelas grandes.

### 8.3 Mudança toca contrato público (API/evento/export/CLI)
- [ ] Mudança aditiva (campo opcional, endpoint novo) — semântica existente intocada.
- [ ] Remoção/mudança incompatível: deprecação com aviso e prazo + medição de uso antes.
- [ ] Consumidores conhecidos verificados; na dúvida se algo é usado: **é usado**.
- [ ] Formato de erro e convenções consistentes com o restante da superfície.
- [ ] Documentação do contrato atualizada no mesmo diff.

### 8.4 Mudança toca concorrência / jobs / filas
- [ ] Estado compartilhado identificado — eliminado ou sincronizado por construção.
- [ ] Check-then-act atômico (constraint+conflito / upsert / lock com timeout).
- [ ] Consumidor idempotente; retry com backoff+jitter e limite; DLQ com alerta.
- [ ] Ack somente após persistir o efeito.
- [ ] Timeout em toda chamada de rede (menor que o timeout de quem me chama).
- [ ] Teste de intermitência: N execuções, não uma.

### 8.5 Mudança toca autenticação / sessão / segredos
- [ ] Hash de senha correto (bcrypt/argon2); comparações em tempo constante; mensagens genéricas (sem enumeração de e-mail).
- [ ] Sessão regenerada no login; invalidação em logout/troca de senha; cookies HttpOnly+Secure+SameSite.
- [ ] JWT: algoritmo fixado, exp/aud/iss verificados, nada sensível no payload, revogação pensada.
- [ ] Segredo novo em env/secret manager, validado no boot; nada em código/log; se algum vazou: **rotacionado**.
- [ ] Eventos de segurança logados (login, falha, mudança de permissão) sem dados sensíveis.

### 8.6 Mudança de dependências
- [ ] Nome exato (typosquatting); mantida; auditoria de vulnerabilidades rodada; licença compatível.
- [ ] Lockfile atualizado e commitado; versão fixada conforme política do projeto.
- [ ] Peso proporcional ao uso; alternativa já instalada considerada antes.
- [ ] Breaking changes do changelog lidas se for atualização de major.
