/* ============================================================
   player.js — player ship stats, ship catalogue, control response
   ============================================================ */

const Ships = {
  scout: {
    name: 'Scout', desc: 'High speed, low health, fast shooting.',
    cost: 0, hp: 70, shield: 30, speed: 420, fireRateMult: 1.35, damageMult: 0.85,
    critChance: 0.06, critMult: 1.6, shieldRegen: 6, energyMax: 100,
    special: 'overdrive', specialDesc: 'Overdrive: temporary fire-rate & speed surge.',
    color: '#4cf3e0'
  },
  fighter: {
    name: 'Fighter', desc: 'Balanced all-rounder.',
    cost: 1200, hp: 100, shield: 50, speed: 340, fireRateMult: 1.0, damageMult: 1.0,
    critChance: 0.08, critMult: 1.7, shieldRegen: 5, energyMax: 100,
    special: 'nova', specialDesc: 'Nova Blast: radial damage pulse around the ship.',
    color: '#8a6bff'
  },
  tank: {
    name: 'Tank', desc: 'High health, slow but relentless.',
    cost: 2400, hp: 160, shield: 90, speed: 240, fireRateMult: 0.8, damageMult: 1.25,
    critChance: 0.05, critMult: 1.5, shieldRegen: 7, energyMax: 110,
    special: 'fortify', specialDesc: 'Fortify: brief invulnerability + damage reflect.',
    color: '#ffb020'
  },
  interceptor: {
    name: 'Interceptor', desc: 'Very high speed, special weapons specialist.',
    cost: 4200, hp: 85, shield: 45, speed: 460, fireRateMult: 1.2, damageMult: 1.1,
    critChance: 0.14, critMult: 2.0, shieldRegen: 8, energyMax: 120,
    special: 'barrage', specialDesc: 'Barrage: unleashes a wave of homing micro-missiles.',
    color: '#ff3d8a'
  }
};

class Player {
  constructor(shipId, upgrades, weaponId, weaponLevel) {
    const s = Ships[shipId] || Ships.scout;
    this.shipId = shipId;
    this.def = s;
    this.x = 0; this.y = 0;
    this.radius = 16;
    this.upgrades = upgrades || { damage: 0, firerate: 0, speed: 0, shield: 0, crit: 0 };

    // apply permanent upgrade levels (each level ~ +6% for scaling stats)
    const upBonus = (lvl) => 1 + lvl * 0.06;

    this.maxHp = s.hp;
    this.hp = this.maxHp;
    this.maxShield = s.shield * upBonus(this.upgrades.shield);
    this.shield = this.maxShield;
    this.shieldRegen = s.shieldRegen;
    this.speed = s.speed * upBonus(this.upgrades.speed);
    this.damageMult = s.damageMult * upBonus(this.upgrades.damage);
    this.fireRateMult = s.fireRateMult * upBonus(this.upgrades.firerate);
    this.critChance = Utils.clamp(s.critChance + this.upgrades.crit * 0.015, 0, 0.75);
    this.critMult = s.critMult;

    this.energy = 0;
    this.energyMax = s.energyMax;

    this.weaponId = weaponId || 'laser';
    this.weaponLevel = weaponLevel || 1;

    this.fireCooldown = 0;
    this.invuln = 0;
    this.boostCooldown = 0;
    this.boosting = 0;
    this.specialActive = 0;
    this.overdrive = 0;
    this.alive = true;

    this.vx = 0; this.vy = 0;
    this.engineFlicker = 0;
  }

  get fireRate() {
    const stats = Weapons.getStats(this.weaponId, this.weaponLevel);
    let rate = stats.fireRate * this.fireRateMult;
    if (this.overdrive > 0) rate *= 1.8;
    return rate;
  }

  takeDamage(amount) {
    if (this.invuln > 0) return false;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
      Audio2.SFX.shieldHit();
    }
    if (amount > 0) {
      this.hp -= amount;
      Audio2.SFX.hurt();
      this.invuln = 0.5;
    }
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return true;
  }

  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }
  addShield(amount) { this.shield = Math.min(this.maxShield, this.shield + amount); }
  addEnergy(amount) { this.energy = Math.min(this.energyMax, this.energy + amount); }

  canUseSpecial() { return this.energy >= this.energyMax; }

  update(dt, input, bounds, survivalMode) {
    // movement
    let mx = input.moveX, my = input.moveY;
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    let spd = this.speed;
    if (this.boosting > 0) spd *= 2.1;
    this.x += mx * spd * dt;
    this.y += my * spd * dt;
    this.x = Utils.clamp(this.x, this.radius, bounds.w - this.radius);
    this.y = Utils.clamp(this.y, this.radius + 40, bounds.h - this.radius);
    this.vx = mx; this.vy = my;

    // timers
    if (this.invuln > 0) this.invuln -= dt;
    if (this.boosting > 0) this.boosting -= dt;
    if (this.boostCooldown > 0) this.boostCooldown -= dt;
    if (this.overdrive > 0) this.overdrive -= dt;
    if (this.specialActive > 0) this.specialActive -= dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    // passive regen (disabled in survival mode per spec)
    if (!survivalMode && this.shield < this.maxShield) {
      this.addShield(this.shieldRegen * dt);
    }
    this.addEnergy(6 * dt);

    this.engineFlicker += dt * 20;
  }

  tryFire(dt, target) {
    if (this.fireCooldown > 0) return false;
    this.fireCooldown = 1 / this.fireRate;
    Weapons.fire(this.weaponId, this.weaponLevel, this.x, this.y - 20, this.damageMult * (this.overdrive > 0 ? 1.3 : 1), this.critChance, this.critMult, target);
    return true;
  }

  tryBoost() {
    if (this.boostCooldown > 0) return false;
    this.boosting = 0.35;
    this.invuln = Math.max(this.invuln, 0.35);
    this.boostCooldown = 2.2;
    Audio2.SFX.boost();
    return true;
  }

  triggerSpecial() {
    if (!this.canUseSpecial()) return false;
    this.energy = 0;
    Audio2.SFX.special();
    switch (this.def.special) {
      case 'overdrive': this.overdrive = 5; break;
      case 'nova': this.specialActive = 0.1; this.novaPending = true; break;
      case 'fortify': this.invuln = 3; this.specialActive = 3; this.fortifyActive = true; break;
      case 'barrage': this.barragePending = 12; break;
    }
    return true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const tilt = Utils.clamp(this.vx, -1, 1) * 0.25;
    ctx.rotate(tilt);

    if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.5;

    // engine trail
    const flick = 6 + Math.sin(this.engineFlicker) * 2;
    const grad = ctx.createRadialGradient(0, 22, 0, 0, 22, flick + (this.boosting > 0 ? 14 : 0));
    grad.addColorStop(0, this.def.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 22, flick + (this.boosting > 0 ? 14 : 0), 0, Math.PI * 2); ctx.fill();

    // hull
    ctx.shadowColor = this.def.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#e8ecf4';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(14, 16);
    ctx.lineTo(6, 10);
    ctx.lineTo(0, 16);
    ctx.lineTo(-6, 10);
    ctx.lineTo(-14, 16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.def.color;
    ctx.beginPath(); ctx.arc(0, -4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // shield ring
    if (this.shield > 0) {
      ctx.globalAlpha *= 0.35;
      ctx.strokeStyle = '#4cf3e0';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
    }
    if (this.invuln > 0 && this.fortifyActive) {
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
