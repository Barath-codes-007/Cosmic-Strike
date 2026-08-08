/* ============================================================
   utils.js — shared helpers used across every module
   ============================================================ */

const Utils = (() => {

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
  function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }

  // circle-circle collision — the game's primary hit-test, cheap and good enough at this scale
  function circleHit(a, b) {
    const r = (a.radius || 0) + (b.radius || 0);
    return dist(a.x, a.y, b.x, b.y) < r;
  }

  // Simple object pool — avoids GC churn from constant bullet/particle allocation
  class Pool {
    constructor(factory, resetFn, size = 64) {
      this.factory = factory;
      this.resetFn = resetFn;
      this.items = [];
      this.active = [];
      for (let i = 0; i < size; i++) this.items.push(factory());
    }
    spawn(...args) {
      let obj = this.items.pop();
      if (!obj) obj = this.factory();
      this.resetFn(obj, ...args);
      obj.__alive = true;
      this.active.push(obj);
      return obj;
    }
    update(fn) {
      for (let i = this.active.length - 1; i >= 0; i--) {
        const o = this.active[i];
        const keep = fn(o);
        if (!keep) {
          o.__alive = false;
          this.active.splice(i, 1);
          this.items.push(o);
        }
      }
    }
    clear() {
      while (this.active.length) {
        const o = this.active.pop();
        o.__alive = false;
        this.items.push(o);
      }
    }
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function formatNum(n) {
    n = Math.floor(n);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return { rand, randInt, choice, clamp, lerp, dist, angleTo, circleHit, Pool, easeOutCubic, formatNum };
})();
