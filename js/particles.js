/* ============================================================
   particles.js — explosions, engine trails, hit sparks, debris
   Pooled for performance.
   ============================================================ */

const Particles = (() => {
  let pool;
  let enabled = true;

  function init() {
    pool = new Utils.Pool(
      () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', shape: 'dot', drag: 0.98, gravity: 0 }),
      (o, x, y, vx, vy, life, size, color, shape, drag, gravity) => {
        o.x = x; o.y = y; o.vx = vx; o.vy = vy; o.life = life; o.maxLife = life;
        o.size = size; o.color = color; o.shape = shape || 'dot'; o.drag = drag ?? 0.98; o.gravity = gravity || 0;
      },
      300
    );
  }

  function setEnabled(v) { enabled = v; }

  function spawn(x, y, vx, vy, life, size, color, shape, drag, gravity) {
    if (!enabled) return;
    pool.spawn(x, y, vx, vy, life, size, color, shape, drag, gravity);
  }

  function explosion(x, y, scale = 1, color = '#ff8a4d') {
    if (!enabled) { return; }
    const n = Math.floor(18 * scale);
    for (let i = 0; i < n; i++) {
      const a = Utils.rand(0, Math.PI * 2);
      const spd = Utils.rand(40, 220) * scale;
      spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, Utils.rand(0.3, 0.7), Utils.rand(2, 5) * scale, color, 'dot', 0.94, 0);
    }
    // core flash
    spawn(x, y, 0, 0, 0.18, 22 * scale, '#fff', 'flash', 1, 0);
    // smoke
    for (let i = 0; i < 6 * scale; i++) {
      const a = Utils.rand(0, Math.PI * 2);
      spawn(x, y, Math.cos(a) * 20, Math.sin(a) * 20, Utils.rand(0.6, 1.1), Utils.rand(6, 14) * scale, 'rgba(120,120,140,0.5)', 'dot', 0.96, -10);
    }
  }

  function spark(x, y, angle, color = '#4cf3e0') {
    if (!enabled) return;
    for (let i = 0; i < 4; i++) {
      const a = angle + Utils.rand(-0.6, 0.6);
      const spd = Utils.rand(60, 160);
      spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, Utils.rand(0.15, 0.3), Utils.rand(1, 3), color, 'dot', 0.9, 0);
    }
  }

  function trail(x, y, color = '#4cf3e0') {
    if (!enabled) return;
    spawn(x, y, Utils.rand(-8, 8), Utils.rand(10, 30), Utils.rand(0.2, 0.4), Utils.rand(2, 4), color, 'dot', 0.94, 0);
  }

  function popText(x, y) { /* reserved for future combo text particles */ }

  function update(dt) {
    if (!pool) return;
    pool.update(o => {
      o.life -= dt;
      if (o.life <= 0) return false;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.vx *= Math.pow(o.drag, dt * 60);
      o.vy *= Math.pow(o.drag, dt * 60);
      o.vy += o.gravity * dt;
      return true;
    });
  }

  function draw(ctx) {
    if (!pool) return;
    for (const o of pool.active) {
      const t = o.life / o.maxLife;
      ctx.globalAlpha = Utils.clamp(t, 0, 1);
      if (o.shape === 'flash') {
        const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.size * t + 1);
        grd.addColorStop(0, 'rgba(255,255,255,0.9)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.size * t + 1, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = o.color;
        ctx.beginPath(); ctx.arc(o.x, o.y, Math.max(0.3, o.size * t), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function clear() { if (pool) pool.clear(); }
  function count() { return pool ? pool.active.length : 0; }

  return { init, setEnabled, spawn, explosion, spark, trail, update, draw, clear, count };
})();
