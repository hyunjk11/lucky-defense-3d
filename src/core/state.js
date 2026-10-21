/**
 * src/core/state.js — 전역 세션 상태(G) 및 6×6 타일 보드 좌표 변환 헬퍼
 */
import { BOARD, RULES } from '../data/config.js';
import { loadProgress } from './progress.js';

export const G = {
  phase: 'menu', // 'menu' | 'play' | 'paused' | 'over' | 'victory'
  t: 0,
  speed: 1, // 1, 2, 3 배속
  wave: 1,
  waveT: 0,
  waveDur: RULES.waveDuration,
  isBossWave: false,
  bossTimer: 0,
  endless: false,

  gold: RULES.startGold,
  gas: RULES.startGas,
  mineLv: 0,
  mineAcc: 0,

  bountyCd: 0,
  bountyCalls: 0,

  // 계열별 업그레이드 레벨
  ups: {
    striker: 0,
    destroyer: 0,
    arcane: 0,
  },

  // 보드 유닛 & 적 & 투사체 & 이펙트
  units: [],     // { uid, def, type, tier, col, row, x, z, cd, shots, totalDmg, mesh, ... }
  enemies: [],   // { eid, spec, hp, maxHp, spd, def, size, isBoss, isBounty, wpIdx, x, z, slowT, slowAmt, shredAmt, ampAmt, mesh, ... }
  spawnQ: [],    // 스폰 대기열
  spawnT: 0,
  projs: [],     // 투사체 배열
  fxs: [],       // 3D 시각 이펙트 배열

  selectedUid: null,
  hoverTile: null, // { col, row }

  kills: 0,
  primordialsThisRun: 0,
  shake: 0,

  save: loadProgress(),
};

let _uidSeq = 1;
export function nextUid() {
  return _uidSeq++;
}

/**
 * 6×6 보드 격자(col 0..5, row 0..5) -> 월드 X, Z 좌표
 */
export function tileToWorld(col, row) {
  const half = (BOARD.cols - 1) * 0.5;
  return {
    x: (col - half) * BOARD.tileSize,
    z: (row - half) * BOARD.tileSize,
  };
}

/**
 * 월드 X, Z 좌표 -> 6×6 보드 격자 { col, row } (범위 밖이면 null)
 */
export function worldToTile(x, z) {
  const half = (BOARD.cols - 1) * 0.5;
  const col = Math.round(x / BOARD.tileSize + half);
  const row = Math.round(z / BOARD.tileSize + half);
  if (col < 0 || col >= BOARD.cols || row < 0 || row >= BOARD.rows) return null;
  return { col, row };
}

export function unitAt(col, row) {
  return G.units.find((u) => u.col === col && u.row === row) || null;
}

export function emptyTiles() {
  const occupied = new Set(G.units.map((u) => `${u.col},${u.row}`));
  const list = [];
  for (let r = 0; r < BOARD.rows; r++) {
    for (let c = 0; c < BOARD.cols; c++) {
      if (!occupied.has(`${c},${r}`)) list.push({ col: c, row: r });
    }
  }
  return list;
}
