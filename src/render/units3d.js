/**
 * src/render/units3d.js — 3대 공격 성향 × 7단계 등급 = 21종 고밀도 절차적 3D 치비 캐릭터 & 무장 모델러
 * - 헤어스타일 5종(단발, 포니테일, 트윈테일, 스파이키, 엘프 장발) + 엘프 귀 + 양팔/손 파지 관절
 * - 계열별 특화 복장(사이버 재킷, 중장갑 폴드런/백팩, 마도사 로브/마도서/아스트롤라베 륜)
 * - 선택 유닛 카드 & 도감 모달용 실시간 3D 회전 포트레이트 렌더러 내장
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOARD } from '../data/config.js';
import { TIERS, TYPES } from '../data/units.js';
import { addOutline, canvasTexture, glow, mergeParts, mk, part, toon, vcToon } from './toon.js';

// ==================== 1. 치비 캐릭터 얼굴 표정 아틀라스 (6프레임) ====================
export const FACE = { normal: 0, blink: 1, focus: 2, happy: 3, star: 4, awaken: 5 };
const NF = 6;
let _faceTex = null;

function getFaceTex() {
  if (_faceTex) return _faceTex;
  const W = 160;
  const H = 128;
  _faceTex = canvasTexture(W * NF, H, (g) => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const ink = '#1e1024';

    const drawGlossyEye = (x, y, colTop = '#140c24', colBot = '#38bdf8') => {
      // 흰자위 바탕
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(x, y, 17, 21, 0, 0, Math.PI * 2);
      g.fill();

      // 눈동자 그라데이션
      const gr = g.createLinearGradient(0, y - 20, 0, y + 20);
      gr.addColorStop(0, colTop);
      gr.addColorStop(0.5, '#3b1d5e');
      gr.addColorStop(1, colBot);
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y + 1, 14, 19, 0, 0, Math.PI * 2);
      g.fill();

      // 쌍꺼풀/속눈썹 라인
      g.strokeStyle = ink;
      g.lineWidth = 5.5;
      g.beginPath();
      g.arc(x, y - 1, 16, Math.PI * 1.12, Math.PI * 1.88);
      g.stroke();

      // 상단 큰 하이라이트 + 하단 반사광
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(x + 5, y - 8, 6.2, 7.2, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x - 6, y + 8, 3.2, 0, Math.PI * 2);
      g.fill();
    };

    const drawBlush = (ox) => {
      g.fillStyle = 'rgba(255, 105, 145, 0.55)';
      for (const x of [ox + 25, ox + 135]) {
        g.beginPath();
        g.ellipse(x, 84, 15, 8.5, 0, 0, Math.PI * 2);
        g.fill();
      }
    };

    for (let f = 0; f < NF; f++) {
      const ox = f * W;
      const ex = [ox + 50, ox + 110];
      const ey = 58;
      drawBlush(ox);
      g.strokeStyle = ink;
      g.fillStyle = ink;
      g.lineWidth = 5;

      if (f === FACE.normal) {
        ex.forEach((x) => drawGlossyEye(x, ey));
        g.beginPath();
        g.arc(ox + 80, 83, 8, 0.2, Math.PI - 0.2);
        g.stroke();
      } else if (f === FACE.blink) {
        for (const x of ex) {
          g.beginPath();
          g.arc(x, ey + 2, 14, 0.2, Math.PI - 0.2);
          g.stroke();
        }
        g.beginPath();
        g.arc(ox + 80, 83, 7, 0.2, Math.PI - 0.2);
        g.stroke();
      } else if (f === FACE.focus) {
        ex.forEach((x) => drawGlossyEye(x, ey + 2, '#1a0a2a', '#f72585'));
        g.strokeStyle = ink;
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(ex[0] - 16, ey - 23);
        g.lineTo(ex[0] + 13, ey - 14);
        g.moveTo(ex[1] + 16, ey - 23);
        g.lineTo(ex[1] - 13, ey - 14);
        g.stroke();
        g.beginPath();
        g.moveTo(ox + 71, 87);
        g.lineTo(ox + 89, 85);
        g.stroke();
      } else if (f === FACE.happy) {
        for (const x of ex) {
          g.beginPath();
          g.arc(x, ey + 6, 13, Math.PI + 0.25, -0.25);
          g.stroke();
        }
        g.fillStyle = '#e11d48';
        g.beginPath();
        g.arc(ox + 80, 81, 12, 0, Math.PI);
        g.fill();
      } else if (f === FACE.star) {
        ex.forEach((x) => {
          drawGlossyEye(x, ey, '#1a1230', '#ffd43b');
          g.fillStyle = '#ffd43b';
          g.beginPath();
          for (let k = 0; k < 10; k++) {
            const a = -Math.PI / 2 + (k * Math.PI) / 5;
            const r = k % 2 ? 5 : 12;
            if (k === 0) g.moveTo(x + Math.cos(a) * r, ey + Math.sin(a) * r);
            else g.lineTo(x + Math.cos(a) * r, ey + Math.sin(a) * r);
          }
          g.closePath();
          g.fill();
        });
        g.fillStyle = '#e64980';
        g.beginPath();
        g.arc(ox + 80, 82, 11, 0, Math.PI);
        g.fill();
      } else if (f === FACE.awaken) {
        ex.forEach((x) => {
          drawGlossyEye(x, ey, '#002838', '#00f5d4');
          g.strokeStyle = '#00f5d4';
          g.lineWidth = 3.5;
          g.beginPath();
          g.arc(x, ey + 1, 10, 0, Math.PI * 2);
          g.stroke();
        });
        g.strokeStyle = ink;
        g.lineWidth = 5;
        g.beginPath();
        g.arc(ox + 80, 83, 9, 0.15, Math.PI - 0.15);
        g.stroke();
      }
    }
  });
  _faceTex.repeat.set(1 / NF, 1);
  return _faceTex;
}

// ==================== 2. 회전 마법진 텍스처 캐시 ====================
const _runeTexCache = {};
function getRuneTex(hexColor, isPrimordial = false) {
  const key = `${hexColor}_${isPrimordial}`;
  if (_runeTexCache[key]) return _runeTexCache[key];
  const col = '#' + new THREE.Color(hexColor).getHexString();
  const tex = canvasTexture(256, 256, (g, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(cx, cy, 114, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, 96, 0, Math.PI * 2);
    g.stroke();

    const pts = isPrimordial ? 8 : 6;
    g.lineWidth = 3.5;
    for (let s = 0; s < 2; s++) {
      g.beginPath();
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2 + (s * Math.PI) / pts;
        const x = cx + Math.cos(a) * 95;
        const y = cy + Math.sin(a) * 95;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * 105, cy + Math.sin(a) * 105, 4, 0, Math.PI * 2);
      g.fill();
    }
  });
  return (_runeTexCache[key] = tex);
}

// ==================== 3. 날개 & 무장 ExtrudeGeometry 빌더 ====================
let _wingGeo = null;
function getWingGeo() {
  if (_wingGeo) return _wingGeo;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.38, 0.34, 0.92, 0.48);
  s.quadraticCurveTo(0.75, 0.18, 0.60, 0.06);
  s.quadraticCurveTo(0.80, 0.02, 0.68, -0.15);
  s.quadraticCurveTo(0.46, -0.14, 0.38, -0.28);
  s.quadraticCurveTo(0.20, -0.24, 0, -0.09);
  s.closePath();
  _wingGeo = new THREE.ExtrudeGeometry(s, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  return _wingGeo;
}

let _gunGeo = null;
function getGunGeo() {
  if (_gunGeo) return _gunGeo;
  const s = new THREE.Shape();
  s.moveTo(-0.20, -0.16);
  s.lineTo(-0.06, -0.16);
  s.lineTo(-0.02, -0.02);
  s.lineTo(0.52, -0.02);
  s.quadraticCurveTo(0.58, 0.03, 0.56, 0.11);
  s.lineTo(-0.14, 0.13);
  s.quadraticCurveTo(-0.22, 0.09, -0.20, -0.16);
  _gunGeo = new THREE.ExtrudeGeometry(s, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.014,
    bevelSegments: 2,
  });
  _gunGeo.rotateY(-Math.PI / 2);
  _gunGeo.translate(0.04, 0, 0);
  return _gunGeo;
}

const S = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const Cap = (r, l, s = 10) => new THREE.CapsuleGeometry(r, l, 4, s);
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s);
const Cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const Tor = (r, t, s = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 6, s, arc);

/**
 * 유닛 정의(def)에 맞춰 3D 치비 캐릭터 + 헤어스타일 + 복장 + 양팔/무기 + 오라를 조립
 */
export function buildUnitMesh(def) {
  const tierInfo = TIERS[def.tier];
  const typeInfo = TYPES[def.type];
  const P = def.pal;
  const tier = def.tier;

  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);

  const sc = tierInfo.scale * 0.64;
  inner.scale.setScalar(sc);

  // 1) 발밑 등급 페데스탈 + 성향 컬러 림
  const baseRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.70, 0.78, 0.11, 22),
    toon(tierInfo.hex)
  );
  baseRing.position.y = 0.055;
  addOutline(baseRing, 0.025);
  inner.add(baseRing);

  const typeTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.71, 0.032, 8, 24),
    glow(typeInfo.hex, 1.8)
  );
  typeTrim.rotation.x = Math.PI / 2;
  typeTrim.position.y = 0.11;
  inner.add(typeTrim);

  // 3등급 이상: 바닥 회전 마법진
  let rune1 = null;
  let rune2 = null;
  if (tier >= 3) {
    const rTex = getRuneTex(tier >= 7 ? 0x00f5d4 : tierInfo.hex, tier >= 6);
    const rSize = tier >= 7 ? 2.55 : tier >= 5 ? 2.15 : 1.80;
    rune1 = new THREE.Mesh(
      new THREE.PlaneGeometry(rSize, rSize),
      new THREE.MeshBasicMaterial({
        map: rTex,
        transparent: true,
        opacity: tier >= 6 ? 0.94 : 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    rune1.rotation.x = -Math.PI / 2;
    rune1.position.y = 0.08;
    inner.add(rune1);

    if (tier >= 6) {
      const rTex2 = getRuneTex(typeInfo.hex, true);
      rune2 = new THREE.Mesh(
        new THREE.PlaneGeometry(rSize * 0.76, rSize * 0.76),
        new THREE.MeshBasicMaterial({
          map: rTex2,
          transparent: true,
          opacity: 0.88,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      rune2.rotation.x = -Math.PI / 2;
      rune2.position.y = 0.1;
      inner.add(rune2);
    }
  }

  // 2) 치비 부츠 & 다리 & 계열별 전용 의상 조립
  const bob = new THREE.Group();
  const baseBobY = tier >= 7 ? 0.25 : 0.09;
  bob.position.y = baseBobY;
  inner.add(bob);

  const bp = [
    // 부츠 & 다리
    part(Box(0.16, 0.12, 0.22), 0x1e293b, -0.12, 0.08, 0.03),
    part(Box(0.16, 0.12, 0.22), 0x1e293b, 0.12, 0.08, 0.03),
    part(Cap(0.085, 0.20, 8), P.bottom, -0.12, 0.24, 0),
    part(Cap(0.085, 0.20, 8), P.bottom, 0.12, 0.24, 0),
    // 상의 아머/재킷
    part(Cap(0.24, 0.26, 12), P.top, 0, 0.58, 0),
    // 하의 스커트/코트 자락
    part(Cone(0.34, 0.32, 14), P.bottom, 0, 0.43, 0),
    // 벨트 & 금장 버클
    part(Cyl(0.255, 0.265, 0.07, 14), 0x1e293b, 0, 0.49, 0),
    part(Box(0.12, 0.09, 0.06), 0xffd43b, 0, 0.49, 0.25),
    // 가슴 엠블럼 코어
    part(S(0.085, 10, 8), P.acc, 0, 0.66, 0.24),
    // 목 칼라/스카프
    part(Tor(0.20, 0.055, 12), P.acc, 0, 0.80, 0, 1, 1, 1, Math.PI / 2),
  ];

  // 계열별 전용 복장 파츠
  if (def.type === 'striker') {
    // 사이버 코트 양옆 플랩 & 등 뒤 V자 부스터 팩
    bp.push(
      part(Box(0.10, 0.34, 0.22), P.top, -0.26, 0.40, 0, 1, 1, 1, 0, 0, 0.22),
      part(Box(0.10, 0.34, 0.22), P.top, 0.26, 0.40, 0, 1, 1, 1, 0, 0, -0.22),
      part(Box(0.32, 0.28, 0.16), 0x1e293b, 0, 0.62, -0.22),
      part(Cyl(0.06, 0.09, 0.22, 8), P.acc, -0.12, 0.48, -0.28, 1, 1, 1, 0.35),
      part(Cyl(0.06, 0.09, 0.22, 8), P.acc, 0.12, 0.48, -0.28, 1, 1, 1, 0.35)
    );
  } else if (def.type === 'destroyer') {
    // 중장갑 대형 어깨 실드 폴드런 & 등 뒤 탄약/원자로 백팩
    const shCol = tier >= 4 ? 0xffd43b : P.top;
    bp.push(
      part(S(0.18, 12, 10), shCol, -0.34, 0.70, 0, 1.25, 0.95, 1.15),
      part(S(0.18, 12, 10), shCol, 0.34, 0.70, 0, 1.25, 0.95, 1.15),
      part(Box(0.24, 0.06, 0.24), P.acc, -0.36, 0.78, 0, 1, 1, 1, 0, 0, 0.35),
      part(Box(0.24, 0.06, 0.24), P.acc, 0.36, 0.78, 0, 1, 1, 1, 0, 0, -0.35),
      part(Box(0.42, 0.38, 0.24), 0x334155, 0, 0.62, -0.24),
      part(Cyl(0.09, 0.09, 0.44, 10), P.acc, -0.14, 0.68, -0.28),
      part(Cyl(0.09, 0.09, 0.44, 10), P.acc, 0.14, 0.68, -0.28)
    );
  } else {
    // 마도사 전면 금장 타바드(앞치마) & 풍성한 마도 망토
    bp.push(
      part(Box(0.18, 0.38, 0.04), P.acc, 0, 0.38, 0.25, 1, 1, 1, -0.12),
      part(S(0.14, 10, 8), P.top, -0.28, 0.68, 0),
      part(S(0.14, 10, 8), P.top, 0.28, 0.68, 0),
      part(Cone(0.42, 0.72, 10), P.top, 0, 0.48, -0.20, 1.15, 1, 0.55, 0.28, 0, 0)
    );
  }

  const bodyMesh = new THREE.Mesh(mergeParts(bp), vcToon);
  bodyMesh.castShadow = true;
  addOutline(bodyMesh, 0.026);
  bob.add(bodyMesh);

  // 3) 치비 머리 + 다양한 헤어스타일 + 귀 + 모자/왕관
  const headG = new THREE.Group();
  headG.position.y = 1.15;
  bob.add(headG);

  const R = 0.45;
  const hp = [
    // 얼굴 구체
    part(S(R, 22, 16), P.skin, 0, 0, 0, 1.06, 0.96, 1.0),
    // 뒷머리 돔
    part(
      new THREE.SphereGeometry(R * 1.07, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.60),
      P.hair,
      0,
      0.04,
      -0.03,
      1.07,
      1.02,
      1.04,
      -0.30
    ),
    // 양옆 애교머리
    part(Cap(0.095, 0.30, 8), P.hair, -0.40, -0.08, 0.12, 1, 1, 0.85, 0, 0, 0.16),
    part(Cap(0.095, 0.30, 8), P.hair, 0.40, -0.08, 0.12, 1, 1, 0.85, 0, 0, -0.16),
  ];

  // 풍성한 앞머리 뱅
  for (let k = -2; k <= 2; k++) {
    hp.push(
      part(
        Cone(0.11, 0.26, 6),
        P.hair,
        k * 0.115,
        0.24,
        0.37 - Math.abs(k) * 0.02,
        1,
        1,
        0.65,
        Math.PI - 0.25,
        0,
        -k * 0.08
      )
    );
  }

  // 엘프 귀 (Arcane 계열)
  if (P.ear === 'elf') {
    for (const sx of [-1, 1]) {
      hp.push(
        part(Cone(0.08, 0.34, 6), P.skin, sx * 0.52, 0.02, -0.02, 1, 0.7, 1, 0, 0, -sx * 1.18)
      );
    }
  }

  // 헤어스타일 분기 (twintail / ponytail / spiky / long)
  if (P.hairStyle === 'twintail') {
    for (const sx of [-1, 1]) {
      // 머리끈 링 + 양갈래 트윈테일 컬
      hp.push(
        part(Tor(0.10, 0.035, 10), P.acc, sx * 0.42, 0.18, -0.10, 1, 1, 1, 0, Math.PI / 2, 0),
        part(Cone(0.18, 0.68, 10), P.hair, sx * 0.56, -0.14, -0.14, 1, 1, 0.85, 0.18, 0, sx * 0.38)
      );
    }
  } else if (P.hairStyle === 'ponytail') {
    hp.push(
      part(Tor(0.11, 0.04, 10), P.acc, 0, 0.22, -0.42),
      part(Cone(0.22, 0.65, 10), P.hair, 0, -0.02, -0.58, 1, 1, 0.85, -0.55, 0, 0)
    );
  } else if (P.hairStyle === 'spiky') {
    for (let i = 0; i < 7; i++) {
      const a = ((i - 3) * 0.42);
      hp.push(
        part(
          Cone(0.12, 0.34, 6),
          P.hair,
          Math.sin(a) * 0.38,
          0.36,
          -Math.cos(a) * 0.22 - 0.1,
          1,
          1,
          1,
          -0.45,
          0,
          -a * 0.7
        )
      );
    }
  } else if (P.hairStyle === 'long') {
    // 등 뒤로 흐르는 긴 웨이브 장발
    for (let k = -2; k <= 2; k++) {
      hp.push(
        part(Cap(0.11, 0.52, 8), P.hair, k * 0.13, -0.26, -0.34, 1.1, 1, 0.7, 0.22, 0, -k * 0.08)
      );
    }
  }

  // 모자 / 바이저 / 티아라 / 왕관 분기
  if (P.hat === 'visor' || P.hat === 'visor_heavy' || P.hat === 'halo_visor') {
    hp.push(
      part(Box(0.72, 0.15, 0.20), P.acc, 0, 0.12, 0.38),
      // 고양이귀 사이버 안테나
      part(Cone(0.11, 0.28, 4), P.top, -0.30, 0.48, 0.05, 1, 1, 0.6, 0, 0, 0.25),
      part(Cone(0.11, 0.28, 4), P.top, 0.30, 0.48, 0.05, 1, 1, 0.6, 0, 0, -0.25)
    );
  } else if (P.hat === 'beret') {
    hp.push(
      part(S(0.40, 14, 10), P.top, 0.08, 0.38, 0, 1.22, 0.46, 1.16, 0, 0, -0.22),
      part(S(0.06, 8, 6), 0xffd43b, -0.12, 0.38, 0.34)
    );
  } else if (P.hat === 'headset') {
    hp.push(
      part(Tor(0.48, 0.045, 16, Math.PI), P.acc, 0, 0.05, 0),
      part(Cyl(0.14, 0.14, 0.12, 12), P.top, -0.48, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2),
      part(Cyl(0.14, 0.14, 0.12, 12), P.top, 0.48, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2),
      part(S(0.08, 8, 6), P.acc, -0.54, 0, 0),
      part(S(0.08, 8, 6), P.acc, 0.54, 0, 0)
    );
  } else if (P.hat === 'valkyrie') {
    hp.push(
      part(Tor(0.36, 0.04, 14), 0xffd43b, 0, 0.36, 0.05, 1, 1, 1, Math.PI / 2),
      part(Cone(0.10, 0.38, 4), 0xffffff, -0.45, 0.32, 0.08, 0.5, 1, 1.2, -0.35, 0, 0.65),
      part(Cone(0.10, 0.38, 4), 0xffffff, 0.45, 0.32, 0.08, 0.5, 1, 1.2, -0.35, 0, -0.65),
      part(S(0.08, 8, 6), P.acc, 0, 0.40, 0.38)
    );
  } else if (P.hat === 'helmet') {
    hp.push(
      part(
        new THREE.SphereGeometry(R * 1.14, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.54),
        P.top,
        0,
        0.06,
        0,
        1.08,
        1,
        1.08,
        -0.12
      ),
      part(Box(0.56, 0.09, 0.18), 0xffd43b, 0, 0.24, 0.42),
      part(Box(0.10, 0.22, 0.52), P.acc, 0, 0.52, -0.02)
    );
  } else if (P.hat === 'wizard') {
    hp.push(
      part(Cyl(0.68, 0.68, 0.055, 18), P.top, 0, 0.34, 0),
      part(Cone(0.38, 0.72, 12), P.top, 0, 0.68, -0.06, 1, 1, 1, -0.22),
      part(Tor(0.34, 0.045, 12), 0xffd43b, 0, 0.39, 0, 1, 1, 1, Math.PI / 2)
    );
  } else if (P.hat === 'horns') {
    for (const sx of [-1, 1]) {
      hp.push(
        part(Cone(0.11, 0.46, 8), 0xffd43b, sx * 0.36, 0.46, 0.06, 1, 1, 1, -0.25, 0, -sx * 0.50),
        part(Cone(0.07, 0.24, 6), P.acc, sx * 0.48, 0.62, 0.02, 1, 1, 1, -0.1, 0, -sx * 0.2)
      );
    }
  } else if (P.hat === 'circlet' || P.hat === 'moon_tiara') {
    hp.push(
      part(Tor(0.36, 0.038, 16), 0xffd43b, 0, 0.36, 0.04, 1, 1, 1, Math.PI / 2),
      // 이마 위 초승달 장식
      part(Tor(0.14, 0.032, 12, Math.PI * 1.35), 0xffd43b, 0, 0.50, 0.34, 1, 1, 1, 0, 0, Math.PI * 0.82),
      part(S(0.055, 8, 6), P.acc, 0, 0.50, 0.35)
    );
  } else if (P.hat === 'myth_crown' || P.hat === 'primordial') {
    const crownCol = tier >= 7 ? 0x00f5d4 : 0xffd43b;
    hp.push(part(Tor(0.36, 0.045, 16), 0xffd43b, 0, 0.38, 0.04, 1, 1, 1, Math.PI / 2));
    const spikes = 5;
    for (let i = 0; i < spikes; i++) {
      const a = (i - 2) * 0.40;
      const isCenter = i === 2;
      hp.push(
        part(
          Cone(isCenter ? 0.085 : 0.065, isCenter ? 0.34 : 0.22, 4),
          isCenter ? crownCol : 0xffd43b,
          Math.sin(a) * 0.34,
          0.52,
          Math.cos(a) * 0.34 + 0.04
        )
      );
    }
  }

  const headMesh = new THREE.Mesh(mergeParts(hp), vcToon);
  headMesh.castShadow = true;
  addOutline(headMesh, 0.026);
  headG.add(headMesh);

  // 얼굴 표정 곡면 패치
  const faceGeo = new THREE.SphereGeometry(
    R * 1.018,
    18,
    12,
    Math.PI / 2 - 0.78,
    1.56,
    Math.PI / 2 - 0.58,
    1.16
  );
  faceGeo.scale(1.06, 0.96, 1.0);
  const fTex = getFaceTex().clone();
  fTex.needsUpdate = true;
  const defaultFace = tier >= 7 ? FACE.awaken : tier >= 5 ? FACE.star : FACE.normal;
  fTex.offset.x = defaultFace / NF;
  const faceMesh = new THREE.Mesh(
    faceGeo,
    new THREE.MeshBasicMaterial({ map: fTex, transparent: true, depthWrite: false })
  );
  headG.add(faceMesh);

  // 4) 고등급(4~7등급) 날개 & 헤일로(광륜) / 아스트롤라베
  const wings = [];
  if (tier >= 4) {
    const wGeo = getWingGeo();
    const wCol = tier >= 7 ? 0x00f5d4 : tier === 6 ? 0xff2957 : tier === 5 ? 0xff922b : P.acc;
    const wMat = glow(wCol, tier >= 6 ? 2.1 : 1.4);
    const pairCount = tier >= 7 ? 3 : tier === 6 ? 2 : 1;
    for (let p = 0; p < pairCount; p++) {
      for (const sx of [-1, 1]) {
        const wm = new THREE.Mesh(wGeo, wMat);
        const wScale = (tier === 4 ? 0.68 : 1.08) - p * 0.12;
        wm.scale.set(sx * wScale, wScale, 1);
        wm.position.set(sx * 0.15, 0.75 - p * 0.16, -0.24);
        wm.rotation.y = -sx * 0.32;
        wm.rotation.z = sx * (0.28 - p * 0.24);
        bob.add(wm);
        wings.push({ m: wm, sx, p });
      }
    }
  }

  let halo = null;
  if (tier >= 5) {
    halo = new THREE.Group();
    halo.position.set(0, 1.48, -0.32);
    const hCol = tier >= 7 ? 0x00f5d4 : tier === 6 ? 0xff2957 : 0xffd43b;
    const hRing = new THREE.Mesh(Tor(0.58 + (tier - 5) * 0.1, 0.038, 24), glow(hCol, 2.4));
    halo.add(hRing);

    if (tier >= 6) {
      const hRing2 = new THREE.Mesh(Tor(0.82, 0.028, 24), glow(0xffd43b, 2.5));
      halo.add(hRing2);
      const rayCnt = tier >= 7 ? 8 : 4;
      for (let i = 0; i < rayCnt; i++) {
        const a = (i / rayCnt) * Math.PI * 2;
        const ray = new THREE.Mesh(Cone(0.055, 0.28, 4), glow(hCol, 2.4));
        ray.position.set(Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0);
        ray.rotation.z = a - Math.PI / 2;
        halo.add(ray);
      }
    }
    bob.add(halo);
  }

  // 5) 양팔(Left/Right Arm) + 손(Hands) + 계열별 대형 3D 무기 조립
  const weaponG = new THREE.Group();
  weaponG.position.set(0, 0.64, 0);
  bob.add(weaponG);

  const skinM = toon(P.skin);
  const sleeveM = toon(P.top);
  const metalM = toon(0x334155);
  const silverM = toon(0xe2e8f0);
  const goldM = toon(0xffd43b);
  const glowAcc = glow(P.acc, 2.1);

  // 양팔과 손 생성 (무기를 파지하는 자세)
  for (const sx of [-1, 1]) {
    const arm = mk(Cap(0.075, 0.24, 8), sleeveM, sx * 0.34, 0.02, 0.16, weaponG, 0.02);
    arm.rotation.x = Math.PI / 2 - 0.25;
    arm.rotation.z = -sx * 0.18;
    mk(S(0.085, 8, 8), skinM, sx * 0.36, -0.02, 0.36, weaponG, 0.02);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 1.0);
  weaponG.add(muzzle);

  const drones = [];

  if (def.type === 'striker') {
    // ⚡ 속사·진동계: 네온 듀얼 피스톨 -> 회전 개틀링/발키리 저격총 -> 아스트랄 위성 비트 + 양손 포톤 라이플
    const gGeo = getGunGeo();
    if (tier <= 2) {
      for (const sx of tier === 2 ? [-0.36, 0.36] : [0.36]) {
        const gm = mk(gGeo, silverM, sx, 0, 0.42, weaponG, 0.022);
        gm.scale.setScalar(1.22);
        mk(Cyl(0.042, 0.042, 0.38, 8).rotateX(Math.PI / 2), glowAcc, sx, 0.05, 0.75, weaponG, 0);
      }
    } else if (tier <= 4) {
      // 대구경 회전 개틀링 / 황금 발키리 롱배럴 레일건
      const mainMat = tier === 4 ? goldM : silverM;
      mk(
        new RoundedBoxGeometry(0.28, 0.26, 0.85, 2, 0.05),
        mainMat,
        0.38,
        -0.02,
        0.48,
        weaponG,
        0.024
      );
      for (let b = 0; b < 4; b++) {
        const a = (b / 4) * Math.PI * 2;
        mk(
          Cyl(0.032, 0.032, 0.72, 8).rotateX(Math.PI / 2),
          glowAcc,
          0.38 + Math.cos(a) * 0.065,
          -0.02 + Math.sin(a) * 0.065,
          0.95,
          weaponG,
          0.015
        );
      }
      // 왼손 보조 홀로그램 타겟터
      mk(Tor(0.18, 0.025, 12), glowAcc, -0.38, 0.06, 0.52, weaponG, 0);
    } else {
      // 5~7등급: 양손 아스트랄 포톤 블래스터 + 공중 부유 위성 레이저 포드
      for (const sx of [-0.38, 0.38]) {
        const gm = mk(gGeo, goldM, sx, 0, 0.46, weaponG, 0.024);
        gm.scale.setScalar(1.35);
        mk(Cyl(0.048, 0.048, 0.55, 8).rotateX(Math.PI / 2), glowAcc, sx, 0.05, 0.86, weaponG, 0);
      }
      const dCount = tier >= 7 ? 4 : 2;
      for (let d = 0; d < dCount; d++) {
        const dg = new THREE.Group();
        mk(new THREE.OctahedronGeometry(0.19, 0), glowAcc, 0, 0, 0, dg, 0.02);
        mk(Cyl(0.042, 0.06, 0.46, 8).rotateX(Math.PI / 2), goldM, 0, 0, 0.24, dg, 0.018);
        bob.add(dg);
        drones.push({ g: dg, phase: (d / dCount) * Math.PI * 2, r: 0.88 + (d % 2) * 0.18 });
      }
    }
    muzzle.position.set(0.36, 0.05, 1.05);
  } else if (def.type === 'destroyer') {
    // 💥 중포·폭발계: 대구경 박격포 -> 쌍열 공성 캐논 -> 숄더 미사일 런처 + 오메가 핵융합 중포
    const barrelCount = tier >= 3 ? 2 : 1;
    const offsets = barrelCount === 2 ? [-0.44, 0.44] : [0.42];
    const rTube = 0.13 + tier * 0.016;
    const len = 0.78 + tier * 0.07;

    for (const bx of offsets) {
      mk(
        new RoundedBoxGeometry(rTube * 2.4, rTube * 2.4, len * 0.68, 2, 0.05),
        tier >= 5 ? goldM : toon(P.top),
        bx,
        0.06,
        0.30,
        weaponG,
        0.026
      );
      mk(
        Cyl(rTube * 0.92, rTube * 1.12, len, 14).rotateX(Math.PI / 2),
        metalM,
        bx,
        0.08,
        0.30 + len * 0.48,
        weaponG,
        0.026
      );
      // 포구 발광 링
      mk(
        Tor(rTube * 1.08, 0.042, 14),
        glowAcc,
        bx,
        0.08,
        0.30 + len * 0.92,
        weaponG,
        0.016
      );
    }
    if (tier >= 5) {
      // 어깨 위 다연장 미사일 포드 + 등 뒤 핵융합 코어 구체
      for (const sx of [-0.36, 0.36]) {
        mk(new RoundedBoxGeometry(0.24, 0.22, 0.36, 2, 0.04), goldM, sx, 0.46, -0.10, weaponG, 0.02);
      }
      const core = mk(S(0.28, 14, 12), glow(0xff9e00, 2.5), 0, 0.48, -0.38, weaponG, 0.02);
      drones.push({ g: core, isCore: true });
    }
    muzzle.position.set(offsets[0], 0.1, 1.15);
  } else {
    // 🔮 마도·관통계: 초승달 보석 지팡이 + 왼손 부유 마도서 + 원소 오브 위성
    const staff = new THREE.Group();
    staff.position.set(0.42, 0.04, 0.34);
    weaponG.add(staff);

    // 지팡이 기둥 + 상단 초승달 헤드 + 중앙 크리스탈
    mk(Cyl(0.036, 0.044, 1.32, 10), tier >= 4 ? goldM : toon(0x6b21a8), 0, 0.24, 0, staff, 0.022);
    mk(
      Tor(0.24, 0.04, 14, Math.PI * 1.45),
      tier >= 4 ? goldM : silverM,
      0,
      0.94,
      0,
      staff,
      0.018
    ).rotation.z = Math.PI * 0.28;
    const tipGem = mk(
      new THREE.OctahedronGeometry(0.16 + tier * 0.014, 0),
      glowAcc,
      0,
      0.94,
      0,
      staff,
      0.02
    );
    drones.push({ g: tipGem, isGem: true });

    // 왼손 부유 마도서(Grimoire) 또는 마력 크리스탈
    const book = mk(
      new RoundedBoxGeometry(0.24, 0.07, 0.30, 1, 0.02),
      toon(P.top),
      -0.42,
      0.16,
      0.42,
      weaponG,
      0.02
    );
    book.rotation.set(0.35, 0.25, -0.2);

    const orbCount = Math.min(6, tier);
    for (let i = 0; i < orbCount; i++) {
      const og = mk(
        new THREE.OctahedronGeometry(0.10 + (tier >= 6 ? 0.035 : 0), 0),
        glow(i % 2 === 0 ? P.acc : typeInfo.subHex, 2.3),
        0,
        0,
        0,
        bob,
        0.015
      );
      drones.push({ g: og, phase: (i / orbCount) * Math.PI * 2, r: 0.72 + (tier >= 6 ? 0.18 : 0) });
    }
    muzzle.position.set(0.42, 0.94, 0.38);
  }

  return {
    root,
    inner,
    bob,
    headG,
    weaponG,
    muzzle,
    fTex,
    defaultFace,
    baseBobY,
    rune1,
    rune2,
    wings,
    halo,
    drones,
    blinkT: 1.5 + Math.random() * 2.5,
    focusT: 0,
  };
}

/**
 * 매 프레임 유닛 애니메이션 업데이트
 */
export function updateUnitVisual(u, dt) {
  const V = u.visual;
  if (!V) return;

  u.x += (u.targetX - u.x) * Math.min(1, dt * 16);
  u.z += (u.targetZ - u.z) * Math.min(1, dt * 16);

  if (u.spawnBounce > 0) {
    u.spawnBounce = Math.max(0, u.spawnBounce - dt * 3.2);
  }
  const jumpY = Math.sin(u.spawnBounce * Math.PI) * 0.85;
  V.root.position.set(u.x, BOARD.boardY + 0.11 + jumpY, u.z);

  if (u.aimYaw != null) {
    let diff = u.aimYaw - V.inner.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    V.inner.rotation.y += diff * Math.min(1, dt * 14);
  }

  const phase = u.uid * 1.3 + performance.now() * 0.0035;
  V.bob.position.y = V.baseBobY + Math.sin(phase) * (u.tier >= 7 ? 0.075 : 0.04);
  u.recoil = Math.max(0, (u.recoil || 0) - dt * 6.5);
  V.weaponG.position.z = -u.recoil * 0.24;
  V.weaponG.rotation.x = -u.recoil * 0.36;

  if (V.focusT > 0) {
    V.focusT -= dt;
    V.fTex.offset.x = (u.tier >= 7 ? FACE.awaken : FACE.focus) / NF;
  } else {
    V.blinkT -= dt;
    if (V.blinkT <= 0) {
      V.fTex.offset.x = FACE.blink / NF;
      if (V.blinkT <= -0.13) {
        V.blinkT = 2.0 + Math.random() * 2.8;
        V.fTex.offset.x = V.defaultFace / NF;
      }
    } else {
      V.fTex.offset.x = V.defaultFace / NF;
    }
  }

  if (V.rune1) V.rune1.rotation.z += dt * (u.tier >= 7 ? 1.4 : 0.85);
  if (V.rune2) V.rune2.rotation.z -= dt * 1.8;
  if (V.halo) V.halo.rotation.z += dt * 1.1;

  for (const w of V.wings) {
    const flap = Math.sin(phase * 1.8 + w.p * 0.7) * 0.15;
    w.m.rotation.y = -w.sx * (0.32 + flap);
  }

  for (const d of V.drones) {
    if (d.isGem || d.isCore) {
      d.g.rotation.y += dt * 2.8;
      d.g.rotation.x += dt * 1.4;
    } else {
      d.phase += dt * 2.4;
      d.g.position.set(
        Math.cos(d.phase) * d.r,
        0.78 + Math.sin(d.phase * 2) * 0.12,
        Math.sin(d.phase) * d.r
      );
      d.g.rotation.y = -d.phase;
    }
  }
}

// ==================== 4. 선택 카드 & 도감용 실시간 3D 회전 프리뷰 스테이지 ====================
let _prevRenderer = null;
let _prevScene = null;
let _prevCam = null;
let _prevModel = null;
let _prevDefId = '';
let _prevDummyUnit = null;

export function renderUnitPortrait(canvasEl, def, dt = 0.016) {
  if (typeof document === 'undefined' || !canvasEl || !def) return;
  if (!_prevRenderer) {
    try {
      _prevRenderer = new THREE.WebGLRenderer({
        canvas: canvasEl,
        alpha: true,
        antialias: true,
      });
      _prevRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      _prevRenderer.setSize(112, 112, false);
      _prevRenderer.outputColorSpace = THREE.SRGBColorSpace;

      _prevScene = new THREE.Scene();
      _prevCam = new THREE.PerspectiveCamera(36, 1, 0.2, 20);
      _prevCam.position.set(0, 1.28, 3.15);
      _prevCam.lookAt(0, 0.78, 0);

      _prevScene.add(new THREE.HemisphereLight(0xffffff, 0x3b1d5e, 1.15));
      const dl = new THREE.DirectionalLight(0xfff4e0, 1.45);
      dl.position.set(2.5, 4, 3.5);
      _prevScene.add(dl);
    } catch (_) {
      return;
    }
  }

  if (_prevDefId !== def.id) {
    _prevDefId = def.id;
    if (_prevModel) {
      _prevScene.remove(_prevModel.root);
    }
    _prevModel = buildUnitMesh(def);
    // 포트레이트 프레임에 꽉 차도록 스케일 정규화
    _prevModel.inner.scale.setScalar(0.76);
    _prevModel.root.position.set(0, -0.05, 0);
    _prevScene.add(_prevModel.root);
    _prevDummyUnit = {
      uid: 999,
      def,
      type: def.type,
      tier: def.tier,
      x: 0,
      z: 0,
      targetX: 0,
      targetZ: 0,
      aimYaw: Math.sin(performance.now() * 0.0012) * 0.45,
      recoil: 0,
      spawnBounce: 0,
      visual: _prevModel,
    };
  }

  if (_prevDummyUnit && _prevModel) {
    // 정면을 중심으로 좌우로 천천히 회전하며 얼굴·무기·날개를 모두 보여줌
    const t = performance.now() * 0.0014;
    _prevModel.inner.rotation.y = Math.sin(t) * 0.58;
    _prevModel.bob.position.y = _prevModel.baseBobY + Math.sin(t * 2.5) * 0.04;
    if (_prevModel.rune1) _prevModel.rune1.rotation.z += dt * 1.2;
    if (_prevModel.rune2) _prevModel.rune2.rotation.z -= dt * 1.5;
    if (_prevModel.halo) _prevModel.halo.rotation.z += dt * 1.0;
    for (const d of _prevModel.drones) {
      if (!d.isGem && !d.isCore) {
        d.phase += dt * 2.2;
        d.g.position.set(Math.cos(d.phase) * d.r, 0.78, Math.sin(d.phase) * d.r);
      }
    }
    _prevModel.root.position.set(0, -0.05, 0);
    _prevRenderer.render(_prevScene, _prevCam);
  }
}
