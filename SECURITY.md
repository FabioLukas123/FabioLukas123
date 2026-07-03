# SECURITY.md — Metodologia de Segurança de um Agente de IA de Desenvolvimento

> Engenharia reversa do comportamento observável ao construir e revisar software com a lente de segurança. Contexto: **segurança defensiva** — proteger sistemas, dados e usuários. O núcleo do método: pensar como atacante para construir como defensor, e tratar segurança como propriedade do design, não como etapa final. Parte da série iniciada em `WORKFLOW.md`.

---

## Índice

1. [O processo de pensamento: antecipando vulnerabilidades](#1-o-processo-de-pensamento)
2. [OWASP Top 10 como mapa mental](#2-owasp-top-10)
3. [Injeções: SQL, Command, Path Traversal](#3-injeções)
4. [XSS, CSRF, SSRF](#4-xss-csrf-ssrf)
5. [Validação e sanitização](#5-validação-e-sanitização)
6. [Autenticação: senhas, sessões, JWT, OAuth](#6-autenticação)
7. [Autorização](#7-autorização)
8. [Rate limiting](#8-rate-limiting)
9. [Segredos](#9-segredos)
10. [Criptografia](#10-criptografia)
11. [Logs e auditoria](#11-logs-e-auditoria)
12. [Backups e recuperação](#12-backups)
13. [Checklist de segurança por mudança](#13-checklist-por-mudança)

---

## 1. O processo de pensamento

### 1.1 A pergunta permanente

Para cada linha que lê ou escreve dados, a pergunta não é *"o que o usuário vai enviar?"* — é *"o que um adversário competente **pode** enviar, e o que acontece quando enviar?"*. Essa troca de sujeito é o mecanismo mental que antecipa vulnerabilidades antes de existirem: o usuário envia `nome@email.com`; o adversário envia `' OR 1=1--`, `../../etc/passwd`, `<script>`, um arquivo de 40GB, a mesma requisição 50 mil vezes, e o ID do recurso de outro cliente.

### 1.2 As cinco perguntas aplicadas a todo design/diff

1. **Fluxo de dados:** por onde entra dado externo? (parâmetros, corpo, headers, cookies, uploads, webhooks, dados de terceiros, mensagens de fila — *tudo* que não nasceu neste processo é externo). Cada ponto de entrada é validado?
2. **Fluxo de confiança:** onde este código *assume* algo sobre quem chama ou sobre o dado? Cada assunção é verificada ou apenas esperada?
3. **Superfície nova:** este diff cria endpoint, parâmetro, upload, integração, dependência? Cada adição é superfície de ataque que precisa das mesmas defesas dos existentes.
4. **Raio de explosão:** se ESTA peça for comprometida, o que o atacante alcança? (Menor privilégio existe para essa resposta ser "pouco".)
5. **Detecção:** se alguém explorar isto hoje, como saberíamos? (Log, alerta, auditoria — a falha silenciosa é a que dura meses.)

### 1.3 Princípios operacionais

- **Defesa em profundidade:** validação na borda E constraint no banco E autorização no serviço E escape na saída. Redundância proposital — uma camada vai falhar.
- **Negar por padrão:** rota sem regra = 403; campo não listado = rejeitado; destino não permitido = bloqueado. Listas são de permissão, não de proibição.
- **Menor privilégio:** cada credencial/token/processo com o mínimo que sua função exige.
- **Falha segura:** erro no check de autorização = negar, nunca "deixar passar e logar".
- **Não inventar primitivas:** criptografia, hashing de senha, tokens, comparação constante — sempre bibliotecas maduras.
- **Assimetria assumida:** o defensor precisa acertar sempre, o atacante uma vez. Por isso vulnerabilidade conhecida não é dívida técnica — é incidente agendado.

---

## 2. OWASP Top 10

Uso o OWASP Top 10 como **mapa mental de revisão** — não como lista para decorar, mas como as dez perguntas que faço a qualquer sistema:

| # | Categoria | A pergunta que faço |
|---|---|---|
| A01 | Broken Access Control | Cada recurso verifica se ESTE usuário pode acessá-LO? (a nº 1 em frequência real — ver §7) |
| A02 | Cryptographic Failures | Dados sensíveis criptografados em trânsito E em repouso? Algoritmos atuais? (§10) |
| A03 | Injection | Algum dado externo é interpolado em código/query/comando/HTML? (§3, §4) |
| A04 | Insecure Design | O design tem os controles ou eles foram "deixados para depois"? Fluxos de abuso modelados? |
| A05 | Security Misconfiguration | Defaults perigosos? Debug ligado em prod? CORS `*`? Headers ausentes? Portas/consoles expostos? |
| A06 | Vulnerable Components | Dependências auditadas e atualizadas? (`npm audit`/`pip-audit`/dependabot) Lockfile commitado? |
| A07 | Auth Failures | Senhas, sessões, tokens conforme §6? Rate limit no login? (§8) |
| A08 | Integrity Failures | Deserialização de dado não confiável? Pipeline de CI/CD e updates verificados? Webhooks com assinatura validada? |
| A09 | Logging Failures | Eventos de segurança logados e alertáveis? Sem dados sensíveis no log? (§11) |
| A10 | SSRF | Alguma URL controlada por usuário é buscada pelo servidor? (§4.3) |

---

## 3. Injeções

A família inteira tem uma única causa: **dado externo tratado como código**. E uma única cura estrutural: **manter dado e código separados por construção** — nunca por "limpeza" do dado.

### 3.1 SQL Injection

- **Regra absoluta: parâmetros/prepared statements. Zero concatenação. Zero exceções.**
- Os cantos onde ela volta mesmo "usando ORM": `ORDER BY`/`LIMIT` dinâmicos concatenados, nome de coluna/tabela vindo do request (→ allowlist de valores permitidos, nunca o valor do usuário), `raw()`/`WHERE` string do ORM, busca full-text montada na mão.
- Revisão: grep por concatenação perto de SQL (`+`, template strings, `format`, `f"`) é a verificação de 30 segundos que sempre faço.

### 3.2 Command Injection

- **Nunca montar shell com entrada externa.** Exec com **array de argumentos** (`execFile(cmd, [args])`, `subprocess.run([...], shell=False)`) — sem shell no meio, não há metacaracteres para explorar.
- Se o shell for inevitável (raro): allowlist estrita do que pode aparecer, nunca blocklist de caracteres "perigosos" (sempre escapa um).
- Atenção aos indiretos: nome de arquivo do upload usado em comando, variável de ambiente propagada, argumentos que começam com `-` (injeção de flag — usar `--` separador).

### 3.3 Path Traversal

- Todo caminho derivado de entrada externa: **resolver/normalizar primeiro, depois verificar que o resultado está DENTRO do diretório base** (`path.resolve` + verificação de prefixo; não "remover `../` da string" — encoding e truques vencem filtros de string).
- Uploads: gerar o nome do arquivo no servidor (UUID), nunca usar o nome enviado; validar tipo pelo conteúdo (magic bytes), não pela extensão; limitar tamanho; armazenar fora da raiz servida.
- O mesmo raciocínio para IDs que viram caminho, chaves de bucket S3, entradas de zip (zip slip).

---

## 4. XSS, CSRF, SSRF

### 4.1 XSS

- **Modelo mental:** todo dado que sai para HTML é hostil — inclusive o que "nós mesmos" gravamos (stored XSS chega pelo banco).
- **Defesas em camadas:** (1) escape automático do framework/template — a defesa primária; **os pontos de fuga são o alvo da revisão**: `dangerouslySetInnerHTML`, `v-html`, `innerHTML`, `document.write`, template string em HTML; (2) escape **por contexto** (HTML ≠ atributo ≠ URL ≠ JS inline — cada um com regras próprias; URLs `javascript:` em `href` passam pelo escape de HTML!); (3) **CSP** como rede de segurança; (4) sanitização de HTML rico com biblioteca dedicada (DOMPurify) e allowlist de tags — nunca regex própria.
- Cookies de sessão `HttpOnly` — XSS que não rouba sessão causa muito menos dano.

### 4.2 CSRF

- **Modelo mental:** o browser da vítima envia os cookies dela automaticamente; um site malicioso pode disparar requisições autenticadas "em nome" dela.
- Defesas: `SameSite=Lax/Strict` no cookie de sessão (o default moderno que resolve a maior parte) + token anti-CSRF nas mutações para o que sobra; **nunca mutação via GET**.
- APIs autenticadas por header (Bearer) são imunes por construção — mas só se NÃO aceitarem também cookie como fallback.
- Validar `Content-Type`/origem em endpoints sensíveis; webhooks têm o problema análogo → assinatura (HMAC) verificada.

### 4.3 SSRF

- **Modelo mental:** "baixe esta URL para mim" transforma meu servidor no proxy do atacante — mirando `localhost`, metadata de cloud (`169.254.169.254`), serviços internos sem auth.
- Defesas: **allowlist de destinos** (domínios/IPs permitidos — a única defesa forte); resolver DNS e validar o IP final contra faixas privadas (e revalidar em redirects — o redirect para dentro é o bypass clássico); bloquear schemes não-http(s) (`file://`, `gopher://`); timeout e limite de tamanho na busca; egress do serviço restrito por rede quando possível.
- Onde ela se esconde: preview de link, importação por URL, webhook configurável, conversor de imagem/PDF que aceita URL, integração "traga seu endpoint".

---

## 5. Validação e sanitização

### 5.1 Os conceitos, distintos

- **Validação** = rejeitar o que não conforma ("isto não é um e-mail → 400"). É a defesa primária.
- **Sanitização** = transformar para tornar seguro (escapar HTML, normalizar unicode). É complementar, contextual à *saída*.
- Ordem: **valide na entrada, escape na saída.** Sanitizar na entrada "para todos os contextos" de uma vez é o erro clássico (corrompe dados e sempre esquece um contexto).

### 5.2 Como valido

- **Schema declarativo na borda** (zod, pydantic, JSON Schema): tipos, tamanhos, formatos, faixas, enums — e **campos desconhecidos rejeitados** em contextos sensíveis (mass assignment: o `isAdmin: true` extra no JSON).
- **Allowlist sobre blocklist, sempre:** definir o que É válido, não enumerar o que é perigoso (a blocklist sempre perde para encoding, unicode e criatividade).
- **Validar o significado, não só o formato:** o ID existe? pertence a este tenant? o estado permite esta transição? a data está numa faixa sensata? o valor é positivo?
- **Limites em tudo:** tamanho de string, itens de array, profundidade de JSON, tamanho de upload, timeout de parse — a entrada sem limite é DoS gratuito.
- **No servidor, sempre:** validação de frontend é UX; a que conta é a que o atacante não controla.

---

## 6. Autenticação

(Design completo em `ARCHITECTURE.md` §14; aqui, a lente de ataque.)

### 6.1 Senhas
- **bcrypt/argon2** com custo calibrado; nunca MD5/SHA-N puro, nunca reversível, **nunca em texto claro — nem no log de "debug"**.
- Comparação de tokens/hashes em **tempo constante** (timing attack).
- Falha de login genérica ("credenciais inválidas") — não confirmar existência de e-mail (enumeração); atenção ao mesmo vazamento no fluxo de **reset** ("enviamos se existir") e no de **cadastro**.
- Reset: token de uso único, curto, hasheado no banco, invalidado no uso e na troca de senha.

### 6.2 Sessões
- Cookie `HttpOnly; Secure; SameSite`; ID de sessão aleatório-criptográfico; **regenerar no login** (session fixation).
- Expiração (absoluta + inatividade); invalidação server-side no logout, troca de senha e sinal de comprometimento.

### 6.3 JWT — os erros que procuro em revisão
- `alg` aceito do token (o clássico `none`/confusão RS→HS) → algoritmo **fixado no servidor**.
- Sem verificação de `exp`/`aud`/`iss`; segredo fraco/compartilhado entre serviços com poderes distintos.
- Dados sensíveis no payload (assinado ≠ criptografado — payload é público).
- Sem estratégia de revogação → expiração curta + refresh token revogável armazenado (hasheado).

### 6.4 OAuth/OIDC — os erros que procuro
- Fluxo implementado "na mão" (→ biblioteca certificada); Authorization Code **com PKCE** para clients públicos.
- `state` ausente (CSRF do fluxo); `redirect_uri` não restrito (open redirect que rouba códigos); ID token sem validação de `iss/aud/nonce`.
- Confiar no e-mail do provedor sem verificar `email_verified` (account takeover por e-mail não verificado).

---

## 7. Autorização

A vulnerabilidade **mais comum na prática** (IDOR/Broken Access Control) e a mais bem escondida — o código funciona perfeitamente para o usuário honesto.

- **O teste mental para cada endpoint:** "logado como o usuário A, troco o ID da URL/payload pelo recurso do usuário B — o que acontece?" A resposta certa é 403/404 vinda de **filtro no dado** (`WHERE id = ? AND tenant_id = ?`), não de esconder o botão.
- **Verificar no objeto, não no papel:** "é admin?" não basta — "é admin DESTE tenant? dono DESTE recurso?".
- **Toda rota de coleção e de item**, incluindo as esquecidas: exports, relatórios, buscas, endpoints "internos", GraphQL resolvers, webhooks de status, URLs de download (assinadas e com expiração, não "secretas").
- **Mass assignment de privilégio:** o PATCH que aceita `role`/`tenant_id`/`owner_id` do payload → campos de privilégio nunca vêm do cliente.
- **Negar por padrão + ponto central de decisão** (middleware/policy) — autorização espalhada em `if`s é inauditável; o ponto central também loga (auditoria, §11).
- **Autorização de segunda ordem:** o job/fila que processa "em nome de" — carrega e verifica o contexto do usuário original, ou roda com poderes de sistema sobre dados de todos? (Vazamento clássico em relatórios assíncronos.)

---

## 8. Rate limiting

- **Onde é obrigatório:** login e todo fluxo de credencial (força bruta), reset de senha e envio de e-mail/SMS (bombardeio + custo), cadastro (contas em massa), endpoints caros (busca, export, geração), APIs públicas (cota por chave).
- **Dimensões de limite:** por IP (grosseiro, contornável, ainda útil), por conta/chave (o que protege contas), por recurso-alvo (tentativas sobre UM e-mail vindas de MIL IPs — credential stuffing), global (proteção de capacidade).
- **Algoritmos:** token bucket/sliding window (permite burst legítimo, trava sustentado); resposta `429` com `Retry-After`; para login, backoff progressivo + desafio antes de lockout duro (lockout puro vira DoS contra a vítima).
- **Implementação:** estado compartilhado (Redis) quando há múltiplas instâncias — rate limit por instância atrás de um LB é rate limit dividido por N.
- **Sinal, não só escudo:** picos de 429 são telemetria de ataque → alertar, não só bloquear.

---

## 9. Segredos

- **Nunca em:** código, repositório, log, mensagem de erro, resposta de API, ticket, frontend (tudo que chega ao browser é público — chave "escondida" em bundle JS não existe).
- **Onde:** secret manager / variáveis de ambiente injetadas; validadas no boot (falha rápida e clara se ausentes).
- **Vazou = comprometido.** Segredo commitado (mesmo removido no commit seguinte — o histórico é público): **rotacionar imediatamente**, não "apagar". `git filter-repo` limpa a história, mas a rotação é o que resolve.
- **Higiene contínua:** `.gitignore` para `.env` e afins; scanner de segredos no CI (gitleaks/trufflehog); prefixos identificáveis nos tokens próprios (`sk_live_`) para os scanners os acharem; rotação periódica dos críticos.
- **Menor privilégio + segregação:** cada serviço/ambiente com suas credenciais; a chave de staging não abre produção; a de leitura não escreve.

---

## 10. Criptografia

Postura única: **usar primitivas maduras via bibliotecas de alto nível; desenhar apenas O QUE proteger, nunca COMO cifrar.**

- **Em trânsito:** TLS em tudo (interno inclusive); certificados válidos e verificados — **nunca** desligar verificação "para funcionar" (o `verify=False` que vai para produção).
- **Em repouso:** criptografia de disco/banco gerenciada como base; criptografia de campo (application-level) para os dados mais sensíveis, com chaves em KMS.
- **Escolhas padrão (e ponto):** AES-GCM/ChaCha20-Poly1305 (autenticada — cifrar sem autenticar é vulnerável a manipulação) para simétrica; chaves de KMS/secret manager com rotação; random **criptográfico** (`secrets`, `crypto.randomBytes`) para tokens — nunca `Math.random()`/`random` comum.
- **Hash ≠ criptografia ≠ encoding:** senha → hash lento e com salt (argon2/bcrypt); integridade → SHA-256/HMAC; **base64 não é segurança** — é formatação.
- **Erros que procuro em revisão:** IV/nonce reutilizado, chave hardcoded, hash rápido para senha, HMAC comparado com `==` comum, JWT `alg` flexível, TLS desligado em cliente HTTP interno.

---

## 11. Logs e auditoria

### 11.1 Logs (diagnóstico) — a lente de segurança
- **Nunca logar:** senhas (nem erradas — o típo no login loga a senha quase certa de alguém), tokens/sessões/chaves, cartões/documentos, corpo bruto de requests com dados pessoais. Redação/mascaramento na biblioteca de log, não na disciplina de cada dev.
- **Sempre logar (eventos de segurança):** logins (sucesso E falha), resets, mudanças de permissão/papel, acessos negados (403 em série = alguém procurando), mudanças de configuração sensível, uso de credenciais de alto privilégio.
- **Injeção de log:** entrada externa com quebras de linha forjando registros → escapar/estruturar (JSON resolve).

### 11.2 Auditoria (responsabilização) — diferente de log
- Trilha de **quem fez o quê em quê e quando** para ações de negócio sensíveis: imutável (append-only), com ator, ação, alvo, timestamp, origem.
- Auditoria responde à investigação ("quem alterou o limite deste cliente?"); log responde ao diagnóstico. Sistemas com dados sensíveis precisam das duas.
- **Alertas sobre os sinais:** rajada de falhas de login, 403s em sequência, download em massa, login de origem anômala — o log que ninguém lê não detecta nada; detecção média sem alerta = meses de exploração silenciosa.

---

## 12. Backups

Backup é segurança: é a defesa final contra ransomware, deleção maliciosa, bug destrutivo e erro operacional.

- **Regra 3-2-1** como referência: 3 cópias, 2 mídias, 1 fora do site — hoje: réplica + snapshot automatizado + cópia em **outra conta/região com acesso segregado** (o atacante que domina a conta principal não pode apagar os backups — backup deletável pela mesma credencial comprometida não é backup, é cache).
- **Backup não testado não existe.** Restauração ensaiada periodicamente (o drill), com tempo medido (RTO real) e perda máxima conhecida (RPO): "backup diário" = "até 24h de dados perdidos" — o negócio sabe e aceitou?
- **Criptografados** (contêm os mesmos dados sensíveis do banco, com menos vigilância) e **com retenção definida** (LGPD/GDPR: o dado apagado a pedido do titular não pode ressuscitar do backup sem processo para isso).
- **Escopo completo:** banco E uploads E configuração E segredos (a restauração precisa de tudo para funcionar de verdade).

---

## 13. Checklist por mudança

Aplicado a todo diff, proporcional à superfície tocada:

### Toda mudança
- [ ] Dado externo novo? → validado com schema, com limites, allowlist sobre blocklist.
- [ ] Interpolação nova perto de SQL/shell/HTML/caminho? → parametrizado/array/escape/confinado.
- [ ] Segredo novo? → env/secret manager; nada no código/log; validado no boot.
- [ ] Dependência nova? → nome exato, mantida, auditada, necessária.
- [ ] Erro novo ao cliente? → sem stack/SQL/caminhos/versões.

### Mudanças em endpoints/rotas
- [ ] Autenticação exigida (ou anonimato intencional e declarado)?
- [ ] **Autorização no recurso específico** (dono/tenant no filtro)?
- [ ] Teste mental do IDOR: usuário A com ID do recurso de B → 403/404?
- [ ] Campos de privilégio (`role`, `owner_id`) impossíveis de setar via payload?
- [ ] Rate limit se o endpoint é de credencial ou caro?
- [ ] Mutação via POST/PUT/DELETE (nunca GET) + proteção CSRF do padrão do projeto?

### Mudanças em autenticação/sessão/token
- [ ] Hash de senha correto; comparações em tempo constante; mensagens genéricas?
- [ ] Sessão regenerada no login; invalidação em logout/troca de senha?
- [ ] JWT: alg fixo, exp/aud/iss verificados, nada sensível no payload, revogação pensada?

### Mudanças com upload/arquivo/URL externa
- [ ] Nome gerado no servidor; tipo por conteúdo; tamanho limitado?
- [ ] Caminho resolvido e confinado ao diretório base?
- [ ] URL de usuário: allowlist de destino, IP privado bloqueado, redirect revalidado?

### Mudanças em dados sensíveis
- [ ] Classificado (pessoal? financeiro? credencial?) e protegido de acordo (criptografia, mascaramento em log, auditoria de acesso)?
- [ ] Aparece em backup/exportação/analytics? Com o mesmo nível de proteção?
