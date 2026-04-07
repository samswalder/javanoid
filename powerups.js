const POWERUP_TYPES = [
  { id: 'wide',      label: 'W', color: '#3498db', glow: '#3498db', duration: 15000 },
  { id: 'multiball', label: 'M', color: '#e67e22', glow: '#e67e22', duration: 0 },
  { id: 'extralife', label: '+', color: '#2ecc71', glow: '#2ecc71', duration: 0 },
  { id: 'slow',      label: 'S', color: '#00cec9', glow: '#00cec9', duration: 10000 },
  { id: 'laser',     label: 'L', color: '#e74c3c', glow: '#e74c3c', duration: 15000 },
  { id: 'fast',      label: 'F', color: '#9b59b6', glow: '#9b59b6', duration: 10000 },
];

const DROP_CHANCE = 0.20;

class Capsule {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vy = 2.5;
    this.w = 32;
    this.h = 16;
    this.alive = true;
  }

  update(canvas) {
    this.y += this.vy;
    if (this.y > canvas.height) this.alive = false;
  }

  checkPaddleCollision(paddle) {
    if (
      this.y + this.h / 2 >= paddle.top &&
      this.y - this.h / 2 <= paddle.top + paddle.height &&
      this.x + this.w / 2 >= paddle.x &&
      this.x - this.w / 2 <= paddle.right
    ) {
      this.alive = false;
      return true;
    }
    return false;
  }

  draw(ctx) {
    ctx.shadowBlur = 14;
    ctx.shadowColor = this.type.glow;

    // Capsule body
    ctx.fillStyle = this.type.color;
    ctx.beginPath();
    ctx.roundRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h, this.h / 2);
    ctx.fill();

    // Label
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.type.label, this.x, this.y);
  }
}

class Laser {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vy = -12;
    this.w = 4;
    this.h = 14;
    this.alive = true;
  }

  update() {
    this.y += this.vy;
    if (this.y + this.h < 0) this.alive = false;
  }

  checkBrickCollision(bricks) {
    const result = bricks.checkBallCollision(
      { x: this.x, y: this.y, radius: 2, vx: 0, vy: this.vy },
      { trySpawn: () => {} }
    );
    if (result) this.alive = false;
    return result;
  }

  draw(ctx) {
    ctx.fillStyle = '#e74c3c';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#e74c3c';
    ctx.fillRect(this.x - this.w / 2, this.y, this.w, this.h);
    ctx.shadowBlur = 0;
  }
}

class PowerupManager {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.capsules = [];
    this.lasers = [];
    this.activeEffects = {};
    this._laserTimer = 0;
  }

  trySpawn(brick) {
    if (Math.random() < DROP_CHANCE) {
      const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      this.capsules.push(new Capsule(brick.x + brick.w / 2, brick.y + brick.h / 2, type));
    }
  }

  update(paddle, bricks, now) {
    // Update capsules
    for (const cap of this.capsules) {
      cap.update(this.canvas);
      if (cap.alive && cap.checkPaddleCollision(paddle)) {
        this._activate(cap.type, now);
      }
    }
    this.capsules = this.capsules.filter(c => c.alive);

    // Expire timed effects
    for (const [id, effect] of Object.entries(this.activeEffects)) {
      if (effect.expires && now >= effect.expires) {
        this._deactivate(id, paddle);
        delete this.activeEffects[id];
      }
    }

    // Laser shooting
    if (this.activeEffects['laser']) {
      this._laserTimer++;
      if (this._laserTimer % 25 === 0) {
        this.lasers.push(new Laser(paddle.x + 6, paddle.top));
        this.lasers.push(new Laser(paddle.right - 6, paddle.top));
      }
    }

    // Update lasers
    for (const laser of this.lasers) {
      laser.update();
      if (laser.alive) {
        const hit = laser.checkBrickCollision(bricks);
        if (hit && hit.destroyed) {
          this.game.addScore(hit.brick.points);
        }
      }
    }
    this.lasers = this.lasers.filter(l => l.alive);
  }

  _activate(type, now) {
    const id = type.id;
    if (id === 'extralife') {
      this.game.addLife();
      return;
    }
    if (id === 'multiball') {
      this.game.spawnExtraBalls();
      return;
    }
    // Timed effects
    const expires = type.duration > 0 ? now + type.duration : null;
    this.activeEffects[id] = { type, expires };

    if (id === 'wide') this.game.paddle.setWide(true);
    if (id === 'slow') this.game.setSpeedModifier(0.6);
    if (id === 'fast') this.game.setSpeedModifier(1.5);
    if (id === 'laser') this._laserTimer = 0;
  }

  _deactivate(id, paddle) {
    if (id === 'wide') paddle.setWide(false);
    if (id === 'slow' || id === 'fast') this.game.setSpeedModifier(1.0);
  }

  clearEffects(paddle) {
    for (const id of Object.keys(this.activeEffects)) {
      this._deactivate(id, paddle);
    }
    this.activeEffects = {};
    this.capsules = [];
    this.lasers = [];
  }

  draw(ctx) {
    for (const cap of this.capsules) cap.draw(ctx);
    for (const laser of this.lasers) laser.draw(ctx);
  }
}
