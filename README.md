# E D E N

**O último paraíso da Terra.**

A humanidade não desapareceu. Ela evoluiu além da matéria — e deixou o planeta
para a natureza. Milhares de anos depois, isto é o que a Terra fez com o tempo
que lhe restou.

Não é um site. Não é um jogo. É **um único ecossistema vivo**: sem páginas,
sem seções, sem capítulos. Uma linha ininterrupta através de sete regiões de
um mundo que continuou sem nós.

---

## A jornada

Tudo começa na escuridão. Uma semente de luz cai, toca o solo, e o mundo
inteiro nasce diante do visitante — raízes bioluminescentes espalham-se a
partir do ponto de impacto, a primeira árvore cresce, depois a floresta,
depois tudo.

A partir daí, rolar não muda de página: **caminha**. Um único percurso
contínuo atravessa:

| | Região | |
|---|---|---|
| I | **The Luminous Forest** | árvores gigantes, copas translúcidas, seiva de luz subindo pelos troncos, feixes de sol na névoa |
| II | **The Floating Gardens** | ilhas que esqueceram o peso, cascatas que dissolvem em névoa antes de chegar ao chão |
| III | **The Crystal River** | água que guardou o céu dentro de si, minerais que respondem como vidro tocado |
| IV | **The Giants** | seres maiores que montanhas cruzando o céu em círculos de uma hora, constelações vivas nos flancos |
| V | **The Bloom** | um mar de flores em cores sem nome, pólen de luz subindo de volta ao céu |
| VI | **The Memory Trees** | árvores ancestrais que guardam a memória de cada espécie extinta — inclusive a nossa |
| VII | **The Horizon** | o mirante final: oceano, montanhas, gigantes ao longe — tudo coexistindo, de uma vez |

O cursor não é um cursor: é uma **presença**. Os esporos gravitam para ela,
o chão acende sob ela, as flores se afastam com delicadeza, as memórias
despertam quando ela se aproxima.

## O som

Nenhum arquivo de áudio. A paisagem sonora inteira é **sintetizada ao vivo**
(WebAudio): vento é caos filtrado, água é caos passado por uma palheta, e a
música é uma conversa generativa em modo lídio — sinos, acordes lentos,
chamados de gigantes — que nunca toca duas vezes da mesma forma, e que se
transforma conforme a região.

## Tecnologia

- **Three.js + React Three Fiber + drei** — cena, instancing, monitor de performance
- **GLSL custom em tudo** — céu, terreno, cascas, copas, água, cristais, criaturas, flores, auroras, partículas: nenhum material padrão
- **GPU particles** — esporos, pólen, memórias, ascensão (uma malha de pontos por sistema, movimento inteiro no vertex shader)
- **GSAP** — a linha do tempo da gênese
- **Postprocessing** — bloom HDR, vinheta, grão
- **Renderização adaptativa** — três níveis de densidade de vida + resolução dinâmica via PerformanceMonitor; a resolução cede antes da beleza

## Rodar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # produção (dist/)
npm run preview  # servir o build
```

Fones de ouvido recomendados. Desperte com um clique. Depois, role — devagar.
