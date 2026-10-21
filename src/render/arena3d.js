/**
 * src/render/arena3d.js — 중앙 6×6 전술 타일 보드, 외곽 순환 트랙, 차원 포털 및 배경 InstancedMesh 환경 생성
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOARD, WAYPOINTS } from '../data/config.js';
import { TIERS, TYPES } from '../data/units.js';
import { G, tileToWorld, unitAt } from '../core/state.js';
import { mulberry32 } from '../core/util.js';
import { scene } from './scene.js';
import { canvasTexture, glow, mk, toon } from './toon.js';

export const tileMeshes = []; // 36개 타일 메쉬 (레이캐스팅 및 하이라이트용)
export let rangeRing = null;
export let selectRing = null;
export let hoverBox = null;
let portalVortex = null;
let portalRingOuter = null;
let trackTex = null;
const pylons = [];
const combineIndicators = [];

export function buildArena() {
  const root = new THREE.Group();
  scene.add(root);

  // 1. 심연 바닥 그리드 평면
  const floorTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#090d1a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(139, 92, 246, 0.06)';
    ctx.fillRect(8, 8, w - 16, h - 16);
  }, true);
  floorTex.repeat.set(40, 40);
  const abyss = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshBasicMaterial({ map: floorTex })
  );
  abyss.rotation.x = -Math.PI / 2;
  abyss.position.y = -0.6;
  root.add(abyss);

  // 2. 외곽 사각 순환 트랙 (몬스터 이동 통로)
  const R = BOARD.trackRadius;
  const W = BOARD.trackWidth;
  trackTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#141b2d';
    ctx.fillRect(0, 0, w, h);
    // 트랙 노이즈
    const rnd = mulberry32(17);
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.18)';
      ctx.fillRect(rnd() * w, rnd() * h, 3, 3);
    }
    // 가장자리 네온 라인
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(4, 0, 6, h);
    ctx.fillRect(w - 10, 0, 6, h);
    // 진행 방향 셰브론(화살표)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.65);
    ctx.lineTo(w * 0.5, h * 0.35);
    ctx.lineTo(w * 0.72, h * 0.65);
    ctx.stroke();
  }, true);
  trackTex.repeat.set(1, 8);

  const trackMat = new THREE.MeshLambertMaterial({ map: trackTex });
  const sideLen = R * 2 + W;
  // 좌(x=-R, +Z 진행), 하(z=+R, +X 진행), 우(x=+R, -Z 진행), 상(z=-R, -X 진행)
  const segments = [
    { x: -R, z: 0, rotY: 0 },
    { x: 0, z: R, rotY: Math.PI / 2 },
    { x: R, z: 0, rotY: Math.PI },
    { x: 0, z: -R, rotY: -Math.PI / 2 },
  ];
  segments.forEach((s) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, 0.24, sideLen), trackMat);
    m.position.set(s.x, -0.12, s.z);
    m.rotation.y = s.rotY;
    m.receiveShadow = true;
    root.add(m);
  });

  // 4개 코너 에너지 파일런(기둥) + 부유 크리스탈
  const pylonBaseGeo = new THREE.CylinderGeometry(0.65, 0.85, 0.8, 8);
  const pylonGemGeo = new THREE.OctahedronGeometry(0.42, 0);
  const pylonMat = toon(0x253048);
  WAYPOINTS.forEach((wp, idx) => {
    const ox = Math.sign(wp.x) * (R + W * 0.68);
    const oz = Math.sign(wp.z) * (R + W * 0.68);
    const pg = new THREE.Group();
    pg.position.set(ox, 0, oz);
    mk(pylonBaseGeo, pylonMat, 0, 0.4, 0, pg, 0.03);
    const gemColor = idx === 0 ? 0xc084fc : 0x38bdf8;
    const gem = mk(pylonGemGeo, glow(gemColor, 1.8), 0, 1.45, 0, pg, 0.02);
    gem.scale.y = 1.45;
    pylons.push(gem);
    root.add(pg);
  });

  // 3. 차원 균열 포털 (좌상단 웨이포인트 0번)
  const portalGroup = new THREE.Group();
  portalGroup.position.set(WAYPOINTS[0].x, 0.1, WAYPOINTS[0].z);
  portalGroup.rotation.y = 0; // +Z 방향을 바라봄
  const archMat = toon(0x312e81);
  for (const sx of [-1, 1]) {
    mk(new RoundedBoxGeometry(0.42, 2.5, 0.42, 2, 0.08), archMat, sx * 1.15, 1.25, 0, portalGroup, 0.03);
  }
  mk(new RoundedBoxGeometry(2.8, 0.45, 0.5, 2, 0.08), archMat, 0, 2.55, 0, portalGroup, 0.03);

  portalVortex = new THREE.Mesh(
    new THREE.CircleGeometry(1.02, 24),
    new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    })
  );
  portalVortex.position.set(0, 1.35, 0);
  portalGroup.add(portalVortex);

  portalRingOuter = new THREE.Mesh(
    new THREE.TorusGeometry(1.08, 0.08, 8, 28),
    glow(0x38bdf8, 2.2)
  );
  portalRingOuter.position.set(0, 1.35, 0);
  portalGroup.add(portalRingOuter);
  root.add(portalGroup);

  // 4. 중앙 6×6 전술 보드 성채 플랫폼
  const boardSpan = BOARD.cols * BOARD.tileSize + 0.7;
  const pedestal = mk(
    new RoundedBoxGeometry(boardSpan, 0.55, boardSpan, 3, 0.14),
    toon(0x1e293b),
    0,
    0.05,
    0,
    root,
    0.035
  );
  pedestal.receiveShadow = true;

  // 보드 테두리 황금/시안 룬 프레임
  const frameRing = new THREE.Mesh(
    new RoundedBoxGeometry(boardSpan + 0.18, 0.14, boardSpan + 0.18, 2, 0.05),
    glow(0x38bdf8, 1.1)
  );
  frameRing.position.set(0, 0.22, 0);
  root.add(frameRing);

  const tileGeo = new RoundedBoxGeometry(BOARD.tileSize - 0.12, 0.22, BOARD.tileSize - 0.12, 2, 0.06);
  const matLight = toon(0x334155);
  const matDark = toon(0x263244);

  tileMeshes.length = 0;
  for (let r = 0; r < BOARD.rows; r++) {
    for (let c = 0; c < BOARD.cols; c++) {
      const { x, z } = tileToWorld(c, r);
      const isEven = (c + r) % 2 === 0;
      const tm = new THREE.Mesh(tileGeo, (isEven ? matLight : matDark).clone());
      tm.position.set(x, BOARD.boardY, z);
      tm.receiveShadow = true;
      tm.userData = { isTile: true, col: c, row: r, baseHex: isEven ? 0x334155 : 0x263244 };
      root.add(tm);
      tileMeshes.push(tm);
    }
  }

  // 5. 선택 링, 사거리 링, 호버 타일 박스, 조합 가능 표시 링
  rangeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.97, 1.0, 64),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  rangeRing.rotation.x = -Math.PI / 2;
  rangeRing.position.y = BOARD.boardY + 0.15;
  rangeRing.visible = false;
  root.add(rangeRing);

  selectRing = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.84, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffd43b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );
  selectRing.rotation.x = -Math.PI / 2;
  selectRing.position.y = BOARD.boardY + 0.14;
  selectRing.visible = false;
  root.add(selectRing);

  hoverBox = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.88, 4),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  hoverBox.rotation.x = -Math.PI / 2;
  hoverBox.rotation.z = Math.PI / 4;
  hoverBox.position.y = BOARD.boardY + 0.14;
  hoverBox.visible = false;
  root.add(hoverBox);

  // 조합 가능 쌍 표시 링 풀 (최대 18개)
  for (let i = 0; i < 18; i++) {
    const cr = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.86, 24),
      new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      })
    );
    cr.rotation.x = -Math.PI / 2;
    cr.position.y = BOARD.boardY + 0.13;
    cr.visible = false;
    root.add(cr);
    combineIndicators.push(cr);
  }

  // 6. 외곽 배경 크리스탈 & 바위 (InstancedMesh로 1 Draw Call 최적화)
  buildBackdropProps(root);
}

function buildBackdropProps(root) {
  const rnd = mulberry32(2026);
  const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);
  const crysGeo = new THREE.OctahedronGeometry(0.9, 0);
  crysGeo.scale(0.7, 2.2, 0.7);

  const rockCount = 48;
  const crysCount = 32;
  const rockIM = new THREE.InstancedMesh(rockGeo, toon(0x1e293b), rockCount);
  const crysIM = new THREE.InstancedMesh(crysGeo, glow(0x6366f1, 1.2), crysCount);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  for (let i = 0; i < rockCount; i++) {
    const a = (i / rockCount) * Math.PI * 2 + rnd() * 0.12;
    const dist = 13.5 + rnd() * 14;
    const s = 0.7 + rnd() * 1.4;
    dummy.position.set(Math.cos(a) * dist, -0.3 + s * 0.25, Math.sin(a) * dist);
    dummy.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3);
    dummy.scale.set(s * 1.2, s * 0.8, s);
    dummy.updateMatrix();
    rockIM.setMatrixAt(i, dummy.matrix);
  }

  for (let i = 0; i < crysCount; i++) {
    const a = (i / crysCount) * Math.PI * 2 + rnd() * 0.2;
    const dist = 12.8 + rnd() * 10;
    const s = 0.6 + rnd() * 1.1;
    dummy.position.set(Math.cos(a) * dist, 0.2 + s * 0.5, Math.sin(a) * dist);
    dummy.rotation.set((rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.4);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    crysIM.setMatrixAt(i, dummy.matrix);
    crysIM.setColorAt(i, col.setHSL(0.55 + rnd() * 0.25, 0.85, 0.6));
  }
  crysIM.instanceColor.needsUpdate = true;
  root.add(rockIM);
  root.add(crysIM);
}

export function updateArenaVisuals(dt) {
  if (trackTex) trackTex.offset.y -= dt * 0.45;
  if (portalVortex) portalVortex.rotation.z -= dt * 2.4;
  if (portalRingOuter) portalRingOuter.rotation.z += dt * 1.6;
  pylons.forEach((g, i) => {
    g.rotation.y += dt * 1.8;
    g.position.y = 1.45 + Math.sin(G.t * 2.5 + i) * 0.12;
  });

  // 선택된 유닛 사거리 링 및 선택 링 업데이트
  const sel = G.units.find((u) => u.uid === G.selectedUid);
  if (sel) {
    selectRing.visible = true;
    selectRing.position.x = sel.x;
    selectRing.position.z = sel.z;
    selectRing.rotation.z = G.t * 2.0;

    rangeRing.visible = true;
    rangeRing.position.x = sel.x;
    rangeRing.position.z = sel.z;
    rangeRing.scale.setScalar(sel.def.range);
    rangeRing.material.color.setHex(TYPES[sel.type].hex);
  } else {
    selectRing.visible = false;
    rangeRing.visible = false;
  }

  // 호버 타일 표시
  if (G.hoverTile) {
    const { x, z } = tileToWorld(G.hoverTile.col, G.hoverTile.row);
    hoverBox.visible = true;
    hoverBox.position.x = x;
    hoverBox.position.z = z;
  } else {
    hoverBox.visible = false;
  }

  // 같은 등급+성향 2기 이상 보유 시 조합 가능 초록 링 표시
  const counts = {};
  for (const u of G.units) {
    if (u.tier < 7) {
      const k = `${u.type}_${u.tier}`;
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  let idx = 0;
  const pulse = 0.55 + Math.sin(G.t * 6) * 0.25;
  for (const u of G.units) {
    const k = `${u.type}_${u.tier}`;
    if (u.tier < 7 && counts[k] >= 2 && idx < combineIndicators.length) {
      const ind = combineIndicators[idx++];
      ind.visible = true;
      ind.position.x = u.x;
      ind.position.z = u.z;
      ind.material.opacity = pulse;
      ind.material.color.setHex(u.tier === 6 ? 0x00f5d4 : 0x4ade80);
    }
  }
  for (let i = idx; i < combineIndicators.length; i++) {
    combineIndicators[i].visible = false;
  }

  // 타일 바닥 등급별 은은한 색상 반영
  for (const tm of tileMeshes) {
    const u = unitAt(tm.userData.col, tm.userData.row);
    if (u) {
      tm.material.color.setHex(TIERS[u.tier].hex).lerp(new THREE.Color(tm.userData.baseHex), 0.55);
    } else {
      tm.material.color.setHex(tm.userData.baseHex);
    }
  }
}
