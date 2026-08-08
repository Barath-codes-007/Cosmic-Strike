/* ============================================================
   main.js — bootstrap, input handling, event wiring
   ============================================================ */

const Main = (() => {
  let save;
  let keys = {};
  let mouse = { x: 0, y: 0, down: false, active: false };
  let touchMove = { active: false, x: 0, y: 0, startX: 0, startY: 0 };
  let mobileFireHeld = false, mobileBoostQueued = false, mobileSpecialQueued = false;
  let boostQueued = false, specialQueued = false;
  let canvas, gameScreen;
  let isMobile = false;

  function detectMobile() {
    const forced = save.settings.controls;
    if (forced === 'on') return true;
    if (forced === 'off') return false;
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  function updateControlMode() {
    isMobile = detectMobile();
    document.getElementById('mobile-controls').classList.toggle('hidden', !isMobile);
  }

  function getInput() {
    let moveX = 0, moveY = 0, firing = false;
    if (isMobile) {
      if (touchMove.active) {
        const dx = touchMove.x - touchMove.startX, dy = touchMove.y - touchMove.startY;
        const mag = Math.hypot(dx, dy);
        const max = 50;
        moveX = Utils.clamp(dx / max, -1, 1);
        moveY = Utils.clamp(dy / max, -1, 1);
      }
      firing = mobileFireHeld;
    } else {
      if (keys['a'] || keys['arrowleft']) moveX -= 1;
      if (keys['d'] || keys['arrowright']) moveX += 1;
      if (keys['w'] || keys['arrowup']) moveY -= 1;
      if (keys['s'] || keys['arrowdown']) moveY += 1;
      firing = keys[' '] || mouse.down;
    }
    const boostPressed = boostQueued || mobileBoostQueued;
    const specialPressed = specialQueued || mobileSpecialQueued;
    boostQueued = false; specialQueued = false; mobileBoostQueued = false; mobileSpecialQueued = false;
    return { moveX, moveY, firing, boostPressed, specialPressed };
  }

  function bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      keys[k] = true;
      if (k === 'shift') boostQueued = true;
      if (k === 'e') specialQueued = true;
      if (k === 'p' || k === 'escape') togglePause();
      if (Game.getState() === 'playing' && [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  }

  function bindMouse() {
    canvas.addEventListener('mousedown', () => { mouse.down = true; Audio2.resume(); });
    window.addEventListener('mouseup', () => { mouse.down = false; });
    canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  }

  function bindTouchJoystick() {
    const zone = document.getElementById('joystick-zone');
    const nub = document.getElementById('joystick-nub');
    let touchId = null;

    function start(e) {
      const t = e.changedTouches[0];
      touchId = t.identifier;
      const rect = zone.getBoundingClientRect();
      touchMove.startX = rect.left + rect.width / 2;
      touchMove.startY = rect.top + rect.height / 2;
      touchMove.x = t.clientX; touchMove.y = t.clientY;
      touchMove.active = true;
      Audio2.resume();
      e.preventDefault();
    }
    function move(e) {
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) {
          touchMove.x = t.clientX; touchMove.y = t.clientY;
          const dx = Utils.clamp(t.clientX - touchMove.startX, -50, 50);
          const dy = Utils.clamp(t.clientY - touchMove.startY, -50, 50);
          nub.style.transform = `translate(${dx}px, ${dy}px)`;
          e.preventDefault();
        }
      }
    }
    function end(e) {
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) {
          touchMove.active = false;
          touchId = null;
          nub.style.transform = 'translate(0,0)';
        }
      }
    }
    zone.addEventListener('touchstart', start, { passive: false });
    zone.addEventListener('touchmove', move, { passive: false });
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
  }

  function bindMobileButtons() {
    const fire = document.getElementById('mob-fire');
    const boost = document.getElementById('mob-boost');
    const special = document.getElementById('mob-special');
    fire.addEventListener('touchstart', (e) => { mobileFireHeld = true; e.preventDefault(); }, { passive: false });
    fire.addEventListener('touchend', (e) => { mobileFireHeld = false; e.preventDefault(); });
    boost.addEventListener('touchstart', (e) => { mobileBoostQueued = true; e.preventDefault(); }, { passive: false });
    special.addEventListener('touchstart', (e) => { mobileSpecialQueued = true; e.preventDefault(); }, { passive: false });
    // allow mouse too (desktop testing / hybrid devices)
    fire.addEventListener('mousedown', () => mobileFireHeld = true);
    fire.addEventListener('mouseup', () => mobileFireHeld = false);
    boost.addEventListener('click', () => mobileBoostQueued = true);
    special.addEventListener('click', () => mobileSpecialQueued = true);
  }

  function togglePause() {
    if (Game.getState() === 'playing') Game.pause();
    else if (Game.getState() === 'paused') Game.resume();
  }

  function bindGameUI() {
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('resume-btn').addEventListener('click', () => { Audio2.SFX.uiClick(); Game.resume(); });
    document.getElementById('restart-btn').addEventListener('click', () => {
      Audio2.SFX.uiClick();
      document.getElementById('screen-pause').classList.remove('active');
      UI.goTo('screen-game');
      Game.startRun(Game.mode);
    });
    document.getElementById('quit-btn').addEventListener('click', () => {
      Audio2.SFX.uiClick();
      Game.quitToMenu();
      UI.goTo('screen-menu');
    });
    document.getElementById('retry-btn').addEventListener('click', () => {
      Audio2.SFX.uiClick();
      UI.goTo('screen-game');
      Game.startRun(Game.mode);
    });
    document.getElementById('go-menu-btn').addEventListener('click', () => {
      Audio2.SFX.uiClick();
      Game.quitToMenu();
      UI.goTo('screen-menu');
    });

    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        Audio2.resume();
        Audio2.SFX.uiClick();
        UI.goTo('screen-game');
        Game.startRun(card.dataset.mode);
      });
    });
  }

  function bindResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { Game.resize(); resizeMenuBg(); }, 80);
    });
    window.addEventListener('orientationchange', () => setTimeout(() => { Game.resize(); resizeMenuBg(); }, 200));
  }

  // decorative animated starfield behind the main menu, independent of the game canvas
  let menuBgCtx, menuStarfield, menuBgRaf;
  function resizeMenuBg() {
    const c = document.getElementById('menu-bg');
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = rect.width * dpr; c.height = rect.height * dpr;
    menuBgCtx = c.getContext('2d');
    menuBgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!menuStarfield) menuStarfield = new Levels.Starfield(rect.width, rect.height);
    else menuStarfield.resize(rect.width, rect.height);
  }
  function menuBgLoop() {
    menuBgRaf = requestAnimationFrame(menuBgLoop);
    if (!document.getElementById('screen-menu').classList.contains('active')) return;
    menuStarfield.update(1 / 60, '#070a16');
    menuStarfield.draw(menuBgCtx);
  }

  function bootSequence(cb) {
    const tips = [
      'Calibrating deflector arrays…', 'Charging plasma capacitors…', 'Syncing star charts…',
      'Loading enemy telemetry…', 'Priming weapon systems…', 'Establishing comms uplink…'
    ];
    const tipEl = document.getElementById('boot-tip');
    const fillEl = document.getElementById('boot-fill');
    let pct = 0;
    const timer = setInterval(() => {
      pct += Utils.rand(8, 22);
      tipEl.textContent = Utils.choice(tips);
      fillEl.style.width = Math.min(100, pct) + '%';
      if (pct >= 100) {
        clearInterval(timer);
        setTimeout(cb, 200);
      }
    }, 140);
  }

  function init() {
    save = Storage.load();
    Game.setSave(save);
    UI.init(save);

    canvas = document.getElementById('game-canvas');
    gameScreen = document.getElementById('screen-game');
    Game.init(canvas);

    updateControlMode();
    bindKeyboard();
    bindMouse();
    bindTouchJoystick();
    bindMobileButtons();
    bindGameUI();
    bindResize();

    resizeMenuBg();
    requestAnimationFrame(menuBgLoop);

    // unlock audio context on first user gesture (mobile autoplay policies)
    const unlock = () => { Audio2.resume(); window.removeEventListener('touchstart', unlock); window.removeEventListener('click', unlock); };
    window.addEventListener('touchstart', unlock);
    window.addEventListener('click', unlock);

    bootSequence(() => {
      document.getElementById('screen-boot').classList.remove('active');
      UI.goTo('screen-menu');
    });
  }

  return { init, getInput, updateControlMode };
})();

document.addEventListener('DOMContentLoaded', Main.init);
