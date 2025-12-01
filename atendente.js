//----------------------------------------------
// CONFIGURAÇÃO DO WEBSOCKET (Render)
//----------------------------------------------
const WS_URL = "wss://fila-de-mercado.onrender.com";
let socket = new WebSocket(WS_URL);

//----------------------------------------------
// ELEMENTOS DO HTML
//----------------------------------------------
const senhaAtualEl = document.getElementById("senhaAtual");
const historicoEl = document.getElementById("historico");
const btnProxima = document.getElementById("btnProxima");
const btnCancelar = document.getElementById("btnCancelar");
const btnPular = document.getElementById("btnPular");

//----------------------------------------------
// CONEXÃO WEBSOCKET
//----------------------------------------------
socket.onopen = () => {
  console.log("Atendente conectado ao WebSocket");
};

socket.onmessage = (msg) => {
  try {
    const data = JSON.parse(msg.data);

    if (data.tipo === "atualizacao") {
      atualizarUI(data);
    }

    if (data.tipo === "chamada") {
      senhaAtualEl.textContent = data.senha || "--";
    }

  } catch (e) {
    console.error("Erro WS Atendente:", e);
  }
};

//----------------------------------------------
// ATUALIZA A INTERFACE DO ATENDENTE
//----------------------------------------------
function atualizarUI(data) {
  // Atualiza senha atual (última chamada)
  senhaAtualEl.textContent = data.historico?.[0] || "--";

  // Atualiza histórico
  historicoEl.innerHTML = "";
  data.historico.slice(0, 5).forEach(s => {
    const div = document.createElement("div");
    div.classList.add("item");
    div.textContent = s;
    historicoEl.appendChild(div);
  });
}

//----------------------------------------------
// CONTROLES DO ATENDENTE
//----------------------------------------------
btnProxima.onclick = () => {
  socket.send(JSON.stringify({ tipo: "chamar" }));
};

btnCancelar.onclick = () => {
  if (!senhaAtualEl.textContent || senhaAtualEl.textContent === "--") return;
  socket.send(JSON.stringify({ tipo: "cancelarSenha", senha: senhaAtualEl.textContent }));
};

btnPular.onclick = () => {
  socket.send(JSON.stringify({ tipo: "pular" }));
};
