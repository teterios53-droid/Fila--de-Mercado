// ATENDENTE.JS

// Sempre pega automaticamente o WS correto (Render ou local)
const WS_URL = location.origin.replace("http", "ws");

const socket = new WebSocket(WS_URL);

const senhaAtual = document.getElementById("senhaAtual");
const historicoEl = document.getElementById("historico");
const btnProxima = document.getElementById("btnProxima");
const btnCancelar = document.getElementById("btnCancelar");
const btnPular = document.getElementById("btnPular");

socket.onopen = () => {
  console.log("🧑‍💼 Atendente conectado ao WS");
  socket.send(JSON.stringify({ tipo: "identificar", tipoCliente: "atendente" }));
};

socket.onmessage = (msg) => {
  try {
    const data = JSON.parse(msg.data);

    if (data.tipo === "atualizacao") atualizarUI(data);
    if (data.tipo === "chamada") atualizarUI({ historico: [data.senha] });

  } catch (e) {
    console.error("Erro ao processar WS:", e);
  }
};

socket.onclose = () => {
  console.warn("WS desconectado (atendente), tentando reconectar...");
  setTimeout(() => location.reload(), 2000);
};

function atualizarUI(data) {
  senhaAtual.textContent = data.historico?.[0] || "--";

  historicoEl.innerHTML = "";
  data.historico?.slice(0, 5).forEach(s => {
    const div = document.createElement("div");
    div.classList.add("item");
    div.textContent = s;
    historicoEl.appendChild(div);
  });
}

btnProxima.onclick = () => socket.send(JSON.stringify({ tipo: "chamar" }));
btnPular.onclick = () => socket.send(JSON.stringify({ tipo: "pular" }));

btnCancelar.onclick = () => {
  const senha = senhaAtual.textContent;
  if (!senha || senha === "--") return;

  socket.send(JSON.stringify({ tipo: "cancelarSenha", senha }));
};
