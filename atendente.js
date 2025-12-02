const socket = new WebSocket("wss://" + window.location.host);

socket.onopen = () => {
    socket.send(JSON.stringify({
        tipo: "identificar",
        tipoCliente: "atendente"
    }));
};

// Elementos
const senhaAtual = document.getElementById("senhaAtual");
const historicoDiv = document.getElementById("historico");
const btnProxima = document.getElementById("btnProxima");
const btnPular = document.getElementById("btnPular");

// Botões
btnProxima.onclick = () => {
    socket.send(JSON.stringify({ tipo: "chamar" }));
};

btnPular.onclick = () => {
    socket.send(JSON.stringify({ tipo: "pular" }));
};

// Receber atualizações
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.tipo === "chamada") {
        senhaAtual.textContent = data.senha;
    }

    if (data.tipo === "atualizacao") {

        // Atualiza histórico
        historicoDiv.innerHTML = "";
        data.historico.forEach(s => {
            const div = document.createElement("div");
            div.className = "item";
            div.textContent = s;
            historicoDiv.appendChild(div);
        });

        if (data.fila.length > 0)
            senhaAtual.textContent = data.fila[0].senha;
        else
            senhaAtual.textContent = "--";
    }
};
