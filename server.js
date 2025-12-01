<script>
const WS_URL = "wss://fila-de-mercado.onrender.com";
let socket = new WebSocket(WS_URL);

socket.onopen = () => {
  console.log("Atendente conectado ao WebSocket");
};

socket.onmessage = (msg) => {
  const data = JSON.parse(msg.data);

  if (data.tipo === "atualizacao") {
    atualizarUI(data);
  }
};

function atualizarUI(data) {
  // senha atual é sempre o primeiro do histórico
  document.getElementById("senhaAtual").textContent = data.historico[0] || "--";

  const hist = document.getElementById("historico");
  hist.innerHTML = "";

  data.historico.slice(0, 5).forEach(s => {
    const div = document.createElement("div");
    div.classList.add("item");
    div.textContent = s;
    hist.appendChild(div);
  });
}

document.getElementById("btnProxima").onclick = () => {
  socket.send(JSON.stringify({ tipo: "chamar" }));
};

document.getElementById("btnCancelar").onclick = () => {
  const senhaAtual = document.getElementById("senhaAtual").textContent;

  if (senhaAtual && senhaAtual !== "--") {
    socket.send(JSON.stringify({
      tipo: "cancelarSenha",
      senha: senhaAtual
    }));
  }
};

document.getElementById("btnPular").onclick = () => {
  socket.send(JSON.stringify({ tipo: "pular" }));
};
</script>
