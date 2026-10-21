/**
 * src/main.js — 게임 진입점, 렌더 루프, 배속(×1/×2/×3) 고정 스텝 시뮬레이션 및 테스트/디버그 훅
 */
import { G } from './core/state.js';
import { $, setRngSeed } from './core/util.js';
import { Snd } from './audio/audio.js';
import { initRenderer, renderer, scene, camera, updateCamera, rotateCamera } from './render/scene.js';
import { buildArena, updateArenaVisuals } from './render/arena3d.js';
import { initVfx, updateVfx } from './render/vfx.js';
import {
  createUnitOnTile,
  resetSession,
  setupWave,
  stepGame,
  summonRandomUnit,
  combineAllAvailable,
  runGamble,
  summonBountyBoss,
} from './combat/combat.js';
import { initHudEvents, refreshHud, showToast } from './ui/hud.js';
import { initInput } from './ui/input.js';

const QS = new URLSearchParams(window.location.search);
if (QS.has('seed')) {
  setRngSeed(Number(QS.get('seed')) || 42);
}

initRenderer();
buildArena();
initVfx();

export function startNewGame() {
  Snd.init();
  resetSession();
  $('menuOverlay').classList.add('hidden');
  $('pauseOverlay').classList.add('hidden');
  $('endOverlay').classList.add('hidden');
  $('hud').classList.remove('hidden');

  G.phase = 'play';
  setupWave(1);
  refreshHud();
  showToast('🎲 타일에 유닛을 소환(Q)하고, 같은 유닛 2기를 합쳐(W) 상위 등급에 도전하세요!', 'good');
}

export function togglePause() {
  if (G.phase === 'play') {
    G.phase = 'paused';
    $('pauseOverlay').classList.remove('hidden');
  } else if (G.phase === 'paused') {
    G.phase = 'play';
    $('pauseOverlay').classList.add('hidden');
  }
  refreshHud();
}

export function backToMenu() {
  resetSession();
  G.phase = 'menu';
  $('hud').classList.add('hidden');
  $('pauseOverlay').classList.add('hidden');
  $('endOverlay').classList.add('hidden');
  $('menuOverlay').classList.remove('hidden');
  refreshHud();
}

initHudEvents({
  onStartNewGame: startNewGame,
  onTogglePause: togglePause,
  onBackToMenu: backToMenu,
  onContinueEndless: () => {
    setupWave(G.wave + 1);
    refreshHud();
  },
});

initInput({
  onTogglePause: togglePause,
});

// 결정론적 시뮬레이션 헬퍼 (hero-defense-3d의 G.sim 패턴 계승)
G.sim = (sec, h = 0.05) => {
  for (let t = 0; t < sec; t += h) {
    stepGame(h);
    updateArenaVisuals(h);
    updateVfx(h);
  }
  refreshHud();
};

// E2E 테스트 및 디버그용 전역 API 노출
window.G = G;
window.__game = {
  G,
  startNewGame,
  summonRandomUnit,
  combineAllAvailable,
  runGamble,
  summonBountyBoss,
  spawnUnit: (type, tier, col, row) => createUnitOnTile(type, tier, col, row, 'summon'),
  grant: (gold = 1000, gas = 500) => {
    G.gold += gold;
    G.gas += gas;
    refreshHud();
  },
  sim: G.sim,
};

let lastNow = performance.now();
let hudAcc = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const rawDt = Math.min(0.08, Math.max(0.001, (now - lastNow) / 1000));
  lastNow = now;

  if (G.phase === 'menu') {
    // 메뉴 배경에서 아레나를 천천히 회전
    G.t += rawDt;
    rotateCamera(rawDt * 0.14);
    updateArenaVisuals(rawDt);
    updateCamera(rawDt);
    renderer.render(scene, camera);
    return;
  }

  if (G.phase === 'play') {
    // ×2, ×3 배속 시 큰 dt 대신 고정 길이 서브스텝을 반복하여 타겟팅·물리 오차 방지
    const subSteps = G.speed || 1;
    for (let s = 0; s < subSteps; s++) {
      stepGame(rawDt);
      if (G.phase !== 'play') break;
    }
    updateArenaVisuals(rawDt);
    updateVfx(rawDt);
    hudAcc += rawDt;
    if (hudAcc >= 0.12) {
      hudAcc = 0;
      refreshHud();
    }
  }

  updateCamera(rawDt);
  renderer.render(scene, camera);
}

refreshHud();
if (QS.has('autostart') || QS.has('test')) {
  startNewGame();
}
requestAnimationFrame(loop);
