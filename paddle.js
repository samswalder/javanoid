class Paddle {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 100;
    this.normalWidth = 100;
    this.wideWidth = 160;
    this.height = 12;
    this.x = canvas.width / 2 - this.width / 2;
    this.y = canvas.height - 40;
    this.speed = 14;
    this.color = '#ecf0f1';
    this.keys = { left: false, right: false };
    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;
    });
    window.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
    });
    this.canvas.addEventListener('mousemove', e => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      this.x = mouseX - this.width / 2;
      this._clamp();
    });
  }

  _clamp() {
    if (this.x < 0) this.x = 0;
    if (this.x + this.width > this.canvas.width) this.x = this.canvas.width - this.width;
  }

  setWide(wide) {
    const centerX = this.x + this.width / 2;
    this.width = wide ? this.wideWidth : this.normalWidth;
    this.x = centerX - this.width / 2;
    this._clamp();
  }

  update() {
    if (this.keys.left) this.x -= this.speed;
    if (this.keys.right) this.x += this.speed;
    this._clamp();
  }

  draw(ctx) {
    // Paddle body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 6);
    ctx.fill();

    // Subtle shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(this.x + 4, this.y + 2, this.width - 8, 4, 3);
    ctx.fill();
  }

  get centerX() { return this.x + this.width / 2; }
  get right() { return this.x + this.width; }
  get top() { return this.y; }
}
