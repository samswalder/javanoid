// Game states
const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', LEVEL_CLEAR: 'level_clear', GAME_OVER: 'game_over', WIN: 'win' };

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 780;
    this.canvas.height = 560;

    this.state = STATE.MENU;
    this.score = 0;
    this.lives = 3;
    this.levelIndex = 0;
    this.highScore = parseInt(localStorage.getItem('javanoidHS') || '0');
    this.speedModifier = 1.0;
    this.userSpeedMultiplier = 1.0;
    this.userPaddleSize = 100;

    this._bindGlobalKeys();
    this._bindSidebar();
    this._loop();
  }

  get baseSpeed() { return (4.5 + this.levelIndex * 0.2) * this.userSpeedMultiplier; }

  _bindSidebar() {
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const sizeSlider = document.getElementById('sizeSlider');
    const sizeValue = document.getElementById('sizeValue');

    speedSlider.addEventListener('input', () => {
      this.userSpeedMultiplier = parseFloat(speedSlider.value);
      speedValue.textContent = this.userSpeedMultiplier.toFixed(1) + '×';
      // Apply immediately to live balls
      if (this.balls) {
        for (const ball of this.balls) {
          ball.baseSpeed = this.baseSpeed;
          ball.setSpeed(this.speedModifier);
        }
      }
    });

    sizeSlider.addEventListener('input', () => {
      this.userPaddleSize = parseInt(sizeSlider.value);
      sizeValue.textContent = this.userPaddleSize + 'px';
      if (this.paddle) {
        const centerX = this.paddle.centerX;
        this.paddle.normalWidth = this.userPaddleSize;
        this.paddle.wideWidth = Math.round(this.userPaddleSize * 1.6);
        // Only update width if wide powerup isn't active
        if (!this.powerupManager?.activeEffects?.['wide']) {
          this.paddle.width = this.userPaddleSize;
          this.paddle.x = centerX - this.paddle.width / 2;
          this.paddle._clamp();
        }
      }
    });
  }

  _bindGlobalKeys() {
    window.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this._onSpace();
      }
      if ((e.key === 'p' || e.key === 'P') && this.state === STATE.PLAYING) {
        this.state = STATE.PAUSED;
      } else if ((e.key === 'p' || e.key === 'P') && this.state === STATE.PAUSED) {
        this.state = STATE.PLAYING;
      }
    });
    this.canvas.addEventListener('click', () => this._onSpace());
  }

  _onSpace() {
    if (this.state === STATE.MENU) {
      this._startGame();
    } else if (this.state === STATE.PLAYING) {
      // Launch ball if any are stuck
      for (const ball of this.balls) {
        if (!ball.launched) ball.launch();
      }
    } else if (this.state === STATE.LEVEL_CLEAR) {
      this._nextLevel();
    } else if (this.state === STATE.GAME_OVER || this.state === STATE.WIN) {
      this.state = STATE.MENU;
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
    }
  }

  _startGame() {
    this.score = 0;
    this.lives = 3;
    this.levelIndex = 0;
    this._loadLevel();
    this.state = STATE.PLAYING;
  }

  _loadLevel() {
    this.speedModifier = 1.0;
    const level = LEVELS[this.levelIndex];
    this.paddle = new Paddle(this.canvas);
    this.paddle.normalWidth = this.userPaddleSize;
    this.paddle.wideWidth = Math.round(this.userPaddleSize * 1.6);
    this.paddle.width = this.userPaddleSize;
    this.paddle.x = this.canvas.width / 2 - this.userPaddleSize / 2;
    this.bricks = new BrickGrid(this.canvas, level);
    this.powerupManager = new PowerupManager(this.canvas, this);
    this.balls = [this._newBall()];
  }

  _newBall() {
    const ball = new Ball(this.canvas, this.paddle.centerX, this.paddle.top - 8, this.baseSpeed * this.speedModifier);
    return ball;
  }

  _nextLevel() {
    this.levelIndex++;
    if (this.levelIndex >= LEVELS.length) {
      this.state = STATE.WIN;
      return;
    }
    this._loadLevel();
    this.state = STATE.PLAYING;
  }

  addScore(pts) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('javanoidHS', this.highScore);
    }
  }

  addLife() {
    this.lives++;
  }

  setSpeedModifier(mod) {
    this.speedModifier = mod;
    const target = this.baseSpeed * mod;
    for (const ball of this.balls) {
      ball.baseSpeed = target;
      ball.setSpeed(1.0);
    }
  }

  spawnExtraBalls() {
    const existing = this.balls.filter(b => b.alive !== false);
    const newBalls = [];
    for (let i = 0; i < 2 && existing.length > 0; i++) {
      const ref = existing[0];
      const b = new Ball(this.canvas, ref.x, ref.y, this.baseSpeed * this.speedModifier);
      b.launched = true;
      // Spread angles
      b.vx = ref.vx * (i === 0 ? -1 : 1) + (Math.random() - 0.5) * 2;
      b.vy = ref.vy < 0 ? ref.vy : -Math.abs(ref.vy);
      const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      b.vx = (b.vx / spd) * b.speed;
      b.vy = (b.vy / spd) * b.speed;
      newBalls.push(b);
    }
    this.balls.push(...newBalls);
  }

  _onBallLost(ball) {
    ball._dead = true;
  }

  _update(now) {
    if (this.state !== STATE.PLAYING) return;

    this.paddle.update();

    // Stick unlaunched balls
    for (const ball of this.balls) {
      if (!ball.launched) ball.stickToPaddle(this.paddle);
    }

    // Update balls
    const prevCount = this.balls.length;
    for (const ball of this.balls) {
      ball.update(this.paddle, this.bricks, this.powerupManager, b => this._onBallLost(b));
    }

    // Remove dead balls
    const deadBalls = this.balls.filter(b => b._dead);
    this.balls = this.balls.filter(b => !b._dead);

    // If all balls gone, lose a life
    if (this.balls.length === 0) {
      this.lives--;
      this.powerupManager.clearEffects(this.paddle);
      if (this.lives <= 0) {
        this.state = STATE.GAME_OVER;
        return;
      }
      // Spawn new ball on paddle
      this.paddle = new Paddle(this.canvas);
      this.balls = [this._newBall()];
    }

    this.powerupManager.update(this.paddle, this.bricks, now);

    // Score bricks
    // (scoring happens in bricks.checkBallCollision via powerupManager callback)
    // Direct ball-brick scoring
    for (const ball of this.balls) {
      // Score is added via bricks collision directly
    }

    // Check level clear
    if (this.bricks.allCleared) {
      this.addScore(500); // level clear bonus
      this.state = STATE.LEVEL_CLEAR;
    }
  }

  _draw(now) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Background
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, W, H);

    if (this.state === STATE.MENU) {
      this._drawMenu(ctx, W, H);
      return;
    }

    if (this.state === STATE.GAME_OVER) {
      this._drawGameOver(ctx, W, H);
      return;
    }

    if (this.state === STATE.WIN) {
      this._drawWin(ctx, W, H);
      return;
    }

    // Draw game elements
    this.bricks.draw(ctx);
    this.powerupManager.draw(ctx);
    this.paddle.draw(ctx);
    for (const ball of this.balls) ball.draw(ctx);

    // HUD
    this._drawHUD(ctx, W, now);

    if (this.state === STATE.PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ecf0f1';
      ctx.font = 'bold 40px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', W / 2, H / 2);
      ctx.font = '18px monospace';
      ctx.fillText('Press P or Space to resume', W / 2, H / 2 + 50);
    }

    if (this.state === STATE.LEVEL_CLEAR) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 44px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LEVEL CLEAR!', W / 2, H / 2 - 20);
      ctx.fillStyle = '#ecf0f1';
      ctx.font = '20px monospace';
      ctx.fillText('+500 bonus points', W / 2, H / 2 + 30);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#95a5a6';
      ctx.fillText('Press Space or click to continue', W / 2, H / 2 + 70);
    }
  }

  _drawHUD(ctx, W, now) {
    ctx.textBaseline = 'top';

    // Score
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${this.score}`, 20, 10);

    // High score
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`HI: ${this.highScore}`, W / 2, 10);

    // Level name
    ctx.fillStyle = '#95a5a6';
    ctx.font = '13px monospace';
    ctx.fillText(LEVELS[this.levelIndex]?.name || '', W / 2, 28);

    // Lives (hearts)
    ctx.textAlign = 'right';
    ctx.font = '18px monospace';
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('♥'.repeat(this.lives), W - 20, 8);

    // Active power-up indicators
    const effects = Object.keys(this.powerupManager.activeEffects);
    if (effects.length > 0) {
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      let px = 20;
      for (const id of effects) {
        const eff = this.powerupManager.activeEffects[id];
        const type = eff.type;
        ctx.fillStyle = type.color;
        ctx.fillText(`[${type.label}]`, px, 30);
        px += 36;
      }
    }
  }

  _drawMenu(ctx, W, H) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#3498db';
    ctx.fillStyle = '#3498db';
    ctx.font = 'bold 64px monospace';
    ctx.fillText('JAVANOID', W / 2, H / 2 - 90);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ecf0f1';
    ctx.font = '20px monospace';
    ctx.fillText('Classic brick breaker', W / 2, H / 2 - 30);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#7f8c8d';
    const lines = [
      'Mouse or Arrow Keys to move paddle',
      'Space / Click to launch ball   P to pause',
      '',
      `High Score: ${this.highScore}`,
    ];
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 20 + i * 26));

    // Blink start prompt
    if (Math.floor(Date.now() / 600) % 2 === 0) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('Press Space or Click to Play', W / 2, H / 2 + 140);
    }

    // Power-up legend
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    const legend = [
      { label: 'W', color: '#3498db', name: 'Wide Paddle' },
      { label: 'M', color: '#e67e22', name: 'Multi-ball' },
      { label: '+', color: '#2ecc71', name: 'Extra Life' },
      { label: 'S', color: '#00cec9', name: 'Slow Ball' },
      { label: 'L', color: '#e74c3c', name: 'Laser' },
      { label: 'F', color: '#9b59b6', name: 'Fast Ball (!)' },
    ];
    const startX = W / 2 - 180;
    const startY = H - 90;
    ctx.fillStyle = '#636e72';
    ctx.textAlign = 'center';
    ctx.fillText('Power-ups:', W / 2, startY - 16);
    legend.forEach((p, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = startX + col * 130;
      const y = startY + row * 22;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(`[${p.label}] ${p.name}`, x, y);
    });
  }

  _drawGameOver(ctx, W, H) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowBlur = 20;
    ctx.shadowColor = '#e74c3c';
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 56px monospace';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 60);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ecf0f1';
    ctx.font = '24px monospace';
    ctx.fillText(`Score: ${this.score}`, W / 2, H / 2);
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`High Score: ${this.highScore}`, W / 2, H / 2 + 40);

    if (Math.floor(Date.now() / 600) % 2 === 0) {
      ctx.fillStyle = '#95a5a6';
      ctx.font = '18px monospace';
      ctx.fillText('Press Space or Click to return to menu', W / 2, H / 2 + 100);
    }
  }

  _drawWin(ctx, W, H) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowBlur = 30;
    ctx.shadowColor = '#f1c40f';
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 52px monospace';
    ctx.fillText('YOU WIN!', W / 2, H / 2 - 70);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#2ecc71';
    ctx.font = '22px monospace';
    ctx.fillText('All 8 levels cleared!', W / 2, H / 2 - 10);

    ctx.fillStyle = '#ecf0f1';
    ctx.font = '24px monospace';
    ctx.fillText(`Final Score: ${this.score}`, W / 2, H / 2 + 40);
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`High Score: ${this.highScore}`, W / 2, H / 2 + 80);

    if (Math.floor(Date.now() / 600) % 2 === 0) {
      ctx.fillStyle = '#95a5a6';
      ctx.font = '18px monospace';
      ctx.fillText('Press Space or Click to return to menu', W / 2, H / 2 + 130);
    }
  }

  _loop() {
    const now = performance.now();
    this._update(now);
    this._draw(now);
    requestAnimationFrame(() => this._loop());
  }
}

// Score bricks as they're broken — patch ball.js collision to call addScore
// We hook this via BrickGrid override
const _origCheckBallCollision = BrickGrid.prototype.checkBallCollision;
BrickGrid.prototype.checkBallCollision = function(ball, powerupManager) {
  const result = _origCheckBallCollision.call(this, ball, powerupManager);
  if (result && result.destroyed && window._game) {
    window._game.addScore(result.brick.points);
  }
  return result;
};

window.addEventListener('DOMContentLoaded', () => {
  window._game = new Game();
});
