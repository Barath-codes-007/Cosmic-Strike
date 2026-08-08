/* ============================================================
   game.js — the Game class: loop, state, collisions, modes
   ============================================================ */

const Game = (() => {
  let canvas, ctx, dpr = 1;
  let bounds = { w: 0, h: 0 };
  let save;
  let starfield;

  let state = 'idle'; // idle | playing | paused | gameover
  let mode = 'story';
  let sector = 1, wave = 1;
  let waveSchedule = null, waveSpawnIdx = 0, waveTimer = 0, waveActive = false, waveClearDelay = 0;
  let bossActive = false, bossPending = false, minibossActive = false;
  let player = null;
  let score = 0, combo = 1, comboTimer = 0, runXp = 0, runCredits = 0;
  let shotsFired = 0, shotsHit = 0, enemiesDestroyedRun = 0, tookDamageThisWave = true, tookDamageThisBoss = false;
  let runTime = 0;
  let shakeAmount = 0;
  let lastTs = 0;
  let scorePopups = [];
  let survivalDifficultyTimer = 0;
  let challengeSeeded = false;
  let endlessDiff = 1;
  let rafId = null;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    Bullets.init();
    Particles.init();
    resize();
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    bounds.w = rect.width; bounds.h = rect.height;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!starfield) starfield = new Levels.Starfield(bounds.w, bounds.h);
    else starfield.resize(bounds.w, bounds.h);
  }

  function setSave(s) { save = s; }

  function startRun(selectedMode) {
    resize(); // screen-game must be visible (display:block) before measuring canvas bounds
    mode = selectedMode;
    sector = mode === 'story' ? 1 : 1;
    if (mode === 'story') sector = Utils.clamp(save.unlockedLevel, 1, Levels.SECTORS.length);
    wave = 1;
    score = 0; combo = 1; comboTimer = 0; runXp = 0; runCredits = 0;
    shotsFired = 0; shotsHit = 0; enemiesDestroyedRun = 0; runTime = 0;
    tookDamageThisWave = false; tookDamageThisBoss = false;
    bossActive = false; bossPending = false; minibossActive = false;
    waveActive = false; waveClearDelay = 0;
    endlessDiff = 1;
    survivalDifficultyTimer = 0;

    Enemies.reset(); Bullets.clear(); PowerUps.reset(); Bosses.reset(); Particles.clear();

    player = new Player(save.selectedShip, save.upgrades, save.selectedWeapon, currentWeaponLevel());
    player.x = bounds.w / 2; player.y = bounds.h - 120;

    state = 'playing';
    document.getElementById('screen-pause').classList.remove('active');
    UI.hideGameOver();
    document.getElementById('boss-bar-wrap').classList.add('hidden');

    startWave();
    Audio2.playMusic('combat');
    lastTs = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function currentWeaponLevel() {
    return save.weaponLevels && save.weaponLevels[save.selectedWeapon] || 1;
  }

  function startWave() {
    tookDamageThisWave = false;
    const sec = Levels.getSector(sector);
    if (mode === 'bossrush') {
      bossPending = true;
      waveActive = false;
      return;
    }
    const diffMult = 1 + (sector - 1) * 0.18 + (wave - 1) * 0.06 + (mode === 'endless' ? endlessDiff * 0.12 : 0);
    const gen = Levels.generateWave(sec, wave, diffMult);
    waveSchedule = gen.schedule;
    waveSpawnIdx = 0;
    waveTimer = 0;
    waveActive = true;
    UI.showLevelToast(mode === 'endless' ? `WAVE ${wave}` : `${sec.name} — WAVE ${wave}/${sec.waves}`);
  }

  function endWaveCheckNext() {
    const sec = Levels.getSector(sector);
    if (!tookDamageThisWave) {
      save.stats.perfectWaves = (save.stats.perfectWaves || 0) + 1;
    }
    if (mode === 'endless') {
      wave++; endlessDiff += 1;
      startWave();
      return;
    }
    if (mode === 'survival' || mode === 'challenge') {
      wave++;
      startWave();
      return;
    }
    // story / bossrush-adjacent: check if boss wave
    if (wave >= sec.waves) {
      bossPending = true;
      waveActive = false;
    } else {
      wave++;
      startWave();
    }
  }

  function launchBoss() {
    const sec = Levels.getSector(sector);
    const bossId = mode === 'bossrush' ? Utils.choice(Object.keys(Bosses.CATALOG)) : sec.boss;
    tookDamageThisBoss = false;
    UI.showBossWarning(() => {
      const diffMult = mode === 'bossrush' ? 1 + (bossRushIndex * 0.35) : 1 + (sector - 1) * 0.22;
      Bosses.spawn(bossId, bounds, diffMult);
      bossActive = true;
      Audio2.playMusic('boss');
    });
  }

  let bossRushIndex = 0;

  function onBossDefeated() {
    const b = Bosses.boss;
    Particles.explosion(b.x, b.y, 3.2, b.def.color);
    if (window.navigator.vibrate) window.navigator.vibrate(80);
    shakeAmount = Math.max(shakeAmount, 18);
    Audio2.SFX.explosionBig();
    addScore(2000 * (sector), b.x, b.y, true);
    runCredits += 400 + sector * 100;
    runXp += 300;
    save.stats.bossesDestroyed = (save.stats.bossesDestroyed || 0) + 1;
    if (!tookDamageThisBoss) save.stats.flawlessBoss = (save.stats.flawlessBoss || 0) + 1;
    bossActive = false;
    Bosses.reset();

    if (mode === 'bossrush') {
      bossRushIndex++;
      if (bossRushIndex >= Object.keys(Bosses.CATALOG).length * 2) { finishRun(true); return; }
      bossPending = true;
      return;
    }
    if (mode === 'story') {
      save.unlockedLevel = Math.max(save.unlockedLevel, sector + 1);
      Storage.save(save);
      if (sector >= Levels.SECTORS.length) { finishRun(true); return; }
      sector++; wave = 1;
      startWave();
    } else {
      finishRun(true);
    }
  }

  function addScore(base, x, y, isBoss) {
    const gained = Math.round(base * combo);
    score += gained;
    scorePopups.push({ x, y, text: '+' + gained, life: 0.8 });
    combo = Math.min(50, combo + (isBoss ? 5 : 1));
    comboTimer = 2.2;
    save.stats.bestCombo = Math.max(save.stats.bestCombo || 0, combo);
  }

  function finishRun(won) {
    state = 'gameover';
    Audio2.stopMusic();
    if (won) Audio2.SFX.victory(); else Audio2.SFX.gameOver();

    save.stats.enemiesDestroyed = (save.stats.enemiesDestroyed || 0) + enemiesDestroyedRun;
    save.stats.shotsFired = (save.stats.shotsFired || 0) + shotsFired;
    save.stats.shotsHit = (save.stats.shotsHit || 0) + shotsHit;
    save.stats.runsPlayed = (save.stats.runsPlayed || 0) + 1;
    save.stats.timeSurvived = Math.max(save.stats.timeSurvived || 0, runTime);
    save.stats.totalCreditsEarned = (save.stats.totalCreditsEarned || 0) + runCredits;
    const acc = shotsFired > 0 ? shotsHit / shotsFired : 0;
    if (shotsFired >= 50) save.stats.bestAccuracy = Math.max(save.stats.bestAccuracy || 0, acc);

    save.credits += runCredits;
    save.xp += runXp;
    let leveledUp = false;
    while (save.xp >= xpForLevel(save.playerLevel)) {
      save.xp -= xpForLevel(save.playerLevel);
      save.playerLevel++;
      leveledUp = true;
    }
    if (leveledUp) Audio2.SFX.levelUp();
    save.highScore = Math.max(save.highScore, score);

    UI.checkAchievements(save, (a) => { Audio2.SFX.achievement(); });
    Storage.save(save);

    UI.showGameOver({
      score, enemiesDestroyed: enemiesDestroyedRun,
      accuracy: Math.round(acc * 100),
      timeStr: formatTime(runTime),
      creditsEarned: runCredits, xpEarned: runXp,
      best: save.highScore
    }, won);
  }

  function xpForLevel(lvl) { return 200 + lvl * 120; }
  function formatTime(s) { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; }

  function pause() { if (state === 'playing') { state = 'paused'; document.getElementById('screen-pause').classList.add('active'); } }
  function resume() { if (state === 'paused') { state = 'playing'; document.getElementById('screen-pause').classList.remove('active'); lastTs = performance.now(); } }
  function quitToMenu() {
    state = 'idle';
    if (rafId) cancelAnimationFrame(rafId);
    document.getElementById('screen-pause').classList.remove('active');
    Audio2.stopMusic();
  }

  // ---------------- Main loop ----------------
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = Math.min(dt, 0.05); // clamp huge jumps (tab switch, etc)

    if (state !== 'playing') { render(dt); return; }

    update(dt);
    render(dt);
  }

  function update(dt) {
    runTime += dt;
    starfield.update(dt, Levels.getSector(sector).tint + '');

    // input from Main
    const input = Main.getInput();
    player.update(dt, input, bounds, mode === 'survival');

    if (input.firing) {
      const target = Bosses.boss || Enemies.list[0];
      if (player.tryFire(dt, target)) {
        shotsFired++;
        Audio2.SFX.shoot();
      }
    }
    if (input.boostPressed) player.tryBoost();
    if (input.specialPressed) player.triggerSpecial();

    handleSpecialEffects();

    // combo decay
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 1; }

    // wave spawning
    if (waveActive) {
      waveTimer += dt;
      while (waveSpawnIdx < waveSchedule.length && waveSchedule[waveSpawnIdx].t <= waveTimer) {
        const item = waveSchedule[waveSpawnIdx];
        const x = Utils.rand(40, bounds.w - 40);
        Enemies.spawn(item.type, x, -30, waveSchedule.diffMult || 1 + (sector - 1) * 0.15);
        waveSpawnIdx++;
      }
      if (waveSpawnIdx >= waveSchedule.length && Enemies.list.length === 0) {
        waveActive = false;
        waveClearDelay = 0.8;
      }
    } else if (!bossActive && !bossPending && waveClearDelay > 0) {
      waveClearDelay -= dt;
      if (waveClearDelay <= 0) endWaveCheckNext();
    }

    if (bossPending && !bossActive) {
      bossPending = false;
      launchBoss();
    }

    // enemy update + firing
    Enemies.update(dt, bounds, player, (e) => {
      const a = Utils.angleTo(e.x, e.y, player.x, player.y);
      Bullets.spawnEnemy({ x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, damage: e.dmg, color: '#ff4d4d', radius: 4 });
    });

    Bosses.update(dt, bounds, player, {
      fanShot: (b, count, dmg) => {
        for (let i = 0; i < count; i++) {
          const a = -Math.PI / 2 + (i - (count - 1) / 2) * 0.28;
          Bullets.spawnEnemy({ x: b.x, y: b.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, damage: dmg, color: b.def.color, radius: 6 });
        }
        Audio2.SFX.shootHeavy();
      },
      missileShot: (b, count, dmg) => {
        for (let i = 0; i < count; i++) {
          Bullets.spawnEnemy({ x: b.x + (i - (count - 1) / 2) * 30, y: b.y, vx: Utils.rand(-30, 30), vy: 160, damage: dmg, color: '#ffb020', kind: 'missile', homing: true, target: player, life: 4, radius: 6 });
        }
        Audio2.SFX.shootHeavy();
      },
      laserSweep: (b, dmg) => {
        for (let i = -2; i <= 2; i++) {
          Bullets.spawnEnemy({ x: b.x + i * 20, y: b.y, vx: i * 40, vy: 300, damage: dmg, color: b.def.color, kind: 'beam', w: 10, h: 26, radius: 7 });
        }
        Audio2.SFX.special();
      },
      spawnMinions: (b, count) => {
        for (let i = 0; i < count; i++) {
          Enemies.spawn('drone', b.x + Utils.rand(-80, 80), b.y + 40, 1 + (sector - 1) * 0.15);
        }
      }
    });

    Bullets.update(dt, bounds);

    PowerUps.update(dt, bounds, player, (type) => onPowerupCollected(type));

    Particles.update(dt);

    collisions();

    // score popups
    for (let i = scorePopups.length - 1; i >= 0; i--) {
      scorePopups[i].life -= dt;
      scorePopups[i].y -= 30 * dt;
      if (scorePopups[i].life <= 0) scorePopups.splice(i, 1);
    }

    if (shakeAmount > 0) shakeAmount = Math.max(0, shakeAmount - dt * 40);

    if (!player.alive) {
      finishRun(false);
    }

    // HUD
    UI.updateHud(player, score, Math.floor(combo), waveLabelText(), bossActive, Bosses.boss ? Bosses.boss.def.name : '', Bosses.boss ? Bosses.boss.hp / Bosses.boss.maxHp : 0);
  }

  function waveLabelText() {
    const sec = Levels.getSector(sector);
    if (mode === 'endless') return `WAVE ${wave} — DIFFICULTY x${endlessDiff.toFixed(1)}`;
    if (mode === 'bossrush') return bossActive ? 'BOSS ENCOUNTER' : 'INCOMING...';
    if (mode === 'survival') return `SURVIVAL — WAVE ${wave} — ${formatTime(runTime)}`;
    if (mode === 'challenge') return `CHALLENGE — WAVE ${wave}`;
    return `${sec.name} — WAVE ${wave}/${sec.waves}`;
  }

  function handleSpecialEffects() {
    if (player.novaPending) {
      player.novaPending = false;
      const radius = 220;
      Particles.explosion(player.x, player.y, 2, '#8a6bff');
      for (const e of Enemies.list) {
        if (Utils.dist(e.x, e.y, player.x, player.y) < radius) {
          Enemies.damage(e, 60 * player.damageMult);
          if (!e.alive) onEnemyKilled(e);
        }
      }
      if (Bosses.boss && Utils.dist(Bosses.boss.x, Bosses.boss.y, player.x, player.y) < radius) {
        Bosses.damage(50 * player.damageMult);
      }
      shakeAmount = Math.max(shakeAmount, 10);
    }
    if (player.barragePending) {
      player.barragePending -= 1;
      if (player.barragePending <= 0 || Math.random() < 0.5) {
        const target = Bosses.boss || Utils.choice(Enemies.list) || null;
        Bullets.spawnPlayer({ x: player.x, y: player.y, vx: Utils.rand(-100, 100), vy: -300, damage: 14 * player.damageMult, color: '#ff3d8a', kind: 'missile', homing: true, target, life: 3, radius: 5 });
      }
      if (player.barragePending <= 0) player.barragePending = 0;
    }
  }

  function onPowerupCollected(type) {
    Audio2.SFX.powerup();
    save.stats.powerupsCollected = (save.stats.powerupsCollected || 0) + 1;
    switch (type) {
      case 'health': player.heal(player.maxHp * 0.3); break;
      case 'shield': player.addShield(player.maxShield * 0.5); break;
      case 'energy': player.addEnergy(player.energyMax * 0.5); break;
      case 'damage': player.damageMult *= 1.15; setTimeout(() => player.damageMult /= 1.15, 8000); break;
      case 'speed': player.speed *= 1.3; setTimeout(() => player.speed /= 1.3, 8000); break;
      case 'multi': player.overdrive = Math.max(player.overdrive, 6); break;
      case 'slowmo': Enemies.list.forEach(e => e.speed *= 0.5); setTimeout(() => Enemies.list.forEach(e => e.speed *= 2), 4000); break;
      case 'score': combo = Math.min(50, combo + 3); comboTimer = 3; break;
      case 'regen': player.addEnergy(player.energyMax); break;
    }
  }

  function onEnemyKilled(e) {
    enemiesDestroyedRun++;
    Particles.explosion(e.x, e.y, e.radius > 16 ? 1.6 : 1, e.color);
    Audio2.SFX.explosion();
    addScore(e.score, e.x, e.y, false);
    runCredits += Math.round(e.score * 0.4);
    runXp += Math.round(e.score * 0.3);
    if (Math.random() < 0.18) PowerUps.spawn(e.x, e.y);
    shakeAmount = Math.max(shakeAmount, 4);
  }

  function collisions() {
    // player bullets vs enemies
    for (const b of Bullets.playerPool.active) {
      if (!b.__alive) continue;
      for (const e of Enemies.list) {
        if (!e.alive) continue;
        if (Utils.circleHit(b, e)) {
          Enemies.damage(e, b.damage);
          shotsHit++;
          Particles.spark(b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI, '#fff');
          if (!e.alive) onEnemyKilled(e);
          b.life = 0; // consume
          break;
        }
      }
      if (Bosses.boss && Bosses.boss.alive && Utils.circleHit(b, Bosses.boss)) {
        Bosses.damage(b.damage);
        shotsHit++;
        Particles.spark(b.x, b.y, 0, '#fff');
        b.life = 0;
        if (!Bosses.boss.alive) onBossDefeated();
      }
    }
    Bullets.playerPool.update(o => o.life > 0);

    // enemy bullets vs player
    if (player.alive) {
      for (const b of Bullets.enemyPool.active) {
        if (!b.__alive) continue;
        if (Utils.circleHit(b, player)) {
          player.takeDamage(b.damage);
          tookDamageThisWave = true; tookDamageThisBoss = true;
          shakeAmount = Math.max(shakeAmount, 6);
          b.life = 0;
        }
      }
      Bullets.enemyPool.update(o => o.life > 0);

      // enemy ships colliding with player (ramming)
      for (const e of Enemies.list) {
        if (!e.alive) continue;
        if (Utils.circleHit(e, player)) {
          player.takeDamage(e.dmg);
          tookDamageThisWave = true; tookDamageThisBoss = true;
          Enemies.damage(e, 9999);
          if (!e.alive) onEnemyKilled(e);
          shakeAmount = Math.max(shakeAmount, 8);
        }
      }
      if (Bosses.boss && Bosses.boss.alive && Utils.circleHit(Bosses.boss, player)) {
        player.takeDamage(Bosses.boss.def.dmg * 0.5);
        tookDamageThisWave = true; tookDamageThisBoss = true;
      }
    } else {
      Bullets.enemyPool.update(o => o.life > 0);
    }
  }

  // ---------------- Render ----------------
  function render(dt) {
    ctx.save();
    if (shakeAmount > 0) {
      ctx.translate(Utils.rand(-shakeAmount, shakeAmount), Utils.rand(-shakeAmount, shakeAmount));
    }
    starfield.draw(ctx);

    PowerUps.draw(ctx);
    Enemies.draw(ctx);
    Bosses.draw(ctx);
    Bullets.draw(ctx);
    Particles.draw(ctx);
    if (player && player.alive) player.draw(ctx);

    // score popups
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    for (const p of scorePopups) {
      ctx.globalAlpha = Utils.clamp(p.life / 0.8, 0, 1);
      ctx.fillStyle = '#ffe14c';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function currentPlayer() { return player; }
  function getState() { return state; }
  function getSave() { return save; }

  return {
    init, resize, setSave, startRun, pause, resume, quitToMenu, currentPlayer, getState, getSave,
    get mode() { return mode; }, get score() { return score; }
  };
})();
