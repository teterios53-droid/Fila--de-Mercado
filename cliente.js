const socket = new WebSocket("wss://" + window.location.host);

let userId = localStorage.getItem("userId");
if (!userId) {
    userId = "user-" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("userId", userId);
}

const btnGerar = document.getElementById("btnGerar");
const btnCancelar = document.getElementById("btnCancelar");
const displaySenha = document.getElementById("senha");
const displayPosicao = document.getElementById("posicao");

// Enviar identificação ao conectar
socket.onopen = () => {
    socket.send(JSON.stringify({
        acao: "identificar",
        tipo: "cliente",
        userId
    }));
};

// Gerar senha
btnGerar.onclick = () => {
    socket.send(JSON.stringify({
        acao: "gerar",
        userId
    }));
};

// Cancelar senha
btnCancelar.onclick = () => {
    socket.send(JSON.stringify({
        acao: "cancelar",
        userId
    }));
};

// Receber mensagens do servidor
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Quando o cliente recebe sua senha
    if (data.tipo === "minhaSenha") {
        displaySenha.textContent = data.senha;
        displayPosicao.textContent = data.position + 1;
    }

    // Atualização geral da fila
    if (data.tipo === "atualizacao") {
        if (data.minhaSenha) {
            displaySenha.textContent = data.minhaSenha.senha;
            displayPosicao.textContent = data.minhaSenha.position + 1;
        } else {
            displaySenha.textContent = "---";
            displayPosicao.textContent = "-";
        }
    }
};
