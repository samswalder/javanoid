class Ball {
  constructor(canvas, x, y, baseSpeed) {
    this.canvas = canvas;
    this.radius = 8;
    this.x = x;
    this.y = y;
    this.baseSpeed = baseSpeed;
    this.speed = baseSpeed;
    this.launched = false;
    // Start at a random upward angle between -60 and +60 degrees from vertical
    const angle = (Math.random() * 120 - 60) * Math.PI / 180;
    this.vx = Math.sin(angle) * this.speed;
    this.vy = -Math.cos(angle) * this.speed;
    this.color = '#ecf0f1';
  }

  launch() {
    this.launched = true;
  }

  setSpeed(multiplier) {
    this.speed = this.baseSpeed * multiplier;
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (currentSpeed > 0) {
      this.vx = (this.vx / currentSpeed) * this.speed;
      this.vy = (this.vy / currentSpeed) * this.speed;
    }
  }

  // Stick ball to paddle before launch
  stickToPaddle(paddle) {
    if (!this.launched) {
      this.x = paddle.centerX;
      this.y = paddle.top - this.radius;
    }
  }

  update(paddle, bricks, powerupManager, onLost) {
    if (!this.launched) return;

    this.x += this.vx;
    this.y += this.vy;

    // Wall collisions
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = Math.abs(this.vx);
    }
    if (this.x + this.radius > this.canvas.width) {
      this.x = this.canvas.width - this.radius;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy);
    }

    // Paddle collision
    if (
      this.vy > 0 &&
      this.x >= paddle.x &&
      this.x <= paddle.right &&
      this.y + this.radius >= paddle.top &&
      this.y + this.radius <= paddle.top + paddle.height + Math.abs(this.vy)
    ) {
      // Hit position relative to paddle center (-1 to +1)
      const hitPos = (this.x - paddle.centerX) / (paddle.width / 2);
      // Reflect with angle based on hit position
      const maxAngle = 60 * Math.PI / 180;
      const angle = hitPos * maxAngle;
      this.vx = Math.sin(angle) * this.speed;
      this.vy = -Math.abs(Math.cos(angle) * this.speed);
      this.y = paddle.top - this.radius;
    }

    // Bottom — ball lost
    if (this.y - this.radius > this.canvas.height) {
      onLost(this);
    }

    // Brick collision
    bricks.checkBallCollision(this, powerupManager);
  }

  draw(ctx) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
