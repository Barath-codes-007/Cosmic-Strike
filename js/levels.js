/* ============================================================
   levels.js — sector definitions + wave scripting + starfield bg
   ============================================================ */

const Levels = (() => {

  // 6 story sectors, each with a distinct nebula tint, enemy roster, and boss
  const SECTORS = [
    { id: 1, name: 'OUTER RIM', tint: '#1a2a4a', roster: ['fighter', 'fast', 'drone'], boss: 'destroyer', waves: 5 },
    { id: 2, name: 'ASTEROID BELT', tint: '#2a1a3a', roster: ['fighter', 'tank', 'kamikaze', 'drone'], boss: 'destroyer', waves: 6 },
    { id: 3, name: 'ION STORM', tint: '#1a3a3a', roster: ['shooter', 'sniper', 'fast', 'fighter'], boss: 'leviathan', waves: 6 },
    { id: 4, name: 'DERELICT FLEET', tint: '#3a1a2a', roster: ['tank', 'shielded', 'turret', 'kamikaze'], boss: 'leviathan', waves: 7 },
    { id: 5, name: 'NEBULA CORE', tint: '#2a2a1a', roster: ['shielded', 'elite', 'sniper', 'swarm', 'drone'], boss: 'sentinel', waves: 7 },
    { id: 6, name: 'THE THRESHOLD', tint: '#3a1a1a', roster: ['elite', 'shielded', 'tank', 'sniper', 'kamikaze'], boss: 'sentinel', waves: 8 }
  ];

  function getSector(n) { return SECTORS[Utils.clamp(n - 1, 0, SECTORS.length - 1)]; }

  // ---------------- Starfield (multi-layer parallax) ----------------
  class Starfield {
    constructor(w, h) {
      this.resize(w, h);
    }
    resize(w, h) {
      this.w = w; this.h = h;
      this.layers = [0.3, 0.6, 1.0, 1.6].map((speed, i) => {
        const count = 40 + i * 25;
        const stars = [];
        for (let s = 0; s < count; s++) {
          stars.push({ x: Math.random() * w, y: Math.random() * h, size: Utils.rand(0.6, i + 1.4), tw: Math.random() * 10 });
        }
        return { speed, stars, color: i < 2 ? 'rgba(200,210,255,' : 'rgba(255,255,255,' };
      });
      this.nebulaBlobs = [];
      for (let i = 0; i < 4; i++) {
        this.nebulaBlobs.push({ x: Math.random() * w, y: Math.random() * h, r: Utils.rand(150, 320), hue: Utils.choice(['#4cf3e0', '#8a6bff', '#ff3d8a']) });
      }
      this.shootingStar = null;
      this.shootingTimer = Utils.rand(3, 8);
      this.debris = [];
      for (let i = 0; i < 10; i++) {
        this.debris.push({ x: Math.random() * w, y: Math.random() * h, vy: Utils.rand(20, 60), size: Utils.rand(2, 5), rot: Math.random() * Math.PI });
      }
    }
    update(dt, tint) {
      this.tint = tint;
      for (const layer of this.layers) {
        for (const st of layer.stars) {
          st.y += layer.speed * 40 * dt;
          if (st.y > this.h) { st.y = 0; st.x = Math.random() * this.w; }
          st.tw += dt * 2;
        }
      }
      for (const d of this.debris) {
        d.y += d.vy * dt; d.rot += dt;
        if (d.y > this.h + 10) { d.y = -10; d.x = Math.random() * this.w; }
      }
      this.shootingTimer -= dt;
      if (this.shootingTimer <= 0 && !this.shootingStar) {
        this.shootingStar = { x: Math.random() * this.w, y: -10, vx: Utils.rand(-200, -400), vy: Utils.rand(300, 500), life: 1.2 };
      }
      if (this.shootingStar) {
        const s = this.shootingStar;
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        if (s.life <= 0) { this.shootingStar = null; this.shootingTimer = Utils.rand(4, 10); }
      }
    }
    draw(ctx) {
      ctx.fillStyle = this.tint ? this.tint : '#04050a';
      ctx.fillRect(0, 0, this.w, this.h);

      // nebula blobs
      for (const n of this.nebulaBlobs) {
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        grd.addColorStop(0, n.hue + '22');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
      }

      for (const layer of this.layers) {
        for (const st of layer.stars) {
          const alpha = 0.5 + Math.sin(st.tw) * 0.5;
          ctx.fillStyle = layer.color + alpha + ')';
          ctx.fillRect(st.x, st.y, st.size, st.size);
        }
      }

      // debris
      ctx.fillStyle = 'rgba(150,150,170,0.5)';
      for (const d of this.debris) {
        ctx.save();
        ctx.translate(d.x, d.y); ctx.rotate(d.rot);
        ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
        ctx.restore();
      }

      if (this.shootingStar) {
        const s = this.shootingStar;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.05, s.y - s.vy * 0.05); ctx.stroke();
      }
    }
  }

  // ---------------- Wave generation ----------------
  // Produces a flat spawn schedule for a wave: [{t, type}, ...]
  function generateWave(sector, waveNum, diffMult) {
    const schedule = [];
    const enemyCount = 6 + waveNum * 2;
    let t = 0;
    for (let i = 0; i < enemyCount; i++) {
      t += Utils.rand(0.35, 0.9) / Math.min(2, 1 + waveNum * 0.05);
      const type = Utils.choice(sector.roster);
      schedule.push({ t, type });
    }
    // mini-boss on the second-to-last wave of a sector (tougher elite/tank)
    if (waveNum === sector.waves - 1) {
      schedule.push({ t: t + 1, type: 'elite', mini: true });
    }
    return { schedule, duration: t + 1.5, diffMult: diffMult };
  }

  return { SECTORS, getSector, Starfield, generateWave };
})();
