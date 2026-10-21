/**
 * src/core/util.js — 공통 유틸리티, 시드 난수, 숫자 포맷터, 안전 localStorage
 */

export const $ = (id) => document.getElementById(id);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _rng = Math.random;
export function setRngSeed(seed) {
  _rng = seed == null ? Math.random : mulberry32(seed);
}
export function rand() {
  return _rng();
}
export function rnd(a = 0, b = 1) {
  return a + _rng() * (b - a);
}
export function pick(arr) {
  return arr[Math.floor(_rng() * arr.length)];
}

export function fmtNum(n) {
  n = Math.round(n);
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '억';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '만';
  return n.toLocaleString('ko-KR');
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const store = {
  get(k, fallback = null) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch (_) {
      return fallback;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (_) {
      return false;
    }
  },
};
