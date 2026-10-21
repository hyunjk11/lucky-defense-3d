/**
 * src/render/vfx.js — 3D 충격파 링, 소환 빛기둥, 레이저 빔, 연쇄 번개 아크, 3D 파편(InstancedMesh), 데미지 플로팅 텍스트
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { $, rnd } from '../core/util.js';
import { G } from '../core/state.js';
import { camera, scene } from './scene.js';
import { toon } from './toon.js';

// ==================== 1. 3D 튀는 파편 (InstancedMesh 풀) ====================
const DEB_MAX = 240;
let debIM = null;
const debState = {
  x: new Float32Array(DEB_MAX),
  y: new Float32Array(DEB_MAX),
  z: new Float32Array(DEB_MAX),
  vx: new Float32Array(DEB_MAX),
  vy: new Float32Array(DEB_MAX),
  vz: new Float32Array(DEB_MAX),
  rx: new Float32Array(DEB_MAX),
  ry: new Float32Array(DEB_MAX),
  life: new Float32Array(DEB_MAX),
  sz: new Float32Array(DEB_MAX),
  head: 0,
};
const _dummy = new THREE.Object3D();
const _tmpC = new THREE.Color();

export function initVfx() {
  if (debIM) return;
  const geo = new RoundedBoxGeometry(0.24, 0.24, 0.24, 1, 0.05);
  debIM = new THREE.InstancedMesh(geo, toon(0xffffff), DEB_MAX);
  debIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debIM.frustumCulled = false;
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < DEB_MAX; i++) {
    debIM.setMatrixAt(i, zeroM);
    debIM.setColorAt(i, _tmpC.setHex(0xffffff));
  }
  scene.add(debIM);
}

export function spawnDebris(x, y, z, count, hexColor, speed = 5.5) {
  if (!debIM) initVfx();
  _tmpC.setHex(hexColor);
  for (let k = 0; k < count; k++) {
    const i = debState.head;
    debState.head = (debState.head + 1) % DEB_MAX;
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(0.35, 1.0) * speed;
    debState.x[i] = x + rnd(-0.25, 0.25);
    debState.y[i] = y + rnd(0.05, 0.35);
    debState.z[i] = z + rnd(-0.25, 0.25);
    debState.vx[i] = Math.cos(a) * sp * 0.65;
    debState.vy[i] = rnd(0.55, 1.15) * speed;
    debState.vz[i] = Math.sin(a) * sp * 0.65;
    debState.rx[i] = rnd(0, 6.28);
    debState.ry[i] = rnd(0, 6.28);
    debState.life[i] = rnd(0.45, 0.85);
    debState.sz[i] = rnd(0.45, 1.05);
    debIM.setColorAt(i, _tmpC);
  }
  debIM.instanceColor.needsUpdate = true;
}

// ==================== 2. 3D 링 / 빛기둥 / 레이저 / 번개 이펙트 ====================
export function spawnRingFx(x, z, radius, hexColor, dur = 0.38, y = 0.18) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 1.0, 36),
    new THREE.MeshBasicMaterial({
      color: hexColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  scene.add(m);
  G.fxs.push({ kind: 'ring', m, t: 0, dur, r: radius });
}

export function spawnPillarFx(x, z, hexColor, scale = 1.0, dur = 0.65) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55 * scale, 0.85 * scale, 9.5, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: hexColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  m.position.set(x, 4.75, z);
  scene.add(m);
  G.fxs.push({ kind: 'pillar', m, t: 0, dur, sc: scale });
  spawnRingFx(x, z, 2.2 * scale, hexColor, dur * 0.8, 0.48);
}

export function spawnBeamFx(x1, y1, z1, x2, y2, z2, hexColor, thickness = 0.09, dur = 0.16) {
  const p1 = new THREE.Vector3(x1, y1, z1);
  const p2 = new THREE.Vector3(x2, y2, z2);
  const dist = p1.distanceTo(p2);
  const geo = new THREE.CylinderGeometry(thickness, thickness, dist, 8);
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  m.position.copy(p1).lerp(p2, 0.5);
  m.lookAt(p2);
  scene.add(m);
  G.fxs.push({ kind: 'fade', m, t: 0, dur });
}

export function spawnLightningFx(pointsList, hexColor = 0xc26eff, dur = 0.22) {
  for (let s = 0; s < pointsList.length - 1; s++) {
    const a = pointsList[s];
    const b = pointsList[s + 1];
    const segs = 6;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const k = i / segs;
      const jx = i > 0 && i < segs ? rnd(-0.28, 0.28) : 0;
      const jy = i > 0 && i < segs ? rnd(-0.18, 0.28) : 0;
      const jz = i > 0 && i < segs ? rnd(-0.28, 0.28) : 0;
      pts.push(
        new THREE.Vector3(
          a.x + (b.x - a.x) * k + jx,
          (a.y || 0.9) + ((b.y || 0.7) - (a.y || 0.9)) * k + jy,
          a.z + (b.z - a.z) * k + jz
        )
      );
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: hexColor,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(line);
    G.fxs.push({ kind: 'fade', m: line, t: 0, dur });
  }
}

export function updateVfx(dt) {
  // 1) 파편 업데이트
  if (debIM) {
    let dirty = false;
    for (let i = 0; i < DEB_MAX; i++) {
      if (debState.life[i] <= 0) continue;
      dirty = true;
      debState.life[i] -= dt;
      if (debState.life[i] <= 0) {
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        debIM.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      debState.vy[i] -= 20 * dt;
      debState.x[i] += debState.vx[i] * dt;
      debState.y[i] += debState.vy[i] * dt;
      debState.z[i] += debState.vz[i] * dt;
      if (debState.y[i] < 0.08) {
        debState.y[i] = 0.08;
        debState.vy[i] *= -0.35;
        debState.vx[i] *= 0.65;
        debState.vz[i] *= 0.65;
      }
      debState.rx[i] += dt * 7;
      const s = debState.sz[i] * Math.min(1, debState.life[i] * 3);
      _dummy.position.set(debState.x[i], debState.y[i], debState.z[i]);
      _dummy.rotation.set(debState.rx[i], debState.ry[i], 0);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      debIM.setMatrixAt(i, _dummy.matrix);
    }
    if (dirty) debIM.instanceMatrix.needsUpdate = true;
  }

  // 2) 링/빛기둥/빔 페이드 업데이트
  for (let i = G.fxs.length - 1; i >= 0; i--) {
    const f = G.fxs[i];
    f.t += dt;
    const k = f.t / f.dur;
    if (k >= 1) {
      scene.remove(f.m);
      if (f.m.geometry) f.m.geometry.dispose();
      if (f.m.material) f.m.material.dispose();
      G.fxs.splice(i, 1);
      continue;
    }
    if (f.kind === 'ring') {
      f.m.scale.setScalar(0.25 + k * f.r);
      f.m.material.opacity = (1 - k) * 0.9;
    } else if (f.kind === 'pillar') {
      const w = (1 - k * 0.65) * f.sc;
      f.m.scale.set(w, 1, w);
      f.m.material.opacity = (1 - k) * 0.85;
    } else {
      f.m.material.opacity = (1 - k) * 0.95;
    }
  }
}

// ==================== 3. 화면 좌표 투영 플로팅 데미지 텍스트 ====================
const _projV = new THREE.Vector3();
let _activeDmgNodes = 0;

export function spawnDmgText(x, y, z, text, color = '#ffffff', isBig = false) {
  if (typeof document === 'undefined' || _activeDmgNodes > 48) return;
  const layer = $('fxLayer');
  if (!layer) return;
  _projV.set(x, y, z).project(camera);
  if (_projV.z > 1) return;
  const sx = (_projV.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-_projV.y * 0.5 + 0.5) * window.innerHeight;

  _activeDmgNodes++;
  const el = document.createElement('div');
  el.className = 'dmg-txt' + (isBig ? ' big' : '');
  el.textContent = typeof text === 'number' ? Math.round(text).toLocaleString() : text;
  el.style.left = `${sx + rnd(-14, 14)}px`;
  el.style.top = `${sy - 16}px`;
  el.style.color = color;
  layer.appendChild(el);
  setTimeout(() => {
    el.remove();
    _activeDmgNodes--;
  }, 720);
}
