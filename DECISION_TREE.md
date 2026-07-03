# DECISION_TREE.md — Árvores de Decisão e Heurísticas de um Agente de IA de Desenvolvimento

> Engenharia reversa do processo decisório observável durante desenvolvimento de software. Cada seção contém a árvore de decisão explícita e as heurísticas que a sustentam. Complementa `WORKFLOW.md` e `ENGINEERING_PHILOSOPHY.md`.

---

## Índice

1. [O meta-algoritmo de qualquer decisão](#1-o-meta-algoritmo-de-qualquer-decisão)
2. [Decisão: qual arquitetura?](#2-decisão-qual-arquitetura)
3. [Decisão: qual biblioteca?](#3-decisão-qual-biblioteca)
4. [Decisão: qual solução/implementação?](#4-decisão-qual-soluçãoimplementação)
5. [Decisão: perguntar ou assumir?](#5-decisão-perguntar-ou-assumir)
6. [Decisão: refatorar ou não?](#6-decisão-refatorar-ou-não)
7. [Decisão: abstrair ou duplicar?](#7-decisão-abstrair-ou-duplicar)
8. [Decisão: otimizar ou não?](#8-decisão-otimizar-ou-não)
9. [Decisão: onde corrigir um bug?](#9-decisão-onde-corrigir-um-bug)
10. [Decisão: como tratar um erro?](#10-decisão-como-tratar-um-erro)
11. [Decisão: teste de quê e em que nível?](#11-decisão-teste-de-quê-e-em-que-nível)
12. [Decisão: síncrono ou assíncrono?](#12-decisão-síncrono-ou-assíncrono)
13. [Decisão: onde guardar o dado?](#13-decisão-onde-guardar-o-dado)
14. [Catálogo de heurísticas transversais](#14-catálogo-de-heurísticas-transversais)

---

## 1. O meta-algoritmo de qualquer decisão

Toda decisão técnica passa pelo mesmo esqueleto antes das heurísticas específicas:

```
1. DEFINIR      → Qual é exatamente a decisão? Qual o critério de sucesso?
2. RESTRINGIR   → Que restrições duras existem? (versão, política, requisito,
                  compatibilidade). Elimine tudo que viola uma restrição.
3. ENUMERAR     → Liste 2–3 candidatas viáveis. Dez candidatas = problema
                  mal definido; volte ao passo 1.
4. DIFERENCIAR  → Compare APENAS nos critérios em que as candidatas diferem.
5. VERIFICAR    → A vencedora teórica sobrevive ao contato com o código real?
                  (versão da lib, padrão do projeto, dado existente)
6. CLASSIFICAR  → A decisão é reversível?
                  ├─ Sim → decida rápido, siga, ajuste depois se preciso.
                  └─ Não → invista em análise; considere envolver o usuário.
7. DECLARAR     → Comunique: escolha + porquê em 1–3 frases + o que faria
                  mudar de ideia.
```

**Desempate universal** (quando as candidatas empatam nos critérios do contexto), nesta ordem:

1. Correção sob todos os casos previstos
2. **Reversibilidade** — a mais fácil de abandonar
3. **Consistência** — a mais parecida com o que o projeto já faz
4. **Simplicidade** — a com menos partes móveis
5. Performance/custo

---

## 2. Decisão: qual arquitetura?

```
Existe mais de uma arquitetura possível?
│
├─ O projeto JÁ TEM uma arquitetura estabelecida?
│   ├─ Sim → A tarefa cabe nela sem contorcionismo?
│   │   ├─ Sim → USE A EXISTENTE. Fim. (Consistência > preferência)
│   │   └─ Não → O contorcionismo custa mais que a mudança?
│   │       ├─ Não → conforme-se à existente, registre a dor no relatório
│   │       └─ Sim → proponha a mudança AO USUÁRIO com custos de ambas;
│   │               nunca execute mudança arquitetural sem aval.
│   └─ Não (projeto novo) → continue ↓
│
├─ Qual é a escala REAL e MEDIDA/PROJETADA?
│   ├─ Desconhecida ou pequena → monolito modular. Ponto de partida default.
│   └─ Grande e comprovada → identifique O QUE escala (leitura? escrita?
│       processamento? times?) e escolha a arquitetura que ataca ESSE eixo.
│
├─ Quantos times/pessoas vão manter isto?
│   ├─ 1 time → monolito (modular). Microsserviços para 1 time = overhead puro.
│   └─ Muitos times com deploy independente necessário → considere serviços
│       ao longo das fronteiras DE DOMÍNIO (nunca fronteiras técnicas).
│
└─ Quão volátil é cada decisão de infraestrutura?
    ├─ Volátil (banco pode trocar, gateway pode trocar) → fronteira/porta ali.
    └─ Estável (linguagem, domínio central) → sem camada de indireção extra.
```

**Heurísticas de arquitetura:**

- Ao empatar, escolha a arquitetura **que o time consegue operar**, não a que impressiona. Arquitetura que ninguém sabe depurar é passivo.
- Fronteiras seguem o domínio (pedido, pagamento, catálogo), nunca a tecnologia (controllers, services, utils como topo da hierarquia).
- Cada camada extra precisa justificar-se com uma decisão volátil que encapsula. Camada que só delega é ruído.
- Prefira a arquitetura cujo pior cenário de erro é "refatoramos" ao invés de "migramos dados de todos os clientes".

---

## 3. Decisão: qual biblioteca?

```
Preciso de uma funcionalidade. De onde vem?
│
├─ 1. O projeto já resolve isso? (helper interno, módulo existente)
│   └─ Sim → USE O EXISTENTE. Buscar antes de criar é obrigatório.
│
├─ 2. A biblioteca padrão da linguagem resolve razoavelmente?
│   └─ Sim → USE A STDLIB. Zero custo de cadeia de suprimentos.
│
├─ 3. Uma dependência JÁ INSTALADA resolve?
│   └─ Sim → use-a (verifique a versão instalada e a API dessa versão!).
│
├─ 4. Dá para escrever em ~50 linhas de código óbvio?
│   ├─ Sim, e o domínio é comum → ESCREVA. Dependência tem custo perpétuo.
│   └─ Não, ou o domínio é TRAIÇOEIRO (datas/fusos, crypto, parsing de
│      formatos, unicode, HTTP client robusto, auth) → biblioteca madura.
│      NUNCA reinvente o traiçoeiro.
│
└─ 5. Escolhendo entre bibliotecas externas, compare nesta ordem:
    a. Manutenção viva? (commits recentes, issues respondidas)
    b. Adoção? (uso amplo = bugs já encontrados por outros)
    c. Tamanho/peso proporcional ao uso? (não importar 2MB para 1 função)
    d. Licença compatível com o projeto?
    e. Superfície de segurança? (dependências transitivas, histórico de CVEs)
    f. API alinhada com o estilo do projeto?
```

**Heurísticas de dependência:**

- Toda dependência é um casamento: você herda os bugs, as breaking changes e o eventual abandono dela.
- Verifique o **nome exato** ao instalar (typosquatting é ataque real).
- Uma dependência para UMA função pequena → copie a lógica (com atribuição se exigida pela licença) ou escreva a sua.
- Se dois candidatos empatam, escolha o que o projeto já usa em outro lugar, ou o mais "chato"/estável — enxoval de features raramente usadas é passivo.

---

## 4. Decisão: qual solução/implementação?

```
Duas ou mais soluções para o mesmo problema:
│
├─ 1. Alguma está ERRADA em algum caso de borda relevante?
│   └─ Elimine-a. Correção não negocia. (O caso de borda "raro" acontece.)
│
├─ 2. Alguma viola restrição do projeto? (versão, padrão, política, perf exigida)
│   └─ Elimine-a.
│
├─ 3. As restantes diferem em quê, NESTE contexto?
│   ├─ Código quente (hot path)?      → peso para performance medida.
│   ├─ Código de borda/configuração?  → peso para clareza.
│   ├─ Contrato público?              → peso para estabilidade/extensibilidade.
│   ├─ Script descartável?            → peso para velocidade de escrita.
│   └─ Domínio central do negócio?    → peso para expressividade e testabilidade.
│
├─ 4. Empate → aplique o desempate universal:
│      correção > reversível > consistente > simples > rápido
│
└─ 5. Teste do pior cenário: "se minha premissa estiver errada,
       esta escolha vira inconveniente ou desastre?"
       └─ Prefira a escolha cujos erros são inconvenientes.
```

**Exemplo aplicado** (observável em decisões reais):

> *Preciso deduplicar itens de uma lista.*
> Opção A: `[...new Set(list)]` — simples, O(n), mas só para primitivos.
> Opção B: filter com `findIndex` — funciona para objetos, mas O(n²).
> Opção C: Map por chave — O(n), funciona para objetos, 3 linhas.
> Decisão: os itens são objetos? → A eliminada (errada para o caso). A lista pode ser grande? → B eliminada (O(n²) em hot path). Resposta: C. Se a lista fosse sempre ≤ 20 itens em código frio, B seria aceitável pela legibilidade — o contexto decide.

---

## 5. Decisão: perguntar ou assumir?

A árvore mais usada de todas — executada várias vezes por tarefa:

```
Encontrei uma ambiguidade. O que faço?
│
├─ A resposta está no REPOSITÓRIO? (convenção, versão, exemplo similar)
│   └─ Sim → DESCUBRA SOZINHO. Perguntar o que se pode descobrir
│            é desperdiçar o tempo do usuário. Nunca pergunte isso.
│
├─ Existe um DEFAULT da indústria ou do contexto, óbvio e barato de trocar?
│   └─ Sim → ASSUMA o default, DECLARE a suposição no relatório
│            ("assumi paginação de 20 itens; ajusto se preferir outra").
│
├─ A escolha muda o PRODUTO, o DADO PERSISTIDO ou é CARA de reverter?
│   └─ Sim → PERGUNTE antes de implementar. Formule com:
│            - 2–4 opções concretas
│            - a recomendada marcada e justificada em 1–2 frases
│            - consequência de cada uma em linguagem de produto
│
└─ As interpretações levam a diffs MUITO diferentes?
    └─ Sim → PERGUNTE (o custo de implementar a interpretação errada
             é maior que o custo da pergunta).
    └─ Não → assuma a mais provável, declare, siga.
```

**Heurística-resumo:** *pergunte sobre negócio, assuma sobre convenção, descubra sobre código.*

---

## 6. Decisão: refatorar ou não?

```
Encontrei código que merece refatoração:
│
├─ A refatoração é NECESSÁRIA para a tarefa atual?
│   (impossível/perigoso implementar sem limpar antes)
│   └─ Sim → refatore PRIMEIRO, em commit separado, comportamento
│            idêntico, testes verdes antes e depois. Depois a feature.
│
├─ Há testes cobrindo o comportamento atual?
│   └─ Não → NÃO refatore ainda. Escreva testes de caracterização
│            (que fixam o comportamento real, bugs inclusos) primeiro.
│
├─ Estou tocando este código de qualquer forma, e a melhoria é
│  PEQUENA e LOCAL? (renomear uma variável, extrair uma função)
│   └─ Sim → regra do escoteiro: melhore UM POUCO. Não reconstrua.
│
├─ O usuário pediu a refatoração?
│   └─ Sim → refatore, ainda em commits separados por tipo de mudança.
│
└─ Nenhum dos acima (motivação é estética, código está fora do caminho)
    └─ NÃO REFATORE. Anote a sugestão no relatório final. Siga.
```

**Nunca:** refatoração + mudança de comportamento no mesmo commit; refatoração de "carona" em hotfix; reescrita total como primeira proposta.

---

## 7. Decisão: abstrair ou duplicar?

```
Este código é parecido com aquele. Unifico?
│
├─ É a 2ª ocorrência?
│   └─ DUPLIQUE (com um comentário se a semelhança for relevante).
│      Duas ocorrências não revelam o padrão — revelam uma coincidência.
│
├─ É a 3ª+ ocorrência E o padrão está claro e estável?
│   └─ Considere abstrair. MAS primeiro:
│       ├─ As ocorrências são o MESMO CONCEITO ou apenas o mesmo texto?
│       │   ├─ Mesmo conceito (mesma regra de negócio) → abstraia.
│       │   │   Duas fontes de verdade para uma regra é bug futuro.
│       │   └─ Só mesmo texto (coincidência estrutural) → NÃO abstraia.
│       │       Elas vão divergir, e a abstração vai virar um switch
│       │       de flags booleanas. (A pior manutenção que existe.)
│       └─ A abstração precisaria de >2 parâmetros de comportamento
│           (flags, callbacks) para cobrir os casos?
│           └─ Sim → sinal de coincidência estrutural. Não abstraia.
│
└─ Regra de ouro: duplicação é mais barata que a abstração errada.
   Desfazer duplicação é fácil; desfazer abstração errada espalhada
   por 30 call sites é um projeto.
```

---

## 8. Decisão: otimizar ou não?

```
Este código poderia ser mais rápido. Otimizo?
│
├─ É higiene, não otimização? (N+1, O(n²) óbvio em coleção que cresce,
│  I/O sequencial paralelizável, falta de paginação, Set vs includes)
│   └─ Sim → FAÇA SEMPRE. Higiene não custa legibilidade.
│
├─ Existe requisito de performance (SLA, budget) OU dor medida?
│   └─ Não → NÃO OTIMIZE. Anote se relevante. Fim.
│   └─ Sim ↓
│
├─ Você MEDIU e identificou que ESTE código é o gargalo?
│   └─ Não → meça primeiro (profile). Otimizar sem perfil = adivinhar.
│   └─ Sim ↓
│
├─ Otimize O GARGALO, na ordem de maior retorno:
│   algoritmo → I/O → trabalho repetido/cache → micro
│
├─ Meça de novo. Requisito atendido?
│   ├─ Sim → PARE. Otimizar além do requisito queima legibilidade à toa.
│   └─ Não → próximo gargalo (ele mudou de lugar), repita.
│
└─ A otimização custou legibilidade?
    └─ Sim → comente o porquê + guarde o número medido no comentário
       ("evita parse repetido; p95 caiu de 800ms→90ms em 2026-07").
```

---

## 9. Decisão: onde corrigir um bug?

```
Encontrei a linha onde o sintoma aparece. Corrijo aqui?
│
├─ Por que o valor/estado inválido chegou até aqui?
│   └─ Suba a cadeia: quem produziu? quem deixou passar?
│
├─ Existe uma camada cuja RESPONSABILIDADE era garantir a invariante?
│   (validação na borda, constraint, tipo, contrato)
│   └─ Sim → CORRIJA LÁ. A correção no sintoma (`if x != null`)
│            deixa a invariante quebrada para todos os outros caminhos.
│
├─ A correção na camada certa é grande/arriscada demais para agora?
│   └─ Mitigue no sintoma COM DECLARAÇÃO EXPLÍCITA:
│      "mitigação temporária; causa raiz é X; issue #N" — nunca silenciosa.
│
└─ Após corrigir:
    ├─ Este mesmo padrão de erro existe em outros lugares? → varra o código.
    └─ Teste de regressão que falhava antes e passa agora? → obrigatório.
```

---

## 10. Decisão: como tratar um erro?

```
Esta chamada pode falhar. O que faço com o erro?
│
├─ EU tenho contexto para RESOLVER o erro aqui?
│   (retry faz sentido? valor default é semanticamente correto? fallback?)
│   ├─ Sim → trate AQUI, logue a decisão (nível WARN se anômalo).
│   └─ Não ↓
│
├─ Alguém ACIMA tem esse contexto?
│   └─ Propague — MAS enriquecido: embrulhe com o contexto local
│      ("falha ao carregar perfil do usuário {id}: {causa}"),
│      preservando o erro original encadeado (cause).
│
├─ O erro é ESPERADO no fluxo de negócio? (saldo insuficiente, não achado)
│   └─ Não é exceção — é RESULTADO. Modele no tipo de retorno
│      (Result/Either/union/status code), não em throw.
│
├─ O erro é IMPOSSÍVEL "em teoria"? (estado que "nunca acontece")
│   └─ Falhe ALTO com assert/erro explícito. O "impossível" acontecendo
│      silenciosamente é o pior bug de todos.
│
└─ REGRAS ABSOLUTAS:
    ├─ Nunca catch vazio.
    ├─ Nunca engolir e retornar default mascarando falha.
    ├─ Logar UMA vez, na camada que trata (não em cada camada da subida).
    ├─ Recursos liberados em TODOS os caminhos (finally/defer/with).
    └─ Mensagem para usuário final ≠ mensagem para log
       (a primeira orienta sem vazar detalhes; a segunda diagnostica).
```

---

## 11. Decisão: teste de quê e em que nível?

```
Escrevi/mudei um comportamento. Que teste escrevo?
│
├─ É lógica pura com ramificações/cálculo/parsing?
│   └─ Teste UNITÁRIO: rápido, muitos casos, incluindo bordas
│      (vazio, nulo, limite, unicode, negativo, enorme).
│
├─ É integração entre camadas? (repositório↔banco, handler↔serviço)
│   └─ Teste de INTEGRAÇÃO com a dependência real ou realista
│      (banco em container > mock do driver).
│
├─ É um fluxo crítico de negócio de ponta a ponta? (checkout, login)
│   └─ POUCOS testes E2E, só nos fluxos que não podem quebrar nunca.
│
├─ É correção de bug?
│   └─ Teste de REGRESSÃO obrigatório, que:
│       ├─ falha SEM a correção (verifique isso de verdade!)
│       └─ passa COM a correção.
│
├─ O que estou testando: comportamento ou implementação?
│   ├─ Comportamento (entrada→saída, efeito observável) → certo.
│   └─ Implementação (métodos internos chamados N vezes, estado privado)
│       → errado; este teste quebrará em todo refactor sem pegar bug algum.
│
└─ Onde mockar?
    ├─ Fronteiras que não controlo: API de terceiros, relógio, random, rede.
    └─ NUNCA o próprio domínio (mockar o que se testa = testar o mock).
```

---

## 12. Decisão: síncrono ou assíncrono?

```
Esta operação entra no caminho da requisição ou sai dele?
│
├─ O usuário PRECISA do resultado para continuar? (cálculo do total, auth)
│   └─ Síncrono. Com timeout e erro claro.
│
├─ O resultado pode chegar depois sem quebrar a experiência?
│   (e-mail, thumbnail, sync com terceiros, relatório)
│   └─ Assíncrono (fila/job). MAS isso obriga:
│       ├─ idempotência (a mensagem VAI chegar duas vezes um dia)
│       ├─ retry com backoff + dead-letter queue
│       ├─ status consultável (o usuário/operador precisa ver o andamento)
│       └─ resposta imediata honesta ("processando", não "pronto")
│
└─ Heurística de paralelismo dentro da requisição:
    ├─ I/O independentes → paralelize (gather/Promise.all) com limite.
    └─ Dependência de ordem → serial; não "otimize" quebrando a ordem.
```

---

## 13. Decisão: onde guardar o dado?

```
Tenho um dado. Onde ele mora?
│
├─ Precisa sobreviver a restart e ser fonte de verdade?
│   └─ Banco primário (relacional por default; documento/kv quando o
│      modelo de acesso claramente pedir), com constraints e migração.
│
├─ É derivável de outra fonte e caro de recomputar?
│   └─ Cache — COM TTL e com a história de invalidação escrita antes
│      do cache existir. Cache é otimização, nunca fonte de verdade.
│
├─ É estado de sessão/UI?
│   └─ O mais perto possível do uso, o mais efêmero possível.
│      Não promova estado de UI a banco por preguiça de derivar.
│
├─ É configuração?
│   ├─ Varia por ambiente → variável de ambiente, validada no boot.
│   ├─ Varia em runtime por admin → banco + cache + auditoria.
│   └─ Não varia → CONSTANTE no código com nome claro. Configurabilidade
│      sem segundo caso de uso real é complexidade acidental.
│
├─ É segredo?
│   └─ Secret manager/env. NUNCA código, NUNCA log, NUNCA repositório.
│
└─ É arquivo/blob?
    └─ Object storage com URL/chave no banco — não bytes no banco
       (salvo pequeno e fortemente transacional).
```

---

## 14. Catálogo de heurísticas transversais

As regras de bolso que aparecem repetidamente em todas as decisões acima:

### Sobre incerteza
1. **Verificável em ≤ 2 minutos → verifique, não assuma.** (Assinatura de API, versão, convenção.)
2. **Incerteza técnica se resolve com experimento, não com debate.** Um spike de 20 linhas vale mais que 20 minutos de prós-e-contras teóricos.
3. **Comece pela parte de maior incerteza** — ela é quem pode invalidar o plano inteiro.

### Sobre risco
4. **Reversível → decida rápido. Irreversível → devagar e com aval.** A velocidade da decisão é função do custo de desfazê-la.
5. **Prefira escolhas cujos fracassos são inconvenientes, não desastres.**
6. **O caso raro acontece.** Em qualquer volume relevante, o "0,1%" é diário.
7. **Toda escrita exposta a retry acontecerá duas vezes.** Projete idempotente.

### Sobre custo
8. **Dependência, camada, flag, parâmetro: tudo cobra aluguel perpétuo.** Só adicione o que paga o próprio aluguel hoje.
9. **Duplicação é mais barata que a abstração errada.**
10. **O código mais barato de manter é o que não foi escrito.** A melhor resposta a alguns pedidos é apontar a feature/lib/config existente.

### Sobre consistência
11. **Na dúvida entre dois estilos, use o do arquivo em que você está.**
12. **Nunca imite defeitos.** Consistência cobre estilo, não vulnerabilidade.

### Sobre pessoas
13. **Escreva para o leitor de daqui a um ano, não para o revisor de hoje.**
14. **Pergunte sobre negócio, assuma sobre convenção, descubra sobre código.**
15. **Uma recomendação clara com porquê > um menu neutro de opções.**

### Sobre finalização
16. **"Funciona" é um fato observado, não uma esperança.** Sem observação, diga "implementado, não verificado porque X".
17. **Todo bug corrigido deixa um teste e uma varredura por irmãos.**
18. **O diff final é relido inteiro antes de qualquer commit — sempre.**
