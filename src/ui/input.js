/**
 * src/ui/input.js — 3D 보드 마우스/터치 레이캐스팅(유닛 선택, 드래그 이동/스왑/합치기, 더블클릭 조합), 카메라 회전 및 키보드 단축키
 */
import * as THREE from 'three';
import { BOARD } from '../data/config.js';
import { G, unitAt, worldToTile } from '../core/state.js';
import { $ } from '../core/util.js';
import { Snd } from '../audio/audio.js';
import {
  awakenMythicUnit,
  combineAllAvailable,
  combineUnit,
  exchangeGoldToGas,
  moveOrSwapUnit,
  rerollPrimordialType,
  sellUnit,
  summonBountyBoss,
  summonRandomUnit,
  upgradeMine,
  upgradeType,
} from '../combat/combat.js';
import { camera, resetCamera, rotateCamera, zoomCamera } from '../render/scene.js';
import { refreshHud } from './hud.js';

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD.boardY);
const hitPoint = new THREE.Vector3();

function getTileFromEvent(clientX, clientY) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  if (raycaster.ray.intersectPlane(boardPlane, hitPoint)) {
    return worldToTile(hitPoint.x, hitPoint.z);
  }
  return null;
}

export function initInput(callbacks) {
  const canvas = $('glCanvas');
  if (!canvas) return;

  let isOrbitDragging = false;
  let lastX = 0;
  let dragStartTile = null;
  let lastClickTime = 0;
  let lastClickUid = null;

  canvas.addEventListener('pointerdown', (e) => {
    Snd.init();
    if (G.phase !== 'play') return;

    if (e.button === 2 || e.button === 1) {
      isOrbitDragging = true;
      lastX = e.clientX;
      return;
    }

    const tile = getTileFromEvent(e.clientX, e.clientY);
    dragStartTile = tile;

    if (!tile) {
      G.selectedUid = null;
      refreshHud();
      return;
    }

    const clickedUnit = unitAt(tile.col, tile.row);
    const now = performance.now();

    // 더블클릭 시 즉시 조합 시도!
    if (clickedUnit && clickedUnit.uid === lastClickUid && now - lastClickTime < 340) {
      combineUnit(clickedUnit);
      lastClickUid = null;
      return;
    }

    lastClickTime = now;
    lastClickUid = clickedUnit ? clickedUnit.uid : null;

    const currentlySelected = G.units.find((u) => u.uid === G.selectedUid);
    if (currentlySelected && (!clickedUnit || clickedUnit.uid !== currentlySelected.uid)) {
      // 이미 선택된 유닛이 있을 때 다른 타일(빈칸 또는 다른 유닛)을 클릭하면 즉시 이동/스왑/조합!
      moveOrSwapUnit(currentlySelected, tile.col, tile.row);
      return;
    }

    if (clickedUnit) {
      G.selectedUid = clickedUnit.uid;
      Snd.play('click');
    } else {
      G.selectedUid = null;
    }
    refreshHud();
  });

  window.addEventListener('pointermove', (e) => {
    if (isOrbitDragging) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      rotateCamera(-dx * 0.0065);
      return;
    }
    if (G.phase !== 'play') return;
    G.hoverTile = getTileFromEvent(e.clientX, e.clientY);
  });

  window.addEventListener('pointerup', (e) => {
    if (isOrbitDragging) {
      isOrbitDragging = false;
      return;
    }
    if (G.phase !== 'play' || !dragStartTile) return;
    const endTile = getTileFromEvent(e.clientX, e.clientY);
    if (
      endTile &&
      (endTile.col !== dragStartTile.col || endTile.row !== dragStartTile.row)
    ) {
      const draggedUnit = unitAt(dragStartTile.col, dragStartTile.row);
      if (draggedUnit) {
        moveOrSwapUnit(draggedUnit, endTile.col, endTile.row);
      }
    }
    dragStartTile = null;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomCamera(e.deltaY * 0.012);
    },
    { passive: false }
  );

  // 우하단 카메라 회전 버튼
  $('btnRotL').addEventListener('click', () => rotateCamera(-0.45));
  $('btnRotR').addEventListener('click', () => rotateCamera(0.45));
  $('btnCamReset').addEventListener('click', () => resetCamera());

  // 키보드 단축키
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const code = e.code;

    if (code === 'KeyM') {
      Snd.setMuted(!G.save.settings.muted);
      $('chkMute').checked = !!G.save.settings.muted;
      return;
    }
    if (code === 'KeyP') {
      callbacks.onTogglePause();
      return;
    }
    if (code === 'Escape') {
      if (!$('codexModal').classList.contains('hidden')) {
        $('codexModal').classList.add('hidden');
        return;
      }
      if (!$('sndModal').classList.contains('hidden')) {
        $('sndModal').classList.add('hidden');
        return;
      }
      if (G.selectedUid) {
        G.selectedUid = null;
        refreshHud();
        return;
      }
      callbacks.onTogglePause();
      return;
    }

    if (G.phase !== 'play') return;

    const sel = G.units.find((u) => u.uid === G.selectedUid);
    switch (code) {
      case 'KeyQ':
        summonRandomUnit();
        break;
      case 'KeyW':
        combineAllAvailable(5);
        break;
      case 'KeyC':
        if (sel) combineUnit(sel);
        break;
      case 'KeyE':
      case 'Delete':
      case 'Backspace':
        if (sel) sellUnit(sel);
        break;
      case 'KeyT':
        if (sel) {
          if (sel.tier === 6) awakenMythicUnit(sel);
          else if (sel.tier === 7) rerollPrimordialType(sel);
        }
        break;
      case 'KeyB':
        summonBountyBoss();
        break;
      case 'KeyG':
        upgradeMine();
        break;
      case 'KeyX':
        exchangeGoldToGas();
        break;
      case 'Digit1':
        upgradeType('striker');
        break;
      case 'Digit2':
        upgradeType('destroyer');
        break;
      case 'Digit3':
        upgradeType('arcane');
        break;
      case 'Space':
      case 'KeyF':
        e.preventDefault();
        G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1;
        $('btnSpeed').textContent = `×${G.speed}`;
        break;
    }
  });
}
