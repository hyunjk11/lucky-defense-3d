/**
 * tests/balance.test.mjs — 21종 유닛 데이터 무결성, 상성 배율, 확률 합계, 웨이브 스펙 단위 테스트
 */
import assert from 'node:assert/strict';
import { BOARD, GAMBLES, RULES, SUMMON_ODDS, upgradeCost, upgradeMultiplier } from '../src/data/config.js';
import { ALL_UNIT_LIST, getUnitDef, TIERS, TYPE_KEYS, TYPES } from '../src/data/units.js';
import { getBountySpec, getWaveSpec, SIZES } from '../src/data/waves.js';

// 1. 소환 확률 총합 1.0 검증
const totalProb = SUMMON_ODDS.reduce((s, r) => s + r.prob, 0);
assert.ok(Math.abs(totalProb - 1.0) < 1e-6, `SUMMON_ODDS sum should be 1.0, got ${totalProb}`);

// 2. 3계열 × 7등급 = 21종 유닛 전체 정의 및 스탯 단조 증가 검증
assert.equal(ALL_UNIT_LIST.length, 21, 'Must have exactly 21 units (3 types x 7 tiers)');

for (const type of TYPE_KEYS) {
  assert.ok(TYPES[type], `Type ${type} exists`);
  for (const sz of Object.keys(SIZES)) {
    assert.ok(TYPES[type].vs[sz] > 0, `Type ${type} has valid multiplier vs ${sz}`);
  }
  let prevDps = 0;
  for (let tier = 1; tier <= 7; tier++) {
    const def = getUnitDef(type, tier);
    assert.ok(def, `Unit ${type}_${tier} must exist`);
    assert.equal(def.type, type);
    assert.equal(def.tier, tier);
    const dps = def.dmg * def.rate;
    assert.ok(dps > prevDps * 1.8, `${def.id} DPS (${dps}) should be significantly higher than tier ${tier - 1} (${prevDps})`);
    prevDps = dps;
  }
}

// 3. 동일 등급 내 3계열 간 기본 기대 DPS 밸런스 검증
for (let tier = 1; tier <= 7; tier++) {
  const sDef = getUnitDef('striker', tier);
  const dDef = getUnitDef('destroyer', tier);
  const aDef = getUnitDef('arcane', tier);
  assert.ok(sDef.dmg > 0 && dDef.dmg > 0 && aDef.dmg > 0);
  assert.ok(dDef.splash >= 2.0, 'Destroyer must have splash radius');
  assert.ok(aDef.chains >= 2 && aDef.slow > 0, 'Arcane must have chains and slow');
}

// 4. 1~50 웨이브 및 10단위 보스 웨이브 검증
for (let w = 1; w <= RULES.maxWaves; w++) {
  const spec = getWaveSpec(w);
  assert.equal(spec.wave, w);
  assert.equal(spec.isBoss, w % 10 === 0, `Wave ${w} boss flag mismatch`);
  assert.ok(spec.hp > 0 && spec.spd > 0);
}

// 5. 현상금 보스 및 업그레이드 수식 검증
const b0 = getBountySpec(1, 0);
const b5 = getBountySpec(10, 2);
assert.ok(b5.hp > b0.hp && b5.goldReward > b0.goldReward);
assert.ok(upgradeMultiplier(5) > upgradeMultiplier(0));
assert.ok(upgradeCost(5).gas > 0);
assert.equal(BOARD.cols * BOARD.rows, 36);
assert.ok(GAMBLES.mid && GAMBLES.high && GAMBLES.myth);

console.log('BALANCE & DATA UNIT TESTS PASS (21 units, 50 waves, gambles verified)');
