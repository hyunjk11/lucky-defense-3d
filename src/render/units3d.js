/**
 * src/render/units3d.js — 3대 공격 성향 × 7단계 등급 = 21종 절차적 3D 치비 영웅 & 무장 모델러
 * - Canvas 기반 6프레임 글로시 아니메 표정 아틀라스 (깜빡임, 집중, 별눈, 각성)
 * - Shape + ExtrudeGeometry 유선형 날개/망토/총기/포신 조형 + 정점 컬러 툰 셰이딩 + 외곽선
 * - 등급별 회전 마법진(CanvasTexture), 헤일로, 부유 위성 드론 및 반동/점프 애니메이션
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
    const ink = '#231426';

    const drawGlossyEye = (x, y, colTop = '#181026', colBot = '#4cc9f0') => {
      const gr = g.createLinearGradient(0, y - 22, 0, y + 22);
      gr.addColorStop(0, colTop);
      gr.addColorStop(0.55, '#3a2252');
      gr.addColorStop(1, colBot);
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, 15, 20, 0, 0, Math.PI * 2);
      g.fill();
      // 큰 하이라이트
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(x + 5, y - 8, 6, 7, 0, 0, Math.PI * 2);
      g.fill();
      // 작은 하이라이트
      g.beginPath();
      g.arc(x - 6, y + 8, 3, 0, Math.PI * 2);
      g.fill();
    };

    const drawBlush = (ox) => {
      g.fillStyle = 'rgba(255, 115, 150, 0.48)';
      for (const x of [ox + 26, ox + 134]) {
        g.beginPath();
        g.ellipse(x, 84, 14, 8, 0, 0, Math.PI * 2);
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
      g.lineWidth = 5.5;

      if (f === FACE.normal) {
        ex.forEach((x) => drawGlossyEye(x, ey));
        g.beginPath();
        g.arc(ox + 80, 82, 8, 0.2, Math.PI - 0.2);
        g.stroke();
      } else if (f === FACE.blink) {
        for (const x of ex) {
          g.beginPath();
          g.arc(x, ey, 13, 0.2, Math.PI - 0.2);
          g.stroke();
        }
        g.beginPath();
        g.arc(ox + 80, 82, 7, 0.2, Math.PI - 0.2);
        g.stroke();
      } else if (f === FACE.focus) {
        ex.forEach((x) => drawGlossyEye(x, ey + 2, '#1a0c2e', '#f72585'));
        g.strokeStyle = ink;
        g.lineWidth = 6;
        // 늠름한 눈썹
        g.beginPath();
        g.moveTo(ex[0] - 15, ey - 22);
        g.lineTo(ex[0] + 13, ey - 14);
        g.moveTo(ex[1] + 15, ey - 22);
        g.lineTo(ex[1] - 13, ey - 14);
        g.stroke();
        g.beginPath();
        g.moveTo(ox + 71, 86);
        g.lineTo(ox + 89, 84);
        g.stroke();
      } else if (f === FACE.happy) {
        for (const x of ex) {
          g.beginPath();
          g.arc(x, ey + 6, 13, Math.PI + 0.25, -0.25);
          g.stroke();
        }
        g.fillStyle = '#d6336c';
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
          drawGlossyEye(x, ey, '#003545', '#00f5d4');
          g.strokeStyle = '#00f5d4';
          g.lineWidth = 3;
          g.beginPath();
          g.arc(x, ey, 10, 0, Math.PI * 2);
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

// ==================== 2. 회전 마법진 텍스처 캐시 (등급별 오라) ====================
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
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cx, cy, 114, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(cx, cy, 98, 0, Math.PI * 2);
    g.stroke();

    // 육망성 / 팔각 성좌 기하학 패턴
    const pts = isPrimordial ? 8 : 6;
    g.lineWidth = 3;
    for (let s = 0; s < 2; s++) {
      g.beginPath();
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2 + (s * Math.PI) / pts;
        const x = cx + Math.cos(a) * 96;
        const y = cy + Math.sin(a) * 96;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    // 룬 점 장식
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * 106, cy + Math.sin(a) * 106, 3.5, 0, Math.PI * 2);
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
  s.quadraticCurveTo(0.35, 0.28, 0.82, 0.42);
  s.quadraticCurveTo(0.68, 0.15, 0.55, 0.05);
  s.quadraticCurveTo(0.72, 0.02, 0.62, -0.14);
  s.quadraticCurveTo(0.42, -0.12, 0.35, -0.26);
  s.quadraticCurveTo(0.18, -0.22, 0, -0.08);
  s.closePath();
  _wingGeo = new THREE.ExtrudeGeometry(s, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  return _wingGeo;
}

let _gunGeo = null;
function getGunGeo() {
  if (_gunGeo) return _gunGeo;
  // 유선형 미래형 블래스터/소총 측면 프로파일 (circuit-racing 스타일 Shape + Extrude)
  const s = new THREE.Shape();
  s.moveTo(-0.18, -0.14);
  s.lineTo(-0.06, -0.14);
  s.lineTo(-0.02, -0.02);
  s.lineTo(0.42, -0.02);
  s.quadraticCurveTo(0.48, 0.02, 0.46, 0.09);
  s.lineTo(-0.12, 0.11);
  s.quadraticCurveTo(-0.2, 0.08, -0.18, -0.14);
  _gunGeo = new THREE.ExtrudeGeometry(s, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  _gunGeo.rotateY(-Math.PI / 2);
  _gunGeo.translate(0.035, 0, 0);
  return _gunGeo;
}

const S = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const Cap = (r, l, s = 10) => new THREE.CapsuleGeometry(r, l, 4, s);
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s);
const Cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const Tor = (r, t, s = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 6, s, arc);

/**
 * 유닛 정의(def)에 맞춰 3D 치비 캐릭터 + 등급별 장식 + 계열별 무기를 조립해 반환
 */
export function buildUnitMesh(def) {
  const tierInfo = TIERS[def.tier];
  const typeInfo = TYPES[def.type];
  const P = def.pal;
  const tier = def.tier;

  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);

  const sc = tierInfo.scale * 0.62;
  inner.scale.setScalar(sc);

  // 1) 발밑 등급 페데스탈 링
  const baseRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.76, 0.1, 20),
    toon(tierInfo.hex)
  );
  baseRing.position.y = 0.05;
  addOutline(baseRing, 0.025);
  inner.add(baseRing);

  // 3등급 이상: 바닥 회전 마법진 (6·7등급은 2중 역회전 마법진)
  let rune1 = null;
  let rune2 = null;
  if (tier >= 3) {
    const rTex = getRuneTex(tier >= 7 ? 0x00f5d4 : tierInfo.hex, tier >= 6);
    const rSize = tier >= 7 ? 2.45 : tier >= 5 ? 2.1 : 1.75;
    rune1 = new THREE.Mesh(
      new THREE.PlaneGeometry(rSize, rSize),
      new THREE.MeshBasicMaterial({
        map: rTex,
        transparent: true,
        opacity: tier >= 6 ? 0.92 : 0.68,
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
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      rune2.rotation.x = -Math.PI / 2;
      rune2.position.y = 0.1;
      inner.add(rune2);
    }
  }

  // 2) 치비 몸통 & 의상 & 망토 조립 (정점 컬러 병합)
  const bob = new THREE.Group();
  // 7등급 태초는 공중에 살짝 부유
  const baseBobY = tier >= 7 ? 0.24 : 0.08;
  bob.position.y = baseBobY;
  inner.add(bob);

  const bp = [
    // 다리 2짝
    part(Cap(0.085, 0.22, 8), P.bottom, -0.11, 0.22, 0),
    part(Cap(0.085, 0.22, 8), P.bottom, 0.11, 0.22, 0),
    // 몸통 튜닉/아머
    part(Cap(0.24, 0.24, 12), P.top, 0, 0.56, 0),
    part(Cone(0.31, 0.28, 12), P.bottom, 0, 0.42, 0),
    // 가슴 코어 장식
    part(S(0.075, 8, 6), P.acc, 0, 0.62, 0.23),
  ];

  // 등급 3 이상: 어깨 견장(Pauldrons) & 망토
  if (tier >= 3) {
    const pCol = tier >= 6 ? 0xffd43b : P.acc;
    bp.push(
      part(S(0.13, 10, 8), pCol, -0.28, 0.68, 0, 1.2, 0.85, 1.0),
      part(S(0.13, 10, 8), pCol, 0.28, 0.68, 0, 1.2, 0.85, 1.0)
    );
    // 등 뒤 망토
    bp.push(part(Cone(0.34, 0.62, 8), P.top, 0, 0.44, -0.18, 1.1, 1, 0.45, 0.24, 0, 0));
  }

  const bodyMesh = new THREE.Mesh(mergeParts(bp), vcToon);
  bodyMesh.castShadow = true;
  addOutline(bodyMesh, 0.025);
  bob.add(bodyMesh);

  // 3) 치비 머리 + 헤어 + 모자/왕관 + 표정 패치
  const headG = new THREE.Group();
  headG.position.y = 1.12;
  bob.add(headG);

  const R = 0.44;
  const hp = [
    // 얼굴 피부 구체
    part(S(R, 20, 16), P.skin, 0, 0, 0, 1.05, 0.96, 1.0),
    // 기본 뒷머리 & 옆머리
    part(
      new THREE.SphereGeometry(R * 1.06, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      P.hair,
      0,
      0.03,
      -0.03,
      1.06,
      1,
      1,
      -0.32
    ),
    part(Cap(0.09, 0.28, 8), P.hair, -0.38, -0.08, 0.12, 1, 1, 0.8, 0, 0, 0.15),
    part(Cap(0.09, 0.28, 8), P.hair, 0.38, -0.08, 0.12, 1, 1, 0.8, 0, 0, -0.15),
  ];
  // 앞머리 뱅
  for (let k = -2; k <= 2; k++) {
    hp.push(part(S(0.095, 8, 6), P.hair, k * 0.11, 0.26, 0.32, 1, 0.7, 0.6));
  }

  // 모자 / 헬멧 / 왕관 스타일 분기
  if (P.hat === 'visor' || P.hat === 'visor_heavy') {
    hp.push(part(Box(0.68, 0.14, 0.18), P.acc, 0, 0.14, 0.38));
  } else if (P.hat === 'beret') {
    hp.push(part(S(0.38, 14, 10), P.top, 0.08, 0.36, 0, 1.2, 0.45, 1.15, 0, 0, -0.22));
  } else if (P.hat === 'headset') {
    hp.push(
      part(Tor(0.46, 0.04, 16, Math.PI), P.acc, 0, 0.04, 0),
      part(Cyl(0.12, 0.12, 0.1, 10), P.acc, -0.46, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2),
      part(Cyl(0.12, 0.12, 0.1, 10), P.acc, 0.46, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2)
    );
  } else if (P.hat === 'helmet') {
    hp.push(
      part(
        new THREE.SphereGeometry(R * 1.13, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
        P.top,
        0,
        0.06,
        0,
        1.06,
        1,
        1.06,
        -0.12
      ),
      part(Box(0.54, 0.08, 0.16), P.acc, 0, 0.22, 0.42)
    );
  } else if (P.hat === 'wizard') {
    hp.push(
      part(Cyl(0.62, 0.62, 0.05, 16), P.top, 0, 0.34, 0),
      part(Cone(0.36, 0.65, 12), P.top, 0, 0.66, -0.05, 1, 1, 1, -0.18),
      part(Tor(0.32, 0.04, 12), P.acc, 0, 0.38, 0, 1, 1, 1, Math.PI / 2)
    );
  } else if (P.hat === 'circlet' || P.hat === 'crown' || P.hat === 'myth_crown' || P.hat === 'primordial') {
    const crownCol = tier >= 5 ? 0xffd43b : P.acc;
    hp.push(part(Tor(0.34, 0.04, 16), crownCol, 0, 0.38, 0.04, 1, 1, 1, Math.PI / 2));
    const spikes = tier >= 6 ? 5 : 3;
    for (let i = 0; i < spikes; i++) {
      const a = ((i - (spikes - 1) / 2) * 0.42);
      hp.push(
        part(
          Cone(0.065, 0.2 + (i === Math.floor(spikes / 2) ? 0.09 : 0), 6),
          crownCol,
          Math.sin(a) * 0.32,
          0.48,
          Math.cos(a) * 0.32 + 0.04
        )
      );
    }
  } else if (P.hat === 'horns') {
    for (const sx of [-1, 1]) {
      hp.push(
        part(Cone(0.09, 0.38, 8), P.acc, sx * 0.34, 0.42, 0.05, 1, 1, 1, -0.2, 0, -sx * 0.45)
      );
    }
  }

  const headMesh = new THREE.Mesh(mergeParts(hp), vcToon);
  headMesh.castShadow = true;
  addOutline(headMesh, 0.025);
  headG.add(headMesh);

  // 얼굴 표정 곡면 패치
  const faceGeo = new THREE.SphereGeometry(
    R * 1.015,
    18,
    12,
    Math.PI / 2 - 0.78,
    1.56,
    Math.PI / 2 - 0.58,
    1.16
  );
  faceGeo.scale(1.05, 0.96, 1.0);
  const fTex = getFaceTex().clone();
  fTex.needsUpdate = true;
  const defaultFace = tier >= 7 ? FACE.awaken : tier >= 5 ? FACE.star : FACE.normal;
  fTex.offset.x = defaultFace / NF;
  const faceMesh = new THREE.Mesh(
    faceGeo,
    new THREE.MeshBasicMaterial({ map: fTex, transparent: true, depthWrite: false })
  );
  headG.add(faceMesh);

  // 4) 고등급(5~7등급) 날개 & 신화/태초 헤일로(광륜)
  const wings = [];
  if (tier >= 5) {
    const wGeo = getWingGeo();
    const wMat = glow(tier >= 7 ? 0x00f5d4 : tier === 6 ? 0xff2957 : P.acc, tier >= 6 ? 2.0 : 1.3);
    const pairCount = tier >= 7 ? 3 : tier === 6 ? 2 : 1;
    for (let p = 0; p < pairCount; p++) {
      for (const sx of [-1, 1]) {
        const wm = new THREE.Mesh(wGeo, wMat);
        wm.scale.set(sx * (1.05 - p * 0.12), 1.0 - p * 0.1, 1);
        wm.position.set(sx * 0.14, 0.72 - p * 0.16, -0.22);
        wm.rotation.y = -sx * 0.35;
        wm.rotation.z = sx * (0.28 - p * 0.24);
        bob.add(wm);
        wings.push({ m: wm, sx, p });
      }
    }
  }

  let halo = null;
  if (tier >= 6) {
    halo = new THREE.Group();
    halo.position.set(0, 1.55, -0.28);
    const hCol = tier >= 7 ? 0xffd43b : 0xff2957;
    const hRing = new THREE.Mesh(Tor(0.56, 0.035, 24), glow(hCol, 2.4));
    halo.add(hRing);
    if (tier >= 7) {
      const hRing2 = new THREE.Mesh(Tor(0.76, 0.025, 24), glow(0x00f5d4, 2.5));
      halo.add(hRing2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const ray = new THREE.Mesh(Cone(0.045, 0.24, 4), glow(0xffd43b, 2.4));
        ray.position.set(Math.cos(a) * 0.86, Math.sin(a) * 0.86, 0);
        ray.rotation.z = a - Math.PI / 2;
        halo.add(ray);
      }
    }
    bob.add(halo);
  }

  // 5) 공격 성향(계열) × 등급별 3D 무기 조형 및 발사구(muzzle)
  const weaponG = new THREE.Group();
  weaponG.position.set(0, 0.65, 0);
  bob.add(weaponG);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 0.9);
  weaponG.add(muzzle);

  const drones = [];
  const metalM = toon(0x334155);
  const goldM = toon(0xffd43b);
  const glowAcc = glow(P.acc, 1.9);

  if (def.type === 'striker') {
    // ⚡ 속사·진동계: 쌍권총 -> 개틀링 -> 레일건 -> 궤도 위성 레이저 포드
    const gGeo = getGunGeo();
    if (tier <= 2) {
      for (const sx of tier === 2 ? [-0.36, 0.36] : [0.34]) {
        const gm = mk(gGeo, toon(P.top), sx, 0, 0.35, weaponG, 0.02);
        mk(Cyl(0.035, 0.035, 0.28, 8).rotateX(Math.PI / 2), glowAcc, sx, 0.04, 0.62, weaponG, 0);
        gm.scale.setScalar(1.05);
      }
    } else if (tier <= 4) {
      // 다연장 개틀링 / 발키리 레일건
      const body = mk(
        new RoundedBoxGeometry(0.24, 0.22, 0.72, 2, 0.04),
        tier === 4 ? goldM : metalM,
        0.38,
        -0.04,
        0.38,
        weaponG,
        0.02
      );
      for (let b = 0; b < 4; b++) {
        const a = (b / 4) * Math.PI * 2;
        mk(
          Cyl(0.028, 0.028, 0.55, 6).rotateX(Math.PI / 2),
          glowAcc,
          0.38 + Math.cos(a) * 0.055,
          -0.04 + Math.sin(a) * 0.055,
          0.78,
          weaponG,
          0.015
        );
      }
      body.castShadow = true;
    } else {
      // 5~7등급: 양손 블래스터 + 공중 부유 궤도 위성 드론
      for (const sx of [-0.38, 0.38]) {
        mk(gGeo, goldM, sx, 0, 0.38, weaponG, 0.02);
        mk(Cyl(0.04, 0.04, 0.42, 8).rotateX(Math.PI / 2), glowAcc, sx, 0.04, 0.72, weaponG, 0);
      }
      const dCount = tier >= 7 ? 4 : 2;
      for (let d = 0; d < dCount; d++) {
        const dg = new THREE.Group();
        mk(new THREE.OctahedronGeometry(0.16, 0), glowAcc, 0, 0, 0, dg, 0.02);
        mk(Cyl(0.035, 0.05, 0.36, 8).rotateX(Math.PI / 2), goldM, 0, 0, 0.2, dg, 0.015);
        bob.add(dg);
        drones.push({ g: dg, phase: (d / dCount) * Math.PI * 2, r: 0.78 + (d % 2) * 0.18 });
      }
    }
    muzzle.position.set(0.32, 0.04, 0.92);
  } else if (def.type === 'destroyer') {
    // 💥 중포·폭발계: 박격포 -> 중캐논 -> 쌍열 공성포 -> 오메가 핵융합 중포
    const barrelCount = tier >= 4 ? 2 : 1;
    const offsets = barrelCount === 2 ? [-0.42, 0.42] : [0.42];
    const rTube = 0.11 + tier * 0.014;
    const len = 0.68 + tier * 0.06;
    for (const bx of offsets) {
      const housing = mk(
        new RoundedBoxGeometry(rTube * 2.3, rTube * 2.3, len * 0.65, 2, 0.04),
        toon(P.top),
        bx,
        0.06,
        0.25,
        weaponG,
        0.025
      );
      const barrel = mk(
        Cyl(rTube * 0.88, rTube * 1.05, len, 12).rotateX(Math.PI / 2),
        metalM,
        bx,
        0.08,
        0.25 + len * 0.45,
        weaponG,
        0.025
      );
      mk(
        Tor(rTube * 1.02, 0.035, 12),
        tier >= 5 ? goldM : glowAcc,
        bx,
        0.08,
        0.25 + len * 0.88,
        weaponG,
        0.015
      );
      housing.castShadow = barrel.castShadow = true;
    }
    if (tier >= 6) {
      // 등 뒤 핵융합 에너지 코어 구체
      const core = mk(S(0.24, 12, 10), glow(0xff9e00, 2.4), 0, 0.45, -0.35, weaponG, 0.02);
      drones.push({ g: core, isCore: true });
    }
    muzzle.position.set(offsets[0], 0.1, 1.05);
  } else {
    // 🔮 마도·관통계: 크리스탈 스태프 + 회전 원소 오브 + 아카식 모놀리스
    const staff = new THREE.Group();
    staff.position.set(0.42, 0.05, 0.25);
    weaponG.add(staff);
    mk(Cyl(0.032, 0.038, 1.15, 8), tier >= 5 ? goldM : toon(0x4a2574), 0, 0.2, 0, staff, 0.02);
    mk(Tor(0.18, 0.03, 14), tier >= 4 ? goldM : glowAcc, 0, 0.82, 0, staff, 0.015);
    const tipGem = mk(new THREE.OctahedronGeometry(0.13 + tier * 0.012, 0), glowAcc, 0, 0.82, 0, staff, 0.02);
    drones.push({ g: tipGem, isGem: true });

    const orbCount = Math.min(6, tier);
    for (let i = 0; i < orbCount; i++) {
      const og = mk(
        new THREE.OctahedronGeometry(0.09 + (tier >= 6 ? 0.03 : 0), 0),
        glow(i % 2 === 0 ? P.acc : typeInfo.subHex, 2.2),
        0,
        0,
        0,
        bob,
        0.015
      );
      drones.push({ g: og, phase: (i / orbCount) * Math.PI * 2, r: 0.65 + (tier >= 6 ? 0.18 : 0) });
    }
    muzzle.position.set(0.42, 0.85, 0.35);
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
 * 매 프레임 유닛의 호흡, 눈 깜빡임, 무기 반동, 룬 회전, 부유 드론 및 타겟 지향 회전 업데이트
 */
export function updateUnitVisual(u, dt) {
  const V = u.visual;
  if (!V) return;

  // 보드 좌표 부드럽게 이동 (드래그/스왑 시 자연스러운 슬라이딩)
  u.x += (u.targetX - u.x) * Math.min(1, dt * 16);
  u.z += (u.targetZ - u.z) * Math.min(1, dt * 16);

  // 소환/조합 시 점프 바운스
  if (u.spawnBounce > 0) {
    u.spawnBounce = Math.max(0, u.spawnBounce - dt * 3.2);
  }
  const jumpY = Math.sin(u.spawnBounce * Math.PI) * 0.85;
  V.root.position.set(u.x, BOARD.boardY + 0.11 + jumpY, u.z);

  // 타겟 방향 부드러운 회전
  if (u.aimYaw != null) {
    let diff = u.aimYaw - V.inner.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    V.inner.rotation.y += diff * Math.min(1, dt * 14);
  }

  // 호흡 바운스 & 무기 발사 반동 복원
  const phase = u.uid * 1.3 + performance.now() * 0.0035;
  V.bob.position.y = V.baseBobY + Math.sin(phase) * (u.tier >= 7 ? 0.07 : 0.035);
  u.recoil = Math.max(0, (u.recoil || 0) - dt * 6.5);
  V.weaponG.position.z = -u.recoil * 0.22;
  V.weaponG.rotation.x = -u.recoil * 0.35;

  // 눈 깜빡임 및 공격 집중 표정 제어
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

  // 바닥 마법진 & 헤일로 & 날개 & 부유 오브 애니메이션
  if (V.rune1) V.rune1.rotation.z += dt * (u.tier >= 7 ? 1.4 : 0.85);
  if (V.rune2) V.rune2.rotation.z -= dt * 1.8;
  if (V.halo) V.halo.rotation.z += dt * 1.1;

  for (const w of V.wings) {
    const flap = Math.sin(phase * 1.8 + w.p * 0.7) * 0.14;
    w.m.rotation.y = -w.sx * (0.35 + flap);
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
