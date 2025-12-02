// ========================================================
// ATENDENTE.JS 
// ========================================================

const ws = new WebSocket(location.origin.replace(/^http/, "ws"));

// Elementos (se existir)
const btnChamar = document.getElementById("chamar");
const btnRepetir = document.getElementById("repetir");
const btnPular = document.getElementById("pular");
const btnCancelar = document.getElementById("cancelarSenha");
const painelAtual = document.getElementById("senhaAtual");
const painelFila = document.getElementById("listaFila");
const painelHistorico = document.getElementById("listaHistorico");

// --------------------------------------------------------
// IDENTIFICAR COMO ATENDENTE
// --------------------------------------------------------
ws.onopen = () => {
  ws.send(JSON.stringify({ tipo: "identificar", tipoCliente: "atendente" }));
};

// --------------------------------------------------------
// FUNÇÃO UNIVERSAL PARA ENVIAR AO SERVER
// --------------------------------------------------------
function enviar(tipo, extra = {}) {
  ws.send(JSON.stringify({ tipo, ...extra }));
}

// --------------------------------------------------------
// BOTÕES (se existirem no HTML)
// --------------------------------------------------------
btnChamar && (btnChamar.onclick = () => enviar("chamar"));
btnRepetir && (btnRepetir.onclick = () => enviar("chamar")); // mesma função
btnPular && (btnPular.onclick = () => enviar("pular"));
btnCancelar && (btnCancelar.onclick = () => {
  const senha = prompt("Digite a senha a cancelar:");
  if (senha) enviar("cancelarSenha", { senha });
});

// --------------------------------------------------------
// RECEBIMENTO DE EVENTOS DO SERVIDOR
// --------------------------------------------------------
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);

  // Atualização geral
  if (data.tipo === "atualizacao") {
    atualizarPainel(data.fila, data.historico);
  }

  // Nova senha sendo chamada
  if (data.tipo === "chamada") {
    if (painelAtual) painelAtual.innerText = data.senha || "--";
  }

  // Cliente recebeu notificação (1ª chamada)
  if (data.tipo === "clienteNotificado") {
    alert(`Cliente da senha ${data.senha} foi notificado.`);
  }

  // Tempo esgotado da 1ª chamada (senha pulada)
  if (data.tipo === "tempoEsgotadoPrimeiraChamada") {
    alert(`A senha ${data.senha} não apareceu. Foi PULADA automaticamente.`);
  }

  // Tempo esgotado da 2ª chamada (senha cancelada)
  if (data.tipo === "tempoEsgotadoSegundaChamada") {
    alert(`A senha ${data.senha} não apareceu novamente. Foi CANCELADA.`);
  }
};

// --------------------------------------------------------
// FUNÇÃO PARA ATUALIZAR FILA E HISTÓRICO (caso existam no HTML)
// --------------------------------------------------------
function atualizarPainel(fila, historico) {
  if (painelFila) {
    painelFila.innerHTML = fila
      .map(f => `<div>Senha: ${f.senha}</div>`)
      .join("");
  }

  if (painelHistorico) {
    painelHistorico.innerHTML = historico
      .map(h => `<div>${h}</div>`)
      .join("");
  }
}
