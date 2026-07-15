const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const TARGET_VIEW_WIDTH = 350; // Super zoom calibrado para o celular
let gameScale = 1;

let imageLoaded = false;
const spriteSheet = new Image();
spriteSheet.src = 'personagem.png'; 

spriteSheet.onload = () => { imageLoaded = true; };
spriteSheet.onerror = () => { imageLoaded = false; }; 

const FRAME_WIDTH = 64;
const FRAME_HEIGHT = 64;

let animationFrameCount = 0;
let currentAnimationFrame = 0;

// Objeto local para guardar a posição suavizada dos jogadores na tela
let clientPlayers = {};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (window.innerWidth < TARGET_VIEW_WIDTH) {
        gameScale = window.innerWidth / TARGET_VIEW_WIDTH;
    } else {
        gameScale = 1;
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function handleMouseInput(event) {
    enviarOrdemDeMovimento(event.clientX, event.clientY);
}

function handleTouchInput(event) {
    if (event.touches && event.touches.length > 0) {
        enviarOrdemDeMovimento(event.touches[0].clientX, event.touches[0].clientY);
    }
}

function enviarOrdemDeMovimento(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const screenClickX = clientX - rect.left;
    const screenClickY = clientY - rect.top;

    let localPlayer = players[socket.id];
    if (!localPlayer) return;

    const virtualWidth = canvas.width / gameScale;
    const virtualHeight = canvas.height / gameScale;

    let cameraX = localPlayer.x - virtualWidth / 2;
    let cameraY = localPlayer.y - virtualHeight / 2;
    cameraX = Math.max(0, Math.min(cameraX, WORLD_WIDTH - virtualWidth));
    cameraY = Math.max(0, Math.min(cameraY, WORLD_HEIGHT - virtualHeight));

    const worldClickX = (screenClickX / gameScale) + cameraX;
    const worldClickY = (screenClickY / gameScale) + cameraY;

    socket.emit('rtsMoveOrder', { x: worldClickX, y: worldClickY });
}

canvas.addEventListener('mousedown', handleMouseInput);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    handleTouchInput(e);
}, { passive: false });

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(gameScale, gameScale);

    // ATUALIZAÇÃO DA INTERPOLAÇÃO (Suavização do Lag)
    for (let id in players) {
        let serverPlayer = players[id];

        // Se o jogador ainda não existe no nosso cliente local, criamos ele
        if (!clientPlayers[id]) {
            clientPlayers[id] = {
                x: serverPlayer.x,
                y: serverPlayer.y
            };
        }

        // FÓRMULA MATEMÁTICA DA SUAVIZAÇÃO (Aproxima a posição visual da posição real do servidor em 15% por frame)
        let lerpFactor = 0.15; 
        clientPlayers[id].x += (serverPlayer.x - clientPlayers[id].x) * lerpFactor;
        clientPlayers[id].y += (serverPlayer.y - clientPlayers[id].y) * lerpFactor;
    }

    // Remove do nosso controle visual quem se desconectou do servidor
    for (let id in clientPlayers) {
        if (!players[id]) {
            delete clientPlayers[id];
        }
    }

    // Centraliza a câmera usando a posição suavizada do jogador local
    let localPlayer = clientPlayers[socket.id];
    const virtualWidth = canvas.width / gameScale;
    const virtualHeight = canvas.height / gameScale;

    let cameraX = 0;
    let cameraY = 0;

    if (localPlayer) {
        cameraX = localPlayer.x - virtualWidth / 2;
        cameraY = localPlayer.y - virtualHeight / 2;
        cameraX = Math.max(0, Math.min(cameraX, WORLD_WIDTH - virtualWidth));
        cameraY = Math.max(0, Math.min(cameraY, WORLD_HEIGHT - virtualHeight));
    }

    // GRADE DO MAPA
    ctx.strokeStyle = '#375737';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += 100) {
        ctx.beginPath(); ctx.moveTo(x - cameraX, 0 - cameraY); ctx.lineTo(x - cameraX, WORLD_HEIGHT - cameraY); ctx.stroke();
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += 100) {
        ctx.beginPath(); ctx.moveTo(0 - cameraX, y - cameraY); ctx.lineTo(WORLD_WIDTH - cameraX, y - cameraY); ctx.stroke();
    }

    animationFrameCount++;
    if (animationFrameCount >= 12) { 
        currentAnimationFrame = (currentAnimationFrame + 1) % 2; 
        animationFrameCount = 0;
    }

    // DESENHO DOS JOGADORES USANDO AS COORDENADAS SUAVIZADAS
    for (let id in clientPlayers) {
        let pClient = clientPlayers[id];
        let pServer = players[id]; // Dados de movimento vindos do servidor externo
        
        let screenX = pClient.x - cameraX;
        let screenY = pClient.y - cameraY;

        if (screenX >= -50 && screenX <= virtualWidth + 50 && screenY >= -50 && screenY <= virtualHeight + 50) {
            let directionLine = 0; 
            let angle = 0;

            // Baseia a animação de andar nas regras lógicas de movimento do servidor
            let isMoving = pServer ? pServer.isMoving : false;

            if (isMoving) {
                let dx = pServer.targetX - pClient.x;
                let dy = pServer.targetY - pClient.y;
                angle = Math.atan2(dy, dx);
            }

            let colFrame = isMoving ? currentAnimationFrame : 0;

            if (imageLoaded) {
                ctx.drawImage(
                    spriteSheet,
                    colFrame * FRAME_WIDTH,       
                    directionLine * FRAME_HEIGHT, 
                    FRAME_WIDTH, FRAME_HEIGHT,    
                    screenX - 32, screenY - 32,   
                    64, 64                        
                );
            } else {
                // BACKUP GEOMÉTRICO
                ctx.save();
                ctx.translate(screenX, screenY);
                if (isMoving) ctx.rotate(angle);

                ctx.fillStyle = pServer ? pServer.color : '#fff';
                ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(8, -5, 4, 0, Math.PI * 2); ctx.arc(8, 5, 4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(9, -5, 1.5, 0, Math.PI * 2); ctx.arc(9, 5, 1.5, 0, Math.PI * 2); ctx.fill();

                ctx.restore();
            }

            if (id === socket.id) {
                ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(screenX, screenY + 20, 24, 0, Math.PI * 2); ctx.stroke();
            }
        }
    }

    ctx.restore();
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
