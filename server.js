const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname)); // CORRIGIDO: Agora com dois underlines (__dirname)

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const players = {};
const SPEED = 3; 

io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);

    players[socket.id] = {
        x: Math.floor(Math.random() * 400) + 50,
        y: Math.floor(Math.random() * 400) + 50,
        targetX: 0,
        targetY: 0,
        isMoving: false,
        color: '#' + Math.floor(Math.random() * 16777215).toString(16)
    };

    players[socket.id].targetX = players[socket.id].x;
    players[socket.id].targetY = players[socket.id].y;

    // Envia a lista atualizada para quem acabou de entrar e atualiza os outros
    socket.emit('currentPlayers', players);
    socket.broadcast.emit('positionsUpdate', players);

    socket.on('rtsMoveOrder', (orderData) => {
        if (players[socket.id]) {
            players[socket.id].targetX = orderData.x;
            players[socket.id].targetY = orderData.y;
            players[socket.id].isMoving = true;
            
            io.emit('playerNewOrder', { id: socket.id, targetX: orderData.x, targetY: orderData.y });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Jogador desconectado: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Loop interno do servidor a 60 FPS
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
                movedAny = true; // Garante o envio da posição final exata ao parar
            }
        }
    }

    if (movedAny) {
        io.emit('positionsUpdate', players);
    }
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor RTS rodando na porta ${PORT}`));
