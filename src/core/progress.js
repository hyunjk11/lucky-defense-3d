/**
 * src/core/progress.js — 영구 기록(최고 웨이브, 도감 21종 해금, 통산 통계, 설정) 저장/병합
 */
import { store } from './util.js';

export const SAVE_KEY = 'lucky_def_3d_save_v1';

export function defaultSave() {
  return {
    v: 1,
    bestWave: 0,
    clears: 0,
    totalGames: 0,
    totalSummons: 0,
    totalPrimordials: 0,
    codex: {}, // { striker_1: count, ... }
    settings: {
      muted: false,
      bgmVol: 0.55,
      sfxVol: 0.75,
      bgMute: true,
    },
  };
}

export function loadProgress() {
  const raw = store.get(SAVE_KEY, null);
  const def = defaultSave();
  if (!raw || typeof raw !== 'object') return def;
  return {
    ...def,
    ...raw,
    codex: { ...def.codex, ...(raw.codex || {}) },
    settings: { ...def.settings, ...(raw.settings || {}) },
  };
}

export function saveProgress(data) {
  store.set(SAVE_KEY, data);
}

export function recordUnitUnlock(save, unitId, tier) {
  if (!save.codex) save.codex = {};
  const isNew = !save.codex[unitId];
  save.codex[unitId] = (save.codex[unitId] || 0) + 1;
  if (tier === 7) save.totalPrimordials = (save.totalPrimordials || 0) + 1;
  saveProgress(save);
  return isNew;
}
