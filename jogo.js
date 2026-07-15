const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const TARGET_VIEW_WIDTH = 500; // Mantém a câmera aproximada e ideal no celular
let gameScale = 1;

// CARREGAMENTO DA SUA SPRITESHEET EXPORTADA DO PISKEL
let imageLoaded = false;
const spriteSheet = new Image();
spriteSheet.src = 'personagem.png'; // Lê o arquivo que você subiu no GitHub

spriteSheet.onload = () => { imageLoaded = true; };
spriteSheet.onerror = () => { imageLoaded = false; }; // Ativa o backup se a imagem falhar

// CONFIGURAÇÃO MODIFICADA: Ajustado para 64x64 pixels para preservar os detalhes do robô
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

function handleInput(event) {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX || (event.touches && event.touches.clientX);
    const clientY = event.clientY || (event.touches && event.touches.clientY);
    if (!clientX || !clientY) return;

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

canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    handleInput(e);
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

    // GRADE DO MAPA DE FUNDO
    ctx.strokeStyle = '#375737';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += 100) {
        ctx.beginPath(); ctx.moveTo(x - cameraX, 0 - cameraY); ctx.lineTo(x - cameraX, WORLD_HEIGHT - cameraY); ctx.stroke();
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += 100) {
        ctx.beginPath(); ctx.moveTo(0 - cameraX, y - cameraY); ctx.lineTo(WORLD_WIDTH - cameraX, y - cameraY); ctx.stroke();
    }

    // VELOCIDADE DA ANIMAÇÃO: Controla a troca de frames dos braços do robô
    animationFrameCount++;
    if (animationFrameCount >= 10) { 
        currentAnimationFrame = (currentAnimationFrame + 1) % 4; // Avança entre as colunas do Piskel
        animationFrameCount = 0;
    }

    // RENDERIZAÇÃO DE TODOS OS JOGADORES CONECTADOS
    for (let id in players) {
        let p = players[id];
        let screenX = p.x - cameraX;
        let screenY = p.y - cameraY;

        // Otimização: Só desenha quem estiver visível na viewport do jogador
        if (screenX >= -50 && screenX <= virtualWidth + 50 && screenY >= -50 && screenY <= virtualHeight + 50) {
            
            // Posição padrão da linha da Spritesheet
            let directionLine = 0; 
            let angle = 0;

            if (p.isMoving) {
                let dx = p.targetX - p.x;
                let dy = p.targetY - p.y;
                angle = Math.atan2(dy, dx);

                // Atribui qual linha horizontal ler da folha de sprites dependendo do movimento
                if (Math.abs(dx) > Math.abs(dy)) {
                    directionLine = dx > 0 ? 3 : 2; // 3 = Direita, 2 = Esquerda
                } else {
                    directionLine = dy > 0 ? 1 : 0; // 1 = Baixo (Frente), 0 = Cima (Costas)
                }
            }

            // Se o robô estiver imóvel, congela na primeira coluna (Frame 1) do Piskel
            let colFrame = p.isMoving ? currentAnimationFrame : 0;

            if (imageLoaded) {
                // Desenha a Spritesheet recortada milimetricamente em blocos de 64x64 pixels
                ctx.drawImage(
                    spriteSheet,
                    colFrame * FRAME_WIDTH,       // Cortar X na imagem original
                    directionLine * FRAME_HEIGHT, // Cortar Y na imagem original
                    FRAME_WIDTH, FRAME_HEIGHT,    // Largura e Altura do corte
                    screenX - 32, screenY - 32,   // Onde posicionar na tela (Centralizado)
                    64, 64                        // Tamanho em que o robô vai aparecer no mapa
                );
            } else {
                // BACKUP VISUAL: Ativado automaticamente se a imagem 'personagem.png' falhar
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

            // Aura Amarela sob o robô do próprio jogador para identificação rápida
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
