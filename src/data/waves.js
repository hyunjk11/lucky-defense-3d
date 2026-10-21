/**
 * src/data/waves.js — 몬스터 크기 상성, 3D 몬스터 아키타입, 50라운드 웨이브 및 현상금 미션 보스 정의
 */

export const SIZES = {
  small: {
    id: 'small',
    name: '소형',
    badge: '🐾 소형',
    color: '#38d9a9',
    weakTo: '⚡속사 150%',
    desc: '이동속도가 빠르고 무리로 몰려옴 (⚡속사·진동계에 취약)',
  },
  medium: {
    id: 'medium',
    name: '중형',
    badge: '🛡️ 중형',
    color: '#74c0fc',
    weakTo: '🔮마도 128%',
    desc: '균형 잡힌 체력과 속도 (🔮마도·관통계에 취약)',
  },
  large: {
    id: 'large',
    name: '대형',
    badge: '🐘 대형',
    color: '#ff8787',
    weakTo: '💥폭발 150%',
    desc: '높은 체력과 중장갑 방어력 보유 (💥중포·폭발계에 취약)',
  },
};

export const MONSTER_ARCHETYPES = {
  slime:   { kind: 'slime',   name: '네온 슬라임',   size: 'small',  spd: 3.3, scale: 0.85, color: 0x38d9a9, eye: 0xffffff },
  wolf:    { kind: 'wolf',    name: '그림자 늑대',   size: 'small',  spd: 3.7, scale: 0.92, color: 0x495057, eye: 0xffd43b },
  goblin:  { kind: 'goblin',  name: '차원 정찰병',   size: 'small',  spd: 3.5, scale: 0.90, color: 0x74b816, eye: 0xff6b6b },
  knight:  { kind: 'knight',  name: '흑철 기사',     size: 'medium', spd: 2.75, scale: 1.02, color: 0x4dabf7, eye: 0xffe066 },
  wraith:  { kind: 'wraith',  name: '공허 망령',     size: 'medium', spd: 2.95, scale: 1.05, color: 0x9775fa, eye: 0x66d9e8 },
  golem:   { kind: 'golem',   name: '암석 골렘',     size: 'large',  spd: 2.2, scale: 1.25, color: 0xf76707, eye: 0xffec99 },
  drake:   { kind: 'drake',   name: '화염 드레이크', size: 'large',  spd: 2.4, scale: 1.28, color: 0xe03131, eye: 0xffd43b },
  boss10:  { kind: 'boss',    name: '10R 보스 · 강철 군주 발록',     size: 'large', spd: 2.0, scale: 1.75, color: 0xff6b6b, eye: 0xffe066, crown: 0xffd43b },
  boss20:  { kind: 'boss',    name: '20R 보스 · 혹한의 지배자 펜리르', size: 'large', spd: 2.15, scale: 1.85, color: 0x3bc9db, eye: 0xffffff, crown: 0x74c0fc },
  boss30:  { kind: 'boss',    name: '30R 보스 · 용암 거신 이프리트',  size: 'large', spd: 2.2, scale: 1.95, color: 0xf76707, eye: 0xfff3bf, crown: 0xff922b },
  boss40:  { kind: 'boss',    name: '40R 보스 · 심연의 대군주 아자젤', size: 'large', spd: 2.3, scale: 2.05, color: 0xae3ec9, eye: 0x66d9e8, crown: 0xe599f7 },
  boss50:  { kind: 'boss',    name: '50R 최종보스 · 태초의 파괴신 크로노스', size: 'large', spd: 2.35, scale: 2.25, color: 0xff2957, eye: 0x00f5d4, crown: 0xffd43b },
  bounty:  { kind: 'bounty',  name: '현상금 보스 · 황금 약탈자',      size: 'large', spd: 2.35, scale: 1.62, color: 0xffd43b, eye: 0xff2957, crown: 0xffffff },
};

const CYCLE_ARCHETYPES = [
  'slime',  // W1: 소형
  'knight', // W2: 중형
  'golem',  // W3: 대형
  'wolf',   // W4: 소형
  'wraith', // W5: 중형
  'drake',  // W6: 대형
  'goblin', // W7: 소형
  'knight', // W8: 중형
  'golem',  // W9: 대형
];

/**
 * 라운드 번호(1~50+)에 해당하는 웨이브 스펙을 반환
 */
export function getWaveSpec(wave) {
  const isBoss = wave % 10 === 0;
  // 체력 성장 곡선: 초반은 부드럽고 중후반(조합/업그레이드 구간)부터 탄력 있게 상승
  const baseHp = Math.round(68 * Math.pow(1.195, wave - 1) * (1 + Math.max(0, wave - 20) * 0.04));
  const def = Math.min(0.60, Math.max(0, (wave - 2) * 0.011));

  if (isBoss) {
    const bossKey = wave === 10 ? 'boss10' : wave === 20 ? 'boss20' : wave === 30 ? 'boss30' : wave === 40 ? 'boss40' : 'boss50';
    const arch = MONSTER_ARCHETYPES[bossKey] || MONSTER_ARCHETYPES.boss50;
    const bossHp = Math.round(baseHp * (28 + Math.floor(wave / 10) * 6));
    return {
      wave,
      isBoss: true,
      archKey: bossKey,
      name: arch.name,
      size: arch.size,
      count: 1,
      escortCount: 10, // 보스와 함께 나오는 호위병
      escortKey: wave >= 30 ? 'wraith' : 'wolf',
      hp: bossHp,
      escortHp: Math.round(baseHp * 0.85),
      spd: arch.spd,
      def: Math.min(0.55, def + 0.08),
      goldReward: 120 + wave * 8,
      gasReward: 45 + wave * 3,
    };
  }

  const archKey = CYCLE_ARCHETYPES[(wave - 1) % CYCLE_ARCHETYPES.length];
  const arch = MONSTER_ARCHETYPES[archKey];
  // 소형은 마릿수가 많고 개체당 체력이 낮음, 대형은 마릿수가 적고 체력/방어가 높음
  const count = arch.size === 'small' ? 24 : arch.size === 'medium' ? 18 : 14;
  const hpMul = arch.size === 'small' ? 0.72 : arch.size === 'medium' ? 1.0 : 1.42;
  const defMod = arch.size === 'large' ? def + 0.08 : arch.size === 'medium' ? def : Math.max(0, def - 0.04);

  return {
    wave,
    isBoss: false,
    archKey,
    name: `${arch.name} (W${wave})`,
    size: arch.size,
    count,
    hp: Math.round(baseHp * hpMul),
    spd: arch.spd * (1 + Math.min(0.25, wave * 0.004)),
    def: Math.min(0.65, defMod),
    goldReward: Math.max(3, Math.round((4 + wave * 0.45) * (arch.size === 'large' ? 1.3 : arch.size === 'small' ? 0.8 : 1))),
    gasReward: arch.size === 'large' ? 2 : 1,
  };
}

/**
 * 현상금 미션 보스 스펙 반환 (플레이어가 B키/버튼으로 직접 호출)
 */
export function getBountySpec(wave, callCount) {
  const w = Math.max(1, wave);
  const baseHp = Math.round(70 * Math.pow(1.19, w - 1));
  const hp = Math.round(baseHp * (11 + callCount * 2.5));
  return {
    isBounty: true,
    archKey: 'bounty',
    name: `💰 현상금 약탈자 Lv.${callCount + 1}`,
    size: 'large',
    hp,
    spd: MONSTER_ARCHETYPES.bounty.spd,
    def: Math.min(0.45, 0.05 + callCount * 0.03),
    goldReward: Math.round(80 + w * 9 + callCount * 25),
    gasReward: Math.round(45 + w * 3 + callCount * 15),
  };
}
