/**
 * src/render/monsters3d.js — 절차적 3D 몬스터 13종 고밀도 모델링 & 보행/비행 애니메이션
 * - 슬라임(왕관/코어), 늑대(주둥이/꼬리/갈기), 정찰병(쌍단검/두건), 흑철기사(투구깃털/대방패/검)
 * - 공허망령(사신낫/유령자락), 암석골렘(어깨크리스탈/룬코어), 드레이크(드래곤날개/꼬리/뿔), 보스(마왕날개/대검/광륜)
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MONSTER_ARCHETYPES } from '../data/waves.js';
import { camera } from './scene.js';
import { glow, mk, toon } from './toon.js';

const S = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const Cyl = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s);

export function buildMonsterMesh(spec) {
  const arch = MONSTER_ARCHETYPES[spec.archKey] || MONSTER_ARCHETYPES.slime;
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);

  const sc = arch.scale * 0.80;
  inner.scale.setScalar(sc);

  const mainM = toon(arch.color);
  const lightM = toon(new THREE.Color(arch.color).lerp(new THREE.Color(0xffffff), 0.38).getHex());
  const darkM = toon(new THREE.Color(arch.color).multiplyScalar(0.45).getHex());
  const eyeM = glow(arch.eye || 0xffe066, 2.2);
  const legs = [];
  const wings = [];
  let tail = null;

  if (arch.kind === 'slime') {
    const body = mk(S(0.56, 18, 12), mainM, 0, 0.44, 0, inner, 0.03);
    body.scale.set(1.15, 0.84, 1.10);
    // 볼터치 & 큰 눈 & 머리 위 슬라임 안테나 방울
    for (const sx of [-0.18, 0.18]) {
      mk(S(0.085, 8, 6), eyeM, sx, 0.54, 0.48, inner, 0);
      mk(S(0.06, 6, 6), glow(0xff6b8b, 1.5), sx * 1.6, 0.44, 0.45, inner, 0);
    }
    mk(Cyl(0.035, 0.05, 0.25, 6), mainM, 0, 0.92, 0, inner, 0.02);
    mk(S(0.11, 10, 8), glow(0xffffff, 1.8), 0, 1.08, 0, inner, 0.02);
  } else if (arch.kind === 'wolf') {
    const body = mk(S(0.38, 14, 10), mainM, 0, 0.56, 0, inner, 0.028);
    body.scale.set(0.95, 0.85, 1.6);
    mk(S(0.32, 12, 10), lightM, 0, 0.62, 0.32, inner, 0.025); // 가슴털
    const head = mk(S(0.27, 12, 10), mainM, 0, 0.82, 0.52, inner, 0.025);
    head.scale.set(1, 0.92, 1.15);
    // 주둥이 & 코
    mk(S(0.14, 10, 8), lightM, 0, 0.76, 0.76, inner, 0.02).scale.set(0.9, 0.75, 1.4);
    mk(S(0.055, 8, 6), darkM, 0, 0.80, 0.94, inner, 0);
    for (const sx of [-0.14, 0.14]) {
      mk(Cone(0.09, 0.26, 6), darkM, sx, 1.08, 0.46, inner, 0.02);
      mk(S(0.055, 8, 6), eyeM, sx * 0.85, 0.86, 0.72, inner, 0);
    }
    // 등 갈기 & 꼬리
    for (let k = 0; k < 3; k++) {
      mk(Cone(0.07, 0.24, 5), lightM, 0, 0.92 - k * 0.04, 0.22 - k * 0.22, inner, 0.015).rotation.x = -0.45;
    }
    tail = mk(Cone(0.11, 0.52, 8), mainM, 0, 0.68, -0.68, inner, 0.02);
    tail.rotation.x = -Math.PI / 2 - 0.4;
    for (const [lx, lz] of [
      [-0.18, 0.34],
      [0.18, 0.34],
      [-0.18, -0.34],
      [0.18, -0.34],
    ]) {
      legs.push(mk(Cyl(0.065, 0.05, 0.44, 8), darkM, lx, 0.24, lz, inner, 0.02));
    }
  } else if (arch.kind === 'goblin') {
    mk(Cyl(0.24, 0.30, 0.52, 10), darkM, 0, 0.46, 0, inner, 0.025);
    mk(Cone(0.34, 0.55, 8), toon(0x3b0764), 0, 0.48, -0.14, inner, 0.02).rotation.x = 0.25;
    mk(S(0.33, 14, 10), mainM, 0, 0.92, 0.04, inner, 0.025);
    for (const sx of [-1, 1]) {
      const ear = mk(Cone(0.095, 0.38, 6), mainM, sx * 0.38, 0.94, 0, inner, 0.02);
      ear.rotation.z = -sx * 1.15;
      mk(S(0.06, 8, 6), eyeM, sx * 0.13, 0.94, 0.30, inner, 0);
      // 양손 쌍단검
      const dag = mk(Cone(0.055, 0.42, 4), glow(0x38bdf8, 1.6), sx * 0.34, 0.52, 0.28, inner, 0.018);
      dag.rotation.x = Math.PI / 2;
      legs.push(mk(Cyl(0.075, 0.06, 0.36, 8), darkM, sx * 0.13, 0.18, 0, inner, 0.02));
    }
  } else if (arch.kind === 'knight') {
    mk(new RoundedBoxGeometry(0.58, 0.66, 0.44, 2, 0.06), mainM, 0, 0.64, 0, inner, 0.03);
    // 어깨 갑옷
    for (const sx of [-0.36, 0.36]) {
      mk(S(0.16, 10, 8), lightM, sx, 0.88, 0, inner, 0.025);
    }
    mk(Cyl(0.27, 0.29, 0.40, 12), darkM, 0, 1.16, 0, inner, 0.025);
    mk(Box(0.40, 0.085, 0.14), eyeM, 0, 1.17, 0.25, inner, 0);
    // 투구 붉은 깃털 장식
    mk(Cone(0.14, 0.42, 8), glow(0xff4d6d, 1.5), 0, 1.50, -0.06, inner, 0.02).rotation.x = -0.3;
    // 왼손 대형 실드 & 오른손 광선검
    mk(new RoundedBoxGeometry(0.12, 0.64, 0.50, 2, 0.04), lightM, -0.40, 0.64, 0.14, inner, 0.025);
    mk(Box(0.09, 0.78, 0.14), glow(0x38bdf8, 1.8), 0.40, 0.80, 0.28, inner, 0.02);
    for (const sx of [-0.15, 0.15]) {
      legs.push(mk(Cyl(0.095, 0.085, 0.40, 8), darkM, sx, 0.20, 0, inner, 0.02));
    }
  } else if (arch.kind === 'wraith') {
    const robe = mk(Cone(0.54, 1.28, 12), mainM, 0, 0.74, 0, inner, 0.03);
    robe.scale.z = 0.88;
    mk(S(0.30, 12, 10), darkM, 0, 1.30, 0.06, inner, 0.025);
    // 사신 후드 뿔 & 눈
    mk(Cone(0.34, 0.42, 8), mainM, 0, 1.54, -0.04, inner, 0.025).rotation.x = -0.25;
    for (const sx of [-0.11, 0.11]) {
      mk(S(0.06, 8, 6), eyeM, sx, 1.30, 0.32, inner, 0);
    }
    // 사신의 거대 낫 (Scythe)
    const pole = mk(Cyl(0.03, 0.03, 1.45, 8), darkM, 0.44, 0.85, 0.18, inner, 0.02);
    pole.rotation.z = -0.15;
    const blade = mk(Cone(0.14, 0.68, 4), glow(0x66d9e8, 2.0), 0.22, 1.48, 0.28, inner, 0.02);
    blade.rotation.z = Math.PI / 2 + 0.25;
  } else if (arch.kind === 'golem') {
    mk(new RoundedBoxGeometry(0.86, 0.86, 0.66, 2, 0.1), mainM, 0, 0.80, 0, inner, 0.035);
    // 가슴 룬 코어 & 어깨 솟아오른 마력 수정
    mk(new THREE.OctahedronGeometry(0.22, 0), eyeM, 0, 0.84, 0.32, inner, 0.02);
    mk(new RoundedBoxGeometry(0.48, 0.40, 0.44, 2, 0.06), darkM, 0, 1.36, 0.08, inner, 0.03);
    mk(Box(0.34, 0.095, 0.12), eyeM, 0, 1.38, 0.29, inner, 0);
    for (const sx of [-1, 1]) {
      mk(new THREE.OctahedronGeometry(0.22, 0), glow(0xff922b, 1.8), sx * 0.48, 1.28, 0, inner, 0.02).scale.y = 1.6;
      mk(new RoundedBoxGeometry(0.30, 0.72, 0.30, 2, 0.06), darkM, sx * 0.60, 0.74, 0.08, inner, 0.03);
      legs.push(mk(new RoundedBoxGeometry(0.28, 0.46, 0.30, 2, 0.05), darkM, sx * 0.25, 0.24, 0, inner, 0.025));
    }
  } else if (arch.kind === 'drake') {
    const body = mk(S(0.52, 14, 10), mainM, 0, 0.70, 0, inner, 0.03);
    body.scale.set(0.98, 0.92, 1.50);
    mk(S(0.36, 12, 10), lightM, 0, 0.68, 0.38, inner, 0.02);
    mk(S(0.34, 12, 10), mainM, 0, 1.12, 0.56, inner, 0.025);
    tail = mk(Cone(0.18, 0.75, 8), mainM, 0, 0.62, -0.78, inner, 0.025);
    tail.rotation.x = -Math.PI / 2 - 0.2;
    for (const sx of [-1, 1]) {
      mk(Cone(0.085, 0.36, 6), glow(0xffd43b, 1.6), sx * 0.22, 1.40, 0.44, inner, 0.02);
      mk(S(0.06, 8, 6), eyeM, sx * 0.15, 1.16, 0.82, inner, 0);
      const wg = mk(Box(0.88, 0.06, 0.52), glow(0xff922b, 1.5), sx * 0.64, 0.98, -0.05, inner, 0.022);
      wg.rotation.z = sx * 0.35;
      wings.push({ m: wg, sx });
      legs.push(mk(Cyl(0.11, 0.095, 0.44, 8), darkM, sx * 0.25, 0.22, 0.1, inner, 0.02));
    }
  } else {
    // 보스 & 현상금 보스: 거대 마왕 아머 + 마왕 날개 + 등 뒤 광륜 + 양손 마검
    mk(new RoundedBoxGeometry(0.95, 1.0, 0.70, 2, 0.1), mainM, 0, 0.90, 0, inner, 0.038);
    mk(new THREE.OctahedronGeometry(0.25, 0), eyeM, 0, 0.95, 0.36, inner, 0.02);
    mk(S(0.40, 14, 12), darkM, 0, 1.60, 0.06, inner, 0.03);
    for (const sx of [-1, 1]) {
      mk(S(0.075, 8, 6), eyeM, sx * 0.15, 1.62, 0.40, inner, 0);
      const horn = mk(Cone(0.12, 0.54, 8), glow(arch.crown || 0xffd43b, 2.1), sx * 0.38, 1.92, 0, inner, 0.025);
      horn.rotation.z = -sx * 0.45;
      mk(
        new RoundedBoxGeometry(0.40, 0.34, 0.44, 2, 0.06),
        glow(arch.crown || 0xffd43b, 1.5),
        sx * 0.68,
        1.28,
        0,
        inner,
        0.03
      );
      const wg = mk(Box(0.95, 0.07, 0.55), glow(arch.crown || 0xff2957, 1.8), sx * 0.72, 1.25, -0.28, inner, 0.025);
      wg.rotation.z = sx * 0.38;
      wings.push({ m: wg, sx });
      legs.push(mk(new RoundedBoxGeometry(0.30, 0.52, 0.34, 2, 0.05), darkM, sx * 0.27, 0.26, 0, inner, 0.03));
    }
    const bossHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.055, 8, 24),
      glow(arch.crown || 0xffd43b, 2.5)
    );
    bossHalo.position.set(0, 1.42, -0.44);
    inner.add(bossHalo);
    mk(Box(0.16, 1.48, 0.28), glow(arch.eye || 0x00f5d4, 2.4), 0.76, 1.20, 0.40, inner, 0.026);
  }

  // 둔화(Slow) 냉기 링 표시기
  const slowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.54, 0.68, 20),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })
  );
  slowRing.rotation.x = -Math.PI / 2;
  slowRing.position.y = 0.05;
  slowRing.visible = false;
  root.add(slowRing);

  // 빌보드 체력바 그룹
  const hpGroup = new THREE.Group();
  const barW = spec.isBoss || spec.isBounty ? 1.90 : 1.08;
  const barH = spec.isBoss || spec.isBounty ? 0.17 : 0.115;
  hpGroup.position.y = (spec.isBoss || spec.isBounty ? 2.55 : 1.62) * sc + 0.35;

  const bgBar = new THREE.Mesh(
    new THREE.PlaneGeometry(barW + 0.06, barH + 0.05),
    new THREE.MeshBasicMaterial({ color: 0x090d16, transparent: true, opacity: 0.85, depthTest: false })
  );
  bgBar.renderOrder = 10;
  hpGroup.add(bgBar);

  const fillGeo = new THREE.PlaneGeometry(barW, barH);
  fillGeo.translate(barW / 2, 0, 0);
  const fillCol = spec.isBoss ? 0xff2957 : spec.isBounty ? 0xffd43b : 0x22c55e;
  const fillBar = new THREE.Mesh(
    fillGeo,
    new THREE.MeshBasicMaterial({ color: fillCol, depthTest: false })
  );
  fillBar.position.x = -barW / 2;
  fillBar.renderOrder = 11;
  hpGroup.add(fillBar);
  root.add(hpGroup);

  return {
    root,
    inner,
    legs,
    wings,
    tail,
    slowRing,
    hpGroup,
    fillBar,
    sc,
    kind: arch.kind,
    phase: Math.random() * Math.PI * 2,
  };
}

export function updateMonsterVisual(e, dt) {
  const V = e.visual;
  if (!V) return;
  V.root.position.set(e.x, 0, e.z);

  let diff = e.yaw - V.inner.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  V.inner.rotation.y += diff * Math.min(1, dt * 12);

  V.phase += dt * e.curSpd * 3.2;
  const hop = Math.abs(Math.sin(V.phase));
  if (V.kind === 'slime') {
    V.inner.scale.set(
      V.sc * (1 + Math.sin(V.phase * 2) * 0.1),
      V.sc * (1 - Math.sin(V.phase * 2) * 0.12),
      V.sc * (1 + Math.sin(V.phase * 2) * 0.1)
    );
    V.inner.position.y = hop * 0.18;
  } else if (V.kind === 'wraith') {
    V.inner.position.y = 0.16 + Math.sin(V.phase) * 0.13;
  } else {
    V.inner.position.y = hop * 0.08;
    V.legs.forEach((lg, idx) => {
      lg.rotation.x = Math.sin(V.phase + (idx % 2 ? Math.PI : 0)) * 0.58;
    });
    V.wings.forEach((w) => {
      w.m.rotation.z = w.sx * (0.35 + Math.sin(V.phase * 1.6) * 0.26);
    });
    if (V.tail) {
      V.tail.rotation.y = Math.sin(V.phase * 1.5) * 0.35;
    }
  }

  V.slowRing.visible = e.slowT > 0;
  if (V.slowRing.visible) V.slowRing.rotation.z += dt * 2.5;

  const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
  V.fillBar.scale.x = Math.max(0.001, ratio);
  if (!e.isBoss && !e.isBounty) {
    V.fillBar.material.color.setHex(ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444);
  }
  V.hpGroup.quaternion.copy(camera.quaternion);
}
