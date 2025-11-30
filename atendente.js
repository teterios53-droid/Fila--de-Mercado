// =======================================
// Conexão WebSocket com o backend
// =======================================
const socket = new WebSocket("ws://localhost:8080");

// Elementos da tela
const senhaAtualBox = document.querySelector(".senha-box");
const btnChamar = document.querySelector(".button1");
const btnCancelar = document.querySelector(".danger");
const btnPular = document.querySelectorAll("button")[2];
const listaHistorico = document.querySelector(".list");

// Estado local
let senhaAtual = "--";
let historico = [];

// ===============================
// Recebe dados do servidor
// ===============================
socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  // Estado inicial enviado ao conectar
  if (msg.tipo === "estado-inicial") {
    senhaAtual = msg.dados.senhaAtual || "--";
    historico = msg.dados.historico || [];
    atualizarTela();
  }

  // Quando uma senha é chamada
  if (msg.tipo === "senha-chamada") {
    senhaAtual = msg.dados.senhaAtual;
    historico = msg.dados.historico;
    atualizarTela();
  }

  // Atualização somente da fila (pulo ou cancelamento)
  if (msg.tipo === "fila-atualizada") {
    // nada para mostrar no painel visual,
    // mas mantemos sincronizado caso precise
  }
};

// Atualiza tudo visualmente
function atualizarTela() {
  senhaAtualBox.textContent = senhaAtual || "--";

  let html = "<h3>Últimas Senhas Chamadas</h3>";

  historico.forEach(s => {
    html += `<div class="item">Açougue - ${s}</div>`;
  });

  listaHistorico.innerHTML = html;
}

// ===============================
// AÇÕES DO ATENDENTE
// ===============================

// CHAMAR próxima senha
btnChamar.onclick = () => {
  socket.send(JSON.stringify({ tipo: "chamar" }));
};

// CANCELAR senha atual
btnCancelar.onclick = () => {
  if (!senhaAtual || senhaAtual === "--") return;
  socket.send(JSON.stringify({ tipo: "cancelar", senha: senhaAtual }));
};

// PULAR senha
btnPular.onclick = () => {
  socket.send(JSON.stringify({ tipo: "pular" }));
};
