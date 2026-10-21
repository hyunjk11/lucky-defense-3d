/**
 * src/render/monsters3d.js — 절차적 3D 몬스터(슬라임, 늑대, 정찰병, 기사, 망령, 골렘, 드레이크, 보스) 모델링 & 애니메이션
 * 빌보드 HP 바 및 디버프(둔화/방깎/받피증) 오라 표시 포함
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

  const sc = arch.scale * 0.78;
  inner.scale.setScalar(sc);

  const mainM = toon(arch.color);
  const darkM = toon(new THREE.Color(arch.color).multiplyScalar(0.45).getHex());
  const eyeM = glow(arch.eye || 0xffe066, 2.2);
  const legs = [];
  const wings = [];

  if (arch.kind === 'slime') {
    const body = mk(S(0.55, 16, 12), mainM, 0, 0.44, 0, inner, 0.03);
    body.scale.set(1.12, 0.82, 1.08);
    for (const sx of [-0.18, 0.18]) {
      mk(S(0.08, 8, 6), eyeM, sx, 0.52, 0.46, inner, 0);
    }
    mk(new THREE.OctahedronGeometry(0.18, 0), glow(0xffffff, 1.5), 0, 0.38, 0, inner, 0);
  } else if (arch.kind === 'wolf') {
    const body = mk(S(0.36, 14, 10), mainM, 0, 0.56, 0, inner, 0.028);
    body.scale.set(0.95, 0.85, 1.55);
    const head = mk(S(0.26, 12, 10), mainM, 0, 0.78, 0.48, inner, 0.025);
    head.scale.set(1, 0.9, 1.15);
    for (const sx of [-0.13, 0.13]) {
      mk(Cone(0.08, 0.24, 6), darkM, sx, 1.02, 0.44, inner, 0.02);
      mk(S(0.05, 8, 6), eyeM, sx * 0.85, 0.82, 0.68, inner, 0);
    }
    for (const [lx, lz] of [
      [-0.18, 0.3],
      [0.18, 0.3],
      [-0.18, -0.3],
      [0.18, -0.3],
    ]) {
      const lg = mk(Cyl(0.06, 0.05, 0.42, 8), darkM, lx, 0.24, lz, inner, 0.02);
      legs.push(lg);
    }
  } else if (arch.kind === 'goblin') {
    mk(Cyl(0.24, 0.28, 0.5, 10), darkM, 0, 0.45, 0, inner, 0.025);
    mk(S(0.32, 14, 10), mainM, 0, 0.9, 0, inner, 0.025);
    for (const sx of [-1, 1]) {
      const ear = mk(Cone(0.09, 0.34, 6), mainM, sx * 0.36, 0.92, 0, inner, 0.02);
      ear.rotation.z = -sx * 1.1;
      mk(S(0.055, 8, 6), eyeM, sx * 0.12, 0.92, 0.28, inner, 0);
      legs.push(mk(Cyl(0.07, 0.06, 0.35, 8), darkM, sx * 0.12, 0.18, 0, inner, 0.02));
    }
  } else if (arch.kind === 'knight') {
    mk(new RoundedBoxGeometry(0.56, 0.65, 0.42, 2, 0.06), mainM, 0, 0.62, 0, inner, 0.03);
    mk(Cyl(0.26, 0.28, 0.38, 12), darkM, 0, 1.14, 0, inner, 0.025);
    mk(Box(0.38, 0.08, 0.12), eyeM, 0, 1.15, 0.24, inner, 0);
    mk(Cone(0.12, 0.35, 8), glow(0xff6b6b, 1.4), 0, 1.45, -0.05, inner, 0.02);
    // 방패와 검
    mk(new RoundedBoxGeometry(0.1, 0.58, 0.46, 2, 0.03), mainM, -0.38, 0.62, 0.12, inner, 0.025);
    mk(Box(0.08, 0.68, 0.12), glow(0x74c0fc, 1.5), 0.38, 0.75, 0.25, inner, 0.02);
    for (const sx of [-0.15, 0.15]) {
      legs.push(mk(Cyl(0.09, 0.08, 0.38, 8), darkM, sx, 0.2, 0, inner, 0.02));
    }
  } else if (arch.kind === 'wraith') {
    const robe = mk(Cone(0.52, 1.25, 12), mainM, 0, 0.72, 0, inner, 0.03);
    robe.scale.z = 0.85;
    mk(S(0.28, 12, 10), darkM, 0, 1.28, 0.06, inner, 0.025);
    for (const sx of [-0.1, 0.1]) {
      mk(S(0.055, 8, 6), eyeM, sx, 1.28, 0.3, inner, 0);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 8, 20), glow(0x66d9e8, 2.0));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.35;
    inner.add(ring);
  } else if (arch.kind === 'golem') {
    mk(new RoundedBoxGeometry(0.82, 0.82, 0.62, 2, 0.1), mainM, 0, 0.78, 0, inner, 0.035);
    mk(new RoundedBoxGeometry(0.46, 0.38, 0.42, 2, 0.06), darkM, 0, 1.32, 0.08, inner, 0.03);
    mk(Box(0.32, 0.09, 0.1), eyeM, 0, 1.34, 0.28, inner, 0);
    for (const sx of [-1, 1]) {
      mk(new RoundedBoxGeometry(0.28, 0.68, 0.28, 2, 0.06), darkM, sx * 0.58, 0.72, 0.08, inner, 0.03);
      legs.push(mk(new RoundedBoxGeometry(0.26, 0.45, 0.28, 2, 0.05), darkM, sx * 0.24, 0.24, 0, inner, 0.025));
    }
  } else if (arch.kind === 'drake') {
    const body = mk(S(0.5, 14, 10), mainM, 0, 0.68, 0, inner, 0.03);
    body.scale.set(0.95, 0.9, 1.45);
    mk(S(0.32, 12, 10), mainM, 0, 1.08, 0.52, inner, 0.025);
    for (const sx of [-1, 1]) {
      mk(Cone(0.08, 0.32, 6), darkM, sx * 0.2, 1.34, 0.42, inner, 0.02);
      mk(S(0.055, 8, 6), eyeM, sx * 0.14, 1.12, 0.78, inner, 0);
      const wg = mk(Box(0.75, 0.05, 0.45), glow(0xff922b, 1.4), sx * 0.58, 0.95, -0.05, inner, 0.02);
      wg.rotation.z = sx * 0.35;
      wings.push({ m: wg, sx });
      legs.push(mk(Cyl(0.1, 0.09, 0.42, 8), darkM, sx * 0.24, 0.22, 0.1, inner, 0.02));
    }
  } else {
    // 보스 & 현상금 보스: 거대 마왕/타이탄 아머 + 왕관 + 등 뒤 에너지 링 + 양손 대검/철퇴
    mk(new RoundedBoxGeometry(0.92, 0.96, 0.68, 2, 0.1), mainM, 0, 0.88, 0, inner, 0.038);
    mk(S(0.38, 14, 12), darkM, 0, 1.56, 0.06, inner, 0.03);
    for (const sx of [-1, 1]) {
      mk(S(0.07, 8, 6), eyeM, sx * 0.14, 1.58, 0.38, inner, 0);
      const horn = mk(Cone(0.11, 0.48, 8), glow(arch.crown || 0xffd43b, 2.0), sx * 0.36, 1.85, 0, inner, 0.025);
      horn.rotation.z = -sx * 0.42;
      // 어깨 갑주
      mk(new RoundedBoxGeometry(0.38, 0.32, 0.42, 2, 0.06), glow(arch.crown || 0xffd43b, 1.4), sx * 0.65, 1.24, 0, inner, 0.03);
      legs.push(mk(new RoundedBoxGeometry(0.28, 0.5, 0.32, 2, 0.05), darkM, sx * 0.26, 0.26, 0, inner, 0.03));
    }
    // 등 뒤 보스 광륜
    const bossHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.05, 8, 24),
      glow(arch.crown || 0xffd43b, 2.4)
    );
    bossHalo.position.set(0, 1.35, -0.4);
    inner.add(bossHalo);
    // 오른손 대검
    mk(Box(0.14, 1.35, 0.24), glow(arch.eye || 0x00f5d4, 2.2), 0.72, 1.15, 0.38, inner, 0.025);
  }

  // 둔화(Slow) 냉기 링 표시기
  const slowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.66, 20),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
  );
  slowRing.rotation.x = -Math.PI / 2;
  slowRing.position.y = 0.05;
  slowRing.visible = false;
  root.add(slowRing);

  // 빌보드 체력바 그룹
  const hpGroup = new THREE.Group();
  const barW = spec.isBoss || spec.isBounty ? 1.85 : 1.05;
  const barH = spec.isBoss || spec.isBounty ? 0.16 : 0.11;
  hpGroup.position.y = (spec.isBoss || spec.isBounty ? 2.45 : 1.55) * sc + 0.35;

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

  // 이동 방향 회전
  let diff = e.yaw - V.inner.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  V.inner.rotation.y += diff * Math.min(1, dt * 12);

  // 보행 애니메이션
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
    V.inner.position.y = 0.15 + Math.sin(V.phase) * 0.12;
  } else {
    V.inner.position.y = hop * 0.08;
    V.legs.forEach((lg, idx) => {
      lg.rotation.x = Math.sin(V.phase + (idx % 2 ? Math.PI : 0)) * 0.55;
    });
    V.wings.forEach((w) => {
      w.m.rotation.z = w.sx * (0.35 + Math.sin(V.phase * 1.5) * 0.25);
    });
  }

  // 둔화 표시기
  V.slowRing.visible = e.slowT > 0;
  if (V.slowRing.visible) V.slowRing.rotation.z += dt * 2.5;

  // 체력바 비율 및 카메라 빌보드
  const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
  V.fillBar.scale.x = Math.max(0.001, ratio);
  if (!e.isBoss && !e.isBounty) {
    V.fillBar.material.color.setHex(ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444);
  }
  V.hpGroup.quaternion.copy(camera.quaternion);
}
