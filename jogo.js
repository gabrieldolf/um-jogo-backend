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
let clientPlayers = {};

// FUNÇÃO DE REDIMENSIONAMENTO OTIMIZADA PARA DESEMPENHO NO CELULAR
function resizeCanvas() {
    // Se a tela for muito grande (como celulares de alta densidade), limitamos a resolução interna
    let maxResolutionWidth = Math.min(window.innerWidth, 800);
    let scaleRatio = maxResolutionWidth / window.innerWidth;
    
    canvas.width = maxResolutionWidth;
    canvas.height = window.innerHeight * scaleRatio;

    if (canvas.width < TARGET_VIEW_WIDTH) {
        gameScale = canvas.width / TARGET_VIEW_WIDTH;
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
    // CORREÇÃO E OTIMIZAÇÃO: Lê o primeiro dedo encostado na tela com estabilidade
    if (event.touches && event.touches.length > 0) {
        enviarOrdemDeMovimento(event.touches[0].clientX, event.touches[0].clientY);
    }
}

function enviarOrdemDeMovimento(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    
    // Converte a posição física da tela para a resolução interna otimizada do canvas
    const screenClickX = (clientX - rect.left) * (canvas.width / rect.width);
    const screenClickY = (clientY - rect.top) * (canvas.height / rect.height);

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

    // INTERPOLAÇÃO DE POSIÇÃO
    for (let id in players) {
        let serverPlayer = players[id];
        if (!clientPlayers[id]) {
            clientPlayers[id] = { x: serverPlayer.x, y: serverPlayer.y };
        }
        let lerpFactor = 0.15; 
        clientPlayers[id].x += (serverPlayer.x - clientPlayers[id].x) * lerpFactor;
        clientPlayers[id].y += (serverPlayer.y - clientPlayers[id].y) * lerpFactor;
    }

    for (let id in clientPlayers) {
        if (!players[id]) delete clientPlayers[id];
    }

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

    // DESENHO DOS JOGADORES
    for (let id in clientPlayers) {
        let pClient = clientPlayers[id];
        let pServer = players[id]; 
        
        let screenX = pClient.x - cameraX;
        let screenY = pClient.y - cameraY;

        if (screenX >= -50 && screenX <= virtualWidth + 50 && screenY >= -50 && screenY <= virtualHeight + 50) {
            let directionLine = 0; 
            let angle = 0;
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
