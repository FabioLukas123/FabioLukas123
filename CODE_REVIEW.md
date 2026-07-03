# CODE_REVIEW.md — Processo Completo de Revisão de Código de um Agente de IA

> Engenharia reversa do comportamento observável durante revisões de código: o que é procurado, em que ordem, com que critérios, e como os achados são reportados. Aplica-se tanto à revisão de código alheio (PRs) quanto à auto-revisão obrigatória antes de qualquer entrega. Parte da série iniciada em `WORKFLOW.md`.

---

## Índice

1. [Princípios da revisão](#1-princípios-da-revisão)
2. [Preparação: entender antes de julgar](#2-preparação-entender-antes-de-julgar)
3. [Os nove passes de revisão](#3-os-nove-passes-de-revisão)
   - [Passe 1 — Intenção vs realização](#31-passe-1--intenção-vs-realização)
   - [Passe 2 — Bugs](#32-passe-2--bugs)
   - [Passe 3 — Edge cases](#33-passe-3--edge-cases)
   - [Passe 4 — Segurança](#34-passe-4--segurança)
   - [Passe 5 — Performance](#35-passe-5--performance)
   - [Passe 6 — Arquitetura](#36-passe-6--arquitetura)
   - [Passe 7 — Clean code e duplicação](#37-passe-7--clean-code-e-duplicação)
   - [Passe 8 — Testabilidade e testes](#38-passe-8--testabilidade-e-testes)
   - [Passe 9 — Manutenção futura](#39-passe-9--manutenção-futura)
4. [Verificação dos achados](#4-verificação-dos-achados)
5. [Como reportar](#5-como-reportar)
6. [Auto-revisão antes de entregar](#6-auto-revisão-antes-de-entregar)
7. [Tabela-resumo de severidades](#7-tabela-resumo-de-severidades)

---

## 1. Princípios da revisão

1. **Revisa-se o código, nunca o autor.** Todo achado vem com justificativa técnica e, quando possível, sugestão concreta de correção.
2. **Severidade ordena tudo.** Um risco de corrupção de dados vale mais que dez opiniões de estilo. Reporto na ordem: correção → segurança → dados → performance com impacto real → manutenção → estilo.
3. **Achado sem cenário não é achado.** Cada problema reportado precisa de um cenário concreto de falha: "com entrada X, no estado Y, o código faz Z errado". Se não consigo construir o cenário, ou verifico até conseguir, ou marco explicitamente como especulativo.
4. **Não reporto o que a máquina resolve.** Formatação, imports ordenados, ponto-e-vírgula — se um formatador/linter resolve, não gasto atenção humana com isso; no máximo sugiro ativar a ferramenta.
5. **A ausência também se revisa.** Os melhores achados costumam ser o que **falta**: o caso de erro não tratado, o teste não escrito, a invalidação de cache não pensada, a migração sem rollback.
6. **Elogio o que merece.** Registrar o que está bem feito calibra o autor e mostra que a revisão foi de verdade — mas sem inflar: um elogio genérico vale zero.

---

## 2. Preparação: entender antes de julgar

Nunca começo pela primeira linha do diff. Antes:

1. **Leio a descrição/issue/commit message** — qual era a intenção? Sem isso, só posso revisar sintaxe.
2. **Entendo o contexto do código tocado** — abro os arquivos alterados inteiros (não só os hunks), e os principais chamadores/chamados. Um diff de 5 linhas pode quebrar um contrato usado em 50 lugares.
3. **Mapeio a superfície da mudança:** toca contrato público? dados persistidos? caminho quente? entrada de usuário? autenticação? Cada "sim" liga um passe extra de atenção.
4. **Rodo o que der:** testes da área, build, lint. O computador encontra de graça o que eu encontraria caro.
5. **Formo a expectativa:** "para realizar essa intenção, eu esperaria mudanças em A, B e C". Divergências entre expectativa e diff são as primeiras pistas — tanto de solução mais esperta que a minha quanto de omissão.

---

## 3. Os nove passes de revisão

Cada passe percorre o diff com uma lente única. Na prática os passes se sobrepõem, mas a disciplina de listar cada lente garante que nenhuma seja esquecida.

### 3.1 Passe 1 — Intenção vs realização

**Pergunta-guia: o diff faz o que diz que faz? E só isso?**

- A mudança realiza a intenção declarada, por inteiro? (Feature pela metade, bug corrigido só num dos caminhos.)
- Há mudanças **além** da intenção? (Refactor de carona, dependência atualizada "junto", comportamento alterado silenciosamente.)
- O que **deveria** ter mudado e não mudou? (A doc do endpoint, o segundo lugar que valida a mesma regra, a migração do dado existente.)
- Os nomes/mensagens/textos refletem o comportamento novo?

Este é o passe que encontra o bug mais grave de todos: *a mudança que não faz o que sua descrição promete.*

### 3.2 Passe 2 — Bugs

**Pergunta-guia: execute mentalmente — onde isso quebra?**

Para cada função alterada, execução mental com entradas: típica, vazia, nula, limite, duplicada, malformada. Procuro especificamente:

- **Off-by-one:** índices, slices, `<` vs `<=`, paginação (a última página, a página vazia).
- **Condições invertidas ou incompletas:** o `else` implícito, o caso em que o loop roda zero vezes, curto-circuito com efeito colateral.
- **Nulos e opcionais:** cada `.` encadeado num valor que pode ser nulo; a diferença entre "campo ausente" e "campo nulo" e "string vazia".
- **Tipos e coerção:** `==` vs `===`, string `"0"` truthy, parse silencioso (`parseInt("12px")` → 12), timezone em datas, float para dinheiro.
- **Assincronia:** promise sem `await`, erro de promise órfão, `forEach(async...)` que não espera, `await` em loop que devia ser paralelo, raça entre duas escritas.
- **Estado e mutação:** objeto compartilhado mutado, cache que retém referência mutável, ordem de inicialização.
- **Fluxo de erro:** quem lança vs quem captura; recurso aberto liberado no caminho de erro? transação com rollback em todos os caminhos?
- **Limites de sistema:** o retry sem limite, a recursão sem caso base garantido, o buffer que cresce sem teto.

### 3.3 Passe 3 — Edge cases

**Pergunta-guia: aplique a lista de disparo a cada entrada e estado.**

Lista de disparo mental (memorizável e aplicada mecanicamente):

| Dimensão | Casos a testar mentalmente |
|---|---|
| Quantidade | vazio, um, dois, muitos, máximo, além do máximo |
| Valor | zero, negativo, limite do tipo, NaN, Infinity, precisão de float |
| Texto | vazio, whitespace, unicode/emoji/acentos, RTL, muito longo, caracteres de controle, aparência de código (`<script>`, `'; DROP`) |
| Tempo | timezone, horário de verão, 29/02, meia-noite, relógio que anda para trás, expiração exata |
| Ordem | desordenado, duplicado, o mesmo item duas vezes na mesma requisição |
| Concorrência | duas requisições idênticas simultâneas, retry duplicando efeito, leitura durante escrita |
| Falha parcial | passo 2 de 3 falhou — estado fica consistente? dá para reexecutar? |
| Identidade | o usuário A acessando o recurso do usuário B; o admin vs o comum |
| Ambiente | variável ausente, dependência fora do ar, disco cheio, resposta lenta |

### 3.4 Passe 4 — Segurança

**Pergunta-guia: o que um adversário competente faz com este diff?**

Checklist aplicado a todo diff que toca entrada, dados, autenticação ou I/O:

- [ ] Toda entrada externa validada com schema **no servidor**?
- [ ] Queries 100% parametrizadas (zero concatenação, inclusive em `ORDER BY`/`LIMIT` dinâmicos)?
- [ ] Saída escapada no contexto certo (HTML, atributo, URL, shell, SQL, header)?
- [ ] **Autorização no recurso específico** (dono/tenant no filtro), não só autenticação? — IDOR é o achado nº 1 em frequência.
- [ ] Nenhum segredo em código, log, mensagem de erro, resposta, commit?
- [ ] Caminhos de arquivo normalizados e confinados? Upload com validação de tipo/tamanho no servidor?
- [ ] Comando externo sem interpolação (exec com array de args)?
- [ ] URL fornecida por usuário restrita por allowlist antes de o servidor buscá-la (SSRF)?
- [ ] Erros ao cliente sem stack trace, SQL, caminhos, versões?
- [ ] Dependência nova: nome exato, mantida, necessária?
- [ ] Rate limit nos endpoints sensíveis novos (login, reset, busca cara)?
- [ ] Dados sensíveis com hashing/criptografia padrão (bcrypt/argon2; nunca MD5/SHA1 para senha)?

(Metodologia completa em `SECURITY.md`.)

### 3.5 Passe 5 — Performance

**Pergunta-guia: o que acontece quando N cresce? Calibrado pela temperatura do código.**

- **N+1**: query/chamada de rede dentro de loop — o achado de performance mais comum e mais impactante.
- **O(n²) escondido:** `includes`/`indexOf`/`in` dentro de loop sobre a mesma coleção (→ Set/Map); sort dentro de loop.
- **Carregar para descartar:** buscar a tabela inteira para filtrar/contar em memória; `SELECT *` quando 2 campos bastam.
- **I/O sequencial paralelizável** (e o inverso: paralelismo quebrando dependência de ordem).
- **Falta de paginação** em listagem nova; payload sem limite.
- **Trabalho repetido:** recomputação por chamada do que é constante; conexão/cliente recriado por requisição; parse repetido.
- **Índice:** o novo padrão de consulta tem índice? (Se a tabela é grande, peço o `EXPLAIN`.)
- **Frontend:** re-render em cascata, objeto/closure novo por render passado como prop, imagem sem dimensão, bundle inflado por import total de biblioteca.

**Calibragem:** exijo rigor no caminho quente; não peço micro-otimização em código de boot/configuração. Performance sem cenário de dano ("com 10k itens isto faz 10k queries") não vira achado — vira nota.

### 3.6 Passe 6 — Arquitetura

**Pergunta-guia: esta mudança deixa o sistema mais fácil ou mais difícil de mudar?**

- **Camada certa?** Regra de negócio em handler HTTP, SQL em componente de UI, formatação de apresentação no domínio — vazamentos de camada.
- **Direção de dependência:** domínio importando infraestrutura? módulo estável dependendo de volátil? ciclo de imports novo?
- **Acoplamento novo:** dois módulos antes independentes agora amarrados? O acoplamento é do domínio (ok) ou acidental (problema)?
- **Duplicação de conceito:** a mudança cria a segunda fonte de verdade para uma regra que já existe com outro nome? (segunda função de formatar dinheiro, segundo client HTTP com config divergente)
- **Contrato público:** a mudança quebra consumidores? Era para ser aditiva e não é?
- **Abstração especulativa:** interface nova com uma implementação, parâmetro que nenhum chamador usa, generalidade sem segundo caso de uso.
- **Consistência arquitetural:** o projeto resolve esse tipo de problema de um jeito estabelecido — a mudança inventa um segundo jeito sem justificar?

### 3.7 Passe 7 — Clean code e duplicação

**Pergunta-guia: o leitor de daqui a um ano entende e confia?**

- **Nomes dizem a verdade?** Função que faz mais do que o nome promete (o `getUser` que cria), variável cujo nome mente sobre o tipo/conteúdo.
- **Tamanho e foco:** função com responsabilidade nomeável sem "e"; aninhamento raso (early return); um nível de abstração por função.
- **Números e strings mágicos** nomeados.
- **Comentários:** explicam porquês que o código não expressa? Ou são ruído ("// incrementa i"), ou pior, mentira desatualizada?
- **Duplicação:** de **conceito** (mesma regra em dois lugares → achado sério: elas vão divergir) vs de **texto** (tolerável até a 3ª ocorrência). Também o inverso: abstração forçada unindo coisas que só parecem iguais.
- **Código morto:** branch inalcançável, parâmetro ignorado, feature flag de 2019.
- **Consistência local:** o diff parece escrito pela mesma mão que o resto do arquivo?

### 3.8 Passe 8 — Testabilidade e testes

**Pergunta-guia: os testes desta mudança falhariam se ela regredisse?**

- A mudança **vem com testes**? Se não, por quê? (Correção de bug sem teste de regressão é achado, não detalhe.)
- Os testes testam **comportamento** (entrada→saída/efeito observável) ou implementação (métodos internos, contagem de chamadas)? Teste de implementação quebra em refactor e não pega bug.
- **O teste pode falhar?** Asserção fraca (`expect(result).toBeDefined()`), teste sem asserção, teste que passa com o bug presente — lastro, não proteção.
- Cobrem os **casos de borda** da mudança, ou só o caminho feliz?
- **Determinismo:** dependem de relógio real, rede pública, ordem de execução, dados de outro teste?
- **Mocks:** apenas nas fronteiras não controladas? Mockar o próprio domínio = testar o mock.
- **Testabilidade do código:** se testá-lo é difícil (construtor faz I/O, singleton global, tempo/random embutidos), isso é um achado de design — o código está pedindo injeção da dependência.

### 3.9 Passe 9 — Manutenção futura

**Pergunta-guia: que armadilha isto planta para daqui a um ano?**

- Quando esta regra mudar, quantos lugares mudam juntos? (Resposta certa: um.)
- O erro em produção será diagnosticável pelo log que este código emite?
- Conhecimento implícito novo? ("precisa chamar X antes de Y", "esse campo nunca é nulo, confia") → deveria ser tipo, constraint ou teste.
- Migração tem rollback? Feature tem como ser desligada se der errado?
- A doc/README/exemplo que menciona o comportamento alterado foi atualizada **neste diff**?
- Dependência nova adiciona superfície de manutenção proporcional ao ganho?
- TODO/FIXME novo tem dono e rastreio, ou é dívida silenciosa?

---

## 4. Verificação dos achados

Antes de reportar, cada achado passa por triagem — porque **um falso positivo custa a credibilidade dos verdadeiros**:

1. **Reconstruo o cenário concreto:** entradas + estado → caminho do código → resultado errado. Se não fecho o caminho, releio o código: metade dos "achados" morre aqui (havia uma guarda que eu não vi, o caso é impossível pelo tipo).
2. **Verifico contra o código real**, não contra minha memória da API (a função da lib pode se comportar diferente na versão instalada).
3. **Quando possível, executo:** um teste rápido que demonstra o bug é o achado perfeito — irrefutável e já meio corrigido.
4. **Classifico a confiança:** CONFIRMADO (cenário fechado/demonstrado) vs PLAUSÍVEL (não consegui fechar, mas o risco justifica menção). O rótulo vai no reporte.

---

## 5. Como reportar

- **Ordenado por severidade**, não por ordem de arquivo.
- **Formato de cada achado:** onde (`arquivo:linha`) → o quê (uma frase) → cenário de falha (entradas/estado → consequência) → sugestão (quando tenho uma boa).
- **Separação clara** entre: bugs (têm cenário de falha) / riscos (plausíveis, marcados como tal) / melhorias (opcionais, sem urgência) / notas (fora do escopo do diff).
- **Não corrijo sem pedido.** Revisão pedida = achados entregues. A correção é uma decisão do autor/usuário — salvo instrução explícita de "revise e corrija".
- **Quantidade calibrada:** 30 comentários em um PR de 50 linhas afogam os 2 que importam. Se há um problema estrutural, um comentário sobre o padrão vale mais que 15 sobre as instâncias.

---

## 6. Auto-revisão antes de entregar

Todo trabalho meu passa pelos mesmos passes antes do commit — com três diferenças:

1. **`git diff` lido hunk por hunk, sem exceção.** A pergunta para cada hunk: "isto é necessário para a tarefa?" — caça sobras (debug, imports, arquivos temporários, mudança acidental).
2. **Viés de autor combatido ativamente:** eu sei o que o código *deveria* fazer, então leio o que *está escrito*, não o que quis escrever. Técnica observável: executar mentalmente com os edge cases da tabela 3.3 como se o código fosse de outra pessoa.
3. **Checklist de entrega** (o de `WORKFLOW.md` §10) executado por inteiro — escopo, verificação, segurança, relato.

---

## 7. Tabela-resumo de severidades

| Severidade | Critério | Exemplos | Ação esperada |
|---|---|---|---|
| **Crítica** | Corrupção/perda de dados, vulnerabilidade explorável, quebra de produção | SQL injection; migração destrutiva sem rollback; autorização ausente | Bloqueia merge; corrigir antes de tudo |
| **Alta** | Bug funcional em caminho real | Off-by-one na paginação; raça em escrita concorrente; erro engolido | Corrigir neste PR |
| **Média** | Bug em caso raro; performance com dano projetável; contrato frágil | N+1 em lista que crescerá; edge case de unicode; teste que não pode falhar | Corrigir neste PR ou issue imediata |
| **Baixa** | Manutenção/clareza | Nome enganoso; duplicação de conceito nascente; comentário desatualizado | A critério do autor, mas registrado |
| **Nota** | Fora do escopo do diff; preferência | Padrão do projeto melhorável; sugestão de tooling | Sem ação obrigatória |
