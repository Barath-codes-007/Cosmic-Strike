/* ============================================================
   bosses.js — large multi-phase boss encounters
   ============================================================ */

const Bosses = (() => {

  const CATALOG = {
    destroyer: {
      name: 'THE DESTROYER', color: '#ff3d8a', radius: 60, baseHp: 900, dmg: 14,
      phases: 4, music: 'boss'
    },
    leviathan: {
      name: 'VOID LEVIATHAN', color: '#8a6bff', radius: 70, baseHp: 1400, dmg: 16,
      phases: 4, music: 'boss'
    },
    sentinel: {
      name: 'ANCIENT SENTINEL', color: '#4cf3e0', radius: 80, baseHp: 2000, dmg: 20,
      phases: 4, music: 'boss'
    }
  };

  let boss = null;

  function reset() { boss = null; }

  function spawn(id, bounds, diffMult) {
    const def = CATALOG[id];
    boss = {
      id, def,
      x: bounds.w / 2, y: -120, targetY: 130,
      hp: def.baseHp * diffMult, maxHp: def.baseHp * diffMult,
      radius: def.radius, phase: 1, t: 0, alive: true,
      attackTimer: 2, entering: true, flashTimer: 0, enraged: false
    };
    return boss;
  }

  function damage(amount) {
    if (!boss || !boss.alive) return;
    boss.flashTimer = 0.08;
    boss.hp -= amount;
    const hpPct = boss.hp / boss.maxHp;
    boss.phase = hpPct > 0.75 ? 1 : hpPct > 0.5 ? 2 : hpPct > 0.22 ? 3 : 4;
    boss.enraged = boss.phase === 4;
    if (boss.hp <= 0) { boss.hp = 0; boss.alive = false; }
  }

  // returns a list of attack "intents" the game loop turns into bullets/minions
  function update(dt, bounds, player, callbacks) {
    if (!boss) return;
    boss.t += dt;
    if (boss.flashTimer > 0) boss.flashTimer -= dt;

    if (boss.entering) {
      boss.y += (boss.targetY - boss.y) * Math.min(1, dt * 1.5);
      if (Math.abs(boss.y - boss.targetY) < 2) boss.entering = false;
      return;
    }

    // horizontal drift
    boss.x = bounds.w / 2 + Math.sin(boss.t * 0.5) * (bounds.w * 0.3);

    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      const speedFactor = boss.enraged ? 0.55 : 1;
      boss.attackTimer = Utils.rand(1.1, 1.9) * speedFactor;

      switch (boss.phase) {
        case 1: // normal spread shooting
          callbacks.fanShot(boss, 5, boss.def.dmg);
          break;
        case 2: // missile attack
          callbacks.missileShot(boss, 3, boss.def.dmg * 1.1);
          break;
        case 3: // laser attack + minions
          callbacks.laserSweep(boss, boss.def.dmg * 1.2);
          if (Math.random() < 0.5) callbacks.spawnMinions(boss, 2);
          break;
        case 4: // enraged: everything, faster
          if (Math.random() < 0.5) callbacks.fanShot(boss, 8, boss.def.dmg * 1.3);
          else callbacks.missileShot(boss, 4, boss.def.dmg * 1.3);
          if (Math.random() < 0.35) callbacks.spawnMinions(boss, 2);
          break;
      }
    }
  }

  function draw(ctx) {
    if (!boss) return;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    if (boss.flashTimer > 0) ctx.filter = 'brightness(2.5)';
    const bob = Math.sin(boss.t * 2) * 6;
    ctx.translate(0, bob);

    ctx.shadowColor = boss.def.color;
    ctx.shadowBlur = boss.enraged ? 30 : 18;
    ctx.fillStyle = boss.def.color;

    // layered geometric boss silhouette — distinct hexagonal core + wings
    const r = boss.radius;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.8;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(10,10,20,0.6)';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = boss.enraged ? '#ff4d4d' : '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.stroke();

    // wings
    ctx.fillStyle = boss.def.color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r * 1.6, -r * 0.3); ctx.lineTo(-r * 1.4, r * 0.4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r * 1.6, -r * 0.3); ctx.lineTo(r * 1.4, r * 0.4); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
    ctx.filter = 'none';
    ctx.restore();
  }

  return { CATALOG, reset, spawn, damage, update, draw, get boss() { return boss; } };
})();
