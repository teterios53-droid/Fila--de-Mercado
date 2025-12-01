//----------------------------------------------
// CONFIGURAÇÃO DO WEBSOCKET (Render)
//----------------------------------------------
const WS_URL = "wss://fila-de-mercado.onrender.com";

//----------------------------------------------
// ELEMENTOS DO HTML
//----------------------------------------------
const senhaAtualEl = document.getElementById("senhaAtual");
const historicoEl = document.getElementById("historico");
const btnProxima = document.getElementById("btnProxima");
const btnCancelar = document.getElementById("btnCancelar");
const btnPular = document.getElementById("btnPular");

//----------------------------------------------
// INICIAR CONEXÃO WEBSOCKET
//----------------------------------------------
let socket = new WebSocket(WS_URL);

socket.onopen = () => {
  console.log("🔌 Atendente conectado ao WebSocket");
};

socket.onerror = (err) => {
  console.warn("⚠️ Erro no WebSocket Atendente:", err);
};

socket.onclose = () => {
  console.log("🔌 WebSocket Atendente desconectado. Tentando reconectar...");
  setTimeout(() => {
    socket = new WebSocket(WS_URL);
    iniciarAtendenteJS();
  }, 2000);
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
    console.error("Erro ao processar mensagem WS Atendente:", e);
  }
};

//----------------------------------------------
// FUNÇÃO PARA ATUALIZAR O PAINEL DO ATENDENTE
//----------------------------------------------
function atualizarUI(data) {
  senhaAtualEl.textContent = data.historico?.[0] || "--";

  historicoEl.innerHTML = "";
  data.historico.slice(0, 5).forEach((s) => {
    const div = document.createElement("div");
    div.classList.add("item");
    div.textContent = s;
    historicoEl.appendChild(div);
  });
}

//----------------------------------------------
// BOTÕES DO ATENDENTE
//----------------------------------------------
btnProxima.addEventListener("click", () => {
  socket.send(JSON.stringify({ tipo: "chamar" }));
});

btnCancelar.addEventListener("click", () => {
  const senha = senhaAtualEl.textContent;
  if (!senha || senha === "--") return;

  socket.send(JSON.stringify({ tipo: "cancelarSenha", senha }));
});

btnPular.addEventListener("click", () => {
  socket.send(JSON.stringify({ tipo: "pular" }));
});
