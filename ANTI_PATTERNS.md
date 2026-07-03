# ANTI_PATTERNS.md — Os Maiores Erros de uma IA de Programação

> Catálogo dos modos de falha característicos de agentes de IA em projetos de software, compilado por engenharia reversa do comportamento observável (dos erros cometidos, corrigidos e prevenidos). Para cada anti-padrão: por que acontece, impacto, como identificar, como corrigir, como prevenir. Parte da série iniciada em `WORKFLOW.md`.

**Organização:** §1 erros de processo (os específicos de IA), §2 lógica, §3 segurança, §4 performance, §5 arquitetura, §6 manutenção e engenharia.

---

## 1. Erros de processo — os característicos de IA

### 1.1 Alucinar APIs (a assinatura que não existe)

- **Por que acontece:** o modelo generaliza a partir de milhares de bibliotecas parecidas e "lembra" de um método plausível (`array.removeDuplicates()`, o parâmetro que existe em outra lib, a API da versão 4 usada na versão 2). A plausibilidade é o disfarce.
- **Impacto:** código que não compila (o caso bom) ou que compila e faz outra coisa (o caso ruim — o parâmetro ignorado silenciosamente).
- **Como identificar:** erro de "método não existe"; comportamento que ignora o argumento; import que não resolve; docs da versão instalada divergindo do uso.
- **Como corrigir:** verificar a assinatura real na fonte instalada (`node_modules`, o pacote no site-packages, a docs da versão do lockfile) e reescrever contra ela.
- **Como prevenir:** **regra dura — API de que não se tem certeza é API que se verifica antes de usar.** Checar a versão no lockfile, não a da memória. Compilar/rodar cedo (o erro barato aos 5 minutos, não aos 500 linhas).

### 1.2 Declarar sucesso sem verificar ("deve funcionar")

- **Por que acontece:** a geração do código *parece* a conclusão da tarefa; a verificação parece opcional. E o otimismo é o viés natural da geração.
- **Impacto:** o pior de todos — corrói a confiança no agente inteiro. Um "funciona" falso custa mais que dez "não consegui verificar" honestos.
- **Como identificar:** relatório sem evidência de execução; "os testes devem passar"; nenhum comando rodado no histórico da sessão.
- **Como corrigir:** rodar agora — testes, build, o fluxo real — e re-reportar com a saída verdadeira.
- **Como prevenir:** definição de pronto que exige observação (`WORKFLOW.md` §2.10); a frase "funciona" reservada para comportamento observado; quando a verificação é impossível, o relatório diz exatamente isso e o porquê.

### 1.3 Escopo inflado (a refatoração de carona)

- **Por que acontece:** o agente vê melhorias possíveis em tudo que lê e não sente o custo social do diff gigante — melhorar *parece* gentileza.
- **Impacto:** diffs irrevisáveis, regressões fora da área pedida, conflitos com trabalho paralelo, quebra do contrato de confiança.
- **Como identificar:** `git diff` com arquivos que a tarefa não mencionava; renomeações/formatação em massa; dependências atualizadas "de brinde".
- **Como corrigir:** reverter tudo que não serve à tarefa; mover as boas ideias para o relatório final como sugestões.
- **Como prevenir:** a pergunta por hunk na auto-revisão: *"isto é necessário para a tarefa?"*; melhorias viram notas, nunca commits não pedidos.

### 1.4 Obedecer à letra e trair a intenção

- **Por que acontece:** o pedido é um proxy imperfeito da necessidade; o agente literalista implementa as palavras ("adicione retry") sem o problema por trás (a instabilidade que o retry vai mascarar).
- **Impacto:** trabalho tecnicamente correto e inútil — ou nocivo (o retry sobre operação não idempotente duplicando pagamentos).
- **Como identificar:** a solução pronta não muda o sintoma original do usuário; o pedido implementado cria um problema adjacente óbvio.
- **Como corrigir:** voltar ao problema real, propor a alternativa, implementar o que o usuário decidir.
- **Como prevenir:** a pergunta de interpretação (`WORKFLOW.md` §2.2): *qual problema o pedido quer resolver?* — implementa-se o pedido, mas o desalinhamento detectado é **dito**.

### 1.5 O loop de tentativa cega (mudar código até o erro sumir)

- **Por que acontece:** sob um erro que não entende, o agente entra em geração-e-teste: troca uma linha, roda, troca outra — sem hipótese. Às vezes o erro "some" (mascarado) e o loop "venceu".
- **Impacto:** correções por coincidência que quebram amanhã; código com cicatrizes de tentativas; horas queimadas.
- **Como identificar:** sequência de edits sem explicação causal entre eles; a "correção" final que ninguém sabe por que funciona; supressões acumuladas (`as any`, `# type: ignore`, `.catch(() => {})`).
- **Como corrigir:** parar; reverter as cicatrizes; reproduzir; ler o erro inteiro; formar hipótese mecânica; um experimento por vez (`DEBUGGING.md` §4).
- **Como prevenir:** regra do "dois strikes": duas tentativas sem entender = obrigação de parar e investigar de verdade. Nenhuma correção sem explicação mecânica de por que corrige.

### 1.6 Perder o contexto do projeto (reinventar o que existe)

- **Por que acontece:** o agente não "vive" no projeto; sem busca ativa, não sabe que já existe `formatMoney()`, um client HTTP configurado, um padrão de erro. Escreve a segunda versão de tudo.
- **Impacto:** duplicação de conceito (as duas versões divergem), inconsistência, o projeto vira colcha.
- **Como identificar:** helper novo suspeito de genérico (`utils/format.ts` novo num projeto de 3 anos); padrão de código diferente do vizinho; import de lib nova para algo corriqueiro.
- **Como corrigir:** procurar o equivalente existente; migrar para ele; apagar a reinvenção.
- **Como prevenir:** busca antes de criar — por nome provável, por conceito, nos vizinhos do código tocado. É o passo "explorar" do fluxo, não opcional.

### 1.7 Concordância servil (aceitar a premissa errada do usuário)

- **Por que acontece:** o usuário afirma "o bug está no cache" e o agente, treinado para ser prestativo, investiga apenas o cache — a premissa vira jaula.
- **Impacto:** investigações longas no lugar errado; "correções" no componente inocente.
- **Como identificar:** a evidência não confirma a premissa mas a investigação segue nela; desconforto entre o que o log diz e o que o usuário disse.
- **Como corrigir:** tratar a premissa do usuário como hipótese nº 1 — testá-la primeiro, com respeito, e reportar o resultado mesmo quando a refuta.
- **Como prevenir:** ceticismo construtivo uniforme: *toda* hipótese se verifica, venha de onde vier. Discordar com evidência é serviço, não insubordinação.

---

## 2. Erros de lógica

### 2.1 O caminho feliz como único caminho

- **Por que acontece:** o fluxo principal é o que o exemplo/pedido descreve; os casos de erro, vazio e borda não aparecem na descrição — e a geração segue a descrição.
- **Impacto:** o software funciona na demo e quebra no primeiro usuário real (lista vazia, rede falhando, campo nulo).
- **Como identificar:** função sem nenhum tratamento de erro; nenhum teste com entrada vazia/nula; `catch` genérico no topo "para garantir".
- **Como corrigir:** enumerar as bordas da tabela de disparo (`CODE_REVIEW.md` §3.3) e tratar cada uma conscientemente (tratar ≠ silenciar).
- **Como prevenir:** a pergunta obrigatória pré-código: *"qual é o caso de borda que vai me morder?"*; testes de borda como parte da definição de pronto.

### 2.2 Erros silenciados (o catch vazio e seus primos)

- **Por que acontece:** o erro "atrapalha" o fluxo feliz; silenciá-lo faz o código "funcionar" agora. Primos: retornar default mascarando falha, `.catch(() => {})`, log em nível debug de exceção grave.
- **Impacto:** o bug futuro sem a única pista que existia; corrupção silenciosa; horas de investigação às cegas.
- **Como identificar:** grep por `catch` vazio/`pass`/`ignore`; defaults retornados em caminhos de erro; operação que "não fez nada" sem log.
- **Como corrigir:** cada erro decide seu destino explícito: tratar (com contexto para isso), propagar enriquecido, ou logar-e-falhar. (`DECISION_TREE.md` §10.)
- **Como prevenir:** regra absoluta — todo catch faz algo; lint que proíbe catch vazio; revisão que trata erro engolido como bug, não estilo.

### 2.3 Confusões de assincronia

- **Por que acontece:** a sintaxe async esconde a semântica: `forEach(async...)` parece esperar (não espera), promise sem await parece executar em ordem, dois awaits paralelos parecem seguros sobre o mesmo estado.
- **Impacto:** raças, resultados fora de ordem, erros órfãos derrubando o processo, "funciona no teste" (rápido) e falha em produção (lento).
- **Como identificar:** `forEach` com callback async; promise criada e não aguardada/tratada; leitura-decisão-escrita sobre estado compartilhado com await no meio; teste intermitente.
- **Como corrigir:** `for...of` com await (serial) ou `Promise.all` com limite (paralelo) — escolhido pela dependência real; todo promise com dono; seção crítica atômica (lock/fila/upsert).
- **Como prevenir:** na revisão, cada `async` responde: quem espera isto? quem trata o erro disto? o que acontece se dois rodarem juntos?

### 2.4 Tipos e coerções traiçoeiras

- **Por que acontece:** as conversões implícitas das linguagens (== vs ===, `"0"` truthy, `parseInt("12px")` → 12, float 0.1+0.2, timezone implícita do `new Date(string)`).
- **Impacto:** bugs sutis com dados reais: o desconto de 0,1+0,2≠0,3, a data que muda de dia conforme o servidor, o if que trata "0" como presente.
- **Como identificar:** comparação frouxa; aritmética float com dinheiro; datas sem timezone explícita; parse sem validação do resto da string.
- **Como corrigir:** comparação estrita; inteiro-de-centavos/decimal para dinheiro; UTC + conversão na borda; parse com validação total.
- **Como prevenir:** os quatro domínios traiçoeiros (dinheiro, datas, unicode, float) sempre com as ferramentas maduras do ecossistema — nunca aritmética "simples".

### 2.5 Check-then-act (a raça clássica)

- **Por que acontece:** a lógica "se não existe, cria" é natural em pensamento sequencial — e o mundo é concorrente.
- **Impacto:** duplicatas (dois cadastros do mesmo e-mail), saldo negativo (dois saques simultâneos), o bug "impossível de reproduzir" localmente.
- **Como identificar:** `if (!exists) create` sem atomicidade; ler-modificar-gravar sem lock/versão; contador atualizado com `x = x + 1` em duas etapas.
- **Como corrigir:** atomicidade real: constraint UNIQUE + tratamento de conflito, `INSERT ... ON CONFLICT`, update atômico (`SET x = x + 1`), lock otimista (versão) ou pessimista com timeout.
- **Como prevenir:** para toda escrita, a pergunta: *"e se dois destes rodarem exatamente juntos?"* — respondida por construção, não por probabilidade.

---

## 3. Erros de segurança

### 3.1 Interpolar entrada externa em contexto executável

- **Por que acontece:** a concatenação é o caminho de menor esforço e os exemplos antigos da internet (dos quais os modelos aprenderam) estão cheios dela.
- **Impacto:** SQL injection, command injection, XSS — comprometimento total de dados ou servidor.
- **Como identificar:** template string/concat/format perto de query, exec, HTML, caminho.
- **Como corrigir/prevenir:** `SECURITY.md` §3–4 — parâmetros, exec com array, escape por contexto, caminho confinado. Regra sem exceção; a revisão de 30 segundos que sempre se faz.

### 3.2 Autorização esquecida (IDOR)

- **Por que acontece:** o código é escrito na perspectiva do usuário legítimo — buscar "o pedido 42" funciona, e ninguém pergunta *de quem* é o pedido 42.
- **Impacto:** qualquer usuário lê/altera dados de qualquer outro trocando um ID. O vazamento clássico.
- **Como identificar:** query por ID sem filtro de dono/tenant; o teste mental "usuário A com ID de B" falhando.
- **Como corrigir/prevenir:** dono/tenant no WHERE de toda query de recurso; ponto central de policy; negar por padrão (`SECURITY.md` §7).

### 3.3 Segredo no código (ou no log)

- **Por que acontece:** "só para testar localmente" — e o commit leva junto; ou o log de request despeja o header Authorization.
- **Impacto:** credencial pública para sempre (o histórico do git não esquece); scanners de atacantes acham em minutos.
- **Como identificar:** grep por padrões de chave; scanner (gitleaks) no CI; audit de logs por tokens.
- **Como corrigir:** **rotacionar já** (remover do código não descompromete), depois limpar.
- **Como prevenir:** env/secret manager desde o primeiro commit; `.env` no `.gitignore` antes de existir; scanner no CI.

### 3.4 Validação só no cliente (ou só confiança)

- **Por que acontece:** o formulário valida, "então o dado chega válido" — esquecendo que o atacante fala com a API sem passar pelo formulário.
- **Impacto:** todo o §2 e §3 entram pela porta "validada": mass assignment, valores impossíveis, payloads gigantes.
- **Como identificar:** endpoint sem schema de validação; campos aceitos além dos esperados; ausência de limites.
- **Como corrigir/prevenir:** schema no servidor em toda borda, allowlist de campos, limites em tudo (`SECURITY.md` §5).

---

## 4. Erros de performance

### 4.1 N+1 (a query em loop)

- **Por que acontece:** o código itera naturalmente ("para cada pedido, busque o cliente") e o ORM esconde o custo atrás de um atributo lazy.
- **Impacto:** latência proporcional ao tamanho da lista; a página que funciona com 10 itens e morre com 10 mil; o banco sufocado.
- **Como identificar:** log de queries com centenas de idênticas; latência linear no tamanho; loop com await/query dentro.
- **Como corrigir:** join/`IN`/batch/eager loading — e conferir o SQL gerado.
- **Como prevenir:** revisão automática de todo loop: *há I/O aqui dentro?*; log de contagem de queries por request em dev.

### 4.2 Carregar tudo para usar quase nada

- **Por que acontece:** `findAll()` + filtro em memória é mais "fácil" que compor o WHERE; `SELECT *` é o default do gerador.
- **Impacto:** RAM explodindo com o crescimento dos dados, rede saturada, OOM em jobs.
- **Como corrigir/prevenir:** filtro/count/agregação no banco; projeção dos campos usados; streaming/paginação para volumes (`PERFORMANCE.md` §7–8).

### 4.3 O(n²) acidental

- **Por que acontece:** `includes` dentro de loop é legível e correto — só que quadrático; com n de teste (10 itens), invisível.
- **Impacto:** o endpoint que degrada de 50ms para 30s conforme a base cresce — o incidente de seis meses depois.
- **Como corrigir/prevenir:** Set/Map para membership; a pergunta "qual é o n real em 2 anos?" em toda revisão de loop aninhado (`PERFORMANCE.md` §3).

### 4.4 Cache sem plano de invalidação

- **Por que acontece:** o cache "resolve" a lentidão em 5 linhas; a invalidação exigiria pensar — fica "para depois".
- **Impacto:** dados velhos servidos indefinidamente; e com chave incompleta, dados de um cliente para outro (incidente de segurança).
- **Como corrigir/prevenir:** a regra do `ARCHITECTURE.md` §11 — sem resposta escrita para "como isto invalida", o cache não entra; TTL sempre; chave com todas as dimensões.

---

## 5. Erros de arquitetura

### 5.1 Abstração especulativa (o framework para um caso de uso)

- **Por que acontece:** IA generaliza por reflexo — pede-se um parser de CSV, entrega-se um "sistema plugável de importação multi-formato". Generalizar parece diligência.
- **Impacto:** complexidade acidental perpétua; indireção que esconde o fluxo; a flexibilidade nunca usada cobrando aluguel em cada leitura.
- **Como identificar:** interface com uma implementação; parâmetros que nenhum chamador varia; camada que só delega; config sem segundo valor real.
- **Como corrigir:** inline da indireção; apagar a generalidade não usada (o git guarda, se um dia precisar).
- **Como prevenir:** YAGNI como regra dura; abstração só na 3ª ocorrência do mesmo *conceito*; "para o futuro" exige o futuro nomeado no roadmap.

### 5.2 Vazamento de camada

- **Por que acontece:** o caminho curto atravessa a fronteira — o SQL no handler resolve agora; a regra de negócio no componente da UI idem.
- **Impacto:** a regra duplicada em três telas diverge; trocar o banco/framework arrasta o domínio junto; testar exige subir tudo.
- **Como identificar:** import de driver/ORM em código de domínio; regra de negócio em template; formatação de apresentação no serviço.
- **Como corrigir:** mover cada lógica para sua camada, deixando nas bordas só tradução.
- **Como prevenir:** direção de dependência policiada por lint de imports; a pergunta de revisão "isto está na camada certa?" (`CODE_REVIEW.md` §3.6).

### 5.3 Duplicação de conceito (a segunda fonte de verdade)

- **Por que acontece:** §1.6 (não achou a primeira) ou pressa (copiar e ajustar).
- **Impacto:** as duas cópias divergem na primeira mudança — o desconto calculado diferente no carrinho e no checkout.
- **Como identificar:** a mesma regra de negócio reconhecível em dois arquivos; correção de bug que precisou ser aplicada "em todos os lugares que fazem X".
- **Como corrigir:** eleger a fonte única, migrar os usos, apagar as cópias.
- **Como prevenir:** busca antes de escrever regra de negócio; na revisão, o passe de duplicação conceitual.

### 5.4 Distribuir o que era simples (microsserviços por moda)

- **Por que acontece:** o padrão "certo" dos artigos vira default; a IA propõe a arquitetura da Netflix para o CRUD de 200 usuários.
- **Impacto:** todo o imposto distribuído (rede, sagas, tracing, deploy múltiplo) sem nenhum benefício — o time afoga em infraestrutura.
- **Como corrigir:** consolidar; monolito modular.
- **Como prevenir:** `ARCHITECTURE.md` §3–4 — serviço novo só com dor nomeada e medida; default é o monólito modular.

---

## 6. Erros de manutenção e engenharia

### 6.1 O teste que não testa

- **Por que acontece:** o teste é escrito para existir (cobertura, hábito) e não para falhar: asserções fracas (`toBeDefined`), mock do próprio alvo, caminho feliz só.
- **Impacto:** falsa segurança — a suíte verde acompanhando a regressão até produção; pior que não ter teste.
- **Como identificar:** o teste passa com o bug presente (o teste supremo: quebre o código de propósito — o teste percebe?); asserções genéricas; mocks do domínio.
- **Como corrigir:** reescrever contra o comportamento (entrada→saída), verificar vermelho-antes/verde-depois.
- **Como prevenir:** todo teste novo demonstrado falhando primeiro; mock só de fronteira (`CODE_REVIEW.md` §3.8).

### 6.2 Comentários que mentem (ou narram o óbvio)

- **Por que acontece:** IA comenta por reflexo ("// incrementa contador") e comentários velhos não acompanham o código que mudou.
- **Impacto:** ruído que treina o leitor a ignorar comentários — inclusive o único que importava; a mentira desatualizada que induz o próximo bug.
- **Como corrigir:** apagar os que narram o quê; atualizar/corrigir os porquês; mover verdades para nomes e tipos.
- **Como prevenir:** comentário só para o que o código não pode dizer (restrição, porquê, armadilha); comentário tocado junto com o código no mesmo diff.

### 6.3 O commit-monstro (tudo junto e misturado)

- **Por que acontece:** o trabalho flui e o commit vira despejo: feature + refactor + formatação + fix não relacionado.
- **Impacto:** revisão impossível; bisect inútil; revert que arrasta o inocente junto.
- **Como corrigir:** separar em commits coesos (mecânico ≠ comportamento).
- **Como prevenir:** commits pequenos por preocupação; a disciplina de nunca misturar refactor com mudança de comportamento.

### 6.4 Conhecimento implícito plantado

- **Por que acontece:** "todo mundo sabe" que precisa chamar `init()` antes, que o campo nunca é nulo, que a ordem importa — todo mundo = quem escreveu, hoje.
- **Impacto:** a armadilha armada para o próximo (humano ou IA), que fará a chamada na ordem errada.
- **Como corrigir/prevenir:** invariantes sobem para o nível verificável — tipo, constraint, assert, teste; API desenhada para que o uso errado não compile ("make illegal states unrepresentable").

### 6.5 Supressão de sinal (o lint desligado, o warning ignorado)

- **Por que acontece:** o aviso "atrapalha" o merge; `// eslint-disable`, `as any`, `@ts-ignore`, `--no-verify` fazem-no sumir.
- **Impacto:** o sistema de alarme desligado exatamente onde estava certo; supressões acumulando até o ruído engolir tudo.
- **Como identificar:** grep pelas supressões; contagem crescendo no diff.
- **Como corrigir:** tratar a causa do aviso; supressão só com justificativa escrita ao lado, caso a caso.
- **Como prevenir:** política — cada supressão carrega o porquê; CI que não aceita supressão nova sem revisão.

### 6.6 Documentação fantasma (o README que mente)

- **Por que acontece:** o comportamento mudou, a doc não — ninguém "teve tempo".
- **Impacto:** onboarding quebrado, decisões tomadas sobre informação falsa; pior que doc ausente (a ausente pelo menos não engana).
- **Como corrigir/prevenir:** doc que fala do comportamento alterado atualiza **no mesmo diff**; preferir doc gerada/verificada (OpenAPI do código, exemplos executáveis) que não pode divergir.

---

## Apêndice — Os dez mandamentos anti-anti-padrão

1. Verifique a API antes de usá-la; verifique o comportamento antes de declará-lo.
2. O diff contém a tarefa — nada além.
3. Todo erro tem destino explícito; nenhum é engolido.
4. Toda escrita concorrente é atômica; toda mensagem chega duas vezes.
5. Entrada externa nunca vira código (SQL, shell, HTML, caminho) sem a defesa estrutural.
6. Toda query de recurso filtra pelo dono; todo segredo mora fora do código.
7. Nenhum loop contém I/O oculto; nenhuma coleção cresce sem limite nomeado.
8. Abstração só na terceira ocorrência do mesmo conceito; serviço novo só com dor medida.
9. Teste que não pode falhar não existe; correção sem explicação mecânica não corrige.
10. Duas tentativas sem entender = pare e investigue. Nunca mude três coisas de uma vez.
