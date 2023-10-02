```javascript
// Função de saudação inicial
function saudacaoInicial() {
  return "Olá! Eu sou o Ericsson, seu assistente virtual. Como posso ajudar você hoje?";
}

// Função para processar a mensagem do usuário
function processarMensagem(mensagem) {
  // Lógica de processamento da mensagem aqui (análise, resposta, ações, etc.)
  // Exemplo simples: responder com uma saudação genérica
  if (mensagem.includes("olá")) {
    return "Olá! Como posso ajudar você?";
  } else if (mensagem.includes("clima")) {
    return "Desculpe, eu não tenho acesso ao clima no momento.";
  } else {
    return "Desculpe, não entendi. Você pode reformular sua pergunta?";
  }
}

// Função para exibir resposta
function exibirResposta(resposta) {
  console.log(resposta);
}

// Função principal para interagir com o chatbot
function iniciarEricsson() {
  exibirResposta(saudacaoInicial());

  // Simular a interação com o usuário (pode ser em um ambiente web real)
  while (true) {
    const mensagemDoUsuario = prompt("Você: ");
    const resposta = processarMensagem(mensagemDoUsuario);
    exibirResposta(resposta);
  }
}

// Iniciar o chatbot
iniciarEricsson();
```
