/* ============================================================
   bullets.js — pooled projectile management (player + enemy)
   ============================================================ */

const Bullets = (() => {
  let playerPool, enemyPool;

  function factory() {
    return { x: 0, y: 0, vx: 0, vy: 0, radius: 4, damage: 1, life: 2, color: '#4cf3e0', kind: 'basic', pierce: 0, homing: false, target: null, angle: 0, w: 6, h: 14 };
  }
  function reset(o, cfg) {
    Object.assign(o, {
      x: cfg.x, y: cfg.y, vx: cfg.vx, vy: cfg.vy, radius: cfg.radius ?? 4,
      damage: cfg.damage ?? 1, life: cfg.life ?? 2.5, color: cfg.color ?? '#4cf3e0',
      kind: cfg.kind ?? 'basic', pierce: cfg.pierce ?? 0, homing: cfg.homing ?? false,
      target: cfg.target ?? null, angle: Math.atan2(cfg.vy, cfg.vx), w: cfg.w ?? 6, h: cfg.h ?? 14
    });
  }

  function init() {
    playerPool = new Utils.Pool(factory, reset, 120);
    enemyPool = new Utils.Pool(factory, reset, 150);
  }

  function spawnPlayer(cfg) { return playerPool.spawn(cfg); }
  function spawnEnemy(cfg) { return enemyPool.spawn(cfg); }

  function update(dt, bounds, homingRetarget) {
    const step = (pool) => pool.update(b => {
      if (b.homing && b.target && b.target.hp > 0) {
        const desired = Math.atan2(b.target.y - b.y, b.target.x - b.x);
        let diff = desired - b.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        b.angle += Utils.clamp(diff, -3 * dt, 3 * dt);
        const spd = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(b.angle) * spd;
        b.vy = Math.sin(b.angle) * spd;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) return false;
      if (b.x < -50 || b.x > bounds.w + 50 || b.y < -50 || b.y > bounds.h + 50) return false;
      return true;
    });
    step(playerPool);
    step(enemyPool);
  }

  function draw(ctx) {
    const drawSet = (pool, glowColor) => {
      for (const b of pool.active) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle + Math.PI / 2);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = b.color;
        if (b.kind === 'missile') {
          ctx.fillRect(-3, -8, 6, 16);
          ctx.fillStyle = '#ffb020';
          ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(3, 8); ctx.lineTo(0, 16); ctx.fill();
        } else if (b.kind === 'plasma') {
          ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI * 2); ctx.fill();
        } else if (b.kind === 'beam') {
          ctx.fillRect(-b.w / 2, -b.h, b.w, b.h * 2);
        } else {
          ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        }
        ctx.restore();
      }
    };
    ctx.shadowBlur = 0;
    drawSet(playerPool);
    drawSet(enemyPool);
    ctx.shadowBlur = 0;
  }

  function clear() { playerPool.clear(); enemyPool.clear(); }

  return { init, spawnPlayer, spawnEnemy, update, draw, clear, get playerPool() { return playerPool; }, get enemyPool() { return enemyPool; } };
})();
