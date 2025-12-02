// ATENDENTE.JS
const WS_URL = "wss://fila-de-mercado.onrender.com";
const socket = new WebSocket(WS_URL);

const senhaAtual = document.getElementById("senhaAtual");
const historicoEl = document.getElementById("historico");
const btnProxima = document.getElementById("btnProxima");
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

// ---- AÇÕES ----

// CHAMAR PRÓXIMA (retira da fila e envia ao histórico)
btnProxima.onclick = () => {
  socket.send(JSON.stringify({ tipo: "chamar" }));
};

// PULAR (move a senha atual para o fim da fila)
btnPular.onclick = () => {
  socket.send(JSON.stringify({ tipo: "pular" }));
};
