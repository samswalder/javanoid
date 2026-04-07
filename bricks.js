class Brick {
  constructor(x, y, w, h, type, color) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type; // 1=normal, 2=tough, 3=indestructible
    this.color = color;
    this.hitsLeft = type === 2 ? 2 : type === 3 ? Infinity : 1;
    this.cracked = false;
    this.alive = true;
  }

  hit() {
    if (this.type === 3) return false; // indestructible
    this.hitsLeft--;
    if (this.hitsLeft === 1 && this.type === 2) this.cracked = true;
    if (this.hitsLeft <= 0) {
      this.alive = false;
      return true; // destroyed
    }
    return false;
  }

  get points() {
    if (this.type === 2) return 20;
    return 10;
  }

  draw(ctx) {
    const pad = 2;
    const rx = this.x + pad;
    const ry = this.y + pad;
    const rw = this.w - pad * 2;
    const rh = this.h - pad * 2;

    if (this.type === 3) {
      // Metallic indestructible
      const grad = ctx.createLinearGradient(rx, ry, rx, ry + rh);
      grad.addColorStop(0, '#95a5a6');
      grad.addColorStop(0.5, '#bdc3c7');
      grad.addColorStop(1, '#7f8c8d');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 3);
      ctx.fill();
      // Rivets
      ctx.fillStyle = '#636e72';
      ctx.beginPath();
      ctx.arc(rx + 6, ry + rh / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rx + rw - 6, ry + rh / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Normal / tough brick
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 3);
    ctx.fill();

    // Shine highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.roundRect(rx + 3, ry + 3, rw - 6, rh * 0.4, 2);
    ctx.fill();

    // Crack lines for tough bricks that have been hit
    if (this.cracked) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rx + rw * 0.3, ry + 2);
      ctx.lineTo(rx + rw * 0.5, ry + rh * 0.6);
      ctx.lineTo(rx + rw * 0.7, ry + rh * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rx + rw * 0.2, ry + rh * 0.5);
      ctx.lineTo(rx + rw * 0.45, ry + rh * 0.8);
      ctx.stroke();
    }
  }
}

class BrickGrid {
  constructor(canvas, levelDef) {
    this.canvas = canvas;
    this.bricks = [];
    this._build(levelDef);
  }

  _build(levelDef) {
    const grid = levelDef.grid;
    const cols = grid[0].length;
    const rows = grid.length;
    const brickW = (this.canvas.width - 40) / cols;
    const brickH = 28;
    const offsetX = 20;
    const offsetY = 60;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = grid[r][c];
        if (type === 0) continue;
        const colorIndex = Math.min(r, levelDef.colors.length - 1);
        const color = levelDef.colors[colorIndex];
        this.bricks.push(new Brick(
          offsetX + c * brickW,
          offsetY + r * brickH,
          brickW,
          brickH,
          type,
          color
        ));
      }
    }
  }

  get allCleared() {
    return this.bricks.every(b => !b.alive || b.type === 3);
  }

  checkBallCollision(ball, powerupManager) {
    for (const brick of this.bricks) {
      if (!brick.alive) continue;

      const bLeft = brick.x;
      const bRight = brick.x + brick.w;
      const bTop = brick.y;
      const bBottom = brick.y + brick.h;

      // Circle vs AABB
      const nearX = Math.max(bLeft, Math.min(ball.x, bRight));
      const nearY = Math.max(bTop, Math.min(ball.y, bBottom));
      const dx = ball.x - nearX;
      const dy = ball.y - nearY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ball.radius) {
        // Determine collision side
        const overlapLeft = ball.x + ball.radius - bLeft;
        const overlapRight = bRight - (ball.x - ball.radius);
        const overlapTop = ball.y + ball.radius - bTop;
        const overlapBottom = bBottom - (ball.y - ball.radius);

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapLeft || minOverlap === overlapRight) {
          ball.vx = -ball.vx;
        } else {
          ball.vy = -ball.vy;
        }

        const destroyed = brick.hit();
        if (destroyed) {
          powerupManager.trySpawn(brick);
          return { brick, destroyed: true };
        }
        return { brick, destroyed: false };
      }
    }
    return null;
  }

  draw(ctx) {
    for (const brick of this.bricks) {
      if (brick.alive) brick.draw(ctx);
    }
  }
}
