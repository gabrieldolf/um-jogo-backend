const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname)); 

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const players = {};
const SPEED = 3; 

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

// Raio de colisão aumentado de 16 para 32 para proteger as bordas do robô de 96px
const PLAYER_COLLISION_RADIUS = 32; 

// MAPEAMENTO DAS LINHAS PRETAS DA SUA PLANTA (Paredes de 15px de espessura)
const obstacles = [
    // --- CASA SUPERIOR ESQUERDA ---
    { x: 300, y: 300, width: 600, height: 15 },   // Norte
    { x: 300, y: 300, width: 15, height: 400 },   // Oeste
    { x: 900, y: 300, width: 15, height: 400 },   // Leste
    { x: 300, y: 700, width: 255, height: 15 },  // Sul (Esquerda da porta)
    { x: 675, y: 700, width: 240, height: 15 },  // Sul (Direita da porta)
    { x: 630, y: 300, width: 15, height: 180 },   // Parede interna vertical
    { x: 630, y: 480, width: 270, height: 15 },   // Parede interna horizontal

    // --- GRANDE ESTRUTURA INFERIOR ---
    { x: 300, y: 1000, width: 150, height: 15 },  // Teto Superior Esquerdo
    { x: 570, y: 1000, width: 340, height: 15 },  // Teto Superior Direito
    { x: 300, y: 1000, width: 15, height: 180 },  // Lateral Esquerda Alta
    { x: 910, y: 1000, width: 15, height: 180 },  // Lateral Direita Alta
    { x: 910, y: 1180, width: 220, height: 15 },  // Teto da ala direita
    { x: 1130, y: 1180, width: 15, height: 280 }, // Parede Leste da ala direita
    { x: 910, y: 1460, width: 235, height: 15 },  // Chão da ala direita
    { x: 210, y: 1180, width: 90, height: 15 },   // Teto do puxadinho
    { x: 210, y: 1260, width: 90, height: 15 },   // Chão do puxadinho
    { x: 210, y: 1180, width: 15, height: 80 },   // Parede Oeste do puxadinho
    { x: 300, y: 1260, width: 15, height: 200 },  // Parede lateral baixa
    { x: 300, y: 1460, width: 220, height: 15 },  // Chão esquerdo
    { x: 640, y: 1460, width: 285, height: 15 },  // Chão direito
    { x: 520, y: 1460, width: 15, height: 120 },  // Corredor vertical esquerdo
    { x: 640, y: 1460, width: 15, height: 120 },  // Corredor vertical direito
    { x: 300, y: 1580, width: 220, height: 15 },  // Teto do quarto inferior
    { x: 640, y: 1580, width: 220, height: 15 },  // Teto do quarto inferior direito
    { x: 300, y: 1580, width: 15, height: 280 },  // Parede Oeste
    { x: 860, y: 1580, width: 15, height: 280 },  // Parede Leste
    { x: 300, y: 1860, width: 575, height: 15 }   // Parede Sul absoluta
];

function checkCollision(x, y, radius) {
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        let closestX = Math.max(obs.x, Math.min(x, obs.x + obs.width));
        let closestY = Math.max(obs.y, Math.min(y, obs.y + obs.height));
        let distanceX = x - closestX;
        let distanceY = y - closestY;
        if ((distanceX * distanceX + distanceY * distanceY) < (radius * radius)) {
            return true;
        }
    }
    return false;
}

io.on('connection', (socket) => {
    let startX, startY;
    do {
        startX = Math.floor(Math.random() * (WORLD_WIDTH - 200)) + 100;
        startY = Math.floor(Math.random() * (WORLD_HEIGHT - 200)) + 100;
    } while (checkCollision(startX, startY, PLAYER_COLLISION_RADIUS));

    players[socket.id] = {
        x: startX, y: startY, targetX: startX, targetY: startY, isMoving: false,
        color: '#' + Math.floor(Math.random() * 16777215).toString(16)
    };

    socket.emit('currentPlayers', players);
    socket.emit('currentObstacles', obstacles);
    socket.broadcast.emit('positionsUpdate', players);

    socket.on('rtsMoveOrder', (orderData) => {
        if (players[socket.id]) {
            players[socket.id].targetX = Math.max(PLAYER_COLLISION_RADIUS, Math.min(orderData.x, WORLD_WIDTH - PLAYER_COLLISION_RADIUS));
            players[socket.id].targetY = Math.max(PLAYER_COLLISION_RADIUS, Math.min(orderData.y, WORLD_HEIGHT - PLAYER_COLLISION_RADIUS));
            players[socket.id].isMoving = true;
            io.emit('playerNewOrder', { id: socket.id, targetX: players[socket.id].targetX, targetY: players[socket.id].targetY });
        }
    });

    socket.on('disconnect', () => {
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
                let nextX = p.x + (dx / distance) * SPEED;
                let nextY = p.y + (dy / distance) * SPEED;

                // Move testando o novo raio de isolamento físico das estruturas
                if (!checkCollision(nextX, p.y, PLAYER_COLLISION_RADIUS)) { p.x = nextX; movedAny = true; } else { p.isMoving = false; }
                if (!checkCollision(p.x, nextY, PLAYER_COLLISION_RADIUS)) { p.y = nextY; movedAny = true; } else { p.isMoving = false; }
            } else {
                p.x = p.targetX; p.y = p.targetY; p.isMoving = false; movedAny = true; 
            }
        }
    }
    if (movedAny) { io.emit('positionsUpdate', players); }
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando com novas travas de colisão na porta ${PORT}`));
