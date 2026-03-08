const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const filledEl = document.getElementById('filled');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const restartBtn = document.getElementById('restart-btn');

const C_WIDTH = canvas.width;  // 840
const C_HEIGHT = canvas.height; // 640
const GAME_X = 20;
const GAME_Y = 20;
const GAME_W = 800;
const GAME_H = 600;

const CELL = 5;
const COLS = GAME_W / CELL; // 160
const ROWS = GAME_H / CELL; // 120
const TOTAL_AREA = GAME_W * GAME_H;
const REQUIRED_FILL_PERCENT_PER_LEVEL = 75;

// Array of vibrant, high-contrast colors for different levels
const LEVEL_COLORS = [
    '#ff0055', // Level 1 - Neon Pink
    '#00ffcc', // Level 2 - Neon Cyan
    '#ffaa00', // Level 3 - Neon Orange
    '#b700ff', // Level 4 - Neon Purple
    '#00ff00', // Level 5 - Neon Green
    '#ffff00', // Level 6 - Neon Yellow
    '#ff0000', // Level 7 - Crimson
    '#0055ff', // Level 8 - Deep Blue
    '#ffffff', // Level 9 - Pure White
];

let state = {
    level: 1,
    score: 0,
    lives: 3,
    filledArea: 0,
    isPlaying: false,
    holes: [],
    trail: [],
    isDrawing: false,
    spaceship: { x: GAME_X, y: GAME_Y, facing: 'right' },
    powerups: [],
    keys: {}
};

class BlackHole {
    constructor(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }

    update(dt) {
        let nx = this.x + this.vx * dt;
        let ny = this.y + this.vy * dt;

        let minC = Math.max(0, Math.floor((nx - GAME_X - this.radius) / CELL));
        let maxC = Math.min(COLS - 1, Math.floor((nx - GAME_X + this.radius) / CELL));
        let minR = Math.max(0, Math.floor((ny - GAME_Y - this.radius) / CELL));
        let maxR = Math.min(ROWS - 1, Math.floor((ny - GAME_Y + this.radius) / CELL));

        let hit1 = false;
        let hit2 = false;

        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                if (state.grid[r][c] === 1) hit1 = true;
                if (state.grid[r][c] === 2) hit2 = true;
            }
        }

        if (hit2) {
            loseLife();
            return;
        }

        if (hit1) {
            let hitX = false;
            let testMinC = Math.max(0, Math.floor((nx - GAME_X - this.radius) / CELL));
            let testMaxC = Math.min(COLS - 1, Math.floor((nx - GAME_X + this.radius) / CELL));
            let testYMinR = Math.max(0, Math.floor((this.y - GAME_Y - this.radius) / CELL));
            let testYMaxR = Math.min(ROWS - 1, Math.floor((this.y - GAME_Y + this.radius) / CELL));

            for (let r = testYMinR; r <= testYMaxR; r++) {
                if (state.grid[r][testMinC] === 1 || state.grid[r][testMaxC] === 1) hitX = true;
            }
            if (hitX) { this.vx *= -1; nx = this.x; }

            let hitY = false;
            let testMinR = Math.max(0, Math.floor((ny - GAME_Y - this.radius) / CELL));
            let testMaxR = Math.min(ROWS - 1, Math.floor((ny - GAME_Y + this.radius) / CELL));
            let testXMinC = Math.max(0, Math.floor((this.x - GAME_X - this.radius) / CELL));
            let testXMaxC = Math.min(COLS - 1, Math.floor((this.x - GAME_X + this.radius) / CELL));

            for (let c = testXMinC; c <= testXMaxC; c++) {
                if (state.grid[testMinR][c] === 1 || state.grid[testMaxR][c] === 1) hitY = true;
            }
            if (hitY) { this.vy *= -1; ny = this.y; }

            if (!hitX && !hitY) {
                this.vx *= -1; this.vy *= -1;
                nx = this.x; ny = this.y;
            }
        }

        this.x = nx;
        this.y = ny;
    }

    draw(ctx) {
        ctx.beginPath();
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2.5);
        grad.addColorStop(0, '#000000');
        grad.addColorStop(0.5, '#aa00ff');
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.arc(this.x, this.y, this.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        ctx.beginPath();
        ctx.fillStyle = '#000000';
        ctx.arc(this.x, this.y, this.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }
}

class Powerup {
    constructor(x, y, radius, speed, lives) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.lives = lives;

        // Slower than black holes
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }

    update(dt) {
        let nx = this.x + this.vx * dt;
        let ny = this.y + this.vy * dt;

        let hitX = false;
        let testMinC = Math.max(0, Math.floor((nx - GAME_X - this.radius) / CELL));
        let testMaxC = Math.min(COLS - 1, Math.floor((nx - GAME_X + this.radius) / CELL));
        let testYMinR = Math.max(0, Math.floor((this.y - GAME_Y - this.radius) / CELL));
        let testYMaxR = Math.min(ROWS - 1, Math.floor((this.y - GAME_Y + this.radius) / CELL));

        for (let r = testYMinR; r <= testYMaxR; r++) {
            if (state.grid[r][testMinC] === 1 || state.grid[r][testMaxC] === 1 || state.grid[r][testMinC] > 10 || state.grid[r][testMaxC] > 10) hitX = true;
        }
        if (hitX) { this.vx *= -1; nx = this.x; }

        let hitY = false;
        let testMinR = Math.max(0, Math.floor((ny - GAME_Y - this.radius) / CELL));
        let testMaxR = Math.min(ROWS - 1, Math.floor((ny - GAME_Y + this.radius) / CELL));
        let testXMinC = Math.max(0, Math.floor((this.x - GAME_X - this.radius) / CELL));
        let testXMaxC = Math.min(COLS - 1, Math.floor((this.x - GAME_X + this.radius) / CELL));

        for (let c = testXMinC; c <= testXMaxC; c++) {
            if (state.grid[testMinR][c] === 1 || state.grid[testMaxR][c] === 1 || state.grid[testMinR][c] > 10 || state.grid[testMaxR][c] > 10) hitY = true;
        }
        if (hitY) { this.vy *= -1; ny = this.y; }

        if (!hitX && !hitY) {
            let pr = Math.floor((ny - GAME_Y) / CELL);
            let pc = Math.floor((nx - GAME_X) / CELL);
            if (state.grid[pr][pc] === 1 || state.grid[pr][pc] > 10) {
                this.vx *= -1; this.vy *= -1;
                nx = this.x; ny = this.y;
            }
        }

        this.x = nx;
        this.y = ny;
    }

    draw(ctx) {
        ctx.beginPath();
        // Draw as a planet based on lives it gives
        let color = this.lives === 1 ? '#00ffcc' : '#ffaa00'; // Cyan for 1, Orange for 2+

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        // Planet ring
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.ellipse(this.x, this.y, this.radius * 1.5, this.radius * 0.4, Math.PI / 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.closePath();

        ctx.shadowBlur = 0;

        // Life count text inside
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+' + this.lives, this.x, this.y);
    }
}

window.addEventListener('keydown', e => {
    state.keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
});
window.addEventListener('keyup', e => {
    state.keys[e.key] = false;
});

// Mobile Swipe Controls
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', e => {
    if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    if (!state.isPlaying) return;
    e.preventDefault(); // Prevent scrolling

    if (e.touches.length > 0) {
        let touchX = e.touches[0].clientX;
        let touchY = e.touches[0].clientY;

        let dx = touchX - touchStartX;
        let dy = touchY - touchStartY;

        // Need a minimum swipe distance to register (deadzone)
        if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
            // Reset keys
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(k => state.keys[k] = false);

            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal swipe
                if (dx > 0) state.keys['ArrowRight'] = true;
                else state.keys['ArrowLeft'] = true;
            } else {
                // Vertical swipe
                if (dy > 0) state.keys['ArrowDown'] = true;
                else state.keys['ArrowUp'] = true;
            }

            // Reset start position for continuous swiping feeling
            touchStartX = touchX;
            touchStartY = touchY;
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    // Optional: Stop moving when finger lifts.
    // ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(k => state.keys[k] = false);
});

// D-Pad Event Listeners
['up', 'down', 'left', 'right'].forEach(dir => {
    const btn = document.getElementById(`btn-${dir}`);
    if (btn) {
        const keyName = `Arrow${dir.charAt(0).toUpperCase() + dir.slice(1)}`;
        
        // Touch events for mobile
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // Reset other keys to prevent conflicting directions
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(k => state.keys[k] = false);
            state.keys[keyName] = true;
        }, { passive: false });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            state.keys[keyName] = false;
        }, { passive: false });

        // Mouse events for testing on desktop if resized
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(k => state.keys[k] = false);
            state.keys[keyName] = true;
        });
        
        btn.addEventListener('mouseup', (e) => {
            e.preventDefault();
            state.keys[keyName] = false;
        });
        btn.addEventListener('mouseleave', (e) => {
            state.keys[keyName] = false;
        });
    }
});

function loseLife() {
    state.lives--;
    for (let pt of state.trail) {
        state.grid[pt.r][pt.c] = 0;
    }
    state.trail = [];
    state.isDrawing = false;

    let validStart = false;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (state.grid[r][c] === 1) {
                state.spaceship.x = GAME_X + c * CELL;
                state.spaceship.y = GAME_Y + r * CELL;
                validStart = true;
                break;
            }
        }
        if (validStart) break;
    }

    if (state.lives <= 0) {
        showOverlay("Game Over", `Final Score: ${state.score}`);
    }
    updateUI();
}

function commitTrail() {
    state.isDrawing = false;
    for (let pt of state.trail) {
        state.grid[pt.r][pt.c] = 1;
    }
    state.trail = [];

    let reachable = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
    let queue = [];
    for (let h of state.holes) {
        let hc = Math.max(0, Math.min(COLS - 1, Math.floor((h.x - GAME_X) / CELL)));
        let hr = Math.max(0, Math.min(ROWS - 1, Math.floor((h.y - GAME_Y) / CELL)));
        if (state.grid[hr][hc] === 0) { // Only if staring on empty space
            queue.push({ c: hc, r: hr });
            reachable[hr][hc] = true;
        }
    }

    let head = 0;
    let dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    while (head < queue.length) {
        let curr = queue[head++];
        for (let d of dirs) {
            let nc = curr.c + d[0]; let nr = curr.r + d[1];
            if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
                // Cannot pass through grid=1 (walls) or grid>10 (already filled areas)
                if (state.grid[nr][nc] === 0 && !reachable[nr][nc]) {
                    reachable[nr][nc] = true;
                    queue.push({ c: nc, r: nr });
                }
            }
        }
    }

    let countFilled = 0;
    // We use the current level + 10 as the marker for the filled block so we know what color it is
    let fillMarker = 10 + state.level;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (state.grid[r][c] === 0 && !reachable[r][c]) {
                state.grid[r][c] = fillMarker;
                countFilled++;
            }
        }
    }

    state.filledArea += countFilled * CELL * CELL;
    state.score += Math.floor(countFilled * CELL * CELL / 100) * state.level;

    updateUI();
    const perc = (state.filledArea / TOTAL_AREA * 100);
    if (perc >= REQUIRED_FILL_PERCENT_PER_LEVEL) {
        state.level++;
        showOverlay(`Level ${state.level - 1} Cleared!`, `Cosmos protected. Get ready for level ${state.level}.`);
    }
}

function updateSpaceship(dt) {
    const speed = 250;
    let oldX = state.spaceship.x;
    let oldY = state.spaceship.y;
    let { facing } = state.spaceship;

    let dx = 0; let dy = 0;

    // Only allow movement in one axis (no diagonals) to enforce 90-degree turns
    let movingX = false;
    let movingY = false;

    if (state.keys['ArrowLeft'] || state.keys['a'] || state.keys['A']) { movingX = true; dx = -speed; facing = 'left'; }
    else if (state.keys['ArrowRight'] || state.keys['d'] || state.keys['D']) { movingX = true; dx = speed; facing = 'right'; }

    if (!movingX) {
        if (state.keys['ArrowUp'] || state.keys['w'] || state.keys['W']) { movingY = true; dy = -speed; facing = 'up'; }
        else if (state.keys['ArrowDown'] || state.keys['s'] || state.keys['S']) { movingY = true; dy = speed; facing = 'down'; }
    }

    dx *= dt;
    dy *= dt;

    if (dx === 0 && dy === 0) return;

    let nx = oldX + dx;
    let ny = oldY + dy;
    nx = Math.max(GAME_X, Math.min(GAME_X + GAME_W - CELL, nx));
    ny = Math.max(GAME_Y, Math.min(GAME_Y + GAME_H - CELL, ny));

    let steps = Math.ceil(Math.max(Math.abs(nx - oldX), Math.abs(ny - oldY)) / (CELL / 2));
    if (steps > 0) {
        let stepX = (nx - oldX) / steps;
        let stepY = (ny - oldY) / steps;

        for (let i = 1; i <= steps; i++) {
            let px = oldX + stepX * i;
            let py = oldY + stepY * i;
            let pc = Math.floor((px - GAME_X) / CELL);
            let pr = Math.floor((py - GAME_Y) / CELL);

            if (state.grid[pr][pc] === 1 || state.grid[pr][pc] > 10) { // Hit perimeter or filled area
                if (state.isDrawing) {
                    commitTrail();
                }
            } else if (state.grid[pr][pc] === 0) { // Hit empty space
                state.grid[pr][pc] = 2; // trail
                state.trail.push({ c: pc, r: pr });
                state.isDrawing = true;
            }
            // If hits 2 (own trail), let them loop over their own trail without dying!
        }
    }

    state.spaceship.x = nx;
    state.spaceship.y = ny;
    state.spaceship.facing = facing;
}

function initLevel() {
    state.holes = [];
    state.powerups = [];
    state.grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    state.trail = [];
    state.isDrawing = false;
    state.filledArea = 0;
    for (let r = 0; r < ROWS; r++) { state.grid[r][0] = 1; state.grid[r][COLS - 1] = 1; }
    for (let c = 0; c < COLS; c++) { state.grid[0][c] = 1; state.grid[ROWS - 1][c] = 1; }

    state.spaceship = { x: GAME_X, y: GAME_Y, facing: 'right' };
    updateUI();

    const numHoles = state.level + 1;
    for (let i = 0; i < numHoles; i++) {
        // Randomize radius between 8 and 24
        let randomRadius = 8 + Math.random() * 16;
        state.holes.push(new BlackHole(
            GAME_X + GAME_W / 2 + (Math.random() - 0.5) * 100,
            GAME_Y + GAME_H / 2 + (Math.random() - 0.5) * 100,
            randomRadius,
            150 + state.level * 30
        ));
    }

    // Spawn 1 or 2 powerup planets occasionally
    if (Math.random() > 0.5 || state.level % 3 === 0) {
        let numPowerups = Math.random() > 0.8 ? 2 : 1;
        for (let i = 0; i < numPowerups; i++) {
            let livesGiven = Math.random() > 0.7 ? 2 : 1;
            state.powerups.push(new Powerup(
                GAME_X + GAME_W / 2 + (Math.random() - 0.5) * 200,
                GAME_Y + GAME_H / 2 + (Math.random() - 0.5) * 200,
                10 + livesGiven * 2,
                80, // Slower than black holes
                livesGiven
            ));
        }
    }
}

function startLevel() {
    initLevel();
    state.isPlaying = true;
    overlay.classList.add('hidden');
    lastTime = null;
    requestAnimationFrame(gameLoop);
}

function showOverlay(title, msg) {
    state.isPlaying = false;
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    overlay.classList.remove('hidden');
}

restartBtn.addEventListener('click', () => {
    if (state.lives <= 0) {
        state.level = 1;
        state.score = 0;
        state.lives = 3;
    }
    startLevel();
});

let lastTime = null;

function updateUI() {
    scoreEl.textContent = state.score;
    livesEl.textContent = state.lives;
    levelEl.textContent = state.level;
    const perc = (state.filledArea / TOTAL_AREA * 100).toFixed(1);
    filledEl.textContent = perc;
}

function update(dt) {
    if (!state.isPlaying) return;
    updateSpaceship(dt);
    state.holes.forEach(b => b.update(dt));
    state.powerups.forEach(p => p.update(dt));

    // Check if player picks up a powerup
    for (let i = state.powerups.length - 1; i >= 0; i--) {
        let p = state.powerups[i];

        let dx = p.x - state.spaceship.x;
        let dy = p.y - state.spaceship.y;

        // Approximate distance check 
        if ((dx * dx + dy * dy) < (p.radius + 15) * (p.radius + 15)) {
            state.lives += p.lives;
            state.powerups.splice(i, 1);
            updateUI();
        }
    }
}

function drawSpaceship(ctx) {
    const { x, y, facing } = state.spaceship;
    ctx.save();
    // Center rocket on cell exactly
    ctx.translate(x + CELL / 2, y + CELL / 2);

    if (facing === 'down') ctx.rotate(Math.PI);
    else if (facing === 'right') ctx.rotate(Math.PI / 2);
    else if (facing === 'left') ctx.rotate(-Math.PI / 2);
    else ctx.rotate(0); // up

    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧑‍🚀', 0, 0);

    ctx.restore();
}

function drawGrid(ctx) {
    // Determine current level color (looping back if needed)
    const levelColor = LEVEL_COLORS[(state.level - 1) % LEVEL_COLORS.length];

    // Draw the perimeter walls in a dark color
    ctx.fillStyle = 'rgba(10, 0, 30, 0.8)';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (state.grid[r][c] === 1) {
                ctx.fillRect(GAME_X + c * CELL, GAME_Y + r * CELL, CELL, CELL);
            }
        }
    }

    // Draw the filled torn sections in their respective level colors
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (state.grid[r][c] > 10) {
                // Determine which level this block was filled on
                let filledLevel = state.grid[r][c] - 10;
                let color = LEVEL_COLORS[(filledLevel - 1) % LEVEL_COLORS.length];
                ctx.fillStyle = color;
                ctx.fillRect(GAME_X + c * CELL, GAME_Y + r * CELL, CELL, CELL);
            }
        }
    }

    // Draw active drawing trail using the current level's contrast color
    ctx.fillStyle = levelColor;
    ctx.shadowColor = levelColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let pt of state.trail) {
        ctx.rect(GAME_X + pt.c * CELL, GAME_Y + pt.r * CELL, CELL, CELL);
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#0055ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(GAME_X, GAME_Y, GAME_W, GAME_H);
}

function draw() {
    ctx.clearRect(0, 0, C_WIDTH, C_HEIGHT);
    drawGrid(ctx);
    state.holes.forEach(h => h.draw(ctx));
    state.powerups.forEach(p => p.draw(ctx));
    drawSpaceship(ctx);
}

function gameLoop(timestamp) {
    if (!state.isPlaying) return;

    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (dt < 0.1) {
        update(dt);
        draw();
    }

    requestAnimationFrame(gameLoop);
}

initLevel();
draw();
showOverlay("Cosmos Partition", "Trap the black holes. Steer the rocket onto the canvas to draw a laser trail. Touch a wall to seal it.");
restartBtn.textContent = "Ignition";

