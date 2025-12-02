const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

// FILAS POR CATEGORIA
let filas = {
    acougue: [],
    padaria: []
};

// SENHA ATUAL CHAMADA (por categoria)
let chamadas = {
    acougue: null,
    padaria: null
};

// ===============================
// BROADCAST
// ===============================
function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

// ===============================
// ENVIAR CHAMADA PARA OS CLIENTES
// ===============================
function chamarSenha(categoria) {
    const senha = chamadas[categoria];
    if (!senha) return;

    senha.chamada++; // <-- incrementa 1ª ou 2ª chamada

    broadcast({
        tipo: "chamarSenha",
        senha: senha.codigo,
        categoria,
        chamada: senha.chamada
    });
}

// ===============================
// WEBSOCKET
// ===============================
wss.on("connection", (ws) => {
    console.log("Novo cliente conectado.");

    ws.on("message", (msg) => {
        const dados = JSON.parse(msg);

        // =====================================
        // 1. GERAR SENHA
        // =====================================
        if (dados.acao === "gerarSenha") {
            const categoria = dados.categoria;
            const codigo = dados.codigo;

            filas[categoria].push(codigo);

            broadcast({
                tipo: "filaAtualizada",
                categoria,
                fila: filas[categoria]
            });
        }

        // =====================================
        // 2. ATENDENTE CHAMA SENHA
        // =====================================
        if (dados.acao === "chamarProxima") {
            const categoria = dados.categoria;

            if (filas[categoria].length === 0) {
                ws.send(JSON.stringify({ tipo: "erro", msg: "Fila vazia" }));
                return;
            }

            const codigo = filas[categoria].shift();

            // Cria objeto da senha ativa
            chamadas[categoria] = {
                codigo,
                chamada: 0 // vai virar 1 na função chamarSenha()
            };

            // Atualiza fila
            broadcast({
                tipo: "filaAtualizada",
                categoria,
                fila: filas[categoria]
            });

            // Envia primeira chamada
            chamarSenha(categoria);
        }

        // =====================================
        // 3. CLIENTE NÃO APARECE → TEMPO ACABOU → PULAR
        // =====================================
        if (dados.acao === "pularSenha") {
            const senha = dados.senha;

            console.log(`Senha ${senha} foi PULADA.`);

            // Envia aos atendentes
            broadcast({
                tipo: "senhaPulada",
                senha
            });

            // Recoloca no fim da fila
            Object.keys(filas).forEach(cat => {
                if (chamadas[cat] && chamadas[cat].codigo === senha) {
                    filas[cat].push(senha);
                    chamadas[cat] = null;

                    broadcast({
                        tipo: "filaAtualizada",
                        categoria: cat,
                        fila: filas[cat]
                    });
                }
            });
        }

        // =====================================
        // 4. CLIENTE NÃO APARECE NA 2ª VEZ → CANCELAR
        // =====================================
        if (dados.acao === "cancelarSenha") {
            const senha = dados.senha;

            console.log(`Senha ${senha} foi CANCELADA.`);

            broadcast({
                tipo: "senhaCancelada",
                senha
            });

            // Retira a senha definitivamente
            Object.keys(chamadas).forEach(cat => {
                if (chamadas[cat] && chamadas[cat].codigo === senha) {
                    chamadas[cat] = null;
                }
            });
        }

        // =====================================
        // 5. ATENDENTE RECHAMAR (2ª chamada manual)
        // =====================================
        if (dados.acao === "repetirChamada") {
            const categoria = dados.categoria;

            if (chamadas[categoria]) {
                chamarSenha(categoria);
            }
        }
    });
});

console.log("Servidor WebSocket rodando na porta 8080");
