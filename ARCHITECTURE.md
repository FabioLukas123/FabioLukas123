# ARCHITECTURE.md — Como um Agente de IA Projeta Sistemas

> Engenharia reversa do comportamento observável ao projetar e evoluir arquiteturas. Para cada abordagem: quando usar, quando evitar, e os trade-offs reais. Parte da série iniciada em `WORKFLOW.md`.

---

## Índice

1. [Fundamentos: o que arquitetura decide](#1-fundamentos)
2. [Modularização](#2-modularização)
3. [Monólitos](#3-monólitos)
4. [Microsserviços](#4-microsserviços)
5. [DDD — Domain-Driven Design](#5-ddd)
6. [Clean Architecture](#6-clean-architecture)
7. [SOLID](#7-solid)
8. [DRY, KISS, YAGNI](#8-dry-kiss-yagni)
9. [Event-Driven Architecture](#9-event-driven-architecture)
10. [Mensageria e filas](#10-mensageria-e-filas)
11. [Cache](#11-cache)
12. [APIs](#12-apis)
13. [Bancos de dados](#13-bancos-de-dados)
14. [Autenticação](#14-autenticação)
15. [Autorização](#15-autorização)
16. [Tabela-mestra de decisão](#16-tabela-mestra-de-decisão)

---

## 1. Fundamentos

Três teses governam todas as decisões abaixo:

1. **Arquitetura é decidir o que será difícil de mudar.** Toda arquitetura facilita certas mudanças e dificulta outras; nenhuma facilita todas. O trabalho é prever quais mudanças *este* sistema sofrerá e baratear essas.
2. **Fronteiras valem pelo que escondem** (Parnas). Um módulo bom encapsula uma decisão volátil (o banco escolhido, o gateway de pagamento, o algoritmo de precificação) de modo que ela mude sem que o resto saiba.
3. **Evolução guiada por dor real vence design antecipado especulativo** — exceto para decisões irreversíveis (schema, API pública, formato persistido), que merecem design antecipado porque errar nelas custa migração, não refatoração.

E uma regra de ouro operacional: **dependências apontam do volátil para o estável, da borda para o centro.** Regras de negócio no centro sem conhecer HTTP/banco/framework; infraestrutura na borda conhecendo o centro.

---

## 2. Modularização

**O que observo ao modularizar:**

- Fronteiras seguem o **domínio** (pedidos, pagamentos, catálogo), não a tecnologia (controllers/, services/, utils/ como topo da hierarquia). Estrutura técnica espalha cada feature por N pastas; estrutura de domínio deixa cada feature num lugar.
- Cada módulo expõe uma **interface pequena e explícita** (o index/façade/API pública) e esconde o resto. Se tudo é público, não há módulo — há pasta.
- **Acoplamento aferente/eferente como sinal:** módulo que todos importam deve ser estável e pequeno; módulo que importa todos é suspeito de ser um "deus".
- Ciclos de import são proibidos — são o sintoma de fronteira mal traçada; a correção é extrair o conceito compartilhado, não `import` tardio escondido.
- Regras de dependência viram **verificação automática** (lint de imports, module boundaries) — arquitetura não policiada por máquina degrada em semanas.

**Trade-off central:** granularidade. Módulos grandes demais viram monólitos internos; pequenos demais viram poeira com overhead de cerimônia. Heurística: um módulo = um conceito de domínio que uma pessoa consegue segurar na cabeça = tipicamente uma equipe pode ser dona dele.

---

## 3. Monólitos

**Default para quase todo projeto novo.** Monólito ≠ bagunça; o alvo é o **monólito modular**: um deploy, uma base, fronteiras internas rígidas de domínio.

**Quando usar:**
- Projeto novo, domínio ainda sendo descoberto (as fronteiras certas ainda não são conhecidas — e extrair um serviço na fronteira errada custa caríssimo).
- Um time, ou poucos, com deploy coordenável.
- Escala atendível verticalmente + réplicas (a grande maioria dos sistemas).

**Vantagens reais:** transações ACID locais (o problema mais difícil dos microsserviços simplesmente não existe), refatoração entre fronteiras barata (o compilador ajuda), depuração com um stack trace só, deploy e observabilidade simples.

**Quando evitar / sinais de saída:** times pisando uns nos outros em deploy; partes com perfis de escala radicalmente diferentes (o encoder de vídeo vs o CRUD); necessidade real de linguagens/runtime distintos; compliance exigindo isolamento.

**Trade-off:** o risco do monólito é interno — sem fronteiras policiadas, vira "big ball of mud" onde tudo toca tudo. O custo de manter as fronteiras internas é o preço de manter a opção de extrair serviços depois, nas fronteiras já validadas.

---

## 4. Microsserviços

**Nunca como ponto de partida; sempre como resposta a uma dor nomeável.**

**Quando usar (dores legítimas):**
- **Escala organizacional:** muitos times precisando de deploy/ciclo independentes — o motivo nº 1 legítimo; microsserviços são uma solução de *gente*, não de tecnologia.
- **Escala técnica assimétrica:** um componente precisa de 50 instâncias, o resto de 2.
- **Isolamento de falha/compliance:** o subsistema X não pode derrubar/ver o Y.

**Quando evitar:**
- Time pequeno ("microsserviços de um time só" = pagar o custo distribuído sem colher o benefício organizacional).
- Domínio imaturo (fronteiras vão mudar; mover fronteira entre serviços = migração de dados + versionamento de API + deploy coordenado — exatamente o que se queria evitar).
- Como resposta a "o monólito está bagunçado" (a bagunça distribuída é a mesma bagunça, com rede no meio: o monólito distribuído).

**O preço, sempre cobrado:** transações viram sagas/consistência eventual; depuração vira tracing distribuído; testes de integração viram orquestração; todo call site ganha timeout/retry/circuit breaker; versionamento de contratos entre serviços; infraestrutura de observabilidade obrigatória. **Fronteiras de serviço = fronteiras de domínio** (nunca "serviço de camada": frontend→"serviço de negócio"→"serviço de dados" é o pior dos mundos).

---

## 5. DDD

Uso DDD como **caixa de ferramentas, não religião** — a parte estratégica quase sempre paga; a tática, só em domínios ricos.

**Sempre pagam (uso por padrão em qualquer sistema de negócio):**
- **Linguagem ubíqua:** o código usa os nomes que o negócio usa ("apólice", "sinistro" — não "record", "item"). Renomear código para alinhar com o negócio é refatoração de alto retorno.
- **Bounded contexts:** o mesmo termo ("cliente") significa coisas diferentes em contextos diferentes (faturamento vs suporte) — modelar cada contexto separadamente, com tradução explícita nas fronteiras, evita o "modelo único corporativo" que não serve a ninguém.
- **Mapa de contextos** como base para fronteiras de módulos/serviços.

**Pagam em domínios ricos (lógica de negócio densa, invariantes complexas):**
- **Agregados:** cluster de entidades com uma raiz que garante invariantes ("o pedido garante que a soma dos itens = total"); transação = um agregado.
- **Value objects:** dinheiro, CPF, período — imutáveis, autovalidados, com igualdade por valor. Baratos e excelentes; uso mesmo fora de DDD "completo".
- **Eventos de domínio** para desacoplar consequências ("PedidoPago" → estoque, e-mail, fiscal).

**Quando evitar:** CRUDs finos, sistemas de integração/pipeline sem regra de negócio densa — ali o cerimonial de agregados/repositórios/factories é peso morto sobre um `INSERT`.

---

## 6. Clean Architecture

O que adoto dela é o **núcleo**: regras de negócio no centro, independentes de framework/banco/UI; dependências apontando para dentro; a fronteira do centro definida por interfaces (ports) implementadas na borda (adapters).

**Quando aplicar com força:** domínio rico e longevo; requisito real de trocar infraestrutura (multi-banco, multi-gateway); necessidade de testar regras de negócio sem subir infraestrutura.

**Quando aliviar:** aplicações finas (CRUD, BFF, glue code) — quatro camadas para atravessar um `SELECT` é complexidade acidental. Ali: handler → serviço → banco, e pronto.

**Armadilhas que policio:**
- **Camada que só delega** (o "service" que chama o "manager" que chama o "repository", cada um com uma linha) — camada sem decisão é ruído; corto.
- **Abstração de banco vazando** (o "repository" que expõe `queryBuilder`) — se vaza, não abstrai; ou fecha, ou assume o acoplamento honestamente.
- **DTOs em cascata** (mapear o mesmo dado 4 vezes entre camadas idênticas) — mapeamento só onde os modelos realmente divergem.
- **Fidelidade ao diagrama acima da fidelidade ao problema** — a arquitetura serve ao sistema, não o contrário.

---

## 7. SOLID

Como aplico cada princípio, com a calibragem observável:

- **S — Responsabilidade única:** a versão útil: *uma razão para mudar por módulo*. Teste prático: descrever a classe/função sem usar "e". Exagero a evitar: fragmentação em 40 classes de um método.
- **O — Aberto/fechado:** útil em **pontos de extensão reais** (plugins, estratégias, handlers por tipo): adicionar caso novo sem editar o switch central. Inútil como dogma: em código interno, *editar* é mais simples que criar hierarquia para evitar edições.
- **L — Substituição de Liskov:** o subtipo honra o contrato do supertipo (não lança onde o pai não lançava, não fortalece pré-condições). Na prática: se um `instanceof`/`isinstance` aparece para tratar um subtipo diferente, a hierarquia está errada — prefiro composição.
- **I — Segregação de interfaces:** interfaces pequenas por consumidor; ninguém implementa 8 métodos para usar 1. Em linguagens estruturais (Go, TS), a interface é declarada por quem consome, do tamanho do consumo.
- **D — Inversão de dependência:** a essencial: código de alto nível depende de abstrações **nas fronteiras voláteis** (banco, APIs externas, relógio, random). A calibragem: inverto nas fronteiras; **não** crio interface para cada classe interna (interface com 1 implementação e 0 razão para uma 2ª = ruído).

---

## 8. DRY, KISS, YAGNI

Os três funcionam como sistema de forças, não isoladamente:

- **DRY — corretamente entendido:** não é "nunca repita texto"; é "**uma fonte de verdade por conhecimento**". Duplicar uma *regra de negócio* é bug futuro certo (elas divergem). Duplicar *estrutura de código* parecida é tolerável — e muitas vezes correto (a abstração forçada de coisas que só parecem iguais gera o switch de flags, a pior manutenção que existe). Regra operacional: abstraio na 3ª ocorrência, e só se for o mesmo *conceito*, não o mesmo texto.
- **KISS:** a solução mais simples que está **correta** (incluindo bordas) vence. Simples ≠ simplista: ignorar timezone não é KISS, é bug. O alvo é a menor quantidade de partes móveis que resolve o problema real inteiro.
- **YAGNI:** não construa para requisito hipotético. O "vamos deixar preparado para multi-tenant" sem tenant no roadmap custa agora e todos os dias. **Exceções conscientes ao YAGNI** — os "baratos agora, caríssimos depois": paginação, timestamps, idempotência de escritas com retry, IDs não sequenciais quando expostos, UTC. Esses eu faço antes da necessidade, porque adicioná-los depois é migração.

Conflitos se resolvem pela ordem: **correto > simples (KISS) > sem especulação (YAGNI) > sem duplicação de conceito (DRY)**.

---

## 9. Event-Driven Architecture

**Quando usar:**
- Consequências genuinamente desacopladas de uma ação: "pedido pago" dispara estoque, nota fiscal, e-mail, analytics — o pagamento não deve conhecer os quatro.
- Integração entre bounded contexts/serviços sem acoplamento temporal (o consumidor pode estar fora do ar).
- Picos absorvíveis: o produtor enfileira na sua velocidade, o consumidor drena na dele.

**Quando evitar:**
- Fluxos que são **realmente sequenciais e síncronos** (o usuário precisa do resultado): transformar requisição-resposta em evento+polling é complexidade pura.
- Como substituto de chamada de função dentro do mesmo módulo ("event-driven interno" para 3 funções = fluxo de controle ilegível).
- Quando o time não tem a observabilidade para operar (sem tracing, um fluxo por eventos é indepurável).

**Os custos, sempre cobrados:**
- **O fluxo desaparece do código:** ninguém mais lê "o que acontece quando um pedido é pago" num lugar só — exige documentação/tracing compensatórios.
- **Consistência eventual:** a UI pode ler o estado antigo logo após a escrita; o produto precisa aceitar isso *explicitamente*.
- **Entrega pelo menos uma vez:** todo consumidor DEVE ser idempotente (chave de idempotência/dedup); a mensagem VAI chegar duas vezes.
- **Ordem não garantida** entre partições/tópicos: ou particionar por chave de agregado, ou projetar para desordem.
- **Versionamento de eventos:** evento publicado é API pública — só evolução aditiva; consumidores toleram campos desconhecidos.
- Esquemas de compensação (saga) no lugar de rollback transacional.

---

## 10. Mensageria e filas

**Fila (ponto-a-ponto)** para distribuir trabalho: N workers competem, cada mensagem processada uma vez (nominalmente). **Tópico (pub/sub)** para notificar fatos: cada assinante recebe tudo. Confundir os dois é o erro de design nº 1 em mensageria.

**Regras que aplico a qualquer consumidor:**
1. **Idempotente** — sem exceção. Deduplicação por chave de mensagem quando o efeito não é naturalmente idempotente.
2. **Retry com backoff exponencial + jitter**, com limite; depois **dead-letter queue** — mensagem venenosa não pode travar a fila para sempre.
3. **DLQ monitorada com alerta** — DLQ sem alerta é lixeira silenciosa de dados de clientes.
4. **Ack só depois de persistir o efeito** (at-least-once honesto); ack antes = perda silenciosa na falha.
5. **Visibilidade:** profundidade da fila e idade da mensagem mais velha como métricas com alerta — fila crescendo é o primeiro sintoma de metade dos incidentes.
6. **Payload:** evento carrega fatos (IDs + dados do fato), não comandos gordos; consumidor busca o resto se precisar (senão o evento vira acoplamento serializado).
7. **Outbox pattern** quando a escrita no banco e a publicação do evento precisam ser atômicas — escrever e publicar em transações separadas SEM outbox = eventos fantasma ou perdidos.

---

## 11. Cache

**A pergunta antes de qualquer cache: "como e quando isto é invalidado?"** Sem resposta escrita, o cache é um bug agendado. Cache é otimização de leitura — **nunca fonte de verdade**.

**Quando usar:** leitura cara + repetida + tolerante a staleness limitada (a tríade completa; faltando uma perna, não).

**Decisões e trade-offs:**

| Decisão | Opções e heurística |
|---|---|
| Onde | Em processo (rápido, some no restart, não compartilhado) vs distribuído/Redis (compartilhado, +1 dependência de rede e falha) — em processo para dados pequenos e por instância; distribuído quando as instâncias precisam concordar |
| Estratégia | Cache-aside (lê→miss→busca→grava) é o default simples; write-through quando a consistência leitura-após-escrita importa |
| Invalidação | TTL **sempre** (a rede de segurança), + invalidação ativa nos caminhos de escrita quando staleness dói. TTL curto e honesto > invalidação "esperta" e furada |
| Chave | Inclui TODAS as dimensões da resposta: tenant, usuário, idioma, versão. Chave sem tenant = dados do cliente A servidos ao B (incidente de segurança, não de performance) |
| Estouro | Política de evicção explícita (LRU + tamanho máximo); cache sem teto é vazamento de memória |
| Falha | Cache fora do ar → sistema degrada (vai ao banco), nunca cai; e cuidado com **stampede** (mil misses simultâneos no mesmo item → single-flight/lock de recomputação) |

**Anti-padrão que policio:** cache tapando query ruim — primeiro indexa/corrige a query; cache é a segunda ferramenta, não a primeira.

---

## 12. APIs

(Complementa `WORKFLOW.md` §4.2.) O desenho de uma API é um **contrato público irreversível na prática** — recebe design antecipado de verdade.

- **Modele recursos e casos de uso reais**, não tabelas. A API espelha o domínio, não o schema.
- **Erros são metade do contrato:** formato de erro uniforme, com `code` estável para máquina e `message` para humano; códigos HTTP semânticos; erros de validação apontando o campo.
- **Compatibilidade como regra de vida:** mudanças aditivas apenas; campo novo opcional; nunca mudar tipo/semântica de campo existente; deprecação com prazo e telemetria de uso antes de remover.
- **Paginação, filtro e ordenação** definidos no dia 1 nas coleções (cursor > offset para dados grandes/mutáveis).
- **Idempotência** nas escritas expostas a retry (header de idempotency-key em criação de pagamento etc.).
- **Consistência interna:** mesmas convenções de nome, formato de data (ISO 8601, UTC), envelope, autenticação em toda a superfície — uma API inconsistente cobra imposto de cada cliente para sempre.
- REST para recursos CRUD-like públicos; RPC/comandos para operações que não são recursos ("recalcular rota"); GraphQL quando os consumidores têm necessidades de shape genuinamente diversas — e o custo (complexidade de servidor, N+1, cache) é aceito conscientemente.

---

## 13. Bancos de dados

**Relacional por default.** É a tecnologia mais madura, com o modelo mais flexível para perguntas ainda não conhecidas, transações reais e constraints. Alternativas entram por requisito específico: documento (agregados autocontidos, shape variável), KV (cache, sessão), busca (texto), série temporal, grafo — cada um **além** do relacional, raramente no lugar.

- **O schema é a decisão mais irreversível do projeto** — mais que a linguagem. Migrar dados de clientes é ordens de magnitude mais caro que refatorar código. Merece design real: normalizado por padrão, desnormalizado com medição e disciplina de sincronização.
- **Constraints no banco** (NOT NULL, UNIQUE, FK, CHECK): a aplicação valida para dar boa mensagem; o banco constrange para garantir a verdade. Duas camadas, de propósito — a aplicação terá bugs.
- **Toda mudança de schema:** migração versionada, com rollback pensado, compatível com o código anterior durante o deploy (**expand → migrate → contract**; nunca renomear coluna em um passo).
- **Índices pelos padrões de consulta reais** (`EXPLAIN` em tabela grande), lembrando o custo em escrita; índice composto na ordem seletividade/uso.
- **Transações curtas, sem I/O externo dentro delas** (chamada HTTP dentro de transação = lock segurado pela latência alheia).
- **N+1 é o inimigo público nº 1** — joins, `IN`, batch, dataloader.
- Dinheiro em inteiro-de-centavos/decimal, nunca float; datas em UTC; soft-delete e `created_at/updated_at` por padrão em tabelas de negócio (salvo LGPD/GDPR exigindo apagamento físico).

---

## 14. Autenticação

**Regra zero: não inventar.** Bibliotecas/protocolos maduros; minha criatividade não é bem-vinda neste domínio.

- **Senhas:** bcrypt/argon2 (custo calibrado), nunca MD5/SHA-N puro; mensagens de falha genéricas (não revelar se o e-mail existe); rate limit + lockout progressivo; reset por token de uso único com expiração curta.
- **Sessões (server-side) vs JWT:** sessões em cookie `HttpOnly; Secure; SameSite` são o default para web apps — revogáveis, simples, seguras. JWT quando há necessidade real de stateless multi-serviço — aceitando o custo: **revogação difícil** (mitigar com expiração curta + refresh token revogável armazenado), claims públicos (assinado ≠ criptografado), algoritmo fixado no servidor (nunca aceitar `alg` do token), segredo forte.
- **OAuth2/OIDC para delegação e SSO** ("entrar com Google", APIs de terceiros): usar biblioteca certificada, fluxo Authorization Code + PKCE para apps públicos; nunca implementar o fluxo "na mão"; `state` contra CSRF; validar `iss/aud/exp/nonce` do ID token.
- **Tokens de API:** com escopo e expiração; armazenados como hash (como senhas); prefixados para detecção em vazamentos (`sk_live_...`).
- MFA para operações sensíveis quando o produto justifica; re-autenticação antes de ações críticas (trocar e-mail/senha, deletar conta).
- **Invalidação:** logout, troca de senha e sinal de comprometimento invalidam sessões/refresh tokens existentes.

---

## 15. Autorização

O irmão negligenciado da autenticação — e a fonte do bug de segurança mais comum que encontro em revisão (IDOR).

- **Em toda requisição, dois checks:** autenticado? **autorizado para ESTE recurso?** O segundo é no objeto, não no papel: `WHERE id = ? AND tenant_id = ?` / `if doc.owner_id != user.id: 403`.
- **Modelos, do mais simples que atende:**
  - **Ownership** (o dono acessa o que é dele) — resolve a maioria dos SaaS pequenos; é o filtro por dono/tenant em TODA query.
  - **RBAC** (papéis → permissões) — quando há perfis distintos (admin, operador, leitor). Papéis carregam *permissões* nomeadas (`invoice:read`), e o código checa a permissão, não o papel (senão todo papel novo = caça ao `if role ==` no código inteiro).
  - **ABAC/policies** (atributos: dono, departamento, horário, valor) — quando RBAC explode em papéis combinatórios; motor de políticas centralizado.
- **Centralize a decisão** (função/middleware/serviço de policy): autorização espalhada em `if`s ad hoc é impossível de auditar. O ponto único também é onde se loga a decisão (auditoria).
- **Negar por padrão:** rota nova sem regra explícita = 403, não 200. A lista é de permissões, não de proibições.
- **No multi-tenant, o tenant é dimensão de TUDO:** query, cache, índice, log, fila. Um esquecimento = dados de um cliente no outro — o pior incidente possível.
- Front-end esconde botões (UX); servidor decide (segurança). Autorização client-side não existe.

---

## 16. Tabela-mestra de decisão

| Situação | Default | Muda quando |
|---|---|---|
| Projeto novo | Monólito modular + relacional | Dor nomeada e medida |
| Fronteiras de módulo | Por domínio | Nunca por camada técnica no topo |
| Extrair microsserviço | Não | Times/escala/isolamento com evidência, fronteira já estável |
| DDD tático (agregados etc.) | Não (só linguagem ubíqua + contexts) | Domínio rico em invariantes |
| Camadas Clean | 2–3 (handler→serviço→dados) | Domínio rico/longevo → ports & adapters no núcleo |
| Interface/abstração | Não criar | Fronteira volátil real (banco, terceiros, relógio) ou 3ª ocorrência do conceito |
| Eventos assíncronos | Não | Consequências desacopladas reais + idempotência + observabilidade prontas |
| Cache | Não | Leitura cara + repetida + staleness tolerável, com invalidação escrita |
| JWT | Sessão em cookie | Stateless multi-serviço necessário, com expiração curta + refresh revogável |
| Autorização | Ownership + negar por padrão | Perfis → RBAC por permissão; combinatório → policies |
| NoSQL | Postgres | Padrão de acesso específico comprovado (e geralmente: além, não no lugar) |
