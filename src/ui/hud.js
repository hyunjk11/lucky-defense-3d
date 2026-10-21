/**
 * src/ui/hud.js — 상단 상태바(몬스터 100마리 게이지, 웨이브/상성 예고, 보스 바), 도박/강화 패널, 선택 유닛 상세 카드, 실시간 딜미터기 및 도감 모달
 */
import { GAMBLES, RULES, upgradeCost, upgradeMultiplier } from '../data/config.js';
import { ALL_UNIT_LIST, TIERS, TYPE_KEYS, TYPES } from '../data/units.js';
import { getBountySpec, getWaveSpec, SIZES } from '../data/waves.js';
import { saveProgress } from '../core/progress.js';
import { G } from '../core/state.js';
import { $, fmtNum, fmtTime } from '../core/util.js';
import { Snd } from '../audio/audio.js';
import {
  awakenMythicUnit,
  combineAllAvailable,
  combineUnit,
  exchangeGoldToGas,
  registerUiHooks,
  rerollPrimordialType,
  runGamble,
  sellUnit,
  summonBountyBoss,
  summonRandomUnit,
  upgradeMine,
  upgradeType,
} from '../combat/combat.js';

let _toastTimer = null;
let _bannerTimer = null;

export function showToast(msg, kind = '') {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show' + (kind ? ` ${kind}` : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.className = 'toast';
  }, 3000);
}

export function showBanner(msg, kind = '') {
  const el = $('centerBanner');
  if (!el) return;
  el.textContent = msg;
  el.className = 'center-banner show' + (kind ? ` ${kind}` : '');
  clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(() => {
    el.className = 'center-banner';
  }, 2200);
}

export function countCombinablePairs() {
  const map = {};
  for (const u of G.units) {
    if (u.tier < 7) {
      const k = `${u.type}_${u.tier}`;
      map[k] = (map[k] || 0) + 1;
    }
  }
  let pairs = 0;
  for (const c of Object.values(map)) {
    pairs += Math.floor(c / 2);
  }
  return pairs;
}

export function refreshHud() {
  if (G.phase === 'menu') {
    $('menuBestWave').textContent = G.save.bestWave ? `${G.save.bestWave} 라운드` : '기록 없음';
    $('menuPrimCnt').textContent = `${G.save.totalPrimordials || 0}회`;
    const unlockedCnt = Object.keys(G.save.codex || {}).length;
    $('menuCodexCnt').textContent = `${unlockedCnt} / ${ALL_UNIT_LIST.length}`;
    return;
  }

  // 1) 재화 & 광산
  $('goldVal').textContent = fmtNum(G.gold);
  $('gasVal').textContent = fmtNum(G.gas);
  const gasRate = (G.mineLv * RULES.mineGasPerSec).toFixed(1);
  $('gasRateVal').textContent = G.mineLv > 0 ? `+${gasRate}/s` : '';

  // 2) 웨이브 & 몬스터 크기 상성 표시 + 다음 웨이브 예고
  const curSpec = getWaveSpec(G.wave);
  const nextSpec = getWaveSpec(G.wave + 1);
  const curSize = SIZES[curSpec.size];
  const nextSize = SIZES[nextSpec.size];

  $('waveNum').textContent = G.endless ? `W${G.wave} (무한)` : `WAVE ${G.wave} / ${RULES.maxWaves}`;
  const remSec = G.isBossWave ? G.bossTimer : Math.max(0, G.waveDur - G.waveT);
  $('waveTimer').textContent = fmtTime(remSec);

  const curBadge = $('curWaveBadge');
  curBadge.textContent = `${curSize.badge} (${curSize.weakTo})`;
  curBadge.style.borderColor = curSize.color;
  curBadge.style.color = curSize.color;

  $('nextWaveTxt').textContent = `다음 W${G.wave + 1}: ${nextSpec.isBoss ? '👑 보스' : nextSize.badge}`;

  // 3) 몬스터 마릿수 한계 게이지 (0 / 100)
  const eCnt = G.enemies.length;
  const pct = Math.min(100, (eCnt / RULES.maxEnemies) * 100);
  $('enemyCntTxt').textContent = `${eCnt} / ${RULES.maxEnemies}`;
  const fill = $('enemyBarFill');
  fill.style.width = `${pct}%`;
  const isDanger = eCnt >= RULES.warnEnemies;
  fill.className = 'limit-fill' + (isDanger ? ' danger' : eCnt >= 50 ? ' warn' : '');
  $('dangerVignette').classList.toggle('on', isDanger);

  // 4) 보스 체력바 (10라운드 보스 또는 현상금 보스)
  const boss = G.enemies.find((e) => e.isBoss) || G.enemies.find((e) => e.isBounty);
  const bossHud = $('bossHud');
  if (boss) {
    bossHud.classList.remove('hidden');
    const bTimer = boss.isBounty ? Math.ceil(boss.bountyTimer) : Math.ceil(G.bossTimer);
    $('bossName').textContent = `${boss.name} (${SIZES[boss.size].badge}) — ⏱️ ${bTimer}초`;
    $('bossHpTxt').textContent = `${fmtNum(Math.max(0, boss.hp))} / ${fmtNum(boss.maxHp)}`;
    $('bossBarFill').style.width = `${Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100))}%`;
  } else {
    bossHud.classList.add('hidden');
  }

  // 5) 좌측 액션 & 도박 버튼 상태 업데이트
  $('unitCntBadge').textContent = `${G.units.length}/36`;
  const pairs = countCombinablePairs();
  const combBtn = $('btnCombineAll');
  $('combineBadge').textContent = pairs > 0 ? `${pairs}쌍 가능!` : '없음';
  combBtn.classList.toggle('glow-ready', pairs > 0);

  const mineCost = RULES.mineBaseCost + G.mineLv * RULES.mineCostStep;
  $('mineCostTxt').textContent = `Lv.${G.mineLv} → ${mineCost}G`;

  const bBtn = $('btnBounty');
  if (G.bountyCd > 0) {
    $('bountySub').textContent = `쿨타임 ${Math.ceil(G.bountyCd)}초`;
    bBtn.disabled = true;
  } else {
    const bSpec = getBountySpec(G.wave, G.bountyCalls);
    $('bountySub').textContent = `+${bSpec.goldReward}G / +${bSpec.gasReward}⛽`;
    bBtn.disabled = false;
  }

  // 6) 계열별 공격력 업그레이드 버튼 3종
  for (const tk of TYPE_KEYS) {
    const lv = G.ups[tk] || 0;
    const cost = upgradeCost(lv);
    const mul = Math.round((upgradeMultiplier(lv) - 1) * 100);
    $(`upLv_${tk}`).textContent = `Lv.${lv} (+${mul}%)`;
    $(`upCost_${tk}`).textContent = cost.gas > 0 ? `${cost.gold}G + ${cost.gas}⛽` : `${cost.gold}G`;
  }

  // 7) 선택된 유닛 상세 카드
  const sel = G.units.find((u) => u.uid === G.selectedUid);
  const selCard = $('unitDetailCard');
  if (sel) {
    selCard.classList.remove('hidden');
    const tInfo = TIERS[sel.tier];
    const tyInfo = TYPES[sel.type];
    const upMul = upgradeMultiplier(G.ups[sel.type] || 0);
    const effDmg = Math.round(sel.def.dmg * upMul);
    const dps = Math.round(effDmg * sel.def.rate * (1 + (sel.def.crit || 0.1) * ((sel.def.critMul || 1.6) - 1)));

    const badge = $('selTierBadge');
    badge.textContent = `${tInfo.name} (${tInfo.en})`;
    badge.style.background = tInfo.color;
    badge.style.color = sel.tier === 1 || sel.tier === 4 || sel.tier === 7 ? '#090d16' : '#ffffff';

    $('selUnitName').textContent = `${tyInfo.icon} ${sel.def.name}`;
    $('selUnitTitle').textContent = `${sel.def.title} · ${tyInfo.role}`;
    $('selUnitStats').textContent = `공격력 ${fmtNum(effDmg)} · 공속 ${sel.def.rate}/s · 추정 DPS ${fmtNum(dps)} · 누적딜 ${fmtNum(sel.totalDmg)}`;
    $('selUnitSkill').textContent = `★ [${sel.def.procName}] ${sel.def.procDesc}`;

    const hasMate =
      sel.tier < 7 &&
      G.units.some((o) => o.uid !== sel.uid && o.type === sel.type && o.tier === sel.tier);
    const btnComb = $('btnSelCombine');
    btnComb.disabled = !hasMate;
    btnComb.textContent = hasMate
      ? `✨ 같은 유닛 합쳐 승급 (C)`
      : sel.tier >= 7
      ? `🌌 최종 태초 등급`
      : `짝 없음 (2기 필요)`;

    const btnSpecial = $('btnSelSpecial');
    if (sel.tier === 6) {
      btnSpecial.classList.remove('hidden');
      btnSpecial.textContent = `🌌 단독 태초 각성 (${RULES.awakenGasCost}⛽ · 50%) [T]`;
    } else if (sel.tier === 7) {
      btnSpecial.classList.remove('hidden');
      btnSpecial.textContent = `🔄 태초 계열 변환 (${RULES.rerollGasCost}⛽) [T]`;
    } else {
      btnSpecial.classList.add('hidden');
    }

    const btnSell = $('btnSelSell');
    if (sel.tier === 7) {
      btnSell.disabled = true;
      btnSell.textContent = '태초 판매불가';
    } else {
      btnSell.disabled = false;
      const gTxt = tInfo.sellGas ? `+${tInfo.sellGas}⛽` : '';
      btnSell.textContent = `판매 +${tInfo.sellGold}G${gTxt} (E)`;
    }
  } else {
    selCard.classList.add('hidden');
  }

  // 8) 우측 실시간 딜량(DPS) 미터기 Top 5
  const dpsList = $('dpsList');
  if (dpsList) {
    const sorted = G.units
      .slice()
      .sort((a, b) => b.totalDmg - a.totalDmg)
      .slice(0, 5);
    const maxDmg = Math.max(1, sorted[0]?.totalDmg || 1);
    dpsList.innerHTML = sorted.length
      ? sorted
          .map((u) => {
            const w = Math.max(4, Math.round((u.totalDmg / maxDmg) * 100));
            const tCol = TIERS[u.tier].color;
            return `<div class="dps-row" data-uid="${u.uid}">
              <div class="dps-top">
                <span class="dps-name"><i style="background:${tCol}"></i>${TYPES[u.type].icon} ${u.def.name}</span>
                <b class="dps-val">${fmtNum(u.totalDmg)}</b>
              </div>
              <div class="dps-bar"><div class="dps-fill" style="width:${w}%;background:${tCol}"></div></div>
            </div>`;
          })
          .join('')
      : '<div class="dps-empty">유닛을 소환(Q)해 전투를 시작하세요</div>';
  }
}

export function renderCodexModal() {
  const grid = $('codexGrid');
  if (!grid) return;
  const codex = G.save.codex || {};
  grid.innerHTML = ALL_UNIT_LIST.map((def) => {
    const count = codex[def.id] || 0;
    const tInfo = TIERS[def.tier];
    const tyInfo = TYPES[def.type];
    return `<div class="codex-card ${count > 0 ? 'unlocked' : 'locked'}" style="--tc:${tInfo.color}">
      <div class="cx-head">
        <span class="cx-tier" style="background:${tInfo.color}">${tInfo.name}</span>
        <span class="cx-type" style="color:${tyInfo.color}">${tyInfo.icon} ${tyInfo.short}</span>
      </div>
      <div class="cx-name">${def.name}</div>
      <div class="cx-title">${def.title}</div>
      <div class="cx-stat">기본공격 ${fmtNum(def.dmg)} · 공속 ${def.rate}/s · 사거리 ${def.range}</div>
      <div class="cx-skill"><b>${def.procName}:</b> ${def.procDesc}</div>
      <div class="cx-cnt">${count > 0 ? `획득 ${count}회` : '미획득'}</div>
    </div>`;
  }).join('');
}

export function initHudEvents(callbacks) {
  registerUiHooks({
    toast: showToast,
    banner: showBanner,
    refresh: refreshHud,
    onGameEnd: (mode, reason) => {
      const ov = $('endOverlay');
      ov.classList.remove('hidden');
      $('endTitle').textContent = mode === 'victory' ? '🏆 50라운드 클리어 승리!' : '💀 차원 방어 실패';
      $('endTitle').className = mode === 'victory' ? 'end-title win' : 'end-title lose';
      $('endReason').textContent = reason;
      $('endStats').innerHTML = `
        <div><span>도달 라운드</span><b>WAVE ${G.wave}</b></div>
        <div><span>처치한 몬스터</span><b>${fmtNum(G.kills)}마리</b></div>
        <div><span>이번 판 태초 강림</span><b>${G.primordialsThisRun}기</b></div>
        <div><span>내 최고 기록</span><b>WAVE ${G.save.bestWave || G.wave}</b></div>
      `;
      $('btnEndless').classList.toggle('hidden', mode !== 'victory');
      refreshHud();
    },
  });

  // 메인 메뉴 & 오버레이 버튼
  $('btnStartGame').addEventListener('click', () => {
    Snd.play('click');
    callbacks.onStartNewGame();
  });
  $('btnOpenCodexMenu').addEventListener('click', () => {
    Snd.play('click');
    renderCodexModal();
    $('codexModal').classList.remove('hidden');
  });
  $('btnOpenCodexHud').addEventListener('click', () => {
    Snd.play('click');
    renderCodexModal();
    $('codexModal').classList.remove('hidden');
  });
  $('btnCloseCodex').addEventListener('click', () => {
    Snd.play('click');
    $('codexModal').classList.add('hidden');
  });

  // 좌측 액션 & 도박 패널
  $('btnSummon').addEventListener('click', () => summonRandomUnit());
  $('btnCombineAll').addEventListener('click', () => combineAllAvailable(5));
  $('btnBounty').addEventListener('click', () => summonBountyBoss());
  $('btnMine').addEventListener('click', () => upgradeMine());
  $('btnExchange').addEventListener('click', () => exchangeGoldToGas());

  $('btnGambleMid').addEventListener('click', () => runGamble('mid'));
  $('btnGambleHigh').addEventListener('click', () => runGamble('high'));
  $('btnGambleMyth').addEventListener('click', () => runGamble('myth'));

  // 계열별 강화 버튼
  for (const tk of TYPE_KEYS) {
    $(`btnUp_${tk}`).addEventListener('click', () => upgradeType(tk));
  }

  // 선택된 유닛 조작 카드 버튼
  $('btnSelCombine').addEventListener('click', () => {
    const sel = G.units.find((u) => u.uid === G.selectedUid);
    if (sel) combineUnit(sel);
  });
  $('btnSelSpecial').addEventListener('click', () => {
    const sel = G.units.find((u) => u.uid === G.selectedUid);
    if (!sel) return;
    if (sel.tier === 6) awakenMythicUnit(sel);
    else if (sel.tier === 7) rerollPrimordialType(sel);
  });
  $('btnSelSell').addEventListener('click', () => {
    const sel = G.units.find((u) => u.uid === G.selectedUid);
    if (sel) sellUnit(sel);
  });

  // 배속 / 일시정지 / 사운드 / 카메라 버튼
  $('btnSpeed').addEventListener('click', () => {
    G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1;
    $('btnSpeed').textContent = `×${G.speed}`;
    Snd.play('click');
  });
  $('btnPause').addEventListener('click', () => callbacks.onTogglePause());
  $('btnResume').addEventListener('click', () => callbacks.onTogglePause());
  $('btnRestartPause').addEventListener('click', () => {
    $('pauseOverlay').classList.add('hidden');
    callbacks.onStartNewGame();
  });
  $('btnMenuPause').addEventListener('click', () => {
    $('pauseOverlay').classList.add('hidden');
    callbacks.onBackToMenu();
  });

  $('btnRestartEnd').addEventListener('click', () => {
    $('endOverlay').classList.add('hidden');
    callbacks.onStartNewGame();
  });
  $('btnEndless').addEventListener('click', () => {
    $('endOverlay').classList.add('hidden');
    G.endless = true;
    G.phase = 'play';
    callbacks.onContinueEndless();
  });

  // 사운드 설정 패널 토글
  $('btnSound').addEventListener('click', () => {
    $('sndModal').classList.toggle('hidden');
  });
  $('btnCloseSnd').addEventListener('click', () => {
    $('sndModal').classList.add('hidden');
  });
  $('chkMute').checked = !!G.save.settings.muted;
  $('chkBgMute').checked = G.save.settings.bgMute !== false;
  $('rngBgm').value = Math.round((G.save.settings.bgmVol ?? 0.55) * 100);
  $('rngSfx').value = Math.round((G.save.settings.sfxVol ?? 0.75) * 100);

  $('chkMute').addEventListener('change', (e) => Snd.setMuted(e.target.checked));
  $('chkBgMute').addEventListener('change', (e) => {
    G.save.settings.bgMute = e.target.checked;
    saveProgress(G.save);
  });
  $('rngBgm').addEventListener('input', (e) => {
    G.save.settings.bgmVol = Number(e.target.value) / 100;
    saveProgress(G.save);
    Snd.syncVolumes();
  });
  $('rngSfx').addEventListener('input', (e) => {
    G.save.settings.sfxVol = Number(e.target.value) / 100;
    saveProgress(G.save);
    Snd.syncVolumes();
  });

  // 딜미터기 클릭 시 해당 유닛 선택
  $('dpsList').addEventListener('click', (e) => {
    const row = e.target.closest('.dps-row');
    if (!row) return;
    const uid = Number(row.dataset.uid);
    if (uid) {
      G.selectedUid = uid;
      refreshHud();
    }
  });
}
