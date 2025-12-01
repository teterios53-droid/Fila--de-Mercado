// SERVER COMPLETO 
const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const path = require("path");

const app = express();
app.use(bodyParser.json());

// Servir toda a pasta do projeto (HTML / JS / imagens)
app.use(express.static(path.join(__dirname)));

// Porta
const PORT = process.env.PORT || 8080;

// Estado da fila
let fila = [];          // { userId, senha, timestamp }
let historico = [];
let contador = 1;

function gerarSenha() {
  return "A" + contador++;
}

function send(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch (e) {}
}

function broadcast(wss, obj, tipoPara = null) {
  const json = JSON.stringify(obj);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      if (!tipoPara || ws.tipo === tipoPara) ws.send(json);
    }
  });
}

// -------- ROTAS HTTP ---------
app.post("/generate", (req, res) => {
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: "userId required" });

  const nova = { userId, senha: gerarSenha(), timestamp: Date.now() };
  fila.push(nova);

  res.json({ senha: nova.senha, position: fila.length - 1 });
  broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
});

app.get("/status", (req, res) => {
  res.json({ fila, historico, contador });
});

// -------- INICIA SERVIDOR HTTP ---------
const server = app.listen(PORT, () => console.log("Servidor rodando na porta", PORT));

// -------- WEBSOCKET ---------
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("WS conectado");

  send(ws, { tipo: "atualizacao", fila, historico });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // -------------------------------
      // IDENTIFICAÇÃO
      // -------------------------------
      if (data.tipo === "identificar") {
        ws.tipo = data.tipoCliente; // "cliente" ou "atendente"
        send(ws, { tipo: "atualizacao", fila, historico });
        return;
      }

      // -------------------------------
      // COMANDOS CLIENTE
      // -------------------------------
      if (ws.tipo === "cliente") {
        if (data.tipo === "gerarSenha") {
          const nova = { userId: data.userId, senha: gerarSenha(), timestamp: Date.now() };
          fila.push(nova);

          send(ws, { tipo: "minhaSenha", senha: nova.senha, position: fila.length - 1 });
          broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
        }

        if (data.tipo === "cancelar") {
          fila = fila.filter(x => x.userId !== data.userId);
          broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
        }

        if (data.tipo === "reconectar") {
          send(ws, { tipo: "atualizacao", fila, historico });
        }
      }

      // -------------------------------
      // COMANDOS ATENDENTE
      // -------------------------------
      if (ws.tipo === "atendente") {
        if (data.tipo === "chamar") {
          if (fila.length === 0) return;
          const atendido = fila.shift();
          historico.unshift(atendido.senha);
          if (historico.length > 50) historico.pop();

          broadcast(wss, { tipo: "chamada", senha: atendido.senha });
          broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
          broadcast(wss, { tipo: "atualizacao", fila, historico }, "atendente");
        }

        if (data.tipo === "pular") {
          if (fila.length <= 1) return;
          const primeiro = fila.shift();
          fila.push(primeiro);
          broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
          broadcast(wss, { tipo: "atualizacao", fila, historico }, "atendente");
        }

        if (data.tipo === "cancelarSenha") {
          fila = fila.filter(x => x.senha !== data.senha);
          broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
          broadcast(wss, { tipo: "atualizacao", fila, historico }, "atendente");
        }
      }

    } catch (e) {
      console.log("Erro WS:", e);
    }
  });
});
