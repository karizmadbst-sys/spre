import * as THREE from 'three';
import {
  animateHumanRig,
  createRealisticHumanRig,
  disposeCharacterResources,
} from './characters';
import type { TextureBundle } from './textures';
import type { CharacterId } from './types';

export type CharacterPreviewMap = Record<CharacterId, string>;

let cachedPreviews: CharacterPreviewMap | null = null;
let inFlightPromise: Promise<CharacterPreviewMap> | null = null;
let previewPaused = false;
let resumeWaiters: Array<() => void> = [];

/**
 * Pause background portrait rendering during active gameplay so we NEVER spin up
 * a second WebGL context or call forceContextLoss() while the player is playing.
 */
export function setCharacterPreviewPaused(paused: boolean): void {
  previewPaused = paused;
  if (!paused && resumeWaiters.length > 0) {
    const waiters = resumeWaiters;
    resumeWaiters = [];
    for (let i = 0; i < waiters.length; i++) {
      waiters[i]();
    }
  }
}

function waitUntilNotPaused(): Promise<void> {
  if (!previewPaused) return Promise.resolve();
  return new Promise((resolve) => {
    resumeWaiters.push(resolve);
  });
}

function createDummyTextureBundle(): TextureBundle {
  const dummy = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  dummy.needsUpdate = true;
  const tex = dummy as unknown as THREE.CanvasTexture;
  return {
    compact: true,
    tileAlbedo: tex,
    tileBump: tex,
    tileRoughness: tex,
    wallAlbedo: tex,
    wallBump: tex,
    concreteAlbedo: tex,
    concreteBump: tex,
    cautionAlbedo: tex,
    metalAlbedo: tex,
    metalBump: tex,
    woodAlbedo: tex,
    woodBump: tex,
    woodRoughness: tex,
    ceilingAlbedo: tex,
    waterNormal: tex,
    monsterSkin: tex,
    monsterBump: tex,
    monsterNormal: tex,
    monsterRoughness: tex,
    monsterEmissive: tex,
    monsterFinSkin: tex,
    monsterFinEmissive: tex,
    monsterEye: tex,
    setAnisotropy: () => {},
    dispose: () => {
      dummy.dispose();
    },
  };
}

function createPoolroomsStudioTileTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#09191d';
    ctx.fillRect(0, 0, size, size);

    const cells = 4;
    const step = size / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const shade = ((x * 7 + y * 13) % 5) - 2;
        const r = Math.max(6, 11 + shade);
        const g = Math.max(16, 29 + shade * 2);
        const b = Math.max(20, 34 + shade * 2);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x * step + 1, y * step + 1, step - 2, step - 2);

        ctx.fillStyle = 'rgba(130, 224, 214, 0.05)';
        ctx.fillRect(x * step + 2, y * step + 2, step - 4, 2);
      }
    }

    ctx.strokeStyle = 'rgba(3, 8, 10, 0.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= cells; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.needsUpdate = true;
  return tex;
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function encodePortraitDataUrl(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.88);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  return canvas.toDataURL('image/jpeg', 0.9);
}

async function renderCharacterPortraits(): Promise<CharacterPreviewMap> {
  if (typeof document === 'undefined') {
    return { male: '', female: '' };
  }

  await waitUntilNotPaused();

  const isCompactDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window ||
      (typeof navigator !== 'undefined' &&
        (navigator.maxTouchPoints > 0 || (navigator.hardwareConcurrency || 4) <= 4)));

  const width = isCompactDevice ? 260 : 340;
  const height = isCompactDevice ? 390 : 510;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isCompactDevice,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'default',
    });
  } catch {
    return { male: '', female: '' };
  }

  const dummyBundle = createDummyTextureBundle();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x061013);
  scene.fog = new THREE.FogExp2(0x061013, 0.088);

  renderer.debug.checkShaderErrors = false;
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = false;

  // Lightweight 3-point Poolrooms studio lighting (zero PMREM/RoomEnvironment/shadowMap stall)
  const hemi = new THREE.HemisphereLight(0xb2e4ee, 0x102228, 1.05);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff1de, 2.55);
  keyLight.position.set(2.2, 3.6, 3.4);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x52ebbf, 2.2);
  rimLight.position.set(-2.3, 2.6, -2.1);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xdaf4f8, 0.85);
  fillLight.position.set(-1.2, 1.7, 2.6);
  scene.add(fillLight);

  const tileTex = createPoolroomsStudioTileTexture();
  const floorMat = new THREE.MeshStandardMaterial({
    map: tileTex,
    roughness: 0.26,
    metalness: 0.14,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: tileTex,
    color: 0x8bb6bd,
    roughness: 0.44,
    metalness: 0.08,
  });

  const floorGeo = new THREE.PlaneGeometry(8, 8);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = -0.024;
  scene.add(floor);

  const backWallGeo = new THREE.PlaneGeometry(6.5, 5.2);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, 2.1, -1.75);
  scene.add(backWall);

  const pillarGeo = new THREE.BoxGeometry(0.44, 5.2, 0.55);
  const leftPillar = new THREE.Mesh(pillarGeo, wallMat);
  leftPillar.position.set(-1.38, 2.1, -1.42);
  const rightPillar = new THREE.Mesh(pillarGeo, wallMat);
  rightPillar.position.set(1.38, 2.1, -1.42);
  scene.add(leftPillar, rightPillar);

  const plinthGeo = new THREE.CylinderGeometry(0.62, 0.68, 0.026, 28);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x0d1f24,
    roughness: 0.34,
    metalness: 0.24,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = -0.013;
  scene.add(plinth);

  const shadowDiscGeo = new THREE.CircleGeometry(0.42, 24);
  shadowDiscGeo.rotateX(-Math.PI / 2);
  const shadowDiscMat = new THREE.MeshBasicMaterial({
    color: 0x020608,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
  shadowDisc.position.y = 0.001;
  scene.add(shadowDisc);

  const rimRingGeo = new THREE.TorusGeometry(0.62, 0.0055, 8, 28);
  rimRingGeo.rotateX(Math.PI / 2);
  const rimRingMat = new THREE.MeshStandardMaterial({
    color: 0x45d6ae,
    emissive: 0x269e7d,
    emissiveIntensity: 0.6,
    roughness: 0.28,
  });
  const rimRing = new THREE.Mesh(rimRingGeo, rimRingMat);
  rimRing.position.y = 0.0015;
  scene.add(rimRing);

  const camera = new THREE.PerspectiveCamera(25, width / height, 0.1, 22);
  camera.position.set(0, 0.98, 4.78);
  camera.lookAt(0, 0.9, 0);

  const result: CharacterPreviewMap = { male: '', female: '' };

  try {
    for (const charId of ['male', 'female'] as const) {
      await waitUntilNotPaused();
      await yieldFrame();
      if (previewPaused) {
        await waitUntilNotPaused();
      }

      const rig = createRealisticHumanRig(dummyBundle, charId, 0x52e0b6, true);
      rig.setShadowDetail('smooth');
      scene.add(rig.root);

      for (let step = 0; step < 6; step++) {
        animateHumanRig(rig, 'idle', 0, 0.2, 0.05);
      }

      if (charId === 'male') {
        rig.root.rotation.y = -0.4;
        rig.hips.position.y = 0.91;
        rig.hips.rotation.set(0, 0, 0);
        rig.torso.rotation.set(-0.03, 0.1, 0);
        rig.headGroup.rotation.set(-0.02, 0.28, 0);

        rig.leftLeg.rotation.set(-0.12, 0, 0.08);
        rig.leftShin.rotation.set(0.14, 0, 0);
        rig.rightLeg.rotation.set(0.09, 0, -0.09);
        rig.rightShin.rotation.set(0.05, 0, 0);

        rig.rightArm.rotation.set(0.12, 0, 0.15);
        rig.rightForearm.rotation.set(-0.32, 0, 0);
        rig.leftArm.rotation.set(-0.38, -0.22, -0.16);
        rig.leftForearm.rotation.set(-1.02, 0, 0);
      } else {
        rig.root.rotation.y = 0.68;
        rig.hips.position.y = 0.915;
        rig.hips.rotation.set(0, 0, -0.03);
        rig.torso.rotation.set(-0.02, -0.12, 0.025);
        rig.headGroup.rotation.set(-0.02, -0.46, 0.035);

        rig.leftLeg.rotation.set(-0.15, 0, 0.05);
        rig.leftShin.rotation.set(0.22, 0, 0);
        rig.rightLeg.rotation.set(0.06, 0, -0.05);
        rig.rightShin.rotation.set(0.02, 0, 0);

        rig.leftArm.rotation.set(0.1, 0.12, -0.2);
        rig.leftForearm.rotation.set(-0.62, 0, 0.06);
        rig.rightArm.rotation.set(-0.14, -0.08, 0.14);
        rig.rightForearm.rotation.set(-0.24, 0, 0);

        for (let i = 0; i < rig.hairNodes.length; i++) {
          const hn = rig.hairNodes[i];
          if (hn.pitchFactor < 0) {
            hn.group.rotation.x = hn.restPitch + 0.14 * Math.abs(hn.pitchFactor);
            hn.group.rotation.z = hn.restRoll + 0.09 * hn.rollFactor;
          } else {
            hn.group.rotation.x = hn.restPitch - 0.04;
            hn.group.rotation.z = hn.restRoll + 0.03;
          }
        }
      }

      rig.root.updateMatrixWorld(true);
      renderer.render(scene, camera);
      result[charId] = encodePortraitDataUrl(canvas);

      scene.remove(rig.root);
      rig.dispose();
    }
  } finally {
    disposeCharacterResources(dummyBundle);
    dummyBundle.dispose();
    tileTex.dispose();
    floorMat.dispose();
    wallMat.dispose();
    floorGeo.dispose();
    backWallGeo.dispose();
    pillarGeo.dispose();
    plinthGeo.dispose();
    plinthMat.dispose();
    shadowDiscGeo.dispose();
    shadowDiscMat.dispose();
    rimRingGeo.dispose();
    rimRingMat.dispose();
    keyLight.dispose();
    hemi.dispose();
    rimLight.dispose();
    fillLight.dispose();
    renderer.dispose();
    // Release transient offscreen context cleanly once menu portraits are encoded
    renderer.forceContextLoss();
  }

  return result;
}

export function getCachedCharacterPreviews(): CharacterPreviewMap | null {
  return cachedPreviews;
}

let triggerPendingRunNow: (() => void) | null = null;

export function loadCharacterPreviews(immediate = false): Promise<CharacterPreviewMap> {
  if (cachedPreviews && cachedPreviews.male && cachedPreviews.female) {
    return Promise.resolve(cachedPreviews);
  }
  if (inFlightPromise) {
    if (immediate && triggerPendingRunNow) {
      triggerPendingRunNow();
    }
    return inFlightPromise;
  }
  inFlightPromise = new Promise<CharacterPreviewMap>((resolve) => {
    let started = false;
    let delayTimer = 0;
    const run = () => {
      if (started) return;
      started = true;
      if (delayTimer) {
        clearTimeout(delayTimer);
        delayTimer = 0;
      }
      triggerPendingRunNow = null;
      void renderCharacterPortraits().then((rendered) => {
        if (rendered.male && rendered.female) {
          cachedPreviews = rendered;
        }
        inFlightPromise = null;
        resolve(rendered);
      });
    };
    triggerPendingRunNow = run;
    if (immediate) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => run());
      } else {
        run();
      }
      return;
    }
    const ric =
      typeof window !== 'undefined'
        ? (window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
          }).requestIdleCallback
        : undefined;
    if (typeof ric === 'function') {
      delayTimer = window.setTimeout(() => ric(run, { timeout: 700 }), 260);
    } else {
      delayTimer = window.setTimeout(run, 380);
    }
  });
  return inFlightPromise;
}
