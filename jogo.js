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

// FUNÇÃO 1: PROCESSA O CLIQUE DO MOUSE (COMPUTADOR)
function handleMouseInput(event) {
    enviarOrdemDeMovimento(event.clientX, event.clientY);
}

// FUNÇÃO 2: PROCESSA O TOQUE NA TELA (CELULAR)
function handleTouchInput(event) {
    if (event.touches && event.touches.length > 0) {
        enviarOrdemDeMovimento(event.touches[0].clientX, event.touches[0].clientY);
    }
}

// FUNÇÃO MATEMÁTICA: TRADUZ O CLIQUE/TOQUE DA TELA PARA O MUNDO DO JOGO
function enviarOrdemDeMovimento(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    
    // Calcula a posição do clique relativa à tela do aparelho
    const screenClickX = clientX - rect.left;
    const screenClickY = clientY - rect.top;

    let localPlayer = players[socket.id];
    if (!localPlayer) return;

    const virtualWidth = canvas.width / gameScale;
    const virtualHeight = canvas.height / gameScale;

    // Calcula onde a câmera virtual estava apontando
    let cameraX = localPlayer.x - virtualWidth / 2;
    let cameraY = localPlayer.y - virtualHeight / 2;
    cameraX = Math.max(0, Math.min(cameraX, WORLD_WIDTH - virtualWidth));
    cameraY = Math.max(0, Math.min(cameraY, WORLD_HEIGHT - virtualHeight));

    // Converte a escala do zoom e soma a posição da câmera
    const worldClickX = (screenClickX / gameScale) + cameraX;
    const worldClickY = (screenClickY / gameScale) + cameraY;

    // Envia o comando real para o servidor processar o movimento
    socket.emit('rtsMoveOrder', { x: worldClickX, y: worldClickY });
}

// Vincula cada evento à sua respectiva função corretora
canvas.addEventListener('mousedown', handleMouseInput);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Impede o navegador de rolar a página para baixo ao tocar
    handleTouchInput(e);
}, { passive: false });

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(gameScale, gameScale);

    let localPlayer = players[socket.id];
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

    for (let id in players) {
        let p = players[id];
        let screenX = p.x - cameraX;
        let screenY = p.y - cameraY;

        if (screenX >= -50 && screenX <= virtualWidth + 50 && screenY >= -50 && screenY <= virtualHeight + 50) {
            let directionLine = 0; 
            let angle = 0;

            if (p.isMoving) {
                let dx = p.targetX - p.x;
                let dy = p.targetY - p.y;
                angle = Math.atan2(dy, dx);
            }

            let colFrame = p.isMoving ? currentAnimationFrame : 0;

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
                if (p.isMoving) ctx.rotate(angle);

                ctx.fillStyle = p.color;
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
