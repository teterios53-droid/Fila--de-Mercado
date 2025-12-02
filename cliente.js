// CLIENTE.JS

// Sempre usa o mesmo domínio do servidor (Render ou local)
const WS_URL = location.origin.replace("http", "ws");

const senhaEl = document.getElementById("senha");
const filaEl = document.getElementById("fila");
const tempoEl = document.getElementById("tempo");
const chamadaEl = document.getElementById("chamada");
const btnCancelar = document.getElementById("cancelar");

let socket = null;
let userId = localStorage.getItem("userId") || gerarUserId();
localStorage.setItem("userId", userId);

let minhaSenha = localStorage.getItem("minhaSenha") || null;

function gerarUserId() {
  return "U" + Math.random().toString(36).substring(2, 10);
}

function conectar() {
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log("🔌 Cliente conectado ao WebSocket");

    socket.send(JSON.stringify({ tipo: "identificar", tipoCliente: "cliente" }));

    if (!minhaSenha) {
      socket.send(JSON.stringify({ tipo: "gerarSenha", userId }));
    } else {
      socket.send(JSON.stringify({ tipo: "reconectar", userId }));
    }
  };

  socket.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      tratarMensagem(data);
    } catch (e) {
      console.error("Erro ao processar WS:", e);
    }
  };

  socket.onclose = () => {
    console.warn("WS desconectado, tentando reconectar...");
    setTimeout(conectar, 2000);
  };

  socket.onerror = (err) => {
    console.warn("Erro WS:", err);
  };
}

conectar();

function tratarMensagem(data) {
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

  if (data.tipo === "atualizacao") {
    atualizarFila(data);
  }
}

function atualizarFila(estado) {
  if (minhaSenha) senhaEl.textContent = minhaSenha;

  const posicao = estado.fila.findIndex(s => s.userId === userId);

  filaEl.textContent = posicao >= 0 ? posicao : "--";
  tempoEl.textContent = `${posicao >= 0 ? posicao : "--"} minutos`;

  chamadaEl.textContent = estado.historico?.[0] || "--";
}

btnCancelar.addEventListener("click", () => {
  if (!minhaSenha) return;

  socket.send(JSON.stringify({ tipo: "cancelar", userId }));

  senhaEl.textContent = "--";
  filaEl.textContent = "--";
  tempoEl.textContent = "-- minutos";
  chamadaEl.textContent = "--";

  localStorage.removeItem("minhaSenha");
  minhaSenha = null;

  alert("Sua senha foi cancelada!");
});
