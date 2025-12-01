// server-atendente.js
// Backend "master" — mantém a fila em memória e faz broadcast via WS.
// Requer: npm install express ws body-parser

const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");

const app = express();
app.use(bodyParser.json());

// porta (Render fornece via process.env.PORT)
const PORT = process.env.PORT || 8080;

// Estado em memória
let fila = [];           // [{ userId, senha, timestamp }]
let historico = [];      // últimas senhas chamadas
let contador = 1;

// util
function gerarSenhaString(n) { return "A" + n; }

// servidor HTTP básico (para gerar senha via client-backend)
app.post("/generate", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const nova = {
    userId,
    senha: gerarSenhaString(contador++),
    timestamp: Date.now()
  };
  fila.push(nova);

  // resposta imediata para quem solicitou
  res.json({ senha: nova.senha, position: fila.length - 1 });

  // notifica todos os subscribers via WS
  broadcastEstado();
});

// endpoint para inspeção/diagnóstico
app.get("/status", (req, res) => {
  res.json({
    fila,
    historico,
    contador
  });
});

// start HTTP server (Render espera um servidor HTTP)
const server = app.listen(PORT, () => {
  console.log(`Atendente HTTP rodando na porta ${PORT}`);
});

// WebSocket Server (para broadcast; o client-backend e o panel do atendente podem se conectar)
const wss = new WebSocket.Server({ server });

function send(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch(e){ /* ignore */ }
}

function broadcastEstado() {
  const payload = {
    tipo: "atualizacao",
    fila: fila.map(x => ({ userId: x.userId, senha: x.senha, timestamp: x.timestamp })),
    historico
  };
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) send(c, payload);
  });
}

// Recebe conexões WS (podem ser client-backends e painéis)
wss.on("connection", (ws, req) => {
  console.log("WS conectado (atendente) - novo cliente/subscriber");

  // enviar estado inicial
  send(ws, { tipo: "atualizacao", fila: fila.map(x => ({ userId: x.userId, senha: x.senha })), historico });

  ws.on("message", message => {
    // esperamos JSON com { tipo: "chamar" | "pular" | "cancelar", ... }
    try {
      const data = JSON.parse(message.toString());
      if (data.tipo === "chamar") {
        if (fila.length === 0) {
          send(ws, { tipo: "erro", msg: "Fila vazia" });
          return;
        }
        const atendido = fila.shift();         // remove primeiro
        historico.unshift(atendido.senha);     // empilha no historico
        if (historico.length > 50) historico.pop();
        // broadcast novo estado
        broadcastEstado();
        return;
      }

      if (data.tipo === "pular") {
        if (fila.length <= 1) return;
        const primeiro = fila.shift();
        fila.push(primeiro);
        broadcastEstado();
        return;
      }

      if (data.tipo === "cancelar") {
        // data.senha ou data.userId
        if (data.senha) {
          fila = fila.filter(x => x.senha !== data.senha);
        } else if (data.userId) {
          fila = fila.filter(x => x.userId !== data.userId);
        }
        broadcastEstado();
        return;
      }

      // opcional: permitir adicionar senha via WS (além do /generate)
      if (data.tipo === "add" && data.userId) {
        const nova = { userId: data.userId, senha: gerarSenhaString(contador++), timestamp: Date.now() };
        fila.push(nova);
        send(ws, { tipo: "minhaSenha", senha: nova.senha, pos: fila.length - 1 });
        broadcastEstado();
        return;
      }

    } catch (err) {
      console.error("msg inválida", err);
    }
  });

  ws.on("close", () => {
    // console.log("conexão ws fechada");
  });
});
