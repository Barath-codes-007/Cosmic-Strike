/* ============================================================
   enemies.js — enemy catalogue, movement/attack behaviors, spawner
   ============================================================ */

const Enemies = (() => {

  const TYPES = {
    fighter:   { hp: 18,  dmg: 8,  speed: 90,  color: '#ff6b6b', radius: 14, score: 60,  behavior: 'weave',   fireRate: 0 },
    fast:      { hp: 10,  dmg: 6,  speed: 190, color: '#ffb020', radius: 11, score: 70,  behavior: 'diveline', fireRate: 0 },
    tank:      { hp: 70,  dmg: 14, speed: 45,  color: '#8a6bff', radius: 22, score: 140, behavior: 'straight', fireRate: 0 },
    shooter:   { hp: 24,  dmg: 10, speed: 60,  color: '#4cc9ff', radius: 15, score: 100, behavior: 'hover',   fireRate: 1.4 },
    sniper:    { hp: 20,  dmg: 16, speed: 40,  color: '#ff3d8a', radius: 14, score: 120, behavior: 'sniper',  fireRate: 2.4 },
    kamikaze:  { hp: 12,  dmg: 22, speed: 260, color: '#ff4d4d', radius: 12, score: 90,  behavior: 'kamikaze', fireRate: 0 },
    shielded:  { hp: 34,  dmg: 10, speed: 70,  color: '#4cf3e0', radius: 17, score: 150, behavior: 'weave',   fireRate: 1.8, shield: 30 },
    turret:    { hp: 40,  dmg: 12, speed: 0,   color: '#93a3c4', radius: 18, score: 130, behavior: 'static',  fireRate: 1.1 },
    drone:     { hp: 8,   dmg: 5,  speed: 140, color: '#ffe14c', radius: 9,  score: 40,  behavior: 'swarm',   fireRate: 0 },
    elite:     { hp: 90,  dmg: 18, speed: 100, color: '#ff3d8a', radius: 20, score: 240, behavior: 'elite',   fireRate: 1.0 }
  };

  let list = [];

  function reset() { list = []; }

  function spawn(typeKey, x, y, diffMult) {
    const def = TYPES[typeKey];
    const e = {
      type: typeKey, def,
      x, y, vx: 0, vy: 0,
      hp: def.hp * diffMult, maxHp: def.hp * diffMult,
      shield: (def.shield || 0) * diffMult, maxShield: (def.shield || 0) * diffMult,
      dmg: def.dmg, speed: def.speed, color: def.color, radius: def.radius, score: def.score,
      fireRate: def.fireRate, fireCooldown: Utils.rand(0.3, 1.2),
      t: Utils.rand(0, 10), phase: 0, alive: true, flashTimer: 0
    };
    list.push(e);
    return e;
  }

  function damage(e, amount) {
    e.flashTimer = 0.08;
    if (e.shield > 0) {
      const absorb = Math.min(e.shield, amount);
      e.shield -= absorb;
      amount -= absorb;
    }
    if (amount > 0) e.hp -= amount;
    if (e.hp <= 0) e.alive = false;
  }

  function update(dt, bounds, player, fireCallback) {
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.t += dt;
      if (e.flashTimer > 0) e.flashTimer -= dt;

      switch (e.def.behavior) {
        case 'straight':
          e.y += e.speed * dt;
          break;
        case 'weave':
          e.y += e.speed * dt;
          e.x += Math.sin(e.t * 2) * 60 * dt;
          break;
        case 'diveline':
          e.y += e.speed * dt;
          if (player) e.x += Utils.clamp(player.x - e.x, -1, 1) * 40 * dt;
          break;
        case 'hover':
          if (e.y < 140) e.y += e.speed * dt;
          else e.x += Math.sin(e.t * 1.4) * 80 * dt;
          break;
        case 'sniper':
          if (e.y < 110) e.y += e.speed * dt;
          else e.x += Math.cos(e.t) * 30 * dt;
          break;
        case 'kamikaze':
          if (player && player.alive) {
            const a = Utils.angleTo(e.x, e.y, player.x, player.y);
            e.x += Math.cos(a) * e.speed * dt;
            e.y += Math.sin(a) * e.speed * dt;
          } else { e.y += e.speed * dt; }
          break;
        case 'static':
          if (e.y < 100) e.y += 60 * dt;
          break;
        case 'swarm':
          e.y += e.speed * dt * 0.6;
          e.x += Math.sin(e.t * 3 + e.phase) * 100 * dt;
          break;
        case 'elite':
          if (e.y < 160) e.y += e.speed * dt;
          else e.x += Math.sin(e.t * 1.1) * 70 * dt;
          break;
      }
      e.x = Utils.clamp(e.x, e.radius, bounds.w - e.radius);

      // firing
      if (e.fireRate > 0 && e.y > 0 && e.y < bounds.h - 60) {
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0) {
          e.fireCooldown = 1 / e.fireRate;
          fireCallback(e);
        }
      }

      if (!e.alive || e.y > bounds.h + 60) {
        list.splice(i, 1);
      }
    }
  }

  function draw(ctx) {
    for (const e of list) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.flashTimer > 0) { ctx.filter = 'brightness(2.2)'; }
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = e.color;

      // simple distinct silhouettes per behavior family
      ctx.beginPath();
      if (e.def.behavior === 'kamikaze') {
        ctx.moveTo(0, e.radius); ctx.lineTo(e.radius, -e.radius); ctx.lineTo(-e.radius, -e.radius);
      } else if (e.def.behavior === 'static') {
        ctx.rect(-e.radius, -e.radius * 0.7, e.radius * 2, e.radius * 1.4);
      } else if (e.def.behavior === 'swarm') {
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      } else {
        ctx.moveTo(0, -e.radius); ctx.lineTo(e.radius, e.radius); ctx.lineTo(0, e.radius * 0.5); ctx.lineTo(-e.radius, e.radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.filter = 'none';

      if (e.maxShield > 0 && e.shield > 0) {
        ctx.strokeStyle = 'rgba(76,243,224,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();

      // health bar for tougher enemies
      if (e.maxHp > 20) {
        const w = e.radius * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 4);
        ctx.fillStyle = e.hp / e.maxHp > 0.4 ? '#4cf3a0' : '#ff4d4d';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * Utils.clamp(e.hp / e.maxHp, 0, 1), 4);
      }
    }
  }

  return { TYPES, reset, spawn, damage, update, draw, get list() { return list; } };
})();
