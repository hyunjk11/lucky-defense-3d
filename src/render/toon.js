/**
 * src/render/toon.js — 툰 셰이딩, 외곽선(Inverted-Hull Outline), 정점 컬러 파츠 병합 및 절차적 2D 캔버스 텍스처
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// 3단계 툰 그라데이션 맵
const gradData = new Uint8Array([
  110, 110, 115, 255,
  188, 188, 195, 255,
  255, 255, 255, 255,
]);
export const grad = new THREE.DataTexture(gradData, 3, 1);
grad.minFilter = grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;

export const toon = (color, opts = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: grad, ...opts });

export const glow = (color, intensity = 1.8) =>
  new THREE.MeshToonMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    gradientMap: grad,
  });

export const vcToon = new THREE.MeshToonMaterial({
  vertexColors: true,
  gradientMap: grad,
});

// 외곽선 머티리얼 캐시
const olMats = {};
export function outlineMat(th = 0.028, color = 0x141020) {
  const key = `${th.toFixed(4)}_${color}`;
  if (olMats[key]) return olMats[key];
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTh = { value: th };
    s.vertexShader =
      'uniform float uTh;\n' +
      s.vertexShader.replace(
        '#include <project_vertex>',
        'transformed += normalize(normal) * uTh;\n#include <project_vertex>'
      );
  };
  m.customProgramCacheKey = () => `outline_${key}`;
  return (olMats[key] = m);
}

const olGeoCache = new WeakMap();
export function olGeo(g) {
  if (olGeoCache.has(g)) return olGeoCache.get(g);
  let o = new THREE.BufferGeometry();
  const pos = g.attributes.position;
  o.setAttribute('position', pos.clone());
  if (g.index) o.setIndex(g.index.clone());
  o = mergeVertices(o, 1e-3);
  o.computeVertexNormals();
  olGeoCache.set(g, o);
  return o;
}

export function addOutline(mesh, th = 0.028, color = 0x141020) {
  if (!th || th <= 0) return null;
  const o = new THREE.Mesh(olGeo(mesh.geometry), outlineMat(th, color));
  o.castShadow = false;
  o.receiveShadow = false;
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

export function mk(geo, mat, x = 0, y = 0, z = 0, parent = null, ol = 0.026) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (ol > 0) addOutline(m, ol);
  if (parent) parent.add(m);
  return m;
}

// 정점 컬러 파츠 생성 & 병합 헬퍼 (cart-race 스타일)
const _tmpCol = new THREE.Color();
export function part(
  g,
  colHex,
  x = 0,
  y = 0,
  z = 0,
  sx = 1,
  sy = 1,
  sz = 1,
  rx = 0,
  ry = 0,
  rz = 0
) {
  g.scale(sx, sy, sz);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  if (x || y || z) g.translate(x, y, z);
  _tmpCol.setHex(colHex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _tmpCol.r;
    arr[i * 3 + 1] = _tmpCol.g;
    arr[i * 3 + 2] = _tmpCol.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  }
  return g;
}

export function mergeParts(parts) {
  const nonIdx = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(nonIdx, false);
  merged.computeVertexNormals();
  parts.forEach((p) => p.dispose());
  return merged;
}

// 절차적 2D 캔버스 텍스처 생성기 (Node 환경에서는 DataTexture 폴백 제공)
export function canvasTexture(w, h, drawFn, repeat = false) {
  if (typeof document === 'undefined') {
    const dt = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h);
    if (repeat) {
      dt.wrapS = THREE.RepeatWrapping;
      dt.wrapT = THREE.RepeatWrapping;
    }
    return dt;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  return tex;
}
