/* ============================================================
   storage.js — persistent save system (localStorage)
   Handles missing/corrupted saves gracefully.
   ============================================================ */

const Storage = (() => {
  const KEY = 'voidrunner_save_v1';

  function defaultSave() {
    return {
      version: 1,
      highScore: 0,
      credits: 0,
      xp: 0,
      playerLevel: 1,
      selectedShip: 'scout',
      ownedShips: ['scout'],
      selectedWeapon: 'laser',
      ownedWeapons: ['laser'],
      weaponLevels: { laser: 1 },
      ownedCosmetics: [],
      selectedCosmetic: null,
      upgrades: { damage: 0, firerate: 0, speed: 0, shield: 0, crit: 0 },
      achievements: {},         // id -> true
      stats: { enemiesDestroyed: 0, bossesDestroyed: 0, shotsFired: 0, shotsHit: 0, runsPlayed: 0, timeSurvived: 0 },
      missions: null,           // generated lazily
      settings: { music: 60, sfx: 80, quality: 'high', shake: true, particles: true, controls: 'auto' },
      unlockedLevel: 1
    };
  }

  function isValid(obj) {
    return obj && typeof obj === 'object' && typeof obj.version === 'number' && obj.stats && obj.upgrades;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      if (!isValid(parsed)) throw new Error('corrupt save shape');
      // merge with defaults in case new fields were added since this save was written
      const merged = Object.assign(defaultSave(), parsed);
      merged.upgrades = Object.assign(defaultSave().upgrades, parsed.upgrades || {});
      merged.weaponLevels = Object.assign(defaultSave().weaponLevels, parsed.weaponLevels || {});
      merged.stats = Object.assign(defaultSave().stats, parsed.stats || {});
      merged.settings = Object.assign(defaultSave().settings, parsed.settings || {});
      return merged;
    } catch (e) {
      console.warn('Save data corrupted or unreadable, resetting to defaults.', e);
      try { localStorage.removeItem(KEY); } catch (e2) {}
      return defaultSave();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Failed to save game data', e);
      return false;
    }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    return defaultSave();
  }

  return { load, save, reset, defaultSave };
})();
