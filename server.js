const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const players = {};
const SPEED = 3; 

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

// DEFINIÇÃO DAS PAREDES SÓLIDAS NO MAPA (X, Y, Largura, Altura)
const obstacles = [
    { x: 400, y: 300, width: 600, height: 60 },   // Parede Horizontal Superior
    { x: 400, y: 360, width: 60, height: 400 },   // Parede Vertical Esquerda (Formando um L)
    { x: 1000, y: 700, width: 80, height: 500 }   // Grande Pilar Central Inferior
];

// Função matemática que checa se o jogador bateu em alguma parede
function checkCollision(x, y, radius) {
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        
        // Encontra o ponto mais próximo da parede em relação ao centro do robô
        let closestX = Math.max(obs.x, Math.min(x, obs.x + obs.width));
        let closestY = Math.max(obs.y, Math.min(y, obs.y + obs.height));

        // Calcula a distância entre o centro do robô e esse ponto mais próximo
        let distanceX = x - closestX;
        let distanceY = y - closestY;
        let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

        // Se a distância for menor que o raio do robô, houve colisão!
        if (distanceSquared < (radius * radius)) {
            return true;
        }
    }
    return false;
}

io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);

    // Garante que o jogador não nasça dentro de uma parede
    let startX, startY;
    do {
        startX = Math.floor(Math.random() * (WORLD_WIDTH - 200)) + 100;
        startY = Math.floor(Math.random() * (WORLD_HEIGHT - 200)) + 100;
    } while (checkCollision(startX, startY, 16));

    players[socket.id] = {
        x: startX,
        y: startY,
        targetX: startX,
        targetY: startY,
        isMoving: false,
        color: '#' + Math.floor(Math.random() * 16777215).toString(16)
    };

    // Envia os jogadores atuais E a lista de obstáculos para o novo jogador
    socket.emit('currentPlayers', players);
    socket.emit('currentObstacles', obstacles);
    socket.broadcast.emit('positionsUpdate', players);

    socket.on('rtsMoveOrder', (orderData) => {
        if (players[socket.id]) {
            players[socket.id].targetX = Math.max(16, Math.min(orderData.x, WORLD_WIDTH - 16));
            players[socket.id].targetY = Math.max(16, Math.min(orderData.y, WORLD_HEIGHT - 16));
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

// Loop principal do servidor (60Hz)
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

                // Tenta mover no eixo X e Y separadamente (deslizamento suave em quinas)
                if (!checkCollision(nextX, p.y, 16)) {
                    p.x = nextX;
                    movedAny = true;
                } else {
                    p.isMoving = false; // Para o movimento se bater de frente
                }

                if (!checkCollision(p.x, nextY, 16)) {
                    p.y = nextY;
                    movedAny = true;
                } else {
                    p.isMoving = false;
                }
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
