const socket = new WebSocket("wss://" + window.location.host);

// Elementos do HTML
const displaySenha = document.getElementById("senha");
const displayFila = document.getElementById("fila");
const displayTempo = document.getElementById("tempo");
const displayChamada = document.getElementById("chamada");
const btnCancelar = document.getElementById("cancelar");

// A senha atual do cliente
let minhaSenha = null;

// Ao conectar, nada precisa ser enviado ao servidor
socket.onopen = () => {
    console.log("Conectado ao servidor");
};

// Quando o cliente clica em pegar senha — SEU HTML não tem botão
// Então vamos pegar a senha automaticamente quando abrir a página
window.onload = () => {
    socket.send(JSON.stringify({ tipo: "pegarSenha" }));
};

// Cancelar pedido
btnCancelar.onclick = () => {
    minhaSenha = null;
    displaySenha.textContent = "--";
    displayFila.textContent = "👥 --";
    displayTempo.textContent = "⏳ -- minutos";
};

// Recebendo mensagens do servidor
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Recebi minha senha
    if (data.tipo === "suaSenha") {
        minhaSenha = data.senha;
        displaySenha.textContent = minhaSenha;
        return;
    }

    // Atualização da senha sendo atendida
    if (data.tipo === "atualizacao") {
        const atual = data.senhaAtual;

        displayChamada.textContent = atual !== null ? atual : "--";

        // Se cliente cancelou ou ainda não tem senha
        if (!minhaSenha) {
            displayFila.textContent = "👥 --";
            displayTempo.textContent = "⏳ -- minutos";
            return;
        }

        // Cálculo de pessoas na frente
        if (atual === null) {
            displayFila.textContent = "👥 --";
            displayTempo.textContent = "⏳ -- minutos";
            return;
        }

        let pessoas = minhaSenha - atual;

        if (pessoas < 0) pessoas = 0;

        displayFila.textContent = "👥 " + pessoas;

        // tempo estimado simples (1 minuto por pessoa)
        displayTempo.textContent = "⏳ " + (pessoas * 1) + " minutos";
    }
};
