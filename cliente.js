//----------------------------------------------
// CONFIGURAÇÃO DO WEBSOCKET (Render)
//----------------------------------------------
const WS_URL = "wss://fila-de-mercado.onrender.com";

//----------------------------------------------
// ELEMENTOS DO HTML
//----------------------------------------------
const senhaEl = document.getElementById("senha");
const filaEl = document.getElementById("fila");
const tempoEl = document.getElementById("tempo");
const chamadaEl = document.getElementById("chamada");
const btnCancelar = document.getElementById("cancelar");

//----------------------------------------------
// VARIÁVEIS DO CLIENTE
//----------------------------------------------
let socket = null;
let userId = localStorage.getItem("userId") || gerarUserId();
localStorage.setItem("userId", userId);

let minhaSenha = localStorage.getItem("minhaSenha") || null;

//----------------------------------------------
// GERA UM ID ÚNICO PARA O CLIENTE
//----------------------------------------------
function gerarUserId() {
  return "U" + Math.random().toString(36).substring(2, 10);
}

//----------------------------------------------
// INICIAR CONEXÃO WEBSOCKET
//----------------------------------------------
function conectar() {

  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log("🔌 Conectado ao WebSocket");

    // Solicitar senha automaticamente ao entrar
    if (!minhaSenha) {
      socket.send(JSON.stringify({
        tipo: "gerarSenha",
        userId
      }));
    }

    // Se já tinha senha salva, reconectar
    if (minhaSenha) {
      socket.send(JSON.stringify({
        tipo: "reconectar",
        userId
      }));
    }
  };

  socket.onerror = (err) => {
    console.warn("⚠️ Erro no WebSocket:", err);
  };

  socket.onclose = () => {
    console.log("🔌 WebSocket desconectado. Tentando reconectar...");
    setTimeout(conectar, 2000);
  };

  socket.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      tratarMensagem(data);
    } catch (e) {
      console.error("Erro ao processar mensagem WS:", e);
    }
  };
}

conectar();

//----------------------------------------------
// TRATAMENTO DE MENSAGENS QUE CHEGAM DO BACKEND
//----------------------------------------------
function tratarMensagem(data) {

  if (data.tipo === "atualizacao") {
    atualizarFila(data);
    return;
  }

  if (data.tipo === "minhaSenha") {
    minhaSenha = data.senha;
    localStorage.setItem("minhaSenha", minhaSenha);
    senhaEl.textContent = minhaSenha;
    return;
  }

  if (data.tipo === "chamada") {
    chamadaEl.textContent = data.senha || "--";
    return;
  }
}

//----------------------------------------------
// ATUALIZA A INTERFACE DO CLIENTE
//----------------------------------------------
function atualizarFila(estado) {
  if (minhaSenha) {
    senhaEl.textContent = minhaSenha;
  }

  const posicao = estado.fila.findIndex(s => s.userId === userId);
  filaEl.textContent = 👥 ${posicao >= 0 ? posicao : "--"};

  tempoEl.textContent = ⏳ ${posicao >= 0 ? posicao : "--"} minutos;

  chamadaEl.textContent = estado.historico?.[0] || "--";
}

//----------------------------------------------
// CANCELAR O PEDIDO
//----------------------------------------------
btnCancelar.addEventListener("click", () => {
  if (!minhaSenha) return;

  socket.send(JSON.stringify({
    tipo: "cancelar",
    userId
  }));

  senhaEl.textContent = "--";
  filaEl.textContent = "--";
  tempoEl.textContent = "-- minutos";
  chamadaEl.textContent = "--";

  localStorage.removeItem("minhaSenha");
  minhaSenha = null;

  alert("Seu pedido foi cancelado!");
});
