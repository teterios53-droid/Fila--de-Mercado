// SERVER COMPLETO
const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const path = require("path");

const app = express();
app.use(bodyParser.json());

// Servir HTML, JS e imagens
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 8080;

// ---------------------------
// ESTADO DA FILA
// ---------------------------
let fila = [];          // { userId, senha, timestamp }
let historico = [];
let contador = 1;

// Gera senha ex: A1, A2, A3...
function gerarSenha() {
  return "A" + contador++;
}

function send(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch (e) {}
}

function broadcast(wss, obj, tipo = null) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      if (!tipo || c.tipo === tipo) c.send(msg);
    }
  });
}

// ---------------------------
// ROTAS HTTP (opcional)
// ---------------------------
app.get("/status", (req, res) => {
  res.json({ fila, historico, contador });
});

// ---------------------------
// INICIA SERVIDOR
// ---------------------------
const server = app.listen(PORT, () =>
  console.log("Servidor rodando na porta:", PORT)
);

// ---------------------------
// WEBSOCKET
// ---------------------------
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("WS conectado");

  // Envia estado inicial
  send(ws, { tipo: "atualizacao", fila, historico });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    // -----------------------
    // IDENTIFICAÇÃO
    // -----------------------
    if (data.tipo === "identificar") {
      ws.tipo = data.tipoCliente; // "cliente" ou "atendente"
      send(ws, { tipo: "atualizacao", fila, historico });
      return;
    }

    // -----------------------
    // CLIENTE
    // -----------------------
    if (ws.tipo === "cliente") {
      // Gerar senha
      if (data.tipo === "gerarSenha") {
        const nova = {
          userId: data.userId,
          senha: gerarSenha(),
          timestamp: Date.now()
        };
        fila.push(nova);

        send(ws, {
          tipo: "minhaSenha",
          senha: nova.senha,
          position: fila.length - 1
        });

        broadcast(wss, { tipo: "atualizacao", fila, historico });
      }

      // Cancelar
      if (data.tipo === "cancelar") {
        fila = fila.filter(x => x.userId !== data.userId);
        broadcast(wss, { tipo: "atualizacao", fila, historico });
      }
    }

    // -----------------------
    // ATENDENTE
    // -----------------------
    if (ws.tipo === "atendente") {

      // CHAMAR PRÓXIMA SENHA
      if (data.tipo === "chamar") {

        if (fila.length === 0) return;

        const atendida = fila.shift();
        historico.unshift(atendida.senha);
        if (historico.length > 50) historico.pop();

        broadcast(wss, { tipo: "chamada", senha: atendida.senha });
        broadcast(wss, { tipo: "atualizacao", fila, historico });
      }

      // PULAR — senha volta 1 posição antes de ser chamada novamente
      if (data.tipo === "pular") {

        if (fila.length <= 1) return;

        const atual = fila.shift(); // tira o primeiro
        fila.splice(1, 0, atual);   // coloca ele na segunda posição

        broadcast(wss, { tipo: "atualizacao", fila, historico });
      }
    }
  });
});
