const socket = io();
let players = {};

// Sincronização de rede direta com o servidor
socket.on('currentPlayers', (serverPlayers) => { players = serverPlayers; });
socket.on('positionsUpdate', (serverPlayers) => { players = serverPlayers; });

socket.on('playerNewOrder', (data) => {
    if(players[data.id]) {
        players[data.id].targetX = data.targetX;
        players[data.id].targetY = data.targetY;
        players[data.id].isMoving = true;
    }
});

socket.on('playerDisconnected', (id) => { delete players[id]; });
