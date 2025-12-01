// ATENDENTE.JS
const WS_URL = "wss://fila-de-mercado.onrender.com";

const socket = new WebSocket(WS_URL);

const senhaAtual = document.getElementById("senhaAtual");
const historicoEl = document.getElementById("historico");
const btnProxima = document.getElementById("btnProxima");
const btnCancelar = document.getElementById("btnCancelar");
const btnPular = document.getElementById("btnPular");

socket.onopen = () => {
  console.log("Atendente conectado ao WS");
  socket.send(JSON.stringify({ tipo: "identificar", tipoCliente: "atendente" }));
};

socket.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.tipo === "atualizacao") atualizarUI(data);
};

function atualizarUI(data) {
  senhaAtual.textContent = data.historico[0] || "--";

  historicoEl.innerHTML = "";
  data.historico.slice(0, 5).forEach(s => {
    const div = document.createElement("div");
    div.classList.add("item");
    div.textContent = s;
    historicoEl.appendChild(div);
  });
}

btnProxima.onclick = () => socket.send(JSON.stringify({ tipo: "chamar" }));
btnPular.onclick = () => socket.send(JSON.stringify({ tipo: "pular" }));
btnCancelar.onclick = () => {
  if (!senhaAtual.textContent || senhaAtual.textContent === "--") return;
  socket.send(JSON.stringify({ tipo: "cancelarSenha", senha: senhaAtual.textContent }));
};
