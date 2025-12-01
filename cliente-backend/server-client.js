// server-client.js
// gateway que atende navegadores. Reencaminha requests ao backend do atendente.
// Requer: npm install ws express node-fetch

const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const fetch = require("node-fetch"); // node 18+ tem fetch nativo, mas para compatibilidade usamos node-fetch

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3500;

// ENDPOINT do atendente (mude para a URL pública quando em Render)
const ATENDENTE_HTTP = process.env.ATENDENTE_HTTP || "http://localhost:8080";
const ATENDENTE_WS = process.env.ATENDENTE_WS || "ws://localhost:8080";

// start http (para Render compatibilidade e healthcheck)
const server = app.listen(PORT, () => {
  console.log(`Client-backend (gateway) rodando na porta ${PORT}`);
});

// WebSocket server para navegadores
const wss = new WebSocket.Server({ server });

// conexão WS para o atendente (para receber broadcasts)
// Reconnect automático simples
let wsAtendente = null;
function conectarAtendente() {
  wsAtendente = new WebSocket(ATENDENTE_WS);

  wsAtendente.on("open", () => {
    console.log("Conectado ao WS do atendente");
  });

  wsAtendente.on("message", (data) => {
    // recebe atualizacoes do atendente e repassa para todos os browsers
    try {
      const msg = JSON.parse(data.toString());
      broadcastToBrowsers(msg);
    } catch (e) { }
  });

  wsAtendente.on("close", () => {
    console.log("WS atendente fechado, reconectando em 2s");
    setTimeout(conectarAtendente, 2000);
  });

  wsAtendente.on("error", (e) => {
    // ignora
  });
}
conectarAtendente();

// broadcast para browsers conectados neste gateway
function broadcastToBrowsers(obj) {
  const data = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(data);
    }
  });
}

// When a browser connects
wss.on("connection", (ws) => {
  console.log("Navegador conectado ao gateway");

  // opcional: enviar um ping de estado inicial (podemos buscar status via HTTP)
  (async () => {
    try {
      const r = await fetch(ATENDENTE_HTTP + "/status");
      if (r.ok) {
        const estado = await r.json();
        ws.send(JSON.stringify({ tipo: "atualizacao", fila: estado.fila, historico: estado.historico || [] }));
      }
    } catch (e) {}
  })();

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // gerar senha (browser -> gateway -> atendente HTTP)
      if (data.tipo === "gerarSenha") {
        const userId = data.userId;
        const res = await fetch(ATENDENTE_HTTP + "/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId })
        });
        const json = await res.json();
        // retorna para o browser quem solicitou
        ws.send(JSON.stringify({ tipo: "minhaSenha", senha: json.senha, position: json.position }));
        // o broadcast do atendente chegará em seguida e será repassado automaticamente
        return;
      }

      // cancelar (browser -> gateway -> atendente WS através de message 'cancelar' ou HTTP)
      if (data.tipo === "cancelar") {
        // encaminha para o atendente via WS (se conectado) ou via HTTP fallback
        if (wsAtendente && wsAtendente.readyState === WebSocket.OPEN) {
          wsAtendente.send(JSON.stringify({ tipo: "cancelar", userId: data.userId }));
        } else {
          await fetch(ATENDENTE_HTTP + "/cancel", { // optional endpoint if you implement
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: data.userId })
          }).catch(()=>{});
        }
        return;
      }

    } catch (err) {
      console.error("msg inválida do browser", err);
    }
  });

  ws.on("close", () => {
    // console.log("browser desconectado");
  });
});

// healthcheck endpoint
app.get("/health", (req, res) => res.json({ ok: true }));
