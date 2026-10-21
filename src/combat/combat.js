/**
 * src/combat/combat.js — 유닛 소환/조합/도박/각성/업그레이드 및 몬스터 이동·전투·상성 데미지 엔진
 */
import * as THREE from 'three';
import { BOARD, GAMBLES, RULES, SUMMON_ODDS, upgradeCost, upgradeMultiplier, WAYPOINTS } from '../data/config.js';
import { getUnitDef, TIERS, TYPE_KEYS, TYPES } from '../data/units.js';
import { getBountySpec, getWaveSpec } from '../data/waves.js';
import { recordUnitUnlock, saveProgress } from '../core/progress.js';
import { emptyTiles, G, nextUid, tileToWorld, unitAt } from '../core/state.js';
import { pick, rand } from '../core/util.js';
import { Snd } from '../audio/audio.js';
import { scene } from '../render/scene.js';
import { buildUnitMesh, updateUnitVisual } from '../render/units3d.js';
import { buildMonsterMesh, updateMonsterVisual } from '../render/monsters3d.js';
import {
  spawnBeamFx,
  spawnDebris,
  spawnDmgText,
  spawnLightningFx,
  spawnPillarFx,
  spawnRingFx,
} from '../render/vfx.js';

// UI 콜백 (hud.js에서 등록)
let _uiHooks = {
  toast: () => {},
  banner: () => {},
  refresh: () => {},
  onGameEnd: () => {},
};
export function registerUiHooks(hooks) {
  _uiHooks = { ..._uiHooks, ...hooks };
}

// ==================== 1. 유닛 생성 · 소환 · 조합 · 도박 · 각성 ====================
export function createUnitOnTile(type, tier, col, row, reason = 'summon') {
  const def = getUnitDef(type, tier);
  if (!def) return null;
  const { x, z } = tileToWorld(col, row);
  const visual = buildUnitMesh(def);
  visual.root.position.set(x, BOARD.boardY + 0.11, z);
  scene.add(visual.root);

  const unit = {
    uid: nextUid(),
    def,
    type,
    tier,
    col,
    row,
    x,
    z,
    targetX: x,
    targetZ: z,
    aimYaw: 0,
    cd: 0.1,
    shots: 0,
    totalDmg: 0,
    recoil: 0,
    spawnBounce: 1.0,
    visual,
  };
  G.units.push(unit);

  const isNew = recordUnitUnlock(G.save, def.id, tier);
  if (tier === 7) G.primordialsThisRun++;

  const tInfo = TIERS[tier];
  spawnPillarFx(x, z, tInfo.hex, tier >= 6 ? 1.5 : tier >= 4 ? 1.1 : 0.7, tier >= 6 ? 0.9 : 0.5);
  Snd.play(reason === 'combine' ? 'combine' : 'summon', tier);

  if (tier === 7) {
    G.shake = 0.35;
    _uiHooks.banner(`🌌 태초 강림! [${def.name}]`, 'primordial');
    _uiHooks.toast(`🌌 태초 등급 [${def.name}]이(가) 전장에 강림했습니다!`, 'primordial');
  } else if (tier === 6) {
    G.shake = 0.22;
    _uiHooks.banner(`🔥 신화 등장! [${def.name}]`, 'mythic');
  } else if (tier === 5) {
    _uiHooks.banner(`🟠 전설 소환! [${def.name}]`, 'legend');
  } else if (isNew && tier >= 3) {
    _uiHooks.toast(`📖 도감 신규 등록: [${tInfo.name}] ${def.name}`, 'good');
  }

  _uiHooks.refresh();
  return unit;
}

export function removeUnit(u) {
  const idx = G.units.indexOf(u);
  if (idx >= 0) G.units.splice(idx, 1);
  if (u.visual && u.visual.root) {
    scene.remove(u.visual.root);
  }
  if (G.selectedUid === u.uid) G.selectedUid = null;
}

export function summonRandomUnit() {
  if (G.phase !== 'play') return null;
  if (G.gold < RULES.summonCost) {
    _uiHooks.toast(`골드가 부족합니다! (소환 비용: ${RULES.summonCost}G)`, 'warn');
    return null;
  }
  const empties = emptyTiles();
  if (!empties.length) {
    _uiHooks.toast('빈 타일이 없습니다! 유닛을 조합(W)하거나 판매(E)하세요.', 'warn');
    return null;
  }

  G.gold -= RULES.summonCost;
  G.save.totalSummons = (G.save.totalSummons || 0) + 1;

  // 등급 추첨
  const r = rand();
  let acc = 0;
  let chosenTier = 1;
  for (const row of SUMMON_ODDS) {
    acc += row.prob;
    if (r <= acc) {
      chosenTier = row.tier;
      break;
    }
  }
  const chosenType = pick(TYPE_KEYS);
  const spot = pick(empties);
  const u = createUnitOnTile(chosenType, chosenTier, spot.col, spot.row, 'summon');
  G.selectedUid = u.uid;
  return u;
}

/**
 * 특정 유닛과 같은 (type, tier) 짝이 있으면 합쳐서 tier+1 랜덤 성향 유닛 생성
 */
export function combineUnit(u) {
  if (!u || u.tier >= 7) return null;
  const mate = G.units.find(
    (other) => other.uid !== u.uid && other.type === u.type && other.tier === u.tier
  );
  if (!mate) {
    _uiHooks.toast('같은 등급·같은 성향의 유닛이 2기 있어야 조합할 수 있습니다.', 'warn');
    return null;
  }
  const targetCol = u.col;
  const targetRow = u.row;
  const nextTier = u.tier + 1;
  const nextType = pick(TYPE_KEYS);

  spawnRingFx(mate.x, mate.z, 1.5, TIERS[u.tier].hex, 0.35);
  removeUnit(mate);
  removeUnit(u);

  const created = createUnitOnTile(nextType, nextTier, targetCol, targetRow, 'combine');
  G.selectedUid = created.uid;
  return created;
}

/**
 * 보드 위 조합 가능한 모든 쌍(신화 미포함 일반~전설 1~5등급, 또는 선택 시 6등급까지)을 일괄 조합
 */
export function combineAllAvailable(maxTier = 5) {
  if (G.phase !== 'play') return 0;
  let combinedCount = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let t = 1; t <= maxTier; t++) {
      for (const type of TYPE_KEYS) {
        const list = G.units.filter((u) => u.tier === t && u.type === type);
        if (list.length >= 2) {
          combineUnit(list[0]);
          combinedCount++;
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  if (combinedCount === 0) {
    _uiHooks.toast('현재 바로 조합할 수 있는 중복 유닛(일반~전설)이 없습니다.', 'warn');
  } else {
    _uiHooks.toast(`✨ ${combinedCount}회 일괄 조합 완료!`, 'good');
  }
  return combinedCount;
}

/**
 * 유닛 이동 또는 자리 스왑
 */
export function moveOrSwapUnit(u, targetCol, targetRow) {
  if (!u || (u.col === targetCol && u.row === targetRow)) return;
  const other = unitAt(targetCol, targetRow);
  const oldCol = u.col;
  const oldRow = u.row;

  // 만약 다른 칸에 있는 유닛이 같은 성향 & 같은 등급(1~6등급)이면 즉시 합치기!
  if (other && other.uid !== u.uid && other.type === u.type && other.tier === u.tier && u.tier < 7) {
    const nextTier = u.tier + 1;
    const nextType = pick(TYPE_KEYS);
    removeUnit(other);
    removeUnit(u);
    const created = createUnitOnTile(nextType, nextTier, targetCol, targetRow, 'combine');
    G.selectedUid = created.uid;
    return;
  }

  const posNew = tileToWorld(targetCol, targetRow);
  u.col = targetCol;
  u.row = targetRow;
  u.targetX = posNew.x;
  u.targetZ = posNew.z;
  u.spawnBounce = 0.45;

  if (other) {
    const posOld = tileToWorld(oldCol, oldRow);
    other.col = oldCol;
    other.row = oldRow;
    other.targetX = posOld.x;
    other.targetZ = posOld.z;
    other.spawnBounce = 0.45;
  }
  Snd.play('click');
  _uiHooks.refresh();
}

/**
 * 유닛 판매 (골드 & 가스 환급)
 */
export function sellUnit(u) {
  if (!u) return false;
  if (u.tier === 7) {
    _uiHooks.toast('🌌 태초 등급 유닛은 판매할 수 없습니다! (계열 변환 가능)', 'warn');
    return false;
  }
  const tInfo = TIERS[u.tier];
  G.gold += tInfo.sellGold;
  G.gas += tInfo.sellGas;
  spawnDebris(u.x, 0.5, u.z, 8, tInfo.hex, 4);
  removeUnit(u);
  Snd.play('coin');
  const gasTxt = tInfo.sellGas > 0 ? ` + ${tInfo.sellGas} 가스` : '';
  _uiHooks.toast(`💰 [${u.def.name}] 판매: +${tInfo.sellGold}G${gasTxt}`, '');
  _uiHooks.refresh();
  return true;
}

/**
 * 신화(6등급) 1기 + 가스로 단독 태초(7등급) 각성 도박 (실패 시 유닛 증발 없음!)
 */
export function awakenMythicUnit(u) {
  if (!u || u.tier !== 6) return false;
  if (G.gas < RULES.awakenGasCost) {
    _uiHooks.toast(`가스가 부족합니다! (태초 각성 비용: ${RULES.awakenGasCost} 가스)`, 'warn');
    return false;
  }
  G.gas -= RULES.awakenGasCost;
  if (rand() < RULES.awakenChance) {
    const col = u.col;
    const row = u.row;
    const type = u.type;
    removeUnit(u);
    const created = createUnitOnTile(type, 7, col, row, 'combine');
    G.selectedUid = created.uid;
    return true;
  } else {
    spawnRingFx(u.x, u.z, 1.8, 0xff2957, 0.45);
    Snd.play('gamble_fail');
    _uiHooks.toast('💥 태초 각성 실패... (신화 유닛은 무사히 보존되었습니다!)', 'warn');
    _uiHooks.refresh();
    return false;
  }
}

/**
 * 태초(7등급) 유닛의 공격 성향(계열)을 다른 계열로 변환 (내가 올인한 업그레이드 계열에 맞추기)
 */
export function rerollPrimordialType(u) {
  if (!u || u.tier !== 7) return false;
  if (G.gas < RULES.rerollGasCost) {
    _uiHooks.toast(`가스가 부족합니다! (계열 변환 비용: ${RULES.rerollGasCost} 가스)`, 'warn');
    return false;
  }
  G.gas -= RULES.rerollGasCost;
  const idx = TYPE_KEYS.indexOf(u.type);
  const nextType = TYPE_KEYS[(idx + 1) % TYPE_KEYS.length];
  const col = u.col;
  const row = u.row;
  const prevDmg = u.totalDmg;
  removeUnit(u);
  const created = createUnitOnTile(nextType, 7, col, row, 'combine');
  created.totalDmg = prevDmg;
  G.selectedUid = created.uid;
  _uiHooks.toast(`🔄 태초 계열 변환 완료: [${created.def.name}]`, 'good');
  return true;
}

/**
 * 가스 도박(룰렛) 3종 실행
 */
export function runGamble(gambleKey) {
  if (G.phase !== 'play') return null;
  const cfg = GAMBLES[gambleKey];
  if (!cfg) return null;
  if (G.gas < cfg.cost) {
    _uiHooks.toast(`가스가 부족합니다! (${cfg.name}: ${cfg.cost} 가스 필요)`, 'warn');
    return null;
  }
  const empties = emptyTiles();
  if (!empties.length) {
    _uiHooks.toast('빈 타일이 없습니다! 먼저 자리를 비워주세요.', 'warn');
    return null;
  }

  G.gas -= cfg.cost;
  if (rand() < cfg.chance) {
    // 가중치 추첨
    const totalW = cfg.pool.reduce((s, p) => s + p.weight, 0);
    let r = rand() * totalW;
    let tier = cfg.pool[0].tier;
    for (const p of cfg.pool) {
      r -= p.weight;
      if (r <= 0) {
        tier = p.tier;
        break;
      }
    }
    const spot = pick(empties);
    const type = pick(TYPE_KEYS);
    Snd.play('gamble_win');
    const u = createUnitOnTile(type, tier, spot.col, spot.row, 'summon');
    G.selectedUid = u.uid;
    _uiHooks.toast(`🎰 [${cfg.name}] 대성공! [${TIERS[tier].name}] ${u.def.name} 획득!`, 'good');
    return u;
  } else {
    Snd.play('gamble_fail');
    _uiHooks.toast(`💨 [${cfg.name}] 실패... 가스가 증발했습니다.`, 'warn');
    _uiHooks.refresh();
    return null;
  }
}

// ==================== 2. 경제 (광산, 환전) & 계열 업그레이드 ====================
export function upgradeType(typeKey) {
  if (G.phase !== 'play' || !TYPES[typeKey]) return false;
  const lv = G.ups[typeKey] || 0;
  const cost = upgradeCost(lv);
  if (G.gold < cost.gold || G.gas < cost.gas) {
    _uiHooks.toast(
      `재화가 부족합니다! (${TYPES[typeKey].name} 강화: ${cost.gold}G${cost.gas ? ` + ${cost.gas}가스` : ''})`,
      'warn'
    );
    return false;
  }
  G.gold -= cost.gold;
  G.gas -= cost.gas;
  G.ups[typeKey] = lv + 1;
  Snd.play('upgrade');
  _uiHooks.toast(
    `${TYPES[typeKey].icon} [${TYPES[typeKey].name}] 공격력 강화 Lv.${lv + 1} 달성!`,
    'good'
  );
  _uiHooks.refresh();
  return true;
}

export function upgradeMine() {
  if (G.phase !== 'play') return false;
  const cost = RULES.mineBaseCost + G.mineLv * RULES.mineCostStep;
  if (G.gold < cost) {
    _uiHooks.toast(`골드가 부족합니다! (가스 광산 증설: ${cost}G)`, 'warn');
    return false;
  }
  G.gold -= cost;
  G.mineLv++;
  Snd.play('upgrade');
  _uiHooks.toast(
    `⛏️ 가스 광산 Lv.${G.mineLv}! (초당 +${(G.mineLv * RULES.mineGasPerSec).toFixed(1)} 가스 자동 채굴)`,
    'good'
  );
  _uiHooks.refresh();
  return true;
}

export function exchangeGoldToGas() {
  if (G.phase !== 'play') return false;
  if (G.gold < RULES.goldToGasCost) {
    _uiHooks.toast(`골드가 부족합니다! (${RULES.goldToGasCost}G → ${RULES.goldToGasAmount} 가스)`, 'warn');
    return false;
  }
  G.gold -= RULES.goldToGasCost;
  G.gas += RULES.goldToGasAmount;
  Snd.play('coin');
  _uiHooks.toast(`⛽ ${RULES.goldToGasCost}G를 ${RULES.goldToGasAmount} 가스로 환전했습니다!`, 'good');
  _uiHooks.refresh();
  return true;
}

// ==================== 3. 웨이브 & 몬스터 스폰 & 현상금 보스 ====================
export function setupWave(waveNum) {
  const spec = getWaveSpec(waveNum);
  G.wave = waveNum;
  G.isBossWave = spec.isBoss;
  G.waveT = 0;
  G.waveDur = spec.isBoss ? RULES.bossTimeLimit : RULES.waveDuration;
  G.bossTimer = spec.isBoss ? RULES.bossTimeLimit : 0;
  G.spawnQ = [];

  if (spec.isBoss) {
    G.spawnQ.push({ ...spec, isBoss: true });
    for (let i = 0; i < (spec.escortCount || 8); i++) {
      G.spawnQ.push({
        archKey: spec.escortKey,
        name: '보스 호위병',
        size: 'small',
        hp: spec.escortHp,
        spd: 3.3,
        def: spec.def * 0.6,
        goldReward: 6,
        gasReward: 1,
        isBoss: false,
      });
    }
    Snd.play('boss_alert');
    _uiHooks.banner(`⚠️ WAVE ${waveNum} 보스 출현! [${spec.name}]`, 'boss');
  } else {
    for (let i = 0; i < spec.count; i++) {
      G.spawnQ.push({ ...spec });
    }
  }
  G.spawnT = 0.1;
  _uiHooks.refresh();
}

export function spawnEnemyFromSpec(spec) {
  const wp0 = WAYPOINTS[0];
  const visual = buildMonsterMesh(spec);
  visual.root.position.set(wp0.x, 0, wp0.z);
  scene.add(visual.root);

  const enemy = {
    eid: nextUid(),
    spec,
    name: spec.name,
    size: spec.size || 'medium',
    hp: spec.hp,
    maxHp: spec.hp,
    spd: spec.spd,
    curSpd: spec.spd,
    def: spec.def || 0,
    goldReward: spec.goldReward || 5,
    gasReward: spec.gasReward || 1,
    isBoss: !!spec.isBoss,
    isBounty: !!spec.isBounty,
    bountyTimer: spec.isBounty ? RULES.bountyTimeLimit : 0,
    wpIdx: 1, // WAYPOINTS[0]에서 출발해 WAYPOINTS[1]로 이동
    x: wp0.x,
    z: wp0.z,
    yaw: 0,
    slowT: 0,
    slowAmt: 0,
    shredAmt: 0,
    ampAmt: 0,
    visual,
  };
  G.enemies.push(enemy);
  return enemy;
}

export function summonBountyBoss() {
  if (G.phase !== 'play') return null;
  if (G.bountyCd > 0) {
    _uiHooks.toast(`현상금 보스 호출 쿨타임입니다! (${Math.ceil(G.bountyCd)}초 남음)`, 'warn');
    return null;
  }
  const spec = getBountySpec(G.wave, G.bountyCalls);
  G.bountyCalls++;
  G.bountyCd = RULES.bountyCooldown;
  const e = spawnEnemyFromSpec(spec);
  Snd.play('boss_alert');
  _uiHooks.toast(
    `🎯 [${spec.name}] 출현! ${RULES.bountyTimeLimit}초 내 처치 시 +${spec.goldReward}G / +${spec.gasReward} 가스!`,
    'good'
  );
  _uiHooks.refresh();
  return e;
}

// ==================== 4. 데미지 계산 (공격 성향 × 적 크기 상성 + 방어력 + 받피증) ====================
export function applyDamage(enemy, rawDmg, unit, isCrit = false, isProc = false) {
  if (!enemy || enemy.hp <= 0) return 0;
  const typeInfo = TYPES[unit.type];
  const sizeMul = typeInfo.vs[enemy.size] || 1.0;

  // 방어력 적용 (마도·관통계는 적 방어력의 70%를 무시하는 관통 특성 보유!)
  const effDef = Math.max(
    -0.35,
    (enemy.def - enemy.shredAmt) * (unit.type === 'arcane' ? 0.3 : 1.0)
  );
  const defMul = 1 - effDef;
  const ampMul = 1 + (enemy.ampAmt || 0);

  const finalDmg = Math.max(1, rawDmg * sizeMul * defMul * ampMul);
  enemy.hp -= finalDmg;
  unit.totalDmg += finalDmg;

  const col = isProc ? '#00f5d4' : isCrit ? '#ffd43b' : sizeMul > 1.2 ? typeInfo.color : '#ffffff';
  spawnDmgText(enemy.x, 1.3, enemy.z, finalDmg, col, isCrit || isProc);

  if (enemy.hp <= 0) {
    killEnemy(enemy);
  }
  return finalDmg;
}

export function killEnemy(enemy) {
  const idx = G.enemies.indexOf(enemy);
  if (idx < 0) return;
  G.enemies.splice(idx, 1);
  if (enemy.visual && enemy.visual.root) {
    scene.remove(enemy.visual.root);
  }

  G.kills++;
  G.gold += enemy.goldReward;
  G.gas += enemy.gasReward;
  spawnDebris(enemy.x, 0.5, enemy.z, enemy.isBoss || enemy.isBounty ? 18 : 6, enemy.isBoss ? 0xff2957 : 0xffd43b, 6);

  if (enemy.isBounty) {
    Snd.play('gamble_win');
    _uiHooks.toast(
      `💰 현상금 보스 처치 성공! +${enemy.goldReward}G / +${enemy.gasReward} 가스 획득!`,
      'good'
    );
  } else if (enemy.isBoss) {
    Snd.play('gamble_win');
    _uiHooks.banner(`🏆 WAVE ${G.wave} 보스 격파!`, 'good');
    _uiHooks.toast(
      `🎉 보스 처치 보상: +${enemy.goldReward}G / +${enemy.gasReward} 가스!`,
      'good'
    );
    // 50라운드 보스 처치 시 승리(무한 모드 진입 선택 가능)
    if (G.wave === RULES.maxWaves && !G.endless) {
      G.save.clears = (G.save.clears || 0) + 1;
      if (G.wave > (G.save.bestWave || 0)) G.save.bestWave = G.wave;
      saveProgress(G.save);
      G.phase = 'victory';
      _uiHooks.onGameEnd('victory', '50라운드 최종 보스 [태초의 파괴신 크로노스]를 격파했습니다!');
    }
  }
}

// ==================== 5. 유닛 공격 & 투사체/스킬 실행 ====================
function fireUnit(u, target) {
  const def = u.def;
  u.shots++;
  u.recoil = 1.0;
  if (u.visual) u.visual.focusT = 0.28;

  const isProc = def.procEvery && u.shots % def.procEvery === 0;
  const upMul = upgradeMultiplier(G.ups[u.type] || 0);
  let dmg = def.dmg * upMul;
  const isCrit = rand() < (def.crit || 0.1);
  if (isCrit) dmg *= def.critMul || 1.6;

  // 발사 월드 좌표
  const mx = u.x + Math.sin(u.aimYaw) * 0.55;
  const my = BOARD.boardY + 0.72;
  const mz = u.z + Math.cos(u.aimYaw) * 0.55;

  if (u.type === 'striker') {
    // ⚡ 속사·진동계: 초고속 레이저 트레이서 + 다중 타격 고유 스킬
    Snd.play(isProc ? 'proc' : 'shoot_striker');
    if (isProc) {
      const procTargets = G.enemies.slice(0, u.tier >= 7 ? 8 : u.tier >= 5 ? 4 : 2);
      const procMul = u.tier >= 7 ? 4.2 : 2.5;
      for (const pt of procTargets) {
        spawnBeamFx(mx, my, mz, pt.x, 0.75, pt.z, u.tier >= 7 ? 0x00f5d4 : 0x29e3ff, 0.14, 0.22);
        if (u.tier >= 6) spawnPillarFx(pt.x, pt.z, 0x29e3ff, 0.7, 0.35);
        applyDamage(pt, dmg * procMul, u, true, true);
      }
    } else {
      spawnBeamFx(mx, my, mz, target.x, 0.7, target.z, isCrit ? 0xffd43b : 0x29e3ff, 0.06 + u.tier * 0.01, 0.12);
      applyDamage(target, dmg, u, isCrit, false);
    }
  } else if (u.type === 'destroyer') {
    // 💥 중포·폭발계: 포물선 포탄 발사 -> 착탄 시 광역 스플래시 폭발 & 방깎
    Snd.play(isProc ? 'proc' : 'shoot_destroyer');
    const shellGeo = new THREE.SphereGeometry(0.14 + u.tier * 0.025, 10, 8);
    const shellCol = isProc ? 0x00f5d4 : u.tier >= 6 ? 0xff2957 : 0xff7d26;
    const shellMesh = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: shellCol }));
    shellMesh.position.set(mx, my, mz);
    scene.add(shellMesh);

    G.projs.push({
      mesh: shellMesh,
      x0: mx,
      y0: my,
      z0: mz,
      tx: target.x,
      tz: target.z,
      target,
      u,
      dmg: isProc ? dmg * 2.4 : dmg,
      splash: (def.splash || 2.2) * (isProc ? 1.35 : 1.0),
      shred: def.shred || 0.1,
      isCrit,
      isProc,
      t: 0,
      dur: 0.28,
      arcH: isProc ? 3.2 : 1.8,
      color: shellCol,
    });
  } else {
    // 🔮 마도·관통계: 다중 연쇄 번개(Chain Lightning) + 이동속도 둔화 + 받피증
    Snd.play(isProc ? 'proc' : 'shoot_arcane');
    const maxChains = (def.chains || 2) + (isProc ? 3 : 0);
    const visited = new Set([target.eid]);
    const chainList = [target];
    let curr = target;

    while (chainList.length < maxChains) {
      let best = null;
      let bestD = 5.5 * 5.5;
      for (const cand of G.enemies) {
        if (visited.has(cand.eid) || cand.hp <= 0) continue;
        const dx = cand.x - curr.x;
        const dz = cand.z - curr.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestD) {
          bestD = d2;
          best = cand;
        }
      }
      if (!best) break;
      visited.add(best.eid);
      chainList.push(best);
      curr = best;
    }

    const pts = [{ x: mx, y: my, z: mz }, ...chainList.map((e) => ({ x: e.x, y: 0.8, z: e.z }))];
    spawnLightningFx(pts, isProc ? 0x00f5d4 : u.tier >= 6 ? 0x72efdd : 0xc26eff, isProc ? 0.3 : 0.18);

    const procMul = isProc ? 2.15 : 1.0;
    chainList.forEach((e, idx) => {
      // 연쇄 감쇠 없이 100% 고정 관통 비율 유지 (후속 타겟은 88% 유지)
      const falloff = idx === 0 ? 1.0 : 0.88;
      e.slowAmt = Math.max(e.slowAmt, def.slow || 0.2);
      e.slowT = Math.max(e.slowT, def.slowDur || 2.5);
      e.ampAmt = Math.max(e.ampAmt, def.amp || 0.05);
      if (isProc && idx === 0) {
        spawnRingFx(e.x, e.z, 2.6, 0xc26eff, 0.38);
      }
      applyDamage(e, dmg * procMul * falloff, u, isCrit, isProc);
    });
  }
}

// ==================== 6. 메인 시뮬레이션 스텝 (stepGame) ====================
export function stepGame(dt) {
  if (G.phase !== 'play') return;
  G.t += dt;

  if (G.wave > (G.save.bestWave || 0)) {
    G.save.bestWave = G.wave;
  }

  // 1) 가스 광산 자동 채굴
  if (G.mineLv > 0) {
    G.mineAcc += dt * G.mineLv * RULES.mineGasPerSec;
    if (G.mineAcc >= 1) {
      const add = Math.floor(G.mineAcc);
      G.gas += add;
      G.mineAcc -= add;
    }
  }

  // 2) 현상금 보스 쿨타임
  if (G.bountyCd > 0) G.bountyCd = Math.max(0, G.bountyCd - dt);

  // 3) 웨이브 스폰 큐 처리
  if (G.spawnQ.length > 0) {
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      const nextSpec = G.spawnQ.shift();
      spawnEnemyFromSpec(nextSpec);
      G.spawnT = nextSpec.isBoss ? 0.5 : 0.52;
    }
  }

  // 4) 몬스터 이동 및 상태 이상 업데이트
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slowAmt = 0;
    }
    // 보스는 둔화 효율 절반 적용
    const effSlow = e.isBoss ? e.slowAmt * 0.5 : e.slowAmt;
    e.curSpd = e.spd * (1 - effSlow);

    // 현상금 보스 제한 시간 체크
    if (e.isBounty) {
      e.bountyTimer -= dt;
      if (e.bountyTimer <= 0) {
        if (e.visual && e.visual.root) scene.remove(e.visual.root);
        G.enemies.splice(i, 1);
        _uiHooks.toast('💨 현상금 보스가 제한 시간이 지나 도주했습니다!', 'warn');
        continue;
      }
    }

    // 웨이포인트 추적 이동
    const wp = WAYPOINTS[e.wpIdx];
    const dx = wp.x - e.x;
    const dz = wp.z - e.z;
    const dist = Math.hypot(dx, dz);
    const move = e.curSpd * dt;
    e.yaw = Math.atan2(dx, dz);

    if (dist <= move) {
      e.x = wp.x;
      e.z = wp.z;
      e.wpIdx = (e.wpIdx + 1) % WAYPOINTS.length;
    } else {
      e.x += (dx / dist) * move;
      e.z += (dz / dist) * move;
    }
    updateMonsterVisual(e, dt);
  }

  // 5) 패배 조건 검사 ①: 필드 몬스터 100마리 초과
  if (G.enemies.length >= RULES.maxEnemies) {
    G.phase = 'over';
    Snd.play('over');
    saveProgress(G.save);
    _uiHooks.onGameEnd(
      'over',
      `트랙의 몬스터가 허용 한계(${RULES.maxEnemies}마리)를 초과하여 차원이 붕괴되었습니다!`
    );
    return;
  }

  // 6) 웨이브 타이머 & 보스 타임어택 검사
  G.waveT += dt;
  if (G.isBossWave) {
    const bossAlive = G.enemies.some((e) => e.isBoss);
    const bossPending = G.spawnQ.some((s) => s.isBoss);
    G.bossTimer = Math.max(0, RULES.bossTimeLimit - G.waveT);
    if (!bossAlive && !bossPending) {
      // 보스 조기 처치 시 다음 라운드로 진행
      if (G.phase === 'play') setupWave(G.wave + 1);
      return;
    } else if (G.bossTimer <= 0 && bossAlive) {
      G.phase = 'over';
      Snd.play('over');
      saveProgress(G.save);
      _uiHooks.onGameEnd(
        'over',
        `제한 시간(${RULES.bossTimeLimit}초) 내에 보스를 처치하지 못했습니다!`
      );
      return;
    }
  } else {
    // 일반 라운드는 시간이 다 되거나 모든 몹을 다 잡으면 다음 라운드로
    const allCleared = G.spawnQ.length === 0 && G.enemies.length === 0;
    if (G.waveT >= G.waveDur || allCleared) {
      // 라운드 생존 보너스 지급
      const bonusG = 15 + Math.floor(G.wave * 1.5);
      const bonusGas = 5 + Math.floor(G.wave * 0.4);
      G.gold += bonusG;
      G.gas += bonusGas;
      setupWave(G.wave + 1);
    }
  }

  // 7) 유닛 타겟팅 및 사격 업데이트
  for (const u of G.units) {
    u.cd -= dt;
    if (u.cd <= 0 && G.enemies.length > 0) {
      const r2 = u.def.range * u.def.range;
      let bestTarget = null;
      let bestScore = -1e9;
      for (const e of G.enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - u.x;
        const dz = e.z - u.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        // 보스/현상금 보스 우선 + 내 공격 성향 상성 유리한 적 우선 타겟팅
        const sizePref = TYPES[u.type].vs[e.size] || 1;
        const score = (e.isBoss ? 500 : e.isBounty ? 350 : 0) + sizePref * 100 - Math.sqrt(d2);
        if (score > bestScore) {
          bestScore = score;
          bestTarget = e;
        }
      }
      if (bestTarget) {
        u.aimYaw = Math.atan2(bestTarget.x - u.x, bestTarget.z - u.z);
        fireUnit(u, bestTarget);
        u.cd = 1 / u.def.rate;
      } else {
        u.cd = 0.08;
      }
    }
    updateUnitVisual(u, dt);
  }

  // 8) 포물선 포탄(Destroyer) 비행 및 스플래시 폭발 처리
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i];
    p.t += dt;
    if (p.target && p.target.hp > 0) {
      p.tx = p.target.x;
      p.tz = p.target.z;
    }
    const k = Math.min(1, p.t / p.dur);
    const cx = p.x0 + (p.tx - p.x0) * k;
    const cz = p.z0 + (p.tz - p.z0) * k;
    const cy = p.y0 * (1 - k) + 0.4 * k + Math.sin(k * Math.PI) * p.arcH;
    p.mesh.position.set(cx, cy, cz);

    if (k >= 1) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      G.projs.splice(i, 1);

      spawnRingFx(p.tx, p.tz, p.splash, p.color, p.isProc ? 0.48 : 0.32);
      if (p.isProc && p.u.tier >= 6) {
        spawnPillarFx(p.tx, p.tz, p.color, 1.1, 0.45);
        G.shake = Math.max(G.shake, 0.14);
      }
      spawnDebris(p.tx, 0.25, p.tz, p.isProc ? 10 : 5, p.color, 5);

      const sp2 = p.splash * p.splash;
      // 스플래시 범위 내 모든 적 타격 (배열 복사 후 순회하여 처치 시 인덱스 밀림 방지)
      const snapshot = G.enemies.slice();
      for (const e of snapshot) {
        if (e.hp <= 0) continue;
        const dx = e.x - p.tx;
        const dz = e.z - p.tz;
        const d2 = dx * dx + dz * dz;
        if (d2 <= sp2) {
          e.shredAmt = Math.min(0.55, Math.max(e.shredAmt, p.shred));
          const falloff = d2 < 0.8 ? 1.0 : 0.82;
          applyDamage(e, p.dmg * falloff, p.u, p.isCrit, p.isProc);
        }
      }
    }
  }
}

/**
 * 게임 세션 초기화 및 새 게임 시작
 */
export function resetSession() {
  for (const u of G.units) {
    if (u.visual && u.visual.root) scene.remove(u.visual.root);
  }
  for (const e of G.enemies) {
    if (e.visual && e.visual.root) scene.remove(e.visual.root);
  }
  for (const p of G.projs) {
    if (p.mesh) scene.remove(p.mesh);
  }
  G.units = [];
  G.enemies = [];
  G.projs = [];
  G.spawnQ = [];
  G.selectedUid = null;
  G.hoverTile = null;

  G.t = 0;
  G.wave = 1;
  G.waveT = 0;
  G.endless = false;
  G.gold = RULES.startGold;
  G.gas = RULES.startGas;
  G.mineLv = 0;
  G.mineAcc = 0;
  G.bountyCd = 0;
  G.bountyCalls = 0;
  G.ups = { striker: 0, destroyer: 0, arcane: 0 };
  G.kills = 0;
  G.primordialsThisRun = 0;
  G.shake = 0;

  G.save.totalGames = (G.save.totalGames || 0) + 1;
  saveProgress(G.save);
}
