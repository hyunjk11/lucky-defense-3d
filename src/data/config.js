/**
 * src/data/config.js — 게임 핵심 밸런스 상수, 보드/트랙 규격, 뽑기 확률 및 도박 테이블
 */

export const BOARD = {
  cols: 6,
  rows: 6,
  tileSize: 1.95,
  boardY: 0.35,
  trackRadius: 7.8,
  trackWidth: 2.5,
};

// 사각 트랙 반시계 방향 웨이포인트 (상단 포털에서 시작해 반시계 순환)
const R = BOARD.trackRadius;
export const WAYPOINTS = [
  { x: -R, z: -R }, // 좌상단 (포털 시작점)
  { x: -R, z: R },  // 좌하단
  { x: R, z: R },   // 우하단
  { x: R, z: -R },  // 우상단
];

export const RULES = {
  maxEnemies: 100,
  warnEnemies: 75,
  maxWaves: 50,
  waveDuration: 22,      // 일반 웨이브 지속 시간(초)
  bossTimeLimit: 60,     // 10라운드 보스 제한 시간(초)
  bountyTimeLimit: 40,   // 현상금 미션 보스 제한 시간(초)
  bountyCooldown: 22,    // 현상금 보스 재호출 쿨타임(초)
  startGold: 125,
  startGas: 30,
  summonCost: 25,
  summonCostStep: 0,     // 메운디 스타일 고정 소환비 25G
  goldToGasCost: 100,    // 100 골드 -> 45 가스 환전
  goldToGasAmount: 45,
  mineBaseCost: 60,      // 가스 광산(일꾼) 업그레이드 시작 비용
  mineCostStep: 45,
  mineGasPerSec: 1.5,    // 광산 레벨당 초당 가스 생산량
  awakenGasCost: 140,    // 신화 1기 + 가스로 태초 각성 도박 비용
  awakenChance: 0.50,    // 단독 태초 각성 성공 확률 (50%, 실패 시 유닛 유지)
  rerollGasCost: 50,     // 태초 유닛 계열(성향) 변환 비용
};

// 기본 소환(25G) 등급 확률 (합계 1.0)
export const SUMMON_ODDS = [
  { tier: 1, prob: 0.58 },  // 일반 58%
  { tier: 2, prob: 0.27 },  // 희귀 27%
  { tier: 3, prob: 0.105 }, // 에픽 10.5%
  { tier: 4, prob: 0.036 }, // 유니크 3.6%
  { tier: 5, prob: 0.009 }, // 전설 0.9% (직뽑 대박!)
];

// 가스 도박(룰렛) 3종 정의
export const GAMBLES = {
  mid: {
    id: 'mid',
    name: '희귀·에픽 도박',
    cost: 30,
    chance: 0.65,
    desc: '성공(65%) 시 희귀(65%) 또는 에픽(35%) 즉시 소환',
    pool: [
      { tier: 2, weight: 65 },
      { tier: 3, weight: 35 },
    ],
  },
  high: {
    id: 'high',
    name: '유니크·전설 도박',
    cost: 75,
    chance: 0.40,
    desc: '성공(40%) 시 유니크(72%) 또는 전설(28%) 즉시 소환',
    pool: [
      { tier: 4, weight: 72 },
      { tier: 5, weight: 28 },
    ],
  },
  myth: {
    id: 'myth',
    name: '신화·태초 강림 도박',
    cost: 170,
    chance: 0.20,
    desc: '성공(20%) 시 신화(85%) 또는 태초(15%) 즉시 강림!',
    pool: [
      { tier: 6, weight: 85 },
      { tier: 7, weight: 15 },
    ],
  },
};

// 계열별 공격력 업그레이드 비용 및 배율
export function upgradeCost(level) {
  return {
    gold: Math.round(30 + level * 22 + Math.pow(level, 1.45) * 6),
    gas: level >= 5 ? Math.round((level - 4) * 12) : 0,
  };
}

// 업그레이드 1레벨당 공격력 +18% 복리/가산 하이브리드
export function upgradeMultiplier(level) {
  return 1 + level * 0.18 + Math.floor(level / 5) * 0.15;
}
