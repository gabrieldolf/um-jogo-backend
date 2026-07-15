const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname)); 

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const players = {};
const SPEED = 3; 

// Limites expandidos do mapa do MMO
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);

    // Jogadores surgem espalhados em qualquer ponto do mapa amplo de 2000x2000
    players[socket.id] = {
        x: Math.floor(Math.random() * (WORLD_WIDTH - 100)) + 50,
        y: Math.floor(Math.random() * (WORLD_HEIGHT - 100)) + 50,
        targetX: 0,
        targetY: 0,
        isMoving: false,
        color: '#' + Math.floor(Math.random() * 16777215).toString(16)
    };

    players[socket.id].targetX = players[socket.id].x;
    players[socket.id].targetY = players[socket.id].y;

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('positionsUpdate', players);

    socket.on('rtsMoveOrder', (orderData) => {
        if (players[socket.id]) {
            // Garante que o alvo do clique respeite as bordas máximas do mapa
            players[socket.id].targetX = Math.max(10, Math.min(orderData.x, WORLD_WIDTH - 10));
            players[socket.id].targetY = Math.max(10, Math.min(orderData.y, WORLD_HEIGHT - 10));
            players[socket.id].isMoving = true;
            
            io.emit('playerNewOrder', { id: socket.id, targetX: players[socket.id].targetX, targetY: players[socket.id].targetY });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Jogador desconectado: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

setInterval(() => {
    let movedAny = false;
    for (let id in players) {
        let p = players[id];
        if (p.isMoving) {
            let dx = p.targetX - p.x;
            let dy = p.targetY - p.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > SPEED) {
                p.x += (dx / distance) * SPEED;
                p.y += (dy / distance) * SPEED;
                movedAny = true;
            } else {
                p.x = p.targetX;
                p.y = p.targetY;
                p.isMoving = false;
                movedAny = true; 
            }
        }
    }

    if (movedAny) {
        io.emit('positionsUpdate', players);
    }
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor RTS/MMO rodando na porta ${PORT}`));
