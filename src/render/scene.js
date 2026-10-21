/**
 * src/render/scene.js — Three.js 씬, 카메라, PMREM 하늘 환경광 반사 및 쿼터뷰 카메라 컨트롤러
 */
import * as THREE from 'three';
import { $, clamp, damp } from '../core/util.js';
import { G } from '../core/state.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1d);
scene.fog = new THREE.FogExp2(0x0b0f1d, 0.014);

export const camera = new THREE.PerspectiveCamera(44, 1, 0.5, 220);

export let renderer = null;

export const camCtrl = {
  yaw: 0,
  targetYaw: 0,
  pitch: 0.92,
  targetPitch: 0.92,
  dist: 26.5,
  targetDist: 26.5,
  lookAt: new THREE.Vector3(0, 0.2, 0.6),
};

export const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.88);
scene.add(hemiLight);

export const dirLight = new THREE.DirectionalLight(0xfff4e0, 1.35);
dirLight.position.set(14, 26, 16);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
Object.assign(dirLight.shadow.camera, {
  left: -16,
  right: 16,
  top: 16,
  bottom: -16,
  near: 4,
  far: 60,
});
dirLight.shadow.bias = -0.0006;
dirLight.shadow.normalBias = 0.025;
scene.add(dirLight);

export const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.55);
rimLight.position.set(-16, 12, -14);
scene.add(rimLight);

export function initRenderer() {
  const app = $('app');
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.id = 'glCanvas';
  app.prepend(renderer.domElement);

  // PMREM 절차적 하늘 환경맵 (차량/무기/크리스탈 반사광 생성)
  const envScene = new THREE.Scene();
  const skyGeo = new THREE.SphereGeometry(60, 24, 12);
  const pos = skyGeo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const topC = new THREE.Color(0x1d4ed8);
  const horC = new THREE.Color(0x7c3aed);
  const botC = new THREE.Color(0x090d16);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 60;
    if (y >= 0) tmp.copy(horC).lerp(topC, Math.pow(y, 0.6));
    else tmp.copy(horC).lerp(botC, Math.min(1, -y * 3));
    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  envScene.add(
    new THREE.Mesh(
      skyGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
    )
  );
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  onResize();
  window.addEventListener('resize', onResize);
  return renderer;
}

export function onResize() {
  if (!renderer) return;
  const w = window.innerWidth || 1024;
  const h = window.innerHeight || 768;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  // 모바일 세로 화면에서는 보드가 잘리지 않도록 카메라 거리를 자동 보정
  const aspect = w / h;
  const baseDist = aspect < 0.8 ? 35.5 : aspect < 1.1 ? 30.0 : 25.5;
  if (!camCtrl._userZoomed) camCtrl.targetDist = baseDist;
  camera.updateProjectionMatrix();
}

export function rotateCamera(deltaYaw) {
  camCtrl.targetYaw += deltaYaw;
}

export function zoomCamera(deltaDist) {
  camCtrl._userZoomed = true;
  camCtrl.targetDist = clamp(camCtrl.targetDist + deltaDist, 16, 40);
}

export function resetCamera() {
  camCtrl._userZoomed = false;
  camCtrl.targetYaw = 0;
  camCtrl.targetPitch = 0.92;
  onResize();
}

export function updateCamera(dt) {
  camCtrl.yaw = damp(camCtrl.yaw, camCtrl.targetYaw, 10, dt);
  camCtrl.pitch = damp(camCtrl.pitch, camCtrl.targetPitch, 10, dt);
  camCtrl.dist = damp(camCtrl.dist, camCtrl.targetDist, 10, dt);

  const r = camCtrl.dist;
  const cosP = Math.cos(camCtrl.pitch);
  const sinP = Math.sin(camCtrl.pitch);
  let cx = camCtrl.lookAt.x + Math.sin(camCtrl.yaw) * cosP * r;
  let cy = camCtrl.lookAt.y + sinP * r;
  let cz = camCtrl.lookAt.z + Math.cos(camCtrl.yaw) * cosP * r;

  if (G.shake > 0.001) {
    const t = performance.now() * 0.04;
    cx += Math.sin(t * 1.7) * G.shake;
    cy += Math.cos(t * 2.1) * G.shake * 0.7;
    cz += Math.sin(t * 1.3) * G.shake;
    G.shake = Math.max(0, G.shake - dt * 2.4);
  }

  camera.position.set(cx, cy, cz);
  camera.lookAt(camCtrl.lookAt);
}
