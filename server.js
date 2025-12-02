// =====================================================
// SERVER.JS — SISTEMA DE FILA DIGITAL (REORGANIZADO)
// =====================================================

const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const path = require("path");

const app = express();
app.use(bodyParser.json());

// Servir página + scripts + imagens
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 8080;

// =====================================================
// ESTADO GLOBAL
// =====================================================
let fila = [];              // { userId, senha, timestamp }
let historico = [];         // lista de senhas chamadas
let puladas = [];           // senhas que foram puladas
let senhaAtual = null;      // senha atualmente chamada
let contador = 1;           // contador do gerador

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================
function gerarSenha() {
  return "A" + contador++;
}

function send(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch {}
}

function broadcast(wss, obj, tipoPara = null) {
  const json = JSON.stringify(obj);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      if (!tipoPara || ws.tipo === tipoPara) ws.send(json);
    }
  });
}

function registrarHistorico(senha) {
  if (!senha) return;
  historico.unshift(senha);
  if (historico.length > 50) historico.pop();
}

// =====================================================
// LÓGICA PRINCIPAL — ATENDENTE
// =====================================================

// CHAMAR PRÓXIMA SENHA
function chamarProxima(wss) {
  // 1 — existe senha pulada esperando?
  if (puladas.length > 0) {
    senhaAtual = puladas.shift();
  }
  // 2 — senão pega da fila normal
  else if (fila.length > 0) {
    const atendido = fila.shift();
    senhaAtual = atendido.senha;
  }
  else {
    senhaAtual = null;
  }

  registrarHistorico(senhaAtual);

  broadcast(wss, { tipo: "chamada", senha: senhaAtual });
  broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
  broadcast(wss, { tipo: "atualizacao", fila, historico }, "atendente");
}

// PULAR SENHA ATUAL
function pularSenha(wss) {

  // Se não há senha atual ainda, chama a primeira
  if (!senhaAtual) {
    chamarProxima(wss);
    return;
  }

  // 1 — guarda a senha atual temporariamente
  const senhaPulada = senhaAtual;

  // 2 — chama a próxima senha da fila
  let novaAtual = null;

  if (fila.length > 0) {
    const proxima = fila.shift();
    novaAtual = proxima.senha;
  }

  senhaAtual = novaAtual;

  // 3 — reinsere a senha pulada LOGO DEPOIS da próxima senha
  if (novaAtual) {
    // insere no início da fila
    fila.unshift({ userId: null, senha: senhaPulada, timestamp: Date.now() });
  } else {
    // se não tem próxima senha, volta ela para atual
    senhaAtual = senhaPulada;
  }

  // registra no histórico
  registrarHistorico(senhaAtual);

  // envia atualizações
  broadcast(wss, { tipo: "chamada", senha: senhaAtual || "--" });
  broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
  broadcast(wss, { tipo: "atualizacao", fila, historico }, "atendente");
}


// CANCELAR SENHA ESPECÍFICA
function cancelarSenha(wss, senha) {
  fila = fila.filter(x => x.senha !== senha);
  puladas = puladas.filter(x => x !== senha);

  broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
  broadcast(wss, { tipo: "atualizacao", fila, historico }, "atendente");
}

// =====================================================
// ROTAS HTTP
// =====================================================
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

// =====================================================
// INICIAR SERVIDOR
// =====================================================
const server = app.listen(PORT, () => {
  console.log("Servidor rodando na porta:", PORT);
});

// =====================================================
// WEBSOCKET
// =====================================================
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("WS conectado");

  send(ws, { tipo: "atualizacao", fila, historico });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // IDENTIFICAÇÃO
      if (data.tipo === "identificar") {
        ws.tipo = data.tipoCliente;
        send(ws, { tipo: "atualizacao", fila, historico });
        return;
      }

      // ---------------------------------------------
      // CLIENTE
      // ---------------------------------------------
      if (ws.tipo === "cliente") {
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

          broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
        }

        if (data.tipo === "cancelar") {
          fila = fila.filter(x => x.userId !== data.userId);
          broadcast(wss, { tipo: "atualizacao", fila, historico }, "cliente");
        }
      }

      // ---------------------------------------------
      // ATENDENTE
      // ---------------------------------------------
      if (ws.tipo === "atendente") {

        if (data.tipo === "chamar") {
          chamarProxima(wss);
        }

        if (data.tipo === "pular") {
          pularSenha(wss);
        }

        if (data.tipo === "cancelarSenha") {
          cancelarSenha(wss, data.senha);
        }
      }

    } catch (e) {
      console.log("Erro WS:", e);
    }
  });
});
