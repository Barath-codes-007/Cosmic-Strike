/* ============================================================
   ui.js — screen navigation, HUD, hangar/shop/upgrades/achievements
   ============================================================ */

const UI = (() => {
  let save;
  let currentShipIndex = 0;
  const shipOrder = ['scout', 'fighter', 'tank', 'interceptor'];

  const ACHIEVEMENTS = [
    { id: 'first_kill', name: 'First Blood', desc: 'Destroy your first enemy.', icon: '🎯', check: s => s.stats.enemiesDestroyed >= 1 },
    { id: 'hundred_kills', name: 'Exterminator', desc: 'Destroy 100 enemies.', icon: '💀', check: s => s.stats.enemiesDestroyed >= 100 },
    { id: 'thousand_kills', name: 'War Machine', desc: 'Destroy 1000 enemies.', icon: '☠', check: s => s.stats.enemiesDestroyed >= 1000 },
    { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat 5 bosses.', icon: '👹', check: s => s.stats.bossesDestroyed >= 5 },
    { id: 'perfect_wave', name: 'Perfect Wave', desc: 'Clear a wave without taking damage.', icon: '✨', check: s => s.stats.perfectWaves >= 1 },
    { id: 'millionaire', name: 'Millionaire', desc: 'Earn 1,000,000 total credits.', icon: '💰', check: s => s.stats.totalCreditsEarned >= 1000000 },
    { id: 'survivor', name: 'Survivor', desc: 'Survive 5 minutes in one run.', icon: '⏱', check: s => s.stats.timeSurvived >= 300 },
    { id: 'no_damage_boss', name: 'Untouchable', desc: 'Defeat a boss without taking damage.', icon: '🛡', check: s => s.stats.flawlessBoss >= 1 },
    { id: 'combo_master', name: 'Combo Master', desc: 'Reach a x20 combo.', icon: '🔥', check: s => s.stats.bestCombo >= 20 },
    { id: 'sharpshooter', name: 'Sharpshooter', desc: 'Reach 80% accuracy in a run (min 50 shots).', icon: '🎯', check: s => s.stats.bestAccuracy >= 0.8 }
  ];

  const COSMETICS = [
    { id: 'trail_gold', name: 'Gold Engine Trail', desc: 'A shimmering golden exhaust trail.', cost: 1500 },
    { id: 'trail_violet', name: 'Violet Engine Trail', desc: 'A deep violet ion trail.', cost: 1500 },
    { id: 'skin_chrome', name: 'Chrome Hull Finish', desc: 'A polished chrome hull skin.', cost: 2200 },
    { id: 'skin_stealth', name: 'Stealth Black Finish', desc: 'A matte stealth hull skin.', cost: 2200 }
  ];

  const MISSION_POOL = [
    { id: 'm_kill50', desc: 'Destroy 50 enemies', target: 50, statKey: 'enemiesDestroyed', reward: { credits: 300, xp: 150 } },
    { id: 'm_kill100', desc: 'Destroy 100 enemies', target: 100, statKey: 'enemiesDestroyed', reward: { credits: 500, xp: 250 } },
    { id: 'm_boss2', desc: 'Defeat 2 bosses', target: 2, statKey: 'bossesDestroyed', reward: { credits: 600, xp: 300 } },
    { id: 'm_powerups20', desc: 'Collect 20 power-ups', target: 20, statKey: 'powerupsCollected', reward: { credits: 350, xp: 150 } },
    { id: 'm_runs3', desc: 'Complete 3 runs', target: 3, statKey: 'runsPlayed', reward: { credits: 400, xp: 200 } }
  ];

  function todayKey() { return new Date().toISOString().slice(0, 10); }

  function ensureMissions() {
    if (!save.missions || save.missions.date !== todayKey()) {
      const picks = [...MISSION_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
      save.missions = {
        date: todayKey(),
        list: picks.map(p => ({ id: p.id, statKey: p.statKey, target: p.target, desc: p.desc, reward: p.reward, startValue: save.stats[p.statKey] || 0, claimed: false }))
      };
      Storage.save(save);
    }
  }

  function renderMissions() {
    ensureMissions();
    const list = document.getElementById('mission-list');
    list.innerHTML = save.missions.list.map(m => {
      const cur = Math.max(0, (save.stats[m.statKey] || 0) - m.startValue);
      const done = cur >= m.target;
      return `<div class="ach-item ${done ? 'unlocked' : ''}">
        <div class="ach-icon">${done ? '✅' : '🕓'}</div>
        <div style="flex:1;">
          <div class="ach-name">${m.desc}</div>
          <div class="ach-desc">${Math.min(cur, m.target)}/${m.target} — reward ${m.reward.credits} ⚙ + ${m.reward.xp} XP</div>
        </div>
        ${done && !m.claimed ? `<button class="upgrade-btn" data-mission="${m.id}">CLAIM</button>` : ''}
      </div>`;
    }).join('');
    list.querySelectorAll('[data-mission]').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = save.missions.list.find(x => x.id === btn.dataset.mission);
        if (m && !m.claimed) {
          m.claimed = true;
          save.credits += m.reward.credits;
          save.xp += m.reward.xp;
          Audio2.SFX.achievement();
          Storage.save(save);
          renderMissions();
          refreshMenuStats();
        }
      });
    });
  }

  function init(saveData) {
    save = saveData;
    currentShipIndex = Math.max(0, shipOrder.indexOf(save.selectedShip));
    bindNav();
    bindHangar();
    bindShop();
    bindUpgrades();
    bindSettings();
    refreshMenuStats();
  }

  function bindNav() {
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        Audio2.SFX.uiClick();
        goTo(btn.dataset.nav);
      });
    });
  }

  function goTo(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'screen-menu') { refreshMenuStats(); Audio2.playMusic('menu'); }
    if (id === 'screen-hangar') renderHangar();
    if (id === 'screen-shop') renderShop('ships');
    if (id === 'screen-upgrades') renderUpgrades();
    if (id === 'screen-achievements') { renderMissions(); renderAchievements(); }
  }

  function refreshMenuStats() {
    document.getElementById('menu-level').textContent = save.playerLevel;
    document.getElementById('menu-credits').textContent = Utils.formatNum(save.credits);
    document.getElementById('menu-best').textContent = Utils.formatNum(save.highScore);
  }

  // ---------------- HANGAR ----------------
  function bindHangar() {
    document.getElementById('hangar-prev').addEventListener('click', () => { cycleShip(-1); });
    document.getElementById('hangar-next').addEventListener('click', () => { cycleShip(1); });
    document.getElementById('hangar-select').addEventListener('click', () => {
      const id = shipOrder[currentShipIndex];
      if (save.ownedShips.includes(id)) {
        save.selectedShip = id;
        Storage.save(save);
        Audio2.SFX.uiClick();
        renderHangar();
      }
    });
  }
  function cycleShip(dir) {
    currentShipIndex = (currentShipIndex + dir + shipOrder.length) % shipOrder.length;
    Audio2.SFX.uiClick();
    renderHangar();
  }
  function renderHangar() {
    const id = shipOrder[currentShipIndex];
    const s = Ships[id];
    document.getElementById('hangar-ship-name').textContent = s.name;
    const owned = save.ownedShips.includes(id);
    const selected = save.selectedShip === id;
    const btn = document.getElementById('hangar-select');
    btn.textContent = !owned ? `LOCKED — ${s.cost} ⚙` : selected ? 'EQUIPPED' : 'SELECT SHIP';
    btn.disabled = !owned || selected;

    const statsEl = document.getElementById('hangar-stats');
    const rows = [
      ['HEALTH', s.hp, 200],
      ['SHIELD', s.shield, 120],
      ['SPEED', s.speed, 500],
      ['FIRE RATE', s.fireRateMult * 100, 150],
      ['CRIT CHANCE', s.critChance * 100, 20]
    ];
    statsEl.innerHTML = rows.map(([label, val, max]) => `
      <div class="stat-row">
        <div class="label">${label}</div>
        <div class="track"><div class="fill" style="width:${Utils.clamp(val / max * 100, 4, 100)}%"></div></div>
      </div>`).join('') + `<div style="font-size:.72rem;color:var(--text-mid);margin-top:6px;">${s.specialDesc}</div>`;

    drawHangarShip(id);
  }
  function drawHangarShip(id) {
    const canvas = document.getElementById('hangar-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dummy = new Player(id, { damage: 0, firerate: 0, speed: 0, shield: 0, crit: 0 }, 'laser', 1);
    dummy.x = canvas.width / 2; dummy.y = canvas.height / 2;
    dummy.engineFlicker = performance.now() / 100;
    dummy.draw(ctx);
  }

  // ---------------- SHOP ----------------
  function bindShop() {
    document.querySelectorAll('.shop-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Audio2.SFX.uiClick();
        renderShop(tab.dataset.tab);
      });
    });
  }
  function renderShop(tab) {
    document.getElementById('shop-credits').textContent = Utils.formatNum(save.credits);
    const grid = document.getElementById('shop-grid');
    let items = [];
    if (tab === 'ships') {
      items = shipOrder.map(id => ({ id, kind: 'ship', name: Ships[id].name, desc: Ships[id].desc, cost: Ships[id].cost }));
    } else if (tab === 'weapons') {
      items = Object.keys(Weapons.CATALOG).map(id => ({ id, kind: 'weapon', name: Weapons.CATALOG[id].name, desc: Weapons.CATALOG[id].desc, cost: Weapons.CATALOG[id].cost }));
    } else {
      items = COSMETICS.map(c => ({ id: c.id, kind: 'cosmetic', name: c.name, desc: c.desc, cost: c.cost }));
    }
    grid.innerHTML = items.map(it => {
      const ownedList = it.kind === 'ship' ? save.ownedShips : it.kind === 'weapon' ? save.ownedWeapons : save.ownedCosmetics;
      const owned = it.cost === 0 || ownedList.includes(it.id);
      const equipped = (it.kind === 'ship' && save.selectedShip === it.id) || (it.kind === 'weapon' && save.selectedWeapon === it.id) || (it.kind === 'cosmetic' && save.selectedCosmetic === it.id);
      let btnLabel = owned ? (equipped ? 'EQUIPPED' : 'EQUIP') : `${Utils.formatNum(it.cost)} ⚙`;
      let btnClass = equipped ? 'equipped' : owned ? 'owned' : '';
      let levelRow = '';
      if (it.kind === 'weapon' && owned) {
        const lvl = save.weaponLevels[it.id] || 1;
        const maxed = lvl >= Weapons.MAX_LEVEL;
        const cost = Weapons.upgradeCost(lvl + 3);
        levelRow = `<div style="display:flex;justify-content:space-between;align-items:center;font-size:.72rem;color:var(--text-mid);">
          <span>WEAPON LV ${lvl}/${Weapons.MAX_LEVEL}</span>
          <button class="upgrade-btn" data-weapon-upgrade="${it.id}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : Utils.formatNum(cost) + ' ⚙'}</button>
        </div>`;
      }
      return `<div class="shop-item">
        <div class="shop-item-top">
          <div class="shop-item-name">${it.name}</div>
        </div>
        <div class="shop-item-desc">${it.desc}</div>
        ${levelRow}
        <button class="shop-item-btn ${btnClass}" data-id="${it.id}" data-kind="${it.kind}" ${equipped ? 'disabled' : ''}>${btnLabel}</button>
      </div>`;
    }).join('');
    grid.querySelectorAll('.shop-item-btn').forEach(btn => {
      btn.addEventListener('click', () => handleShopClick(btn.dataset.id, btn.dataset.kind, tab));
    });
    grid.querySelectorAll('[data-weapon-upgrade]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = btn.dataset.weaponUpgrade;
        const lvl = save.weaponLevels[id] || 1;
        if (lvl >= Weapons.MAX_LEVEL) return;
        const cost = Weapons.upgradeCost(lvl + 3);
        if (save.credits < cost) { Audio2.SFX.hurt(); return; }
        save.credits -= cost;
        save.weaponLevels[id] = lvl + 1;
        Storage.save(save);
        Audio2.SFX.powerup();
        refreshMenuStats();
        renderShop(tab);
      });
    });
  }
  function handleShopClick(id, kind, tab) {
    const ownedList = kind === 'ship' ? save.ownedShips : kind === 'weapon' ? save.ownedWeapons : save.ownedCosmetics;
    const catalogItem = kind === 'ship' ? Ships[id] : kind === 'weapon' ? Weapons.CATALOG[id] : COSMETICS.find(c => c.id === id);
    const owned = catalogItem.cost === 0 || ownedList.includes(id);
    if (!owned) {
      if (save.credits < catalogItem.cost) { Audio2.SFX.hurt(); return; }
      save.credits -= catalogItem.cost;
      ownedList.push(id);
      if (kind === 'weapon' && !save.weaponLevels[id]) save.weaponLevels[id] = 1;
      Audio2.SFX.powerup();
    } else {
      Audio2.SFX.uiClick();
    }
    if (kind === 'ship') save.selectedShip = id;
    if (kind === 'weapon') save.selectedWeapon = id;
    if (kind === 'cosmetic') save.selectedCosmetic = id;
    Storage.save(save);
    refreshMenuStats();
    renderShop(tab);
  }

  // ---------------- UPGRADES ----------------
  const UPGRADE_DEFS = [
    { key: 'damage', name: 'DAMAGE', desc: 'Increases weapon damage.' },
    { key: 'firerate', name: 'FIRE RATE', desc: 'Increases shots per second.' },
    { key: 'speed', name: 'MOVEMENT SPEED', desc: 'Increases ship speed.' },
    { key: 'shield', name: 'MAX SHIELD', desc: 'Increases maximum shield capacity.' },
    { key: 'crit', name: 'CRITICAL CHANCE', desc: 'Increases chance to land critical hits.' }
  ];
  function bindUpgrades() {}
  function renderUpgrades() {
    document.getElementById('upg-credits').textContent = Utils.formatNum(save.credits);
    const list = document.getElementById('upgrade-list');
    list.innerHTML = UPGRADE_DEFS.map(u => {
      const lvl = save.upgrades[u.key] || 0;
      const maxed = lvl >= 10;
      const cost = Weapons.upgradeCost(lvl);
      const dots = Array.from({ length: 10 }, (_, i) => `<div class="upgrade-dot ${i < lvl ? 'filled' : ''}"></div>`).join('');
      return `<div class="upgrade-row">
        <div class="upgrade-info">
          <div class="upgrade-name">${u.name}</div>
          <div class="upgrade-level">LV ${lvl}/10 — ${u.desc}</div>
          <div class="upgrade-dots">${dots}</div>
        </div>
        <button class="upgrade-btn" data-key="${u.key}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : Utils.formatNum(cost) + ' ⚙'}</button>
      </div>`;
    }).join('');
    list.querySelectorAll('.upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const lvl = save.upgrades[key] || 0;
        const cost = Weapons.upgradeCost(lvl);
        if (lvl >= 10 || save.credits < cost) { Audio2.SFX.hurt(); return; }
        save.credits -= cost;
        save.upgrades[key] = lvl + 1;
        Storage.save(save);
        Audio2.SFX.powerup();
        refreshMenuStats();
        renderUpgrades();
      });
    });
  }

  // ---------------- ACHIEVEMENTS ----------------
  function checkAchievements(save, onUnlock) {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (!save.achievements[a.id] && a.check(save)) {
        save.achievements[a.id] = true;
        changed = true;
        if (onUnlock) onUnlock(a);
      }
    }
    return changed;
  }
  function renderAchievements() {
    const list = document.getElementById('ach-list');
    list.innerHTML = ACHIEVEMENTS.map(a => {
      const unlocked = !!save.achievements[a.id];
      return `<div class="ach-item ${unlocked ? 'unlocked' : ''}">
        <div class="ach-icon">${a.icon}</div>
        <div>
          <div class="ach-name">${a.name}</div>
          <div class="ach-desc">${a.desc}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ---------------- SETTINGS ----------------
  function bindSettings() {
    const musicEl = document.getElementById('set-music');
    const sfxEl = document.getElementById('set-sfx');
    const qualityEl = document.getElementById('set-quality');
    const shakeEl = document.getElementById('set-shake');
    const particlesEl = document.getElementById('set-particles');
    const controlsEl = document.getElementById('set-controls');

    musicEl.value = save.settings.music;
    sfxEl.value = save.settings.sfx;
    qualityEl.value = save.settings.quality;
    shakeEl.checked = save.settings.shake;
    particlesEl.checked = save.settings.particles;
    controlsEl.value = save.settings.controls;

    Audio2.setMusicVolume(save.settings.music);
    Audio2.setSfxVolume(save.settings.sfx);
    Particles.setEnabled(save.settings.particles);

    musicEl.addEventListener('input', () => { save.settings.music = +musicEl.value; Audio2.setMusicVolume(save.settings.music); Storage.save(save); });
    sfxEl.addEventListener('input', () => { save.settings.sfx = +sfxEl.value; Audio2.setSfxVolume(save.settings.sfx); Storage.save(save); });
    qualityEl.addEventListener('change', () => { save.settings.quality = qualityEl.value; Storage.save(save); });
    shakeEl.addEventListener('change', () => { save.settings.shake = shakeEl.checked; Storage.save(save); });
    particlesEl.addEventListener('change', () => { save.settings.particles = particlesEl.checked; Particles.setEnabled(save.settings.particles); Storage.save(save); });
    controlsEl.addEventListener('change', () => { save.settings.controls = controlsEl.value; Storage.save(save); Main.updateControlMode(); });
  }

  // ---------------- HUD ----------------
  function updateHud(player, score, combo, waveLabel, bossActive, bossName, bossPct) {
    document.getElementById('hp-fill').style.width = Utils.clamp(player.hp / player.maxHp * 100, 0, 100) + '%';
    document.getElementById('shield-fill').style.width = Utils.clamp(player.shield / player.maxShield * 100, 0, 100) + '%';
    document.getElementById('energy-fill').style.width = Utils.clamp(player.energy / player.energyMax * 100, 0, 100) + '%';
    document.getElementById('hud-score').textContent = Utils.formatNum(score);
    document.getElementById('hud-combo').textContent = 'x' + combo;
    document.getElementById('wave-label').textContent = waveLabel;
    const bossWrap = document.getElementById('boss-bar-wrap');
    if (bossActive) {
      bossWrap.classList.remove('hidden');
      document.getElementById('boss-name').textContent = bossName;
      document.getElementById('boss-fill').style.width = Utils.clamp(bossPct * 100, 0, 100) + '%';
    } else {
      bossWrap.classList.add('hidden');
    }
  }

  function showBossWarning(cb) {
    const el = document.getElementById('boss-warning');
    el.classList.remove('hidden');
    Audio2.SFX.bossWarning();
    setTimeout(() => { el.classList.add('hidden'); if (cb) cb(); }, 2200);
  }

  function showLevelToast(text, ms = 1800) {
    const el = document.getElementById('level-toast');
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), ms);
  }

  function showGameOver(stats, won) {
    document.getElementById('gameover-title').textContent = won ? 'MISSION COMPLETE' : 'MISSION FAILED';
    const el = document.getElementById('go-stats');
    el.innerHTML = `
      <div>SCORE <b>${Utils.formatNum(stats.score)}</b></div>
      <div>ENEMIES DESTROYED <b>${stats.enemiesDestroyed}</b></div>
      <div>ACCURACY <b>${stats.accuracy}%</b></div>
      <div>TIME SURVIVED <b>${stats.timeStr}</b></div>
      <div>CREDITS EARNED <b>${stats.creditsEarned}</b></div>
      <div>XP EARNED <b>${stats.xpEarned}</b></div>
      <div>BEST SCORE <b>${Utils.formatNum(stats.best)}</b></div>
    `;
    document.getElementById('screen-gameover').classList.add('active');
  }
  function hideGameOver() { document.getElementById('screen-gameover').classList.remove('active'); }

  return {
    init, goTo, refreshMenuStats, renderHangar, renderShop, renderUpgrades, renderAchievements,
    checkAchievements, ACHIEVEMENTS, renderMissions, updateHud, showBossWarning, showLevelToast, showGameOver, hideGameOver,
    get shipOrder() { return shipOrder; }
  };
})();
