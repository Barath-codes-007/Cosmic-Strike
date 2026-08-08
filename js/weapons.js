/* ============================================================
   weapons.js — weapon catalogue + upgrade scaling + fire logic
   ============================================================ */

const Weapons = (() => {

  // Base stats at level 1. Each level adds the *Level scalars below.
  const CATALOG = {
    laser: {
      name: 'Basic Laser', desc: 'Reliable single-shot cannon. Fast and cheap.',
      color: '#4cf3e0', baseDamage: 8, baseFireRate: 5.5, cost: 0,
      pattern: 'single'
    },
    double: {
      name: 'Double Laser', desc: 'Twin parallel beams for double coverage.',
      color: '#4cf3e0', baseDamage: 7, baseFireRate: 5.2, cost: 800,
      pattern: 'double'
    },
    triple: {
      name: 'Triple Laser', desc: 'Three-way spread with a wide hit box.',
      color: '#8a6bff', baseDamage: 6, baseFireRate: 5, cost: 1600,
      pattern: 'triple'
    },
    spread: {
      name: 'Spread Shot', desc: 'Five-way fan, devastating up close.',
      color: '#ff3d8a', baseDamage: 5, baseFireRate: 4.2, cost: 2200,
      pattern: 'spread'
    },
    plasma: {
      name: 'Plasma Cannon', desc: 'Slow, heavy plasma orbs that punch hard.',
      color: '#ffb020', baseDamage: 22, baseFireRate: 2.2, cost: 3000,
      pattern: 'plasma'
    },
    missile: {
      name: 'Missile Launcher', desc: 'Homing missiles that track the nearest target.',
      color: '#ff4d4d', baseDamage: 26, baseFireRate: 1.6, cost: 3600,
      pattern: 'missile'
    },
    beam: {
      name: 'Laser Beam', desc: 'A continuous piercing beam. Great vs. bosses.',
      color: '#4cf3e0', baseDamage: 3, baseFireRate: 18, cost: 4200,
      pattern: 'beam'
    },
    energy: {
      name: 'Energy Weapon', desc: 'Chain-lightning shots that arc between foes.',
      color: '#8a6bff', baseDamage: 10, baseFireRate: 4, cost: 5000,
      pattern: 'energy'
    }
  };

  const MAX_LEVEL = 5;
  function levelMultiplier(level) { return 1 + (level - 1) * 0.28; }
  function upgradeCost(currentLevel) { return Math.round(300 * Math.pow(1.9, currentLevel)); }

  function getStats(id, level) {
    const base = CATALOG[id];
    const mult = levelMultiplier(level);
    return {
      damage: base.baseDamage * mult,
      fireRate: base.baseFireRate * (1 + (level - 1) * 0.08),
      pattern: base.pattern,
      color: base.color
    };
  }

  // fire() spawns bullets for one shot event, based on pattern + player's total stat modifiers
  function fire(id, level, shooterX, shooterY, damageMult, critChance, critMult, target) {
    const stats = getStats(id, level);
    const dmg = () => {
      const isCrit = Math.random() < critChance;
      const d = stats.damage * damageMult * (isCrit ? critMult : 1);
      return { d, isCrit };
    };
    const speed = 620;
    const mk = (vx, vy, extra = {}) => {
      const { d, isCrit } = dmg();
      Bullets.spawnPlayer(Object.assign({
        x: shooterX, y: shooterY, vx, vy, damage: d, color: stats.color, isCrit,
        kind: stats.pattern === 'plasma' ? 'plasma' : stats.pattern === 'missile' ? 'missile' : stats.pattern === 'beam' ? 'beam' : 'basic',
        radius: stats.pattern === 'plasma' ? 9 : 4
      }, extra));
    };

    switch (stats.pattern) {
      case 'single':
        mk(0, -speed);
        break;
      case 'double':
        mk(0, -speed, { x: shooterX - 12 }); mk(0, -speed, { x: shooterX + 12 });
        break;
      case 'triple':
        mk(0, -speed); mk(-speed * 0.18, -speed * 0.98); mk(speed * 0.18, -speed * 0.98);
        break;
      case 'spread': {
        const angles = [-0.5, -0.25, 0, 0.25, 0.5];
        angles.forEach(a => mk(Math.sin(a) * speed, -Math.cos(a) * speed));
        break;
      }
      case 'plasma':
        mk(0, -speed * 0.65);
        break;
      case 'missile':
        mk(Utils.rand(-40, 40), -speed * 0.7, { homing: true, target, life: 3.5 });
        break;
      case 'beam':
        mk(0, -speed * 1.4, { w: 8, h: 30, life: 0.5 });
        break;
      case 'energy':
        mk(Utils.rand(-30, 30), -speed * 0.85);
        break;
      default:
        mk(0, -speed);
    }
  }

  return { CATALOG, MAX_LEVEL, levelMultiplier, upgradeCost, getStats, fire };
})();
