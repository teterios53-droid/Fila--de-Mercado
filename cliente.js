const socket = new WebSocket("wss://" + window.location.host);

let userId = localStorage.getItem("userId");
let minhaSenha = null;

// Se nunca pegou senha antes
if (!userId) {
    userId = "u-" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("userId", userId);
}

// Elementos
const displaySenha = document.getElementById("senha");
const displayFila = document.getElementById("fila");
const displayTempo = document.getElementById("tempo");
const displayChamada = document.getElementById("chamada");
const btnCancelar = document.getElementById("cancelar");

// Conexão
socket.onopen = () => {
    socket.send(JSON.stringify({
        tipo: "identificar",
        tipoCliente: "cliente"
    }));

    // pegar automaticamente se ainda não tiver senha
    if (!localStorage.getItem("minhaSenha")) {
        socket.send(JSON.stringify({
            tipo: "gerarSenha",
            userId
        }));
    }
};

// Cancelar senha
btnCancelar.onclick = () => {
    socket.send(JSON.stringify({
        tipo: "cancelar",
        userId
    }));

    displaySenha.textContent = "--";
    displayFila.textContent = "--";
    displayTempo.textContent = "-- minutos";
    localStorage.removeItem("minhaSenha");
};

// Receber mensagens
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Recebe senha própria
    if (data.tipo === "minhaSenha") {
        minhaSenha = data.senha;
        localStorage.setItem("minhaSenha", minhaSenha);

        displaySenha.textContent = data.senha;
        displayFila.textContent = data.position;
    }

    // Atualização geral
    if (data.tipo === "atualizacao") {

        if (localStorage.getItem("minhaSenha")) {
            const index = data.fila.findIndex(f => f.senha === localStorage.getItem("minhaSenha"));
            displayFila.textContent = index >= 0 ? index : "--";
            displayTempo.textContent = (index * 2) + " minutos";
        }

        if (data.fila.length > 0)
            displayChamada.textContent = data.fila[0].senha;
    }

    // Chamada no painel
    if (data.tipo === "chamada") {
        displayChamada.textContent = data.senha;
    }
};
