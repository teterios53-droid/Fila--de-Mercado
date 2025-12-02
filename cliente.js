// ===========================
// CONFIGURAÇÕES INICIAIS
// ===========================
const socket = new WebSocket("wss://SEU_SERVIDOR_AQUI"); 
let popupTimer = null;
let countdownInterval = null;

// Som da chamada
const audio = new Audio("chamada.mp3");

// ===========================
// ELEMENTOS DO POPUP
// ===========================
function criarPopup() {
    const popup = document.createElement("div");
    popup.id = "popup-senha";
    popup.style.position = "fixed";
    popup.style.top = "0";
    popup.style.left = "0";
    popup.style.width = "100%";
    popup.style.height = "100%";
    popup.style.background = "rgba(0,0,0,0.6)";
    popup.style.display = "flex";
    popup.style.alignItems = "center";
    popup.style.justifyContent = "center";
    popup.style.zIndex = "9999";
    popup.style.fontFamily = "Arial";

    popup.innerHTML = `
        <div style="background:#fff; padding:30px; width:350px; text-align:center; border-radius:15px;">
            <h2 id="popupTitulo">Senha chamada!</h2>
            <p id="popupSenha" style="font-size:28px; font-weight:bold;">---</p>
            <p>Tempo restante:</p>
            <p id="popupTempo" style="font-size:32px; color:red;">40</p>
        </div>
    `;

    document.body.appendChild(popup);
}

function removerPopup() {
    const popup = document.getElementById("popup-senha");
    if (popup) popup.remove();

    // Reseta timers
    if (popupTimer) clearTimeout(popupTimer);
    if (countdownInterval) clearInterval(countdownInterval);
}

// ===========================
// FUNÇÃO PRINCIPAL: MOSTRAR POPUP
// ===========================
function mostrarPopupSenha(senha, numeroChamada) {
    removerPopup();
    criarPopup();

    document.getElementById("popupSenha").innerText = senha;

    let tempo = 40;
    document.getElementById("popupTempo").innerText = tempo;

    audio.play();

    // Contador visível
    countdownInterval = setInterval(() => {
        tempo--;
        document.getElementById("popupTempo").innerText = tempo;

        if (tempo <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);

    // Quando o tempo terminar → PULAR ou CANCELAR
    popupTimer = setTimeout(() => {
        if (numeroChamada === 1) {
            socket.send(JSON.stringify({ acao: "pularSenha", senha }));
            alert(`A senha ${senha} foi PULADA (1ª chamada esgotou).`);
        } else {
            socket.send(JSON.stringify({ acao: "cancelarSenha", senha }));
            alert(`A senha ${senha} foi CANCELADA (2ª chamada esgotou).`);
        }

        removerPopup();
    }, 40000);
}

// ===========================
// RECEBENDO DADOS DO SERVIDOR
// ===========================
socket.addEventListener("message", (event) => {
    const dados = JSON.parse(event.data);

    // Servidor envia algo como:
    // { tipo: "chamarSenha", senha: "A-015", chamada: 1 }
    if (dados.tipo === "chamarSenha") {
        mostrarPopupSenha(dados.senha, dados.chamada);
    }
});

socket.addEventListener("open", () => {
    console.log("Conectado ao servidor de senhas.");
});

socket.addEventListener("close", () => {
    console.log("Desconectado. Tentando reconectar em 3s...");
    setTimeout(() => location.reload(), 3000);
});
