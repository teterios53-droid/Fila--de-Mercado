// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // ajuste se necessário

const PORT = process.env.PORT || 8080;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- Estado das filas e chamadas ---
const filas = {
  acougue: [], // cada item: { codigo: "A001", chamadas: 0, userId: optional }
  padaria: []
};

const chamadas = {
  acougue: null, // { codigo:"A001", chamada:1, timestamp, timerId }
  padaria: null
};

// Timer storage para limpar timers facilmente
const timers = {
  acougue: null,
  padaria: null
};

// Tempo em ms (40 segundos)
const TEMPO_CHAMADA_MS = 40 * 1000;

// --- Helpers de broadcast ---
function broadcastAll(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(msg);
    }
  });
}

function broadcastCategory(category, obj) {
  // atualmente broadcast para todos; caso queira filtrar por tipo de cliente,
  // adicione lógica aqui (por ex. c.role === 'atendente' etc).
  broadcastAll(obj);
}

// Atualiza todos com a fila atualizada (útil após mudanças)
function enviarFilaAtualizada(category) {
  broadcastAll({ tipo: "filaAtualizada", categoria: category, fila: filas[category] });
}

// Envia atualização geral (fila + chamada)
function enviarAtualizacaoGeral() {
  const payload = {
    tipo: "atualizacaoGeral",
    filas,
    chamadas: {
      acougue: chamadas.acougue ? { codigo: chamadas.acougue.codigo, chamada: chamadas.acougue.chamada } : null,
      padaria: chamadas.padaria ? { codigo: chamadas.padaria.codigo, chamada: chamadas.padaria.chamada } : null
    }
  };
  broadcastAll(payload);
}

// --- Timer management ---
function clearTimer(category) {
  if (timers[category]) {
    clearTimeout(timers[category]);
    timers[category] = null;
  }
  if (chamadas[category]) {
    chamadas[category].timerId = null;
  }
}

function startTimerParaChamada(category) {
  clearTimer(category);

  if (!chamadas[category]) return;
  const codigo = chamadas[category].codigo;
  const chamadaNum = chamadas[category].chamada; // 1 ou 2

  // Start timer
  timers[category] = setTimeout(() => {
    // Timer expirou para essa chamada
    if (chamadas[category] && chamadas[category].codigo === codigo) {
      // Caso 1: primeira chamada expirou
      if (chamadaNum === 1) {
        // Notificar que tempo esgotou na 1ª chamada
        broadcastAll({ tipo: "tempoEsgotadoPrimeiraChamada", categoria, senha: codigo });

        // Recolocar a senha para ser chamada logo após a próxima:
        // Implementação: inserir no início da fila para que ela volte logo na próxima chamada
        filas[category].unshift(codigo);

        // Emitir evento de senha pulada
        broadcastAll({ tipo: "senhaPulada", categoria, senha: codigo });

        // limpar a chamada atual (libera atendente para próxima)
        chamadas[category] = null;
        clearTimer(category);

        // Atualiza fila e estado
        enviarFilaAtualizada(category);
        enviarAtualizacaoGeral();
      }
      // Caso 2: segunda chamada expirou => cancelar
      else {
        broadcastAll({ tipo: "tempoEsgotadoSegundaChamada", categoria, senha: codigo });
        broadcastAll({ tipo: "senhaCancelada", categoria, senha: codigo });

        // limpa a chamada atual sem retornar à fila
        chamadas[category] = null;
        clearTimer(category);

        enviarFilaAtualizada(category);
        enviarAtualizacaoGeral();
      }
    }
  }, TEMPO_CHAMADA_MS);

  // guarda timerId no objeto de chamada
  if (chamadas[category]) chamadas[category].timerId = timers[category];
}

// --- Funções principais ---
function chamarProxima(category) {
  // se já existe uma chamada em andamento, ignorar ou permitir repetir?
  // vamos permitir que chamarProxima só funcione se não houver chamada atual
  if (chamadas[category]) {
    // já existe uma chamada em andamento — retornar aviso
    return { ok: false, msg: "Já existe uma chamada em andamento nessa categoria." };
  }

  if (!filas[category] || filas[category].length === 0) {
    return { ok: false, msg: "Fila vazia" };
  }

  // pega próxima da fila
  const codigo = filas[category].shift();

  // cria chamada
  chamadas[category] = {
    codigo,
    chamada: 1,
    timestamp: Date.now(),
    timerId: null
  };

  // envia a chamada para todos (clientes e atendentes)
  broadcastAll({
    tipo: "chamarSenha",
    categoria,
    senha: codigo,
    chamada: 1
  });

  // atualiza filas
  enviarFilaAtualizada(category);
  enviarAtualizacaoGeral();

  // inicia timer
  startTimerParaChamada(category);

  return { ok: true };
}

function repetirChamada(category) {
  if (!chamadas[category]) {
    return { ok: false, msg: "Não há chamada ativa para repetir." };
  }

  // só permitir repetir se for primeira chamada
  if (chamadas[category].chamada >= 2) {
    return { ok: false, msg: "Já foi repetida 2 vezes." };
  }

  // incrementar para a 2ª chamada
  chamadas[category].chamada = 2;
  chamadas[category].timestamp = Date.now();

  // enviar segundo aviso
  broadcastAll({
    tipo: "chamarSenha",
    categoria,
    senha: chamadas[category].codigo,
    chamada: 2
  });

  // reiniciar timer para a 2ª chamada
  startTimerParaChamada(category);

  enviarAtualizacaoGeral();
  return { ok: true };
}

function pularSenhaServidor(category) {
  if (!chamadas[category]) return { ok: false, msg: "Nenhuma chamada ativa para pular." };

  const codigo = chamadas[category].codigo;

  // enviar evento
  broadcastAll({ tipo: "senhaPulada", categoria, senha: codigo });

  // reinsere a senha para logo após próxima (coloca no início da fila)
  filas[category].unshift(codigo);

  // limpa chamada e timer
  chamadas[category] = null;
  clearTimer(category);

  enviarFilaAtualizada(category);
  enviarAtualizacaoGeral();
  return { ok: true };
}

function cancelarSenhaServidor(category) {
  if (!chamadas[category]) return { ok: false, msg: "Nenhuma chamada ativa para cancelar." };

  const codigo = chamadas[category].codigo;

  // enviar evento
  broadcastAll({ tipo: "senhaCancelada", categoria, senha: codigo });

  // limpa chamada e timer (não reentra na fila)
  chamadas[category] = null;
  clearTimer(category);

  enviarFilaAtualizada(category);
  enviarAtualizacaoGeral();
  return { ok: true };
}

function confirmarChegada(category, codigo) {
  // se a chamada atual é essa, confirma e limpa timer
  if (chamadas[category] && chamadas[category].codigo === codigo) {
    clearTimer(category);
    broadcastAll({ tipo: "clienteConfirmado", categoria, senha: codigo });

    // marcar de alguma forma ou finalizar
    chamadas[category] = null;
    enviarAtualizacaoGeral();
    return { ok: true };
  }
  return { ok: false, msg: "Chamada não coincide ou não existe." };
}

// --- WebSocket handling ---
wss.on("connection", (ws) => {
  // opcional: marcar role (cliente/atendente) se o front enviar identificar
  ws.on("message", (msg) => {
    let data = null;
    try { data = JSON.parse(msg); } catch (e) { console.warn("JSON inválido:", msg); return; }

    // identificar
    if (data.tipo === "identificar" && data.tipoCliente) {
      ws.role = data.tipoCliente; // 'cliente' ou 'atendente'
      // enviar estado inicial
      ws.send(JSON.stringify({
        tipo: "inicial",
        filas,
        chamadas: {
          acougue: chamadas.acougue ? { codigo: chamadas.acougue.codigo, chamada: chamadas.acougue.chamada } : null,
          padaria: chamadas.padaria ? { codigo: chamadas.padaria.codigo, chamada: chamadas.padaria.chamada } : null
        }
      }));
      return;
    }

    // Gerar nova senha (cliente)
    if (data.acao === "gerarSenha") {
      const categoria = data.categoria || "acougue";
      const codigo = data.codigo || generateCodigo(categoria);

      filas[categoria].push(codigo);
      enviarFilaAtualizada(categoria);
      enviarAtualizacaoGeral();
      continueIfNeeded();
      return;
    }

    // Cliente confirma que está indo
    if (data.acao === "confirmar") {
      const categoria = data.categoria || detectCategoriaFromCodigo(data.senha) || "acougue";
      const codigo = data.senha;
      const r = confirmarChegada(categoria, codigo);
      // opcional: responder só para quem pediu
      ws.send(JSON.stringify({ tipo: "confirmarResposta", ok: r.ok, msg: r.msg || null }));
      return;
    }

    // Atendente chama próxima
    if (data.acao === "chamarProxima") {
      const categoria = data.categoria || "acougue";
      const r = chamarProxima(categoria);
      ws.send(JSON.stringify({ tipo: "chamarResposta", ok: r.ok, msg: r.msg || null }));
      return;
    }

    // Atendente repete a chamada (2ª)
    if (data.acao === "repetirChamada") {
      const categoria = data.categoria || "acougue";
      const r = repetirChamada(categoria);
      ws.send(JSON.stringify({ tipo: "repetirResposta", ok: r.ok, msg: r.msg || null }));
      return;
    }

    // Cliente/Servidor notificam pular (pode vir do cliente quando timer do cliente estoura)
    if (data.acao === "pularSenha") {
      // se enviaram categoria tente usá-la, senão deduza por código
      const categoria = data.categoria || detectCategoriaFromCodigo(data.senha) || "acougue";
      const r = pularSenhaServidor(categoria);
      ws.send(JSON.stringify({ tipo: "pularResposta", ok: r.ok, msg: r.msg || null }));
      return;
    }

    // Cancelar senha (quando expira 2ª vez ou manual)
    if (data.acao === "cancelarSenha") {
      const categoria = data.categoria || detectCategoriaFromCodigo(data.senha) || "acougue";
      const r = cancelarSenhaServidor(categoria);
      ws.send(JSON.stringify({ tipo: "cancelarResposta", ok: r.ok, msg: r.msg || null }));
      return;
    }
  });

  // envia estado inicial ao conectar
  ws.send(JSON.stringify({
    tipo: "inicial",
    filas,
    chamadas: {
      acougue: chamadas.acougue ? { codigo: chamadas.acougue.codigo, chamada: chamadas.acougue.chamada } : null,
      padaria: chamadas.padaria ? { codigo: chamadas.padaria.codigo, chamada: chamadas.padaria.chamada } : null
    }
  }));
});

// --- util: gera código simples A001/B001 etc (você pode adaptar) ---
let contadorA = 1;
let contadorP = 1;
function generateCodigo(categoria) {
  if (categoria === "padaria") {
    return "P" + String(contadorP++).padStart(3, "0");
  }
  return "A" + String(contadorA++).padStart(3, "0");
}

// util: tenta adivinhar categoria pelo prefixo do código
function detectCategoriaFromCodigo(codigo) {
  if (!codigo || typeof codigo !== "string") return null;
  if (codigo.startsWith("P")) return "padaria";
  if (codigo.startsWith("A")) return "acougue";
  return null;
}

// Se quiser ligar um comportamento automático (ex: quando fila voltar a ter items, não necessário)
// placeholder
function continueIfNeeded() {
  // por enquanto não faz nada
}

// --- iniciar servidor ---
server.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
