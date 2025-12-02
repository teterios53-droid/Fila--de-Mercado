const http = require("http");
const WebSocket = require("ws");

let fila = [];         // Fila normal
let atual = null;      // Senha que está no painel

let proximaSenha = 1;  // Para os clientes

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Função para enviar atualização a todos
function broadcastAtualizacao() {
    const msg = JSON.stringify({
        tipo: "atualizacao",
        senhaAtual: atual
    });

    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(msg);
    });
}

wss.on("connection", (ws) => {
    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        // ---- Cliente pediu senha ----
        if (data.tipo === "pegarSenha") {
            fila.push(proximaSenha);
            ws.send(JSON.stringify({ tipo: "suaSenha", senha: proximaSenha }));
            proximaSenha++;
            return;
        }

        // ---- Atendente chama próxima ----
        if (data.acao === "chamar") {
            if (fila.length > 0) {
                atual = fila.shift();
            } else {
                atual = null;
            }
            broadcastAtualizacao();
            return;
        }

        // ---- Atendente pulou ----
        if (data.acao === "pular") {
            if (fila.length > 0 || atual !== null) {

                // Guarda a senha atual
                const pulada = atual;

                // Chama a próxima automaticamente
                atual = fila.length > 0 ? fila.shift() : null;

                // Reinsere a pulada um número antes da próxima chamada:
                // → posição 0 seria igual "agora"
                // → posição 1 a coloca para voltar depois de 1 atendimento
                if (pulada !== null) {
                    fila.splice(1, 0, pulada);
                }

                broadcastAtualizacao();
            }
        }
    });

    // Envia a senha atual ao novo conectado
    ws.send(JSON.stringify({ tipo: "atualizacao", senhaAtual: atual }));
});

server.listen(process.env.PORT || 3000);
