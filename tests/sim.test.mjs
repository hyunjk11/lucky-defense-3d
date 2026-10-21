/**
 * tests/sim.test.mjs — 21종 3D 유닛 모델링, 13종 3D 몬스터 모델링, 아레나 생성 및 전투/조합/도박/각성 통합 시뮬레이션 테스트
 */
import assert from 'node:assert/strict';
import { ALL_UNIT_LIST } from '../src/data/units.js';
import { MONSTER_ARCHETYPES, getWaveSpec } from '../src/data/waves.js';
import { G, tileToWorld, worldToTile } from '../src/core/state.js';
import { setRngSeed } from '../src/core/util.js';
import { buildArena, updateArenaVisuals } from '../src/render/arena3d.js';
import { buildUnitMesh } from '../src/render/units3d.js';
import { buildMonsterMesh } from '../src/render/monsters3d.js';
import { initVfx, updateVfx } from '../src/render/vfx.js';
import {
  awakenMythicUnit,
  combineAllAvailable,
  combineUnit,
  createUnitOnTile,
  exchangeGoldToGas,
  moveOrSwapUnit,
  rerollPrimordialType,
  resetSession,
  runGamble,
  sellUnit,
  setupWave,
  stepGame,
  summonBountyBoss,
  summonRandomUnit,
  upgradeMine,
  upgradeType,
} from '../src/combat/combat.js';

setRngSeed(2026);

// 1. 아레나 및 VFX 3D 씬 초기화 검증
buildArena();
initVfx();
updateArenaVisuals(0.05);

// 2. 타일 <-> 월드 좌표 왕복 변환 검증
for (let r = 0; r < 6; r++) {
  for (let c = 0; c < 6; c++) {
    const w = tileToWorld(c, r);
    const t = worldToTile(w.x, w.z);
    assert.deepEqual(t, { col: c, row: r });
  }
}

// 3. 21종 전체 유닛 3D 메쉬 생성 검증 (Shape + ExtrudeGeometry + 정점 컬러 + 마법진 + 날개 + 드론)
for (const def of ALL_UNIT_LIST) {
  const vm = buildUnitMesh(def);
  assert.ok(vm && vm.root && vm.inner && vm.weaponG, `Unit mesh failed for ${def.id}`);
  if (def.tier >= 5) assert.ok(vm.wings.length >= 2, `Tier ${def.tier} should have wings`);
  if (def.tier >= 6) assert.ok(vm.halo, `Tier ${def.tier} should have halo`);
}

// 4. 13종 전체 몬스터 3D 메쉬 생성 검증
for (const key of Object.keys(MONSTER_ARCHETYPES)) {
  const mm = buildMonsterMesh({ archKey: key, isBoss: key.startsWith('boss') });
  assert.ok(mm && mm.root && mm.hpGroup, `Monster mesh failed for ${key}`);
}

// 5. 실제 세션 플레이 시뮬레이션 (소환, 조합, 이동/스왑, 도박, 태초 각성, 전투)
resetSession();
G.phase = 'play';
setupWave(1);

// 기본 골드(125G)로 4기 소환
for (let i = 0; i < 4; i++) {
  const u = summonRandomUnit();
  assert.ok(u, `Summon #${i + 1} should succeed`);
}
assert.equal(G.units.length, 4);
assert.equal(G.gold, 25);

// 동일 등급+성향 유닛 2기 생성 후 조합(combineUnit) 검증
resetSession();
G.phase = 'play';
setupWave(1);
const u1 = createUnitOnTile('striker', 3, 0, 0, 'summon');
const u2 = createUnitOnTile('striker', 3, 1, 0, 'summon');
const uCombined = combineUnit(u1);
assert.ok(uCombined, 'Combine should succeed');
assert.equal(uCombined.tier, 4, 'Combined tier should be 4 (Unique)');
assert.equal(G.units.length, 1);

// 이동 및 스왑 검증
moveOrSwapUnit(uCombined, 3, 3);
assert.equal(uCombined.col, 3);
assert.equal(uCombined.row, 3);

// 신화(6등급) 단독 태초(7등급) 각성 & 태초 계열 변환 검증
G.gas = 5000;
G.gold = 5000;
const myth = createUnitOnTile('destroyer', 6, 2, 2, 'summon');
let awakened = false;
for (let tries = 0; tries < 20; tries++) {
  if (awakenMythicUnit(myth)) {
    awakened = true;
    break;
  }
}
assert.ok(awakened, 'Mythic should awaken to Primordial (tier 7) within 20 tries');
const prim = G.units.find((u) => u.tier === 7);
assert.ok(prim, 'Primordial unit exists on board');
const prevType = prim.type;
rerollPrimordialType(prim);
const rerolled = G.units.find((u) => u.tier === 7);
assert.notEqual(rerolled.type, prevType, 'Primordial type should rotate on reroll');

// 판매 불가 검증 (태초 등급은 실수 판매 방지)
assert.equal(sellUnit(rerolled), false, 'Primordial unit cannot be sold');

// 광산, 환전, 계열 강화, 도박, 현상금 보스 호출 및 전투 15초 시뮬레이션
assert.ok(upgradeMine());
assert.ok(exchangeGoldToGas());
assert.ok(upgradeType('striker'));
assert.ok(upgradeType('destroyer'));
assert.ok(upgradeType('arcane'));

for (let i = 0; i < 10; i++) {
  runGamble('mid');
}
combineAllAvailable(5);
const bounty = summonBountyBoss();
assert.ok(bounty && bounty.isBounty, 'Bounty boss should spawn');

// 3계열 7등급 태초 유닛을 모두 배치하고 10라운드 보스 웨이브 전투 시뮬레이션
createUnitOnTile('striker', 7, 1, 2, 'summon');
createUnitOnTile('destroyer', 7, 2, 2, 'summon');
createUnitOnTile('arcane', 7, 3, 2, 'summon');
setupWave(10);

for (let step = 0; step < 200; step++) {
  stepGame(0.05);
  updateArenaVisuals(0.05);
  updateVfx(0.05);
}

assert.ok(G.kills > 0, `Units should have killed monsters, kills=${G.kills}`);
const totalDealt = G.units.reduce((s, u) => s + u.totalDmg, 0);
assert.ok(totalDealt > 1000, `Units should deal significant damage, dealt=${totalDealt}`);

console.log(`3D MESH & COMBAT SIMULATION TESTS PASS (21 unit 3D models, 13 monster 3D models, kills=${G.kills}, dmg=${Math.round(totalDealt)})`);
