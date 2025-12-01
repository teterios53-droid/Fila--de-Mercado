//server

const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;

// ESTADO
let fila = [];          // { userId, senha, timestamp }
let historico = [];
let contador = 1;

function gerarSenha() { return "A" + contador++; }

function send(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch (e) {}
}

function broadcast(wss, obj) {
  const json = JSON.stringify(obj);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(json);
  });
}

// HTTP
app.post("/generate", (req, res) => {
  const { userId } = req.body;

  if (!userId)
    return res.status(400).json({ error: "userId required" });

  const nova = {
    userId,
    senha: gerarSenha(),
    timestamp: Date.now()
  };

  fila.push(nova);

  // resposta ao cliente via HTTP
  res.json({ senha: nova.senha, position: fila.length - 1 });

  // broadcast geral
  broadcast(wss, { tipo: "atualizacao", fila, historico });
});

app.get("/status", (req, res) => {
  res.json({ fila, historico, contador });
});

const server = app.listen(PORT, () =>
  console.log("Servidor rodando porta", PORT)
);

const wss = new WebSocket.Server({ server });

// WEBSOCKET PRINCIPAL
wss.on("connection", (ws) => {
  console.log("WS conectado");

  // estado inicial
  send(ws, { tipo: "atualizacao", fila, historico });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      //----------------------------------
      // RECONEXÃO DO CLIENTE.JS
      //----------------------------------
      if (data.tipo === "reconectar") {
        send(ws, {
          tipo: "atualizacao",
          fila,
          historico
        });
        return;
      }

      //----------------------------------
      // CLIENTE – Gerar senha via WS
      //----------------------------------
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
        return;
      }

      //----------------------------------
      // CLIENTE – Cancelar
      //----------------------------------
      if (data.tipo === "cancelar") {
        fila = fila.filter(x => x.userId !== data.userId);

        broadcast(wss, {
          tipo: "atualizacao",
          fila,
          historico
        });
        return;
      }

      //----------------------------------
      // ATENDENTE – Chamar próxima
      //----------------------------------
      if (data.tipo === "chamar") {
        if (fila.length === 0) return;

        const atendido = fila.shift();
        historico.unshift(atendido.senha);
        if (historico.length > 50) historico.pop();

        // PARA SEU cliente.js
        broadcast(wss, { tipo: "chamada", senha: atendido.senha });

        broadcast(wss, { tipo: "atualizacao", fila, historico });
        return;
      }

      //----------------------------------
      // ATENDENTE – Pular
      //----------------------------------
      if (data.tipo === "pular") {
        if (fila.length <= 1) return;

        const primeiro = fila.shift();
        fila.push(primeiro);

        broadcast(wss, { tipo: "atualizacao", fila, historico });
        return;
      }

      //----------------------------------
      // ATENDENTE – Cancelar senha
      //----------------------------------
      if (data.tipo === "cancelarSenha") {
        fila = fila.filter(x => x.senha !== data.senha);

        broadcast(wss, { tipo: "atualizacao", fila, historico });
        return;
      }

    } catch (e) {
      console.log("Erro WS:", e);
    }
  });
});
