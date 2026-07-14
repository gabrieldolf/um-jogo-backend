const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const players = {};

io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);
    
    // Cria um novo jogador em uma posição aleatória
    players[socket.id] = {
        x: Math.floor(Math.random() * 400),
        y: Math.floor(Math.random() * 400),
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
    };

    // Envia o estado atual para todos
    io.emit('currentPlayers', players);

    // Atualiza a posição quando o jogador se move
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', { id: socket.id, x: players[socket.id].x, y: players[socket.id].y });
        }
    });

    // Remove o jogador ao desconectar
    socket.on('disconnect', () => {
        console.log(`Jogador desconectado: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
