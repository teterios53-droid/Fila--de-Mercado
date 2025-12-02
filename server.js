// --- IMPORTS ---
const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

// --- EXPRESS (para servir o site) ---
const app = express();
app.use(express.static(path.join(__dirname)));

// Rota principal
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Cria servidor HTTP + WS
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- FILA ---
let fila = [];         // Fila normal
let atual = null;      // Senha no painel
let proximaSenha = 1;

// --- Função para atualizar todos ---
function broadcastAtualizacao() {
    const msg = JSON.stringify({
        tipo: "atualizacao",
        senhaAtual: atual,
        fila
    });

    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(msg);
    });
}

// --- WEBSOCKET ---
wss.on("connection", (ws) => {

    // Envia estado inicial ao conectado
    ws.send(JSON.stringify({
        tipo: "atualizacao",
        senhaAtual: atual,
        fila
    }));

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        // ---- Cliente pede senha ----
        if (data.tipo === "pegarSenha") {
            fila.push(proximaSenha);

            ws.send(JSON.stringify({
                tipo: "suaSenha",
                senha: proximaSenha
            }));

            proximaSenha++;
            broadcastAtualizacao();
            return;
        }

        // ---- Atendente chama próxima ----
        if (data.acao === "chamar") {
            atual = fila.length > 0 ? fila.shift() : null;
            broadcastAtualizacao();
            return;
        }

        // ---- Atendente pula senha ----
        if (data.acao === "pular") {
            if (atual !== null || fila.length > 0) {

                const pulada = atual;

                atual = fila.length > 0 ? fila.shift() : null;

                if (pulada !== null) {
                    // volta depois de 1 atendimento
                    fila.splice(1, 0, pulada);
                }

                broadcastAtualizacao();
            }
        }
    });
});

// --- INICIA SERVIDOR ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () =>
    console.log("Servidor rodando na porta", PORT)
);
