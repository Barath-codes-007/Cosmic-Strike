# VOID RUNNER — Deep Signal Incursion

A complete, polished 2D arcade space shooter built with **plain HTML5, CSS3, vanilla JavaScript, and the Canvas API** — no game engines, no frameworks, no external assets. All audio is synthesized live with the Web Audio API, and all graphics (ships, enemies, bosses, starfields, explosions) are drawn procedurally on `<canvas>`.

Open `index.html` in any modern browser (desktop or mobile) and play — nothing to build or install.

---

## Controls

**Desktop**
| Action | Key |
|---|---|
| Move | `W A S D` or Arrow Keys |
| Shoot | `Space` or Left Mouse |
| Boost / Dash | `Shift` |
| Special Ability | `E` |
| Pause | `P` or `Esc` |

**Mobile**
- Left virtual joystick — move
- FIRE button — shoot (hold)
- BOOST button — dash + brief invulnerability
- E button — special ability
- Pause icon (top-right) — pause

Mobile controls auto-detect touch devices; you can force them on/off in **Settings → Mobile Controls**.

---

## Features

- **5 game modes** — Story, Endless, Boss Rush, Survival, Challenge
- **4 unlockable ships** — Scout, Fighter, Tank, Interceptor — each with distinct stats and a unique special ability (Overdrive, Nova Blast, Fortify, Barrage)
- **8 weapons** — Basic Laser, Double Laser, Triple Laser, Spread Shot, Plasma Cannon, Missile Launcher (homing), Laser Beam, Energy Weapon — each independently upgradeable to level 5
- **9 power-up types** — Health, Shield, Energy, Damage Boost, Speed Boost, Multi-shot, Slow-motion, Score x2, Energy Regen
- **10 enemy types** with distinct movement AI and attack patterns (fighter, fast, tank, shooter, sniper, kamikaze, shielded, turret, drone, elite)
- **3 multi-phase bosses** (Destroyer, Void Leviathan, Ancient Sentinel), each with 4 phases, warning klaxons, minion spawns, and unique attack patterns
- **6 story sectors** with increasing difficulty, a mini-boss wave, and a sector boss
- **Procedural parallax starfield** — 4 star layers, drifting nebula, shooting stars, and space debris, all rendered live on canvas
- **Full progression systems** — player XP/levels, in-run score/combo, credits, a shop (ships/weapons/cosmetics), 5 permanent stat upgrade trees, daily missions, and 10 achievements — all persisted with `localStorage` (with corruption-safe fallback to defaults)
- **Object pooling** for bullets and particles to keep frame rates smooth
- **Fully responsive** — canvas resizes to any viewport and uses `devicePixelRatio` for crisp rendering without tanking performance
- **Synthesized audio** — every sound effect and the adaptive music (menu/combat/boss) is generated at runtime with the Web Audio API; there are no audio files to load

> **Note on scope:** the original brief called for 10 levels and 5 bosses. To keep every system fully working rather than padded with placeholders, this build ships with 6 sectors and 3 bosses (each reused with scaling difficulty in Boss Rush/Endless). The level and boss data are simple, declarative objects in `js/levels.js` and `js/bosses.js` — adding more is a matter of adding more entries, described below.

---

## Project Structure

```
space-shooter/
│
├── index.html              All screens (menu, hangar, shop, HUD, etc.)
├── README.md
│
├── css/
│   ├── style.css           Base theme, typography, screen system
│   ├── menu.css            Menu + all subscreens (hangar/shop/upgrades/etc.)
│   └── game.css             In-game HUD + mobile controls
│
├── js/
│   ├── main.js              Bootstrap, input handling, event wiring
│   ├── game.js               Main loop, state machine, collisions, scoring
│   ├── player.js             Player class, ship catalogue, abilities
│   ├── enemies.js            Enemy catalogue, AI behaviors, spawner
│   ├── bullets.js            Pooled projectile management
│   ├── weapons.js            Weapon catalogue + upgrade scaling + firing
│   ├── powerups.js           Power-up pickups
│   ├── particles.js          Explosions, sparks, trails (pooled)
│   ├── levels.js             Sector/wave data + animated starfield
│   ├── audio.js              Web Audio API synthesized SFX + music
│   ├── ui.js                 Screen navigation, HUD, shop/hangar rendering
│   └── storage.js            localStorage save/load with corruption handling
│
└── assets/
    ├── images/               (unused — all art is drawn on canvas)
    └── audio/                (unused — all audio is synthesized)
```

---

## How to Run

Just open `index.html` in a browser. Because the game uses `localStorage`, if you open it via `file://` some browsers restrict storage — if saves don't persist, serve it over a local static server instead:

```bash
cd space-shooter
python3 -m http.server 8080
# then visit http://localhost:8080
```

---

## How to Customize

- **Add a weapon:** add an entry to `CATALOG` in `js/weapons.js` (damage, fire rate, pattern, cost) and a matching `case` in the `fire()` switch if it needs a new bullet pattern.
- **Add a ship:** add an entry to `Ships` in `js/player.js` with its stats and a `special` id, then implement that ability's effect in `Player.triggerSpecial()` and `Game.handleSpecialEffects()`.
- **Add an enemy:** add an entry to `TYPES` in `js/enemies.js` with hp/damage/speed/behavior, then (if it's a new movement pattern) add a `case` to the `switch (e.def.behavior)` block in `Enemies.update()`.
- **Add a boss:** add an entry to `CATALOG` in `js/bosses.js`, then reference its id from a sector in `js/levels.js`.
- **Add a sector/level:** append an object to `SECTORS` in `js/levels.js` with a `roster` (enemy types), `boss` id, tint color, and wave count.
- **Tune difficulty:** wave scaling lives in `startWave()` and `Levels.generateWave()` in `js/game.js` / `js/levels.js`.

---
# 🚀 Cosmic Strike

A professional 2D space shooter game built with HTML5, CSS3, and JavaScript.

## 🎮 Play the Game

[▶️ Live Demo](https://barath-codes-007.github.io/Cosmic-Strike/)

## Deployment

### GitHub Pages
1. Push this folder to a GitHub repository (the `space-shooter` folder should be the repo root, or set it as the Pages source folder).
2. In the repo, go to **Settings → Pages**.
3. Under **Source**, choose the branch (e.g. `main`) and root folder, then save.
4. Your game will be live at `https://<your-username>.github.io/<repo-name>/`.

### Netlify
1. Drag-and-drop the `space-shooter` folder onto [app.netlify.com/drop](https://app.netlify.com/drop), **or**:
2. Connect the repository in the Netlify dashboard → **New site from Git**.
3. Build command: *(none needed)* — leave blank.
4. Publish directory: `space-shooter` (or `/` if the repo root is already the game folder).
5. Deploy — Netlify will give you a live URL immediately.

No build step, environment variables, or backend are required for either host — this is a fully static site.

---

## Browser Support

Any modern evergreen browser (Chrome, Firefox, Safari, Edge) on desktop or mobile. Requires the Web Audio API and Canvas 2D, both supported everywhere Anthropic-generated code is likely to run. Audio starts after the first user tap/click, per browser autoplay policy.
