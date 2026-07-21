const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const TARGET_VIEW_WIDTH = 350; 
let gameScale = 1;

let imageLoaded = false;
const spriteSheet = new Image();
spriteSheet.src = 'personagem.png'; 

spriteSheet.onload = () => { imageLoaded = true; };
spriteSheet.onerror = () => { imageLoaded = false; }; 

const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 128;

let animationFrameCount = 0;
let currentAnimationFrame = 0;
let clientPlayers = {};
let gameObstacles = [];

function resizeCanvas() {
    let maxResolutionWidth = Math.min(window.innerWidth, 800);
    let scaleRatio = maxResolutionWidth / window.innerWidth;
    canvas.width = maxResolutionWidth;
    canvas.height = window.innerHeight * scaleRatio;
    gameScale = canvas.width < TARGET_VIEW_WIDTH ? canvas.width / TARGET_VIEW_WIDTH : 1;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

socket.on('currentObstacles', (serverObstacles) => { gameObstacles = serverObstacles; });

function handleMouseInput(event) { enviarOrdemDeMovimento(event.clientX, event.clientY); }
function handleTouchInput(event) { if (event.touches && event.touches.length > 0) { enviarOrdemDeMovimento(event.touches[0].clientX, event.touches[0].clientY); } }

function enviarOrdemDeMovimento(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const screenClickX = (clientX - rect.left) * (canvas.width / rect.width);
    const screenClickY = (clientY - rect.top) * (canvas.height / rect.height);
    let localPlayer = players[socket.id];
    if (!localPlayer) return;

    const virtualWidth = canvas.width / gameScale;
    const virtualHeight = canvas.height / gameScale;
    let cameraX = Math.max(0, Math.min(localPlayer.x - virtualWidth / 2, WORLD_WIDTH - virtualWidth));
    let cameraY = Math.max(0, Math.min(localPlayer.y - virtualHeight / 2, WORLD_HEIGHT - virtualHeight));

    socket.emit('rtsMoveOrder', { x: (screenClickX / gameScale) + cameraX, y: (screenClickY / gameScale) + cameraY });
}

canvas.addEventListener('mousedown', handleMouseInput);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouchInput(e); }, { passive: false });

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(gameScale, gameScale);

    // INTERPOLAÇÃO
    for (let id in players) {
        let serverPlayer = players[id];
        if (!clientPlayers[id]) clientPlayers[id] = { x: serverPlayer.x, y: serverPlayer.y, id: id, facingLeft: false };
        clientPlayers[id].x += (serverPlayer.x - clientPlayers[id].x) * 0.15;
        clientPlayers[id].y += (serverPlayer.y - clientPlayers[id].y) * 0.15;
        if (serverPlayer.isMoving) {
            let dx = serverPlayer.targetX - serverPlayer.x;
            if (Math.abs(dx) > 0.5) clientPlayers[id].facingLeft = dx < 0;
        }
    }
    for (let id in clientPlayers) { if (!players[id]) delete clientPlayers[id]; }

    let localPlayer = clientPlayers[socket.id];
    const virtualWidth = canvas.width / gameScale;
    const virtualHeight = canvas.height / gameScale;
    let cameraX = localPlayer ? Math.max(0, Math.min(localPlayer.x - virtualWidth / 2, WORLD_WIDTH - virtualWidth)) : 0;
    let cameraY = localPlayer ? Math.max(0, Math.min(localPlayer.y - virtualHeight / 2, WORLD_HEIGHT - virtualHeight)) : 0;

    // GRADE DE GRAMA
    ctx.strokeStyle = '#375737'; ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += 100) { ctx.beginPath(); ctx.moveTo(x - cameraX, 0 - cameraY); ctx.lineTo(x - cameraX, WORLD_HEIGHT - cameraY); ctx.stroke(); }
    for (let y = 0; y <= WORLD_HEIGHT; y += 100) { ctx.beginPath(); ctx.moveTo(0 - cameraX, y - cameraY); ctx.lineTo(WORLD_WIDTH - cameraX, y - cameraY); ctx.stroke(); }

    // RENDERIZAR OS TIPOS DE CHÃO DA SUA IMAGEM (Áreas Beges Internas)
    ctx.fillStyle = '#dbb88e'; 
    // 1. Chão da Casa Superior
    ctx.fillRect(300 - cameraX, 300 - cameraY, 600, 400);
    // 2. Chão da Casa Inferior Complexa
    ctx.fillRect(300 - cameraX, 1000 - cameraY, 610, 460);
    ctx.fillRect(910 - cameraX, 1180 - cameraY, 220, 280);
    ctx.fillRect(210 - cameraX, 1180 - cameraY, 90, 80);
    ctx.fillRect(300 - cameraX, 1580 - cameraY, 560, 280);
    ctx.fillRect(520 - cameraX, 1460 - cameraY, 120, 120); // Corredor de elo
    // 3. Grande Círculo de Arena à Direita
    ctx.beginPath();
    ctx.arc(1450 - cameraX, 550 - cameraY, 220, 0, Math.PI * 2);
    ctx.fill();

    animationFrameCount++;
    if (animationFrameCount >= 10) { currentAnimationFrame = (currentAnimationFrame + 1) % 4; animationFrameCount = 0; }

    // FILA DE Y-SORTING
    let renderList = [];
    for (let id in clientPlayers) { renderList.push({ type: 'player', sortY: clientPlayers[id].y + 20, data: clientPlayers[id] }); }
    for (let i = 0; i < gameObstacles.length; i++) { renderList.push({ type: 'obstacle', sortY: gameObstacles[i].y + gameObstacles[i].height, data: gameObstacles[i] }); }
    renderList.sort((a, b) => a.sortY - b.sortY);

    // DESENHO DAS ENTIDADES (Paredes e Robôs)
    for (let i = 0; i < renderList.length; i++) {
        let item = renderList[i];
        if (item.type === 'obstacle') {
            let obs = item.data;
            let sx = obs.x - cameraX; let sy = obs.y - cameraY;
            if (sx + obs.width >= -50 && sx <= virtualWidth + 50 && sy + obs.height >= -50 && sy <= virtualHeight + 50) {
                ctx.fillStyle = '#222326'; // Linhas pretas viram paredes escuras e modernas
                ctx.fillRect(sx, sy, obs.width, obs.height);
            }
        } else if (item.type === 'player') {
            let pClient = item.data; let id = pClient.id; let pServer = players[id];
            let sx = pClient.x - cameraX; let sy = pClient.y - cameraY;
            if (sx >= -100 && sx <= virtualWidth + 100 && sy >= -100 && sy <= virtualHeight + 100) {
                let colFrame = pServer && pServer.isMoving ? currentAnimationFrame : 0;
                ctx.save();
                if (pClient.facingLeft) {
                    ctx.translate(sx, sy); ctx.scale(-1, 1);
                    if (imageLoaded) ctx.drawImage(spriteSheet, colFrame * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT, -48, -48, 96, 96);
                } else {
                    if (imageLoaded) ctx.drawImage(spriteSheet, colFrame * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT, sx - 48, sy - 48, 96, 96);
                }
                ctx.restore();
            }
        }
    }

    ctx.restore();
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
