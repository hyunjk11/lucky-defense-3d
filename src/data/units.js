/**
 * src/data/units.js — 3대 공격 성향(속사·진동 / 중포·폭발 / 마도·관통) × 7단계 등급 = 21종 유닛 데이터
 */

export const TYPES = {
  striker: {
    id: 'striker',
    name: '속사·진동',
    short: '속사',
    icon: '⚡',
    color: '#29e3ff',
    hex: 0x29e3ff,
    subHex: 0xffd24a,
    role: '초고속 단일 연사 · 치명타 특화 (소형 150% 피해)',
    vs: { small: 1.5, medium: 1.0, large: 0.65 },
  },
  destroyer: {
    id: 'destroyer',
    name: '중포·폭발',
    short: '폭발',
    icon: '💥',
    color: '#ff5d38',
    hex: 0xff5d38,
    subHex: 0xffb830,
    role: '광역 포격 스플래시 · 방어 파쇄 (대형·보스 150% 피해)',
    vs: { small: 0.65, medium: 1.0, large: 1.5 },
  },
  arcane: {
    id: 'arcane',
    name: '마도·관통',
    short: '마도',
    icon: '🔮',
    color: '#c26eff',
    hex: 0xc26eff,
    subHex: 0x5c9dff,
    role: '연쇄 번개 관통 · 이동속도 둔화 & 받피증 (전 크기 만능)',
    vs: { small: 1.08, medium: 1.28, large: 1.08 },
  },
};

export const TYPE_KEYS = ['striker', 'destroyer', 'arcane'];

export const TIERS = {
  1: { tier: 1, name: '일반', en: 'NORMAL', color: '#cfd8e3', hex: 0xcfd8e3, sellGold: 12, sellGas: 0, scale: 0.86 },
  2: { tier: 2, name: '희귀', en: 'RARE', color: '#3ea6ff', hex: 0x3ea6ff, sellGold: 28, sellGas: 0, scale: 0.94 },
  3: { tier: 3, name: '에픽', en: 'EPIC', color: '#b862ff', hex: 0xb862ff, sellGold: 60, sellGas: 8, scale: 1.02 },
  4: { tier: 4, name: '유니크', en: 'UNIQUE', color: '#ffd23b', hex: 0xffd23b, sellGold: 130, sellGas: 22, scale: 1.1 },
  5: { tier: 5, name: '전설', en: 'LEGEND', color: '#ff7d26', hex: 0xff7d26, sellGold: 280, sellGas: 55, scale: 1.18 },
  6: { tier: 6, name: '신화', en: 'MYTHIC', color: '#ff2957', hex: 0xff2957, sellGold: 600, sellGas: 120, scale: 1.28 },
  7: { tier: 7, name: '태초', en: 'PRIMORDIAL', color: '#00f5d4', hex: 0x00f5d4, sellGold: 1400, sellGas: 300, scale: 1.42 },
};

/**
 * 21종 유닛 상세 정의
 * - dmg: 1발당 기본 공격력
 * - rate: 초당 공격 횟수
 * - range: 사거리 (월드 단위, 트랙 커버리지에 중요)
 * - crit: 치명타 확률, critMul: 치명타 배율
 * - splash: 폭발 반경 (destroyer 전용)
 * - shred: 방어력 감소율 (destroyer 전용)
 * - chains: 연쇄 타격 수 (arcane 전용)
 * - slow: 이동속도 둔화율 0..0.65 (arcane 전용)
 * - amp: 받는 피해 증가 디버프 (arcane 고등급)
 * - procEvery: N회 공격마다 발동하는 고유 스킬 주기
 */
export const UNIT_DEFS = {
  // ==================== ⚡ 속사·진동계 (Striker 1~7) ====================
  striker_1: {
    id: 'striker_1', type: 'striker', tier: 1,
    name: '네온 스카우트', title: '신입 쌍권총 사수',
    dmg: 22, rate: 2.4, range: 6.8, crit: 0.12, critMul: 1.6,
    procEvery: 8, procName: '속사 연발', procDesc: '8번째 사격마다 220% 위력의 관통탄 발사',
    pal: { skin: 0xffe2cc, hair: 0x2a3b4c, top: 0x1c7ed6, bottom: 0x1b263b, acc: 0x29e3ff, hat: 'visor' },
  },
  striker_2: {
    id: 'striker_2', type: 'striker', tier: 2,
    name: '펄스 레인저', title: '진동 기관단총 사수',
    dmg: 48, rate: 2.8, range: 7.4, crit: 0.16, critMul: 1.75,
    procEvery: 7, procName: '소닉 버스트', procDesc: '7번째 사격마다 2연발 초음속 진동탄 발사',
    pal: { skin: 0xffe2cc, hair: 0x00b4d8, top: 0x1864ab, bottom: 0x102a43, acc: 0x48cae4, hat: 'beret' },
  },
  striker_3: {
    id: 'striker_3', type: 'striker', tier: 3,
    name: '사이버 거너', title: '회전 개틀링 특무대',
    dmg: 105, rate: 3.4, range: 8.0, crit: 0.20, critMul: 1.9,
    procEvery: 7, procName: '오버드라이브 탄막', procDesc: '7번째 사격마다 주변 3기에게 동시에 고속 레이저 난사',
    pal: { skin: 0xffdfca, hair: 0xe0fbfc, top: 0x0b7285, bottom: 0x1d2d44, acc: 0x00f5d4, hat: 'headset' },
  },
  striker_4: {
    id: 'striker_4', type: 'striker', tier: 4,
    name: '발키리 건슬링어', title: '황금 이지스 저격수',
    dmg: 245, rate: 3.8, range: 8.8, crit: 0.25, critMul: 2.1,
    procEvery: 6, procName: '발키리 일섬', procDesc: '6번째 사격마다 340% 확정 치명타 레일건 관통 사격',
    pal: { skin: 0xffe4d0, hair: 0xffd166, top: 0xf4a261, bottom: 0x1d3557, acc: 0x29e3ff, hat: 'crown' },
  },
  striker_5: {
    id: 'striker_5', type: 'striker', tier: 5,
    name: '팬텀 데스슈터', title: '초음속 섬멸 처형자',
    dmg: 580, rate: 4.3, range: 9.6, crit: 0.32, critMul: 2.35,
    procEvery: 6, procName: '팬텀 오비탈 사격', procDesc: '6번째 사격마다 4기에게 380% 궤도 저격 + 소형 추가 피해',
    pal: { skin: 0xffe4d0, hair: 0xffffff, top: 0x111827, bottom: 0x0f172a, acc: 0x00f5d4, hat: 'halo_visor', wings: 'cyber' },
  },
  striker_6: {
    id: 'striker_6', type: 'striker', tier: 6,
    name: '네메시스 궤도처형자', title: '신화급 위성 레이저 지휘관',
    dmg: 1450, rate: 5.0, range: 10.6, crit: 0.40, critMul: 2.6,
    procEvery: 5, procName: '위성 레이저 폭격', procDesc: '5번째 사격마다 하늘에서 위성 레이저가 내리꽂혀 450% 광역 진동 피해',
    pal: { skin: 0xffe8d6, hair: 0x72efdd, top: 0x0a1128, bottom: 0x001f54, acc: 0x29e3ff, hat: 'myth_crown', wings: 'seraph4' },
  },
  striker_7: {
    id: 'striker_7', type: 'striker', tier: 7,
    name: '태초 · 제네시스 아스트랄 거너', title: '성좌를 꿰뚫는 태초의 총성',
    dmg: 3900, rate: 6.2, range: 12.5, crit: 0.50, critMul: 3.0,
    procEvery: 5, procName: '🌌 아스트랄 성광 심판', procDesc: '5번째 사격마다 트랙 전역의 적 최대 8기에게 520% 성광 궤도 폭격',
    pal: { skin: 0xfff0e6, hair: 0xa8ffef, top: 0x061a2e, bottom: 0x0b2545, acc: 0x00f5d4, hat: 'primordial', wings: 'seraph6' },
  },

  // ==================== 💥 중포·폭발계 (Destroyer 1~7) ====================
  destroyer_1: {
    id: 'destroyer_1', type: 'destroyer', tier: 1,
    name: '봄버 박격포병', title: '견습 유탄 포수',
    dmg: 45, rate: 0.95, range: 6.6, crit: 0.08, critMul: 1.5, splash: 2.1, shred: 0.08,
    procEvery: 5, procName: '고폭 유탄', procDesc: '5번째 포격마다 폭발 반경이 1.4배 넓은 강화 포탄 발사',
    pal: { skin: 0xffdcb8, hair: 0x5c3c20, top: 0xc92a2a, bottom: 0x2b2d42, acc: 0xff922b, hat: 'helmet' },
  },
  destroyer_2: {
    id: 'destroyer_2', type: 'destroyer', tier: 2,
    name: '아이언 캐논병', title: '중장갑 곡사포 사수',
    dmg: 102, rate: 1.05, range: 7.2, crit: 0.10, critMul: 1.6, splash: 2.35, shred: 0.14,
    procEvery: 5, procName: '파쇄 철갑탄', procDesc: '5번째 포격마다 적 방어력을 크게 깎는 200% 철갑 폭발탄 발사',
    pal: { skin: 0xffdcb8, hair: 0x370617, top: 0xd9480f, bottom: 0x212529, acc: 0xffb703, hat: 'helmet' },
  },
  destroyer_3: {
    id: 'destroyer_3', type: 'destroyer', tier: 3,
    name: '플라즈마 블래스터', title: '열핵 로켓 런처 사수',
    dmg: 235, rate: 1.18, range: 7.8, crit: 0.14, critMul: 1.75, splash: 2.65, shred: 0.20,
    procEvery: 4, procName: '네이팜 화염 폭풍', procDesc: '4번째 포격마다 250% 광역 폭발과 함께 주변 적 추가 화상 피해',
    pal: { skin: 0xffe0c2, hair: 0xffba08, top: 0x9d0208, bottom: 0x1b1f24, acc: 0xff5d38, hat: 'visor_heavy' },
  },
  destroyer_4: {
    id: 'destroyer_4', type: 'destroyer', tier: 4,
    name: '타이탄 공성포', title: '쌍열 헤비 하우처',
    dmg: 540, rate: 1.32, range: 8.5, crit: 0.18, critMul: 1.9, splash: 3.0, shred: 0.26,
    procEvery: 4, procName: '타이탄 대지진', procDesc: '4번째 포격마다 반경 4.0에 300% 대지진 충격파를 일으켜 대형 적 분쇄',
    pal: { skin: 0xffe0c2, hair: 0xf48c06, top: 0x6a040f, bottom: 0x14171a, acc: 0xffbe0b, hat: 'horns' },
  },
  destroyer_5: {
    id: 'destroyer_5', type: 'destroyer', tier: 5,
    name: '헬파이어 저거너트', title: '초중량 둠스데이 메카',
    dmg: 1280, rate: 1.48, range: 9.2, crit: 0.22, critMul: 2.1, splash: 3.4, shred: 0.34,
    procEvery: 4, procName: '메테오 클러스터', procDesc: '4번째 포격마다 3발의 확산 핵포탄이 연속 낙하하여 광역 초토화',
    pal: { skin: 0xffe4cc, hair: 0xffccd5, top: 0x370617, bottom: 0x0d0f12, acc: 0xff4d00, hat: 'crown', wings: 'mecha' },
  },
  destroyer_6: {
    id: 'destroyer_6', type: 'destroyer', tier: 6,
    name: '아포칼립스 핵융합포', title: '신화급 행성 파쇄 병기',
    dmg: 3200, rate: 1.68, range: 10.2, crit: 0.28, critMul: 2.35, splash: 3.9, shred: 0.45,
    procEvery: 4, procName: '아포칼립스 슈퍼노바', procDesc: '4번째 포격마다 거대 초신성 폭발을 일으켜 반경 4.8 적에게 420% 피해',
    pal: { skin: 0xffe8d6, hair: 0xffe5ec, top: 0x2b0918, bottom: 0x11050c, acc: 0xff2a55, hat: 'myth_crown', wings: 'seraph4' },
  },
  destroyer_7: {
    id: 'destroyer_7', type: 'destroyer', tier: 7,
    name: '태초 · 오메가 라그나로크 타이탄', title: '차원을 붕괴시키는 종말의 포신',
    dmg: 8800, rate: 2.0, range: 12.2, crit: 0.36, critMul: 2.75, splash: 4.6, shred: 0.60,
    procEvery: 3, procName: '🌌 라그나로크 차원 붕괴포', procDesc: '3번째 포격마다 초거대 중력자 핵폭발로 광역 500% 피해 + 보스 추가 강타',
    pal: { skin: 0xfff0e6, hair: 0xfff3b0, top: 0x3d0814, bottom: 0x1a0409, acc: 0xff9e00, hat: 'primordial', wings: 'seraph6' },
  },

  // ==================== 🔮 마도·관통계 (Arcane 1~7) ====================
  arcane_1: {
    id: 'arcane_1', type: 'arcane', tier: 1,
    name: '룬 어프렌티스', title: '수습 비전 마도사',
    dmg: 26, rate: 1.35, range: 7.0, crit: 0.10, critMul: 1.5, chains: 2, slow: 0.18, slowDur: 2.2, amp: 0.05,
    procEvery: 6, procName: '서리 고리', procDesc: '6번째 마법마다 적들의 발을 묶는 냉기 파동 발사',
    pal: { skin: 0xfff0f5, hair: 0x9d4edd, top: 0x5a189a, bottom: 0x240046, acc: 0xc77dff, hat: 'wizard' },
  },
  arcane_2: {
    id: 'arcane_2', type: 'arcane', tier: 2,
    name: '프로스트 위버', title: '빙결 연쇄 술사',
    dmg: 58, rate: 1.5, range: 7.5, crit: 0.12, critMul: 1.6, chains: 3, slow: 0.25, slowDur: 2.6, amp: 0.08,
    procEvery: 6, procName: '블리자드 체인', procDesc: '6번째 마법마다 4기에게 전이되는 빙결 번개로 강한 둔화 부여',
    pal: { skin: 0xfff0f5, hair: 0x72efdd, top: 0x3c096c, bottom: 0x10002b, acc: 0x80ffdb, hat: 'wizard' },
  },
  arcane_3: {
    id: 'arcane_3', type: 'arcane', tier: 3,
    name: '스톰 아케이니스', title: '뇌전 폭풍 마도사',
    dmg: 132, rate: 1.68, range: 8.2, crit: 0.16, critMul: 1.75, chains: 4, slow: 0.32, slowDur: 3.0, amp: 0.12,
    procEvery: 5, procName: '썬더 볼텍스', procDesc: '5번째 마법마다 5연쇄 뇌전 폭풍을 일으켜 240% 관통 피해',
    pal: { skin: 0xfff0f5, hair: 0xe0aaff, top: 0x3a0ca3, bottom: 0x1b065e, acc: 0xb86eff, hat: 'circlet' },
  },
  arcane_4: {
    id: 'arcane_4', type: 'arcane', tier: 4,
    name: '아크 엘리멘탈리스트', title: '대원소 지배자',
    dmg: 310, rate: 1.85, range: 8.9, crit: 0.20, critMul: 1.9, chains: 5, slow: 0.40, slowDur: 3.4, amp: 0.18,
    procEvery: 5, procName: '엘리멘탈 노바', procDesc: '5번째 마법마다 6기 연쇄 + 받는 피해 18% 증폭 및 40% 감속',
    pal: { skin: 0xfff5f8, hair: 0xffb3c6, top: 0x480ca8, bottom: 0x10002b, acc: 0x4cc9f0, hat: 'crown' },
  },
  arcane_5: {
    id: 'arcane_5', type: 'arcane', tier: 5,
    name: '보이드 대현자', title: '심연의 중력 마도왕',
    dmg: 730, rate: 2.05, range: 9.7, crit: 0.25, critMul: 2.1, chains: 6, slow: 0.48, slowDur: 3.8, amp: 0.25,
    procEvery: 4, procName: '보이드 블랙홀', procDesc: '4번째 마법마다 중력장을 펼쳐 7기에게 320% 관통 피해 + 극둔화',
    pal: { skin: 0xfff5f8, hair: 0xffffff, top: 0x240046, bottom: 0x0a0118, acc: 0xf72585, hat: 'horns', wings: 'arcane' },
  },
  arcane_6: {
    id: 'arcane_6', type: 'arcane', tier: 6,
    name: '크로노스 시공지배자', title: '신화급 시간 왜곡 아르콘',
    dmg: 1820, rate: 2.30, range: 10.8, crit: 0.32, critMul: 2.4, chains: 8, slow: 0.56, slowDur: 4.2, amp: 0.35,
    procEvery: 4, procName: '크로노 타임스톱', procDesc: '4번째 마법마다 시공 폭풍으로 9기에게 400% 관통 피해 및 거의 정지급 감속',
    pal: { skin: 0xfff8fa, hair: 0xc8b6ff, top: 0x190028, bottom: 0x090014, acc: 0x72efdd, hat: 'myth_crown', wings: 'seraph4' },
  },
  arcane_7: {
    id: 'arcane_7', type: 'arcane', tier: 7,
    name: '태초 · 이터니티 아카식 아르콘', title: '만물의 법칙을 다시 쓰는 태초의 지성',
    dmg: 4950, rate: 2.75, range: 12.6, crit: 0.42, critMul: 2.8, chains: 12, slow: 0.65, slowDur: 5.0, amp: 0.50,
    procEvery: 4, procName: '🌌 아카식 리라이트 (전역 심판)', procDesc: '4번째 마법마다 12연쇄 창세의 번개로 480% 고정 피해 + 받피증 50% + 극둔화',
    pal: { skin: 0xffffff, hair: 0x9bf6ff, top: 0x12002b, bottom: 0x050010, acc: 0x00f5d4, hat: 'primordial', wings: 'seraph6' },
  },
};

export function getUnitDef(type, tier) {
  return UNIT_DEFS[`${type}_${tier}`];
}

export const ALL_UNIT_LIST = Object.values(UNIT_DEFS);
