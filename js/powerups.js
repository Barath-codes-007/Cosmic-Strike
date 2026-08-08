/* ============================================================
   powerups.js — floating pickups with visual/audio feedback
   ============================================================ */

const PowerUps = (() => {
  const TYPES = {
    health:  { icon: '❤', color: '#ff4d4d', label: 'HEALTH' },
    shield:  { icon: '🛡', color: '#4cc9ff', label: 'SHIELD' },
    energy:  { icon: '⚡', color: '#ffe14c', label: 'ENERGY' },
    damage:  { icon: '🔥', color: '#ff8a4d', label: 'DAMAGE BOOST' },
    speed:   { icon: '🚀', color: '#4cf3e0', label: 'SPEED BOOST' },
    multi:   { icon: '💥', color: '#8a6bff', label: 'MULTI-SHOT' },
    slowmo:  { icon: '⏱', color: '#c084fc', label: 'SLOW MOTION' },
    score:   { icon: '⭐', color: '#ffb020', label: 'SCORE x2' },
    regen:   { icon: '🔋', color: '#4cf3a0', label: 'ENERGY REGEN' }
  };
  const KEYS = Object.keys(TYPES);

  let list = [];

  function reset() { list = []; }

  function spawn(x, y, forcedType) {
    const type = forcedType || Utils.choice(KEYS);
    list.push({ x, y, vy: 60, type, radius: 14, life: 8, spin: 0 });
  }

  function update(dt, bounds, player, onCollect) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.y += p.vy * dt;
      p.spin += dt * 3;
      p.life -= dt;
      if (p.life <= 0 || p.y > bounds.h + 30) { list.splice(i, 1); continue; }
      if (player && player.alive && Utils.circleHit(p, player)) {
        onCollect(p.type);
        list.splice(i, 1);
      }
    }
  }

  function draw(ctx) {
    for (const p of list) {
      const def = TYPES[p.type];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.spin) * 0.3);
      const pulse = 1 + Math.sin(p.spin * 2) * 0.08;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(10,14,28,0.7)';
      ctx.beginPath(); ctx.arc(0, 0, p.radius * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, 0, 1);
      ctx.restore();
    }
  }

  return { TYPES, reset, spawn, update, draw, get list() { return list; } };
})();
