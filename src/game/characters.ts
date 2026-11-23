import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { TextureBundle } from './textures';
import type { ActiveQualityTier, CharacterId } from './types';

export type PlayerAnimState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'swim';

export interface HairPhysicsNode {
  group: THREE.Group;
  restPitch: number;
  restRoll: number;
  restYaw: number;
  pitchFactor: number;
  rollFactor: number;
  phaseOffset: number;
  maxBackwardPitch: number;
  maxForwardPitch: number;
}

export interface PlayerRig {
  characterId: CharacterId;
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  leftHand: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  rightHand: THREE.Group;
  leftLeg: THREE.Group;
  leftShin: THREE.Group;
  leftFoot: THREE.Group;
  rightLeg: THREE.Group;
  rightShin: THREE.Group;
  rightFoot: THREE.Group;
  headlamp: THREE.SpotLight;
  lampAnchor: THREE.Group;
  pushAnimTimer: number;
  pushedAnimTimer: number;
  hairNodes: HairPhysicsNode[];
  hairPitch: number;
  hairPitchVel: number;
  hairRoll: number;
  hairRollVel: number;
  prevHipsY: number;
  prevTorsoX: number;
  gaitPhase: number;
  swimPhase: number;
  prevAnimState: PlayerAnimState;
  airTime: number;
  jumpTime: number;
  landTimer: number;
  landDuration: number;
  landStrength: number;
  deathTimer: number;
  setVisible: (visible: boolean) => void;
  setShadowDetail: (tier: ActiveQualityTier) => void;
  dispose: () => void;
}

interface CharacterTextures {
  maleSkinAlbedo: THREE.CanvasTexture;
  femaleSkinAlbedo: THREE.CanvasTexture;
  skinBump: THREE.CanvasTexture;
  maleFaceMap: THREE.CanvasTexture;
  femaleFaceMap: THREE.CanvasTexture;
  maleEyeMap: THREE.CanvasTexture;
  femaleEyeMap: THREE.CanvasTexture;
  maleHairMap: THREE.CanvasTexture;
  femaleHairMap: THREE.CanvasTexture;
  hairBump: THREE.CanvasTexture;
  maleShirtMap: THREE.CanvasTexture;
  femaleJacketMap: THREE.CanvasTexture;
  pantsMap: THREE.CanvasTexture;
  fabricBump: THREE.CanvasTexture;
  leatherMap: THREE.CanvasTexture;
  dispose: () => void;
}

interface CharacterVariantPool {
  skinMat: THREE.MeshStandardMaterial;
  faceMat: THREE.MeshStandardMaterial;
  lipMat: THREE.MeshStandardMaterial;
  eyeMat: THREE.MeshStandardMaterial;
  browLashMat: THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  topMat: THREE.MeshStandardMaterial;
  innerTopMat: THREE.MeshStandardMaterial;
  pantsMat: THREE.MeshStandardMaterial;
  leatherMat: THREE.MeshStandardMaterial;
  bootSoleMat: THREE.MeshStandardMaterial;
  metalMat: THREE.MeshStandardMaterial;
  lampLensMat: THREE.MeshStandardMaterial;
  geometries: THREE.BufferGeometry[];
  pelvisGeo: THREE.BufferGeometry;
  torsoGeo: THREE.BufferGeometry;
  collarGeo: THREE.BufferGeometry;
  harnessGeo: THREE.BufferGeometry;
  beltGeo: THREE.BufferGeometry;
  buckleGeo: THREE.BufferGeometry;
  headGeo: THREE.BufferGeometry;
  headSkinMergedGeo: THREE.BufferGeometry;
  headBrowNostrilMergedGeo: THREE.BufferGeometry;
  headLipsMergedGeo: THREE.BufferGeometry;
  headEyesMergedGeo: THREE.BufferGeometry;
  hairCapGeo: THREE.BufferGeometry;
  hairTieGeo: THREE.BufferGeometry | null;
  hairLockGroups: Array<{
    geo: THREE.BufferGeometry;
    anchor: [number, number, number];
    restPitch: number;
    restRoll: number;
    restYaw: number;
    pitchFactor: number;
    rollFactor: number;
    phaseOffset: number;
    maxBackwardPitch: number;
    maxForwardPitch: number;
    parentIndex?: number;
  }>;
  upperArmTopMergedGeo: THREE.BufferGeometry;
  upperArmGeo: THREE.BufferGeometry;
  elbowGeo: THREE.BufferGeometry;
  forearmGeo: THREE.BufferGeometry;
  cuffGeo: THREE.BufferGeometry;
  leftHandGeo: THREE.BufferGeometry;
  rightHandGeo: THREE.BufferGeometry;
  thighGeo: THREE.BufferGeometry;
  lowerLegPantsMergedGeo: THREE.BufferGeometry;
  bootUpperGeo: THREE.BufferGeometry;
  bootSoleGeo: THREE.BufferGeometry;
  trimBandGeo: THREE.BufferGeometry;
  lampBodyGeo: THREE.BufferGeometry;
  lampLensGeo: THREE.BufferGeometry;
}

export interface CharacterSharedPool {
  quality: ActiveQualityTier;
  textures: CharacterTextures;
  trimMats: Map<string, THREE.MeshStandardMaterial>;
  variants: Partial<Record<CharacterId, CharacterVariantPool>>;
}

const characterPoolByBundle = new WeakMap<TextureBundle, CharacterSharedPool>();
const _trimColorTmp = new THREE.Color();

function tagShared<T extends THREE.BufferGeometry | THREE.Material>(obj: T): T {
  obj.userData.sharedPool = true;
  return obj;
}

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

function safeLerp(cur: number, target: number, k: number, fallback = 0): number {
  const c = Number.isFinite(cur) ? cur : fallback;
  const t = Number.isFinite(target) ? target : fallback;
  return c + (t - c) * k;
}

function bakeAndMergeStaticParts(
  parts: Array<{
    geo: THREE.BufferGeometry;
    px?: number;
    py?: number;
    pz?: number;
    rx?: number;
    ry?: number;
    rz?: number;
  }>
): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  const mat = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    // Keep only position/normal/uv so all merged parts share identical attribute layout
    for (const key of Object.keys(g.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') {
        g.deleteAttribute(key);
      }
    }
    if (!g.attributes.normal) {
      g.computeVertexNormals();
    }
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    euler.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0, 'XYZ');
    quat.setFromEuler(euler);
    pos.set(p.px ?? 0, p.py ?? 0, p.pz ?? 0);
    mat.compose(pos, quat, scale);
    g.applyMatrix4(mat);
    prepared.push(g);
  }

  const merged = mergeGeometries(prepared, false);
  for (let i = 0; i < prepared.length; i++) {
    prepared[i].dispose();
  }
  if (!merged) {
    throw new Error('Failed to merge static character sub-geometries.');
  }
  return merged;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  if (typeof document === 'undefined') {
    return [null as unknown as HTMLCanvasElement, null];
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  return [canvas, ctx];
}

function makeCanvasTexture(
  canvas: HTMLCanvasElement | null,
  ctx: CanvasRenderingContext2D | null,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  if (!canvas || !ctx) {
    const dt = new THREE.DataTexture(new Uint8Array([200, 180, 165, 255]), 1, 1);
    dt.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    dt.needsUpdate = true;
    return dt as unknown as THREE.CanvasTexture;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Computes signed volume of a closed indexed triangle mesh and flips triangle winding
 * if negative so vertex normals ALWAYS point strictly outward (never hollow/inside-out).
 */
function ensureOutwardWinding(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const idx = geo.getIndex();
  if (!pos || !idx) return geo;

  const arr = idx.array;
  let signedVol6 = 0;
  for (let i = 0; i < arr.length; i += 3) {
    const i0 = arr[i];
    const i1 = arr[i + 1];
    const i2 = arr[i + 2];

    const x0 = pos.getX(i0), y0 = pos.getY(i0), z0 = pos.getZ(i0);
    const x1 = pos.getX(i1), y1 = pos.getY(i1), z1 = pos.getZ(i1);
    const x2 = pos.getX(i2), y2 = pos.getY(i2), z2 = pos.getZ(i2);

    const cx = y1 * z2 - z1 * y2;
    const cy = z1 * x2 - x1 * z2;
    const cz = x1 * y2 - y1 * x2;
    signedVol6 += x0 * cx + y0 * cy + z0 * cz;
  }

  if (signedVol6 < 0) {
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      (arr as Uint16Array | Uint32Array)[i + 1] = arr[i + 2];
      (arr as Uint16Array | Uint32Array)[i + 2] = tmp;
    }
    idx.needsUpdate = true;
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Exact sphere equirectangular UV -> Canvas pixel coordinate mapping for head SphereGeometry
 * with phiStart = -Math.PI * 0.5, phiLength = Math.PI * 2, and CanvasTexture flipY = true.
 */
function projectHeadNormalToCanvas(
  nx: number,
  ny: number,
  nz: number,
  size: number
): [number, number] {
  const len = Math.hypot(nx, ny, nz) || 1;
  const ux = nx / len;
  const uy = THREE.MathUtils.clamp(ny / len, -1, 1);
  const uz = nz / len;
  const dphi = Math.atan2(ux, uz); // 0 at +Z front, positive toward +X
  const u = 0.5 + dphi / (Math.PI * 2);
  const theta = Math.acos(uy); // 0 at top (+Y), PI at bottom (-Y)
  return [u * size, (theta / Math.PI) * size];
}

function createSkinTextures(
  variant: CharacterId,
  compact = false,
  generateBump = true
): {
  albedo: THREE.CanvasTexture;
  face: THREE.CanvasTexture;
  bump: THREE.CanvasTexture | null;
} {
  const size = 512;
  const outSize = compact ? 256 : 512;
  const [skinC, sCtx] = makeCanvas(outSize);
  const [faceC, fCtx] = makeCanvas(outSize);
  const [bumpC, bCtx] = generateBump ? makeCanvas(outSize) : [null, null];

  const isMale = variant === 'male';
  const baseR = isMale ? 212 : 226;
  const baseG = isMale ? 166 : 182;
  const baseB = isMale ? 138 : 158;

  if (sCtx && fCtx) {
    const scale = outSize / size;
    if (scale !== 1) {
      sCtx.scale(scale, scale);
      fCtx.scale(scale, scale);
      if (bCtx) bCtx.scale(scale, scale);
    }
    sCtx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
    sCtx.fillRect(0, 0, size, size);

    if (bCtx) {
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);
    }

    // Organic skin micro-pores & subtle dermal tonal variation
    const poreCount = compact ? 1600 : 4200;
    for (let i = 0; i < poreCount; i++) {
      const px = (i * 197 + 31) % size;
      const py = (i * 313 + 79) % size;
      const rad = 0.7 + (i % 3) * 0.55;
      const tone = (i % 7) - 3;
      sCtx.fillStyle =
        tone > 0 ? 'rgba(246, 208, 188, 0.042)' : 'rgba(142, 82, 66, 0.042)';
      sCtx.beginPath();
      sCtx.arc(px, py, rad, 0, Math.PI * 2);
      sCtx.fill();

      if (bCtx) {
        const bVal = 123 + (i % 13);
        bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
        bCtx.fillRect(px, py, 2, 2);
      }
    }

    const warmGrad = sCtx.createRadialGradient(256, 256, 20, 256, 256, 240);
    warmGrad.addColorStop(0, 'rgba(218, 134, 114, 0.075)');
    warmGrad.addColorStop(1, 'rgba(120, 74, 58, 0.055)');
    sCtx.fillStyle = warmGrad;
    sCtx.fillRect(0, 0, size, size);

    fCtx.drawImage(skinC, 0, 0, size, size);

    // Hairline crown & occipital darkening (matches cranial hair roots)
    const crownDark = fCtx.createLinearGradient(0, 0, 0, 155);
    crownDark.addColorStop(0, isMale ? 'rgba(34, 24, 18, 0.85)' : 'rgba(46, 28, 20, 0.82)');
    crownDark.addColorStop(0.55, isMale ? 'rgba(42, 30, 22, 0.35)' : 'rgba(56, 36, 26, 0.3)');
    crownDark.addColorStop(1, 'rgba(42, 30, 22, 0)');
    fCtx.fillStyle = crownDark;
    fCtx.fillRect(0, 0, size, 160);

    // Back of skull hair-shadow fade (u < 0.25 and u > 0.75)
    const leftBackFade = fCtx.createLinearGradient(0, 0, 145, 0);
    leftBackFade.addColorStop(0, isMale ? 'rgba(34, 24, 18, 0.7)' : 'rgba(46, 28, 20, 0.65)');
    leftBackFade.addColorStop(1, 'rgba(34, 24, 18, 0)');
    fCtx.fillStyle = leftBackFade;
    fCtx.fillRect(0, 0, 150, 380);

    const rightBackFade = fCtx.createLinearGradient(size, 0, size - 145, 0);
    rightBackFade.addColorStop(0, isMale ? 'rgba(34, 24, 18, 0.7)' : 'rgba(46, 28, 20, 0.65)');
    rightBackFade.addColorStop(1, 'rgba(34, 24, 18, 0)');
    fCtx.fillStyle = rightBackFade;
    fCtx.fillRect(size - 150, 0, 150, 380);

    // Under-chin & jawline natural ambient occlusion
    const chinShade = fCtx.createLinearGradient(0, 365, 0, 512);
    chinShade.addColorStop(0, 'rgba(78, 42, 34, 0)');
    chinShade.addColorStop(0.55, 'rgba(72, 38, 32, 0.24)');
    chinShade.addColorStop(1, 'rgba(54, 28, 24, 0.42)');
    fCtx.fillStyle = chinShade;
    fCtx.fillRect(0, 360, size, 152);

    // Orbital eye-socket depth, under-eye, cheek flush & brows mapped exactly onto 3D coordinates
    for (const side of [-1, 1] as const) {
      const [ex, ey] = projectHeadNormalToCanvas(side * 0.34, 0.055, 0.938, size);
      const orbitG = fCtx.createRadialGradient(ex, ey, 3, ex, ey, 21);
      orbitG.addColorStop(0, 'rgba(76, 44, 38, 0.38)');
      orbitG.addColorStop(0.6, 'rgba(116, 68, 56, 0.16)');
      orbitG.addColorStop(1, 'rgba(116, 68, 56, 0)');
      fCtx.fillStyle = orbitG;
      fCtx.beginPath();
      fCtx.ellipse(ex, ey, 21, 15, 0, 0, Math.PI * 2);
      fCtx.fill();

      // Subtle under-eye realistic skin tone
      const [bx, by] = projectHeadNormalToCanvas(side * 0.34, -0.045, 0.938, size);
      const bagG = fCtx.createRadialGradient(bx, by, 2, bx, by, 15);
      bagG.addColorStop(0, 'rgba(122, 78, 74, 0.16)');
      bagG.addColorStop(1, 'rgba(122, 78, 74, 0)');
      fCtx.fillStyle = bagG;
      fCtx.beginPath();
      fCtx.ellipse(bx, by, 17, 9, 0, 0, Math.PI * 2);
      fCtx.fill();

      // Cheekbone warmth / natural flush
      const [cx, cy] = projectHeadNormalToCanvas(side * 0.56, -0.13, 0.818, size);
      const cheekG = fCtx.createRadialGradient(cx, cy, 4, cx, cy, 28);
      cheekG.addColorStop(0, isMale ? 'rgba(192, 108, 94, 0.16)' : 'rgba(216, 112, 108, 0.24)');
      cheekG.addColorStop(1, 'rgba(200, 110, 100, 0)');
      fCtx.fillStyle = cheekG;
      fCtx.beginPath();
      fCtx.arc(cx, cy, 28, 0, Math.PI * 2);
      fCtx.fill();

      // Subtle brow shadow beneath 3D brow arch
      const [biX, biY] = projectHeadNormalToCanvas(side * 0.17, 0.24, 0.955, size);
      const [bmX, bmY] = projectHeadNormalToCanvas(side * 0.34, 0.275, 0.9, size);
      const [boX, boY] = projectHeadNormalToCanvas(side * 0.53, 0.23, 0.815, size);
      fCtx.strokeStyle = isMale ? 'rgba(38, 28, 22, 0.45)' : 'rgba(54, 34, 24, 0.38)';
      fCtx.lineWidth = isMale ? 5.5 : 3.8;
      fCtx.lineCap = 'round';
      fCtx.beginPath();
      fCtx.moveTo(biX, biY);
      fCtx.quadraticCurveTo(bmX, bmY, boX, boY);
      fCtx.stroke();

      // Ear concha recessed shadow
      const [earX, earY] = projectHeadNormalToCanvas(side * 0.995, -0.02, -0.04, size);
      const earG = fCtx.createRadialGradient(earX, earY, 2, earX, earY, 18);
      earG.addColorStop(0, 'rgba(92, 48, 42, 0.38)');
      earG.addColorStop(1, 'rgba(92, 48, 42, 0)');
      fCtx.fillStyle = earG;
      fCtx.beginPath();
      fCtx.ellipse(earX, earY, 12, 18, 0, 0, Math.PI * 2);
      fCtx.fill();

      // Soft nasolabial fold contour
      const [nl1x, nl1y] = projectHeadNormalToCanvas(side * 0.16, -0.14, 0.977, size);
      const [nl2x, nl2y] = projectHeadNormalToCanvas(side * 0.28, -0.39, 0.876, size);
      fCtx.strokeStyle = 'rgba(118, 66, 56, 0.14)';
      fCtx.lineWidth = 3;
      fCtx.beginPath();
      fCtx.moveTo(nl1x, nl1y);
      fCtx.quadraticCurveTo((nl1x + nl2x) * 0.5 + side * 4, (nl1y + nl2y) * 0.5, nl2x, nl2y);
      fCtx.stroke();
    }

    // Nose bridge highlight & tip subsurface warmth
    const [nTopX, nTopY] = projectHeadNormalToCanvas(0, 0.14, 0.99, size);
    const [nTipX, nTipY] = projectHeadNormalToCanvas(0, -0.14, 0.99, size);
    const noseBridge = fCtx.createLinearGradient(nTopX, nTopY, nTipX, nTipY);
    noseBridge.addColorStop(0, 'rgba(255, 232, 218, 0.12)');
    noseBridge.addColorStop(0.72, 'rgba(255, 224, 208, 0.2)');
    noseBridge.addColorStop(1, 'rgba(195, 108, 94, 0.18)');
    fCtx.fillStyle = noseBridge;
    fCtx.beginPath();
    fCtx.ellipse(nTopX, (nTopY + nTipY) * 0.5, 7, Math.abs(nTipY - nTopY) * 0.58, 0, 0, Math.PI * 2);
    fCtx.fill();

    // Philtrum shadow below nose
    const [phX, phY] = projectHeadNormalToCanvas(0, -0.25, 0.968, size);
    fCtx.fillStyle = 'rgba(102, 56, 48, 0.2)';
    fCtx.beginPath();
    fCtx.ellipse(phX, phY, 4, 8, 0, 0, Math.PI * 2);
    fCtx.fill();

    // Lip area subtle flush & oral commissure corners
    const [lipX, lipY] = projectHeadNormalToCanvas(0, -0.37, 0.929, size);
    const lipG = fCtx.createRadialGradient(lipX, lipY, 3, lipX, lipY, 19);
    lipG.addColorStop(0, isMale ? 'rgba(164, 92, 84, 0.52)' : 'rgba(182, 86, 92, 0.64)');
    lipG.addColorStop(0.65, isMale ? 'rgba(164, 92, 84, 0.2)' : 'rgba(182, 86, 92, 0.25)');
    lipG.addColorStop(1, 'rgba(164, 92, 84, 0)');
    fCtx.fillStyle = lipG;
    fCtx.beginPath();
    fCtx.ellipse(lipX, lipY, 19, 9, 0, 0, Math.PI * 2);
    fCtx.fill();

    // Male realistic jawline & upper-lip beard stubble
    if (isMale) {
      const [jawTopX, jawTopY] = projectHeadNormalToCanvas(0, -0.28, 0.96, size);
      const [chinBotX, chinBotY] = projectHeadNormalToCanvas(0, -0.82, 0.57, size);
      const yStart = Math.min(jawTopY, chinBotY);
      const yEnd = Math.max(jawTopY, chinBotY);
      for (let i = 0; i < 2100; i++) {
        const sx = 256 - 72 + ((i * 89) % 144);
        const sy = yStart + ((i * 53) % Math.max(10, yEnd - yStart));
        const dx = (sx - 256) / 68;
        const dy = (sy - (yStart + (yEnd - yStart) * 0.52)) / ((yEnd - yStart) * 0.55);
        if (dx * dx + dy * dy > 1.0) continue;
        if (Math.abs(sx - lipX) < 16 && Math.abs(sy - lipY) < 8) continue;
        fCtx.fillStyle = 'rgba(38, 30, 26, 0.16)';
        fCtx.fillRect(sx, sy, 1.3, 1.3);
      }
    }
  }

  return {
    albedo: makeCanvasTexture(skinC, sCtx, true, 1, 1),
    face: makeCanvasTexture(faceC, fCtx, true, 1, 1),
    bump: generateBump ? makeCanvasTexture(bumpC, bCtx, false, 2, 2) : null,
  };
}

function createHumanEyeTexture(variant: CharacterId, compact = false): THREE.CanvasTexture {
  const size = 256;
  const outSize = compact ? 128 : 256;
  const [canvas, ctx] = makeCanvas(outSize);
  if (ctx) {
    if (outSize !== size) {
      ctx.scale(outSize / size, outSize / size);
    }
    // Natural sclera (mapped cleanly onto front-projected planar UVs on eyeball)
    const sclG = ctx.createRadialGradient(128, 128, 26, 128, 128, 128);
    sclG.addColorStop(0, '#f7f5f2');
    sclG.addColorStop(0.55, '#edeae5');
    sclG.addColorStop(0.85, '#dfcfca');
    sclG.addColorStop(1, '#c7a49f');
    ctx.fillStyle = sclG;
    ctx.fillRect(0, 0, size, size);

    // Subtle peripheral scleral vessels
    ctx.strokeStyle = 'rgba(176, 84, 82, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62);
      ctx.quadraticCurveTo(
        128 + Math.cos(a + 0.12) * 90,
        128 + Math.sin(a + 0.12) * 90,
        128 + Math.cos(a - 0.06) * 122,
        128 + Math.sin(a - 0.06) * 122
      );
      ctx.stroke();
    }

    // Crisp anatomically proportioned iris (occupying ~46% of corneal width)
    const irisR = 54;
    const isMale = variant === 'male';
    const limbalG = ctx.createRadialGradient(128, 128, 12, 128, 128, irisR + 4);
    if (isMale) {
      limbalG.addColorStop(0, '#0c0907');
      limbalG.addColorStop(0.32, '#926f39');
      limbalG.addColorStop(0.68, '#534729');
      limbalG.addColorStop(0.88, '#23281d');
      limbalG.addColorStop(1, 'rgba(30, 34, 28, 0)');
    } else {
      limbalG.addColorStop(0, '#081016');
      limbalG.addColorStop(0.32, '#86b8ca');
      limbalG.addColorStop(0.68, '#3b6478');
      limbalG.addColorStop(0.88, '#172a38');
      limbalG.addColorStop(1, 'rgba(26, 47, 61, 0)');
    }
    ctx.fillStyle = limbalG;
    ctx.beginPath();
    ctx.arc(128, 128, irisR + 2, 0, Math.PI * 2);
    ctx.fill();

    // Fine radial iris stroma fibers
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      ctx.strokeStyle = isMale
        ? i % 2 === 0
          ? 'rgba(196, 154, 82, 0.36)'
          : 'rgba(34, 28, 18, 0.38)'
        : i % 2 === 0
          ? 'rgba(186, 230, 244, 0.36)'
          : 'rgba(22, 46, 64, 0.42)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(a) * 20, 128 + Math.sin(a) * 20);
      ctx.lineTo(128 + Math.cos(a) * (irisR - 4), 128 + Math.sin(a) * (irisR - 4));
      ctx.stroke();
    }

    // Sharp pupil + subtle upper eyelid ambient shadow at top of sclera
    ctx.fillStyle = '#07080a';
    ctx.beginPath();
    ctx.arc(128, 128, 20, 0, Math.PI * 2);
    ctx.fill();

    // Subtle cornea highlight reflection dot for natural life
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.arc(114, 114, 6.5, 0, Math.PI * 2);
    ctx.fill();

    const lidAO = ctx.createLinearGradient(0, 0, 0, 96);
    lidAO.addColorStop(0, 'rgba(40, 28, 28, 0.34)');
    lidAO.addColorStop(1, 'rgba(40, 28, 28, 0)');
    ctx.fillStyle = lidAO;
    ctx.fillRect(0, 0, size, 96);
  }
  const tex = makeCanvasTexture(canvas, ctx, true, 1, 1);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createHairTextures(compact = false): {
  maleHair: THREE.CanvasTexture;
  femaleHair: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const size = 256;
  const outSize = compact ? 128 : 256;
  const [mC, mCtx] = makeCanvas(outSize);
  const [fC, fCtx] = makeCanvas(outSize);
  const [bC, bCtx] = makeCanvas(outSize);

  const paintStrands = (
    ctx: CanvasRenderingContext2D,
    baseHex: string,
    strandColors: string[],
    isBump = false
  ) => {
    if (outSize !== size) {
      ctx.scale(outSize / size, outSize / size);
    }
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);
    const strandCount = compact ? 380 : 760;
    for (let i = 0; i < strandCount; i++) {
      const x = (i * 29 + (i % 7) * 3) % size;
      const w = 0.9 + (i % 2) * 0.8;
      ctx.strokeStyle = strandColors[i % strandColors.length];
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(
        x + Math.sin(i) * 4,
        size * 0.33,
        x - Math.cos(i) * 4,
        size * 0.66,
        x,
        size
      );
      ctx.stroke();
    }
    if (!isBump) {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, 'rgba(10, 7, 5, 0.28)');
      g.addColorStop(0.5, 'rgba(255, 240, 225, 0.08)');
      g.addColorStop(1, 'rgba(18, 12, 10, 0.22)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  };

  if (mCtx && fCtx && bCtx) {
    paintStrands(mCtx, '#241b16', [
      'rgba(62, 46, 36, 0.58)',
      'rgba(20, 14, 11, 0.65)',
      'rgba(88, 66, 50, 0.34)',
    ]);
    paintStrands(fCtx, '#361f16', [
      'rgba(102, 58, 38, 0.56)',
      'rgba(38, 20, 14, 0.64)',
      'rgba(140, 86, 56, 0.36)',
    ]);
    paintStrands(
      bCtx,
      '#7d7d7d',
      ['rgba(220,220,220,0.46)', 'rgba(38,38,38,0.48)', 'rgba(175,175,175,0.38)'],
      true
    );
  }

  return {
    maleHair: makeCanvasTexture(mC, mCtx, true, 1, 1),
    femaleHair: makeCanvasTexture(fC, fCtx, true, 1, 1),
    bump: makeCanvasTexture(bC, bCtx, false, 1, 1),
  };
}

function createFabricTextures(compact = false): {
  maleShirt: THREE.CanvasTexture;
  femaleJacket: THREE.CanvasTexture;
  pants: THREE.CanvasTexture;
  fabricBump: THREE.CanvasTexture;
  leather: THREE.CanvasTexture;
} {
  const size = 512;
  const outSize = compact ? 256 : 512;
  const [msC, msCtx] = makeCanvas(outSize);
  const [fjC, fjCtx] = makeCanvas(outSize);
  const [ptC, ptCtx] = makeCanvas(outSize);
  const [fbC, fbCtx] = makeCanvas(outSize);
  const [ltC, ltCtx] = makeCanvas(outSize);

  const paintWovenFabric = (
    ctx: CanvasRenderingContext2D,
    base: string,
    warp: string,
    weft: string,
    foldShade: string,
    ripstop: boolean
  ) => {
    if (outSize !== size) {
      ctx.scale(outSize / size, outSize / size);
    }
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = warp;
    ctx.lineWidth = 1;
    for (let x = 0; x < size; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    ctx.strokeStyle = weft;
    for (let y = 0; y < size; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    if (ripstop) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.lineWidth = 1.2;
      for (let g = 0; g < size; g += 24) {
        ctx.beginPath();
        ctx.moveTo(g, 0);
        ctx.lineTo(g, size);
        ctx.moveTo(0, g);
        ctx.lineTo(size, g);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 18; i++) {
      const fx = (i * 67) % size;
      const fy = (i * 89) % size;
      const g = ctx.createRadialGradient(fx, fy, 4, fx, fy, 78);
      g.addColorStop(0, foldShade);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(220, 232, 236, 0.14)';
    ctx.lineWidth = 1.5;
    for (const sx of [64, 256, 448]) {
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, size);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };

  if (msCtx && fjCtx && ptCtx && fbCtx && ltCtx) {
    paintWovenFabric(
      msCtx,
      '#2e3f4a',
      'rgba(255,255,255,0.04)',
      'rgba(12,18,24,0.08)',
      'rgba(14, 20, 26, 0.14)',
      false
    );
    paintWovenFabric(
      fjCtx,
      '#354b44',
      'rgba(235,248,240,0.035)',
      'rgba(10,18,16,0.09)',
      'rgba(12, 22, 18, 0.14)',
      true
    );
    paintWovenFabric(
      ptCtx,
      '#232a2f',
      'rgba(255,255,255,0.03)',
      'rgba(8,10,12,0.1)',
      'rgba(10, 12, 14, 0.18)',
      true
    );
    paintWovenFabric(
      fbCtx,
      '#808080',
      'rgba(210,210,210,0.22)',
      'rgba(48,48,48,0.24)',
      'rgba(60, 60, 60, 0.12)',
      true
    );
    if (outSize !== size) {
      ltCtx.scale(outSize / size, outSize / size);
    }
    ltCtx.fillStyle = '#2d2119';
    ltCtx.fillRect(0, 0, size, size);
    const leatherPores = compact ? 700 : 1600;
    for (let i = 0; i < leatherPores; i++) {
      const lx = (i * 157) % size;
      const ly = (i * 271) % size;
      ltCtx.fillStyle = i % 2 === 0 ? 'rgba(70, 50, 38, 0.18)' : 'rgba(18, 12, 9, 0.22)';
      ltCtx.fillRect(lx, ly, 3 + (i % 4), 2 + (i % 3));
    }
  }

  return {
    maleShirt: makeCanvasTexture(msC, msCtx, true, 2, 2),
    femaleJacket: makeCanvasTexture(fjC, fjCtx, true, 2, 2),
    pants: makeCanvasTexture(ptC, ptCtx, true, 2, 2),
    fabricBump: makeCanvasTexture(fbC, fbCtx, false, 3, 3),
    leather: makeCanvasTexture(ltC, ltCtx, true, 2, 2),
  };
}

function getCharacterPool(bundle: TextureBundle): CharacterSharedPool {
  let pool = characterPoolByBundle.get(bundle);
  if (pool) return pool;

  const compact = Boolean((bundle as { compact?: boolean }).compact);
  const maleSkin = createSkinTextures('male', compact, true);
  const femaleSkin = createSkinTextures('female', compact, false);
  const hairTex = createHairTextures(compact);
  const fabric = createFabricTextures(compact);
  const maleEyeMap = createHumanEyeTexture('male', compact);
  const femaleEyeMap = createHumanEyeTexture('female', compact);

  pool = {
    quality: compact ? 'smooth' : 'standard',
    textures: {
      maleSkinAlbedo: maleSkin.albedo,
      femaleSkinAlbedo: femaleSkin.albedo,
      skinBump: maleSkin.bump!,
      maleFaceMap: maleSkin.face,
      femaleFaceMap: femaleSkin.face,
      maleEyeMap,
      femaleEyeMap,
      maleHairMap: hairTex.maleHair,
      femaleHairMap: hairTex.femaleHair,
      hairBump: hairTex.bump,
      maleShirtMap: fabric.maleShirt,
      femaleJacketMap: fabric.femaleJacket,
      pantsMap: fabric.pants,
      fabricBump: fabric.fabricBump,
      leatherMap: fabric.leather,
      dispose: () => {
        maleSkin.albedo.dispose();
        maleSkin.face.dispose();
        maleSkin.bump?.dispose();
        femaleSkin.albedo.dispose();
        femaleSkin.face.dispose();
        maleEyeMap.dispose();
        femaleEyeMap.dispose();
        hairTex.maleHair.dispose();
        hairTex.femaleHair.dispose();
        hairTex.bump.dispose();
        fabric.maleShirt.dispose();
        fabric.femaleJacket.dispose();
        fabric.pants.dispose();
        fabric.fabricBump.dispose();
        fabric.leather.dispose();
      },
    },
    trimMats: new Map(),
    variants: {},
  };

  characterPoolByBundle.set(bundle, pool);
  return pool;
}

function applyTierToVariantPool(
  v: CharacterVariantPool,
  tex: CharacterTextures,
  tier: ActiveQualityTier
): void {
  const isSmooth = tier === 'smooth';
  const envScale = isSmooth ? 0.78 : tier === 'ultra' ? 1.12 : 0.96;
  const scaleBump = (mat: THREE.MeshStandardMaterial, map: THREE.Texture) => {
    if (!mat.bumpMap) {
      mat.bumpMap = map;
      mat.needsUpdate = true;
    }
    if (mat.userData.origBumpScale === undefined) {
      mat.userData.origBumpScale = mat.bumpScale || 0.015;
    }
    mat.bumpScale = isSmooth ? 0 : (mat.userData.origBumpScale as number);
    mat.envMapIntensity = envScale;
  };
  scaleBump(v.skinMat, tex.skinBump);
  scaleBump(v.faceMat, tex.skinBump);
  scaleBump(v.hairMat, tex.hairBump);
  scaleBump(v.topMat, tex.fabricBump);
  scaleBump(v.innerTopMat, tex.fabricBump);
  scaleBump(v.pantsMat, tex.fabricBump);
  scaleBump(v.leatherMat, tex.fabricBump);
  v.metalMat.envMapIntensity = envScale;
  v.eyeMat.envMapIntensity = isSmooth ? 1.1 : tier === 'ultra' ? 1.6 : 1.38;
}

export function setCharacterQualityTier(bundle: TextureBundle, tier: ActiveQualityTier): void {
  const pool = characterPoolByBundle.get(bundle);
  if (!pool) return;
  pool.quality = tier;
  for (const key of Object.keys(pool.variants) as CharacterId[]) {
    const v = pool.variants[key];
    if (!v) continue;
    applyTierToVariantPool(v, pool.textures, tier);
  }
}

export function setCharacterTextureAnisotropy(bundle: TextureBundle, maxAniso: number): void {
  const pool = characterPoolByBundle.get(bundle);
  if (!pool) return;
  const aniso = Math.max(1, Math.min(16, Math.round(maxAniso)));
  const t = pool.textures;
  const list = [
    t.maleSkinAlbedo,
    t.femaleSkinAlbedo,
    t.skinBump,
    t.maleFaceMap,
    t.femaleFaceMap,
    t.maleEyeMap,
    t.femaleEyeMap,
    t.maleHairMap,
    t.femaleHairMap,
    t.hairBump,
    t.maleShirtMap,
    t.femaleJacketMap,
    t.pantsMap,
    t.fabricBump,
    t.leatherMap,
  ];
  for (let i = 0; i < list.length; i++) {
    if (list[i].anisotropy !== aniso) {
      list[i].anisotropy = aniso;
      list[i].needsUpdate = true;
    }
  }
}

export function markCharacterTexturesDirty(bundle: TextureBundle): void {
  const pool = characterPoolByBundle.get(bundle);
  if (!pool) return;
  const t = pool.textures;
  t.maleSkinAlbedo.needsUpdate = true;
  t.femaleSkinAlbedo.needsUpdate = true;
  t.skinBump.needsUpdate = true;
  t.maleFaceMap.needsUpdate = true;
  t.femaleFaceMap.needsUpdate = true;
  t.maleEyeMap.needsUpdate = true;
  t.femaleEyeMap.needsUpdate = true;
  t.maleHairMap.needsUpdate = true;
  t.femaleHairMap.needsUpdate = true;
  t.hairBump.needsUpdate = true;
  t.maleShirtMap.needsUpdate = true;
  t.femaleJacketMap.needsUpdate = true;
  t.pantsMap.needsUpdate = true;
  t.fabricBump.needsUpdate = true;
  t.leatherMap.needsUpdate = true;
}

export function disposeCharacterResources(bundle: TextureBundle): void {
  const pool = characterPoolByBundle.get(bundle);
  if (!pool) return;
  pool.textures.dispose();
  pool.trimMats.forEach((m) => m.dispose());
  pool.trimMats.clear();
  for (const key of Object.keys(pool.variants) as CharacterId[]) {
    const v = pool.variants[key];
    if (!v) continue;
    v.geometries.forEach((g) => g.dispose());
    v.skinMat.dispose();
    v.faceMat.dispose();
    v.lipMat.dispose();
    v.eyeMat.dispose();
    v.browLashMat.dispose();
    v.hairMat.dispose();
    v.topMat.dispose();
    v.innerTopMat.dispose();
    v.pantsMat.dispose();
    v.leatherMat.dispose();
    v.bootSoleMat.dispose();
    v.metalMat.dispose();
    v.lampLensMat.dispose();
  }
  characterPoolByBundle.delete(bundle);
}

interface LoftSlice {
  y: number;
  rx: number;
  rz: number;
  cx?: number;
  cz?: number;
  frontBoost?: number;
  backBoost?: number;
  backPinch?: number;
  sternumPinch?: number;
  shoulderSquare?: number;
}

/**
 * Creates an anatomically contoured solid lofted BufferGeometry with guaranteed OUTWARD
 * triangle winding and smooth vertex normals.
 */
function createLoftedBodyGeo(
  slices: LoftSlice[],
  radialSegs = 24,
  capBottom = true,
  capTop = true
): THREE.BufferGeometry {
  const ringVerts = radialSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const yMin = slices[0].y;
  const ySpan = Math.max(0.001, slices[slices.length - 1].y - yMin);

  for (let s = 0; s < slices.length; s++) {
    const sl = slices[s];
    const cx = sl.cx ?? 0;
    const cz = sl.cz ?? 0;
    const v = (sl.y - yMin) / ySpan;
    for (let r = 0; r <= radialSegs; r++) {
      const u = r / radialSegs;
      const phi = -Math.PI * 0.5 + u * Math.PI * 2; // u=0.5 => +Z front
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      let px = cosP * sl.rx;
      let pz = sinP * sl.rz;

      if (sl.frontBoost && sinP > 0) {
        pz += Math.pow(sinP, 1.35) * sl.frontBoost * (0.55 + 0.45 * Math.abs(cosP));
      }
      if (sl.sternumPinch && sinP > 0.3) {
        const centerFactor = Math.exp(-Math.pow(cosP / 0.24, 2));
        pz -= centerFactor * sl.sternumPinch * sinP;
      }
      if (sl.backBoost && sinP < 0) {
        pz -= Math.pow(-sinP, 1.3) * sl.backBoost * (0.55 + 0.45 * Math.abs(cosP));
      }
      if (sl.backPinch && sinP < 0) {
        pz += Math.abs(sinP) * sl.backPinch * (1 - Math.abs(cosP) * 0.5);
      }
      if (sl.shoulderSquare) {
        const sq = Math.pow(Math.abs(cosP), 2.4) * sl.shoulderSquare;
        px *= 1 + sq * 0.08;
      }

      positions.push(cx + px, sl.y, cz + pz);
      uvs.push(u, v);
    }
  }

  // Outward winding: T_u = +Z on +X side, T_v = +Y -> T_v x T_u = (+1, 0, 0) OUTWARD
  for (let s = 0; s < slices.length - 1; s++) {
    const r0 = s * ringVerts;
    const r1 = (s + 1) * ringVerts;
    for (let r = 0; r < radialSegs; r++) {
      const a = r0 + r;
      const b = r0 + r + 1;
      const c = r1 + r;
      const d = r1 + r + 1;
      indices.push(a, c, d, a, d, b);
    }
  }

  if (capBottom) {
    const botIdx = positions.length / 3;
    const s0 = slices[0];
    positions.push(s0.cx ?? 0, s0.y, s0.cz ?? 0);
    uvs.push(0.5, 0);
    for (let r = 0; r < radialSegs; r++) {
      indices.push(botIdx, r, r + 1);
    }
  }

  if (capTop) {
    const topIdx = positions.length / 3;
    const sLast = slices[slices.length - 1];
    positions.push(sLast.cx ?? 0, sLast.y, sLast.cz ?? 0);
    uvs.push(0.5, 1);
    const baseRing = (slices.length - 1) * ringVerts;
    for (let r = 0; r < radialSegs; r++) {
      indices.push(topIdx, baseRing + r + 1, baseRing + r);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  if (capBottom && capTop) {
    ensureOutwardWinding(geo);
  } else {
    geo.computeVertexNormals();
  }
  return geo;
}

/**
 * Watertight solid ring collar with outer wall, beveled top edge, inner wall, and bottom wall.
 */
function createClosedCollarRingGeo(
  yBottom: number,
  yTop: number,
  rInnerX: number,
  rInnerZ: number,
  rOuterX: number,
  rOuterZ: number,
  cz = 0,
  segs = 24
): THREE.BufferGeometry {
  const pts: Array<[number, number]> = []; // [scaleT (0=inner, 1=outer), y]
  pts.push([1.0, yBottom]);
  pts.push([1.0, yTop - 0.008]);
  pts.push([0.92, yTop]);
  pts.push([0.08, yTop]);
  pts.push([0.0, yTop - 0.008]);
  pts.push([0.0, yBottom]);
  pts.push([1.0, yBottom]); // closed loop

  const ringCount = pts.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const radialStride = segs + 1;

  for (let p = 0; p < ringCount; p++) {
    const [t, py] = pts[p];
    const rx = THREE.MathUtils.lerp(rInnerX, rOuterX, t);
    const rz = THREE.MathUtils.lerp(rInnerZ, rOuterZ, t);
    const v = p / (ringCount - 1);
    for (let r = 0; r <= segs; r++) {
      const u = r / segs;
      const phi = -Math.PI * 0.5 + u * Math.PI * 2;
      positions.push(Math.cos(phi) * rx, py, cz + Math.sin(phi) * rz);
      uvs.push(u, v);
    }
  }

  for (let p = 0; p < ringCount - 1; p++) {
    const row0 = p * radialStride;
    const row1 = (p + 1) * radialStride;
    for (let r = 0; r < segs; r++) {
      const a = row0 + r;
      const b = row0 + r + 1;
      const c = row1 + r;
      const d = row1 + r + 1;
      indices.push(a, c, d, a, d, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return ensureOutwardWinding(geo);
}

function createSculptedHeadGeometry(variant: CharacterId, compact = false): THREE.BufferGeometry {
  const isMale = variant === 'male';
  const geo = new THREE.SphereGeometry(
    0.105,
    compact ? 24 : 32,
    compact ? 18 : 24,
    -Math.PI * 0.5,
    Math.PI * 2
  );
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = x / 0.105;
    const ny = y / 0.105;
    const nz = z / 0.105;

    // Anatomical vertical cranial proportion (total head span y in [-0.118, +0.118])
    y *= 1.12;
    x *= isMale ? 0.87 : 0.825;
    z *= 0.99;

    // Occipital skull back roundness & parietal taper
    if (nz < -0.12) {
      z -= 0.009 * Math.pow(-nz, 1.25) * (1 - Math.abs(ny) * 0.45);
    }
    if (ny > 0.15 && Math.abs(nx) > 0.52) {
      x *= 0.94;
    }

    // Jawline tapering from zygoma down toward chin
    if (ny < 0) {
      const jawT = Math.min(1, -ny);
      const jawNarrow = isMale ? 0.19 : 0.32;
      x *= 1 - jawT * jawNarrow;
      if (nz > -0.1) {
        z += jawT * (isMale ? 0.011 : 0.008) * Math.max(0, nz + 0.15);
      }
      if (isMale && ny < -0.22 && ny > -0.68 && Math.abs(nx) > 0.5 && nz < 0.25) {
        x *= 1.075;
      }
      if (ny < -0.64 && nz > 0.18) {
        z += (isMale ? 0.0095 : 0.006) * (-ny - 0.64) * nz;
        if (!isMale) x *= 0.86;
      }
    }

    // Superciliary brow ridge & forehead plane
    if (nz > 0.38 && ny > 0.12 && ny < 0.42) {
      const browFactor = Math.exp(-Math.pow((ny - 0.24) / 0.11, 2)) * Math.max(0, nz - 0.32);
      z += browFactor * (isMale ? 0.0085 : 0.0038);
    }

    // Smooth recessed orbital eye sockets centered around ny=+0.05, nx=+-0.34
    for (const side of [-1, 1]) {
      const dx = (nx - side * 0.34) / 0.23;
      const dy = (ny - 0.05) / 0.16;
      const distSq = dx * dx + dy * dy;
      if (nz > 0.45 && distSq < 1.15) {
        const socketDepth = Math.pow(Math.max(0, 1 - distSq / 1.15), 1.45);
        z -= socketDepth * 0.014;
      }
    }

    // Zygomatic cheekbones
    for (const side of [-1, 1]) {
      const dx = (nx - side * 0.55) / 0.26;
      const dy = (ny + 0.12) / 0.2;
      const distSq = dx * dx + dy * dy;
      if (nz > 0.2 && distSq < 1.0) {
        const cheekLift = Math.pow(1 - distSq, 1.3);
        x += side * cheekLift * (isMale ? 0.0042 : 0.0055);
        z += cheekLift * (isMale ? 0.0052 : 0.0065);
      }
      // Subtle buccal cheek contour below zygoma
      const bdx = (nx - side * 0.5) / 0.22;
      const bdy = (ny + 0.38) / 0.2;
      const bDistSq = bdx * bdx + bdy * bdy;
      if (nz > 0.25 && bDistSq < 1.0) {
        x -= side * Math.pow(1 - bDistSq, 1.5) * 0.0028;
      }
    }

    // Maxillary mouth contour (gives natural fullness under lips)
    if (nz > 0.5 && ny < -0.18 && ny > -0.58 && Math.abs(nx) < 0.46) {
      const mFactor = Math.exp(-Math.pow((ny + 0.36) / 0.18, 2)) * (1 - Math.abs(nx) / 0.46);
      z += mFactor * 0.0085;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createHumanNoseGeometry(variant: CharacterId): {
  nose: THREE.BufferGeometry;
  nostrils: THREE.BufferGeometry;
} {
  const isMale = variant === 'male';
  const w = isMale ? 0.0145 : 0.012;

  const bridge = createLoftedBodyGeo(
    [
      { y: -0.022, rx: w * 0.95, rz: 0.015, cz: 0.001 },
      { y: -0.013, rx: w * 0.96, rz: 0.021, cz: 0.007 }, // nasal tip
      { y: -0.001, rx: w * 0.72, rz: 0.016, cz: 0.003 },
      { y: 0.014, rx: w * 0.6, rz: 0.013, cz: -0.001 },
      { y: 0.028, rx: w * 0.62, rz: 0.011, cz: -0.004 }, // radix blended into glabella
    ],
    14,
    true,
    true
  );

  // Subtle alar nostril wings left & right blended at base of nose
  const parts: THREE.BufferGeometry[] = [bridge];
  for (const side of [-1, 1] as const) {
    const ala = new THREE.SphereGeometry(isMale ? 0.0072 : 0.006, 10, 8);
    ala.scale(0.95, 0.85, 1.15);
    ala.translate(side * (isMale ? 0.0088 : 0.0074), -0.014, 0.002);
    parts.push(ala);
  }
  const nose = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  nose.computeVertexNormals();

  // Subtle dark nostril shadows tucked underneath alar base
  const nParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    const nHole = new THREE.SphereGeometry(isMale ? 0.0032 : 0.0026, 8, 6);
    nHole.scale(1.1, 0.6, 1.35);
    nHole.translate(side * (isMale ? 0.0052 : 0.0044), -0.0185, 0.006);
    nParts.push(nHole);
  }
  const nostrils = mergeGeometries(nParts, false);
  nParts.forEach((p) => p.dispose());
  nostrils.computeVertexNormals();

  return { nose, nostrils };
}

function createSculptedLipsGeometry(variant: CharacterId): {
  upper: THREE.BufferGeometry;
  lower: THREE.BufferGeometry;
} {
  const isMale = variant === 'male';
  const halfW = isMale ? 0.022 : 0.021;

  const bendAlongFace = (geo: THREE.BufferGeometry, isUpper: boolean) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const t = Math.min(1, Math.abs(x) / halfW);
      // Taper cleanly toward mouth corners and curve backward onto facial arc
      const cornerScale = Math.max(0.22, Math.sqrt(Math.max(0.05, 1 - t * t * 0.92)));
      y *= cornerScale;
      z *= 0.72 * cornerScale;
      // Cupid's bow silhouette on upper lip
      if (isUpper) {
        const peak = Math.exp(-Math.pow((Math.abs(x) - 0.0055) / 0.0045, 2));
        const dip = Math.exp(-Math.pow(x / 0.0028, 2));
        y += peak * 0.0018 - dip * 0.0012;
      } else {
        // Gentle full center curve on lower lip
        y -= Math.exp(-Math.pow(x / 0.009, 2)) * 0.0014;
      }
      z -= 2.8 * x * x;
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
  };

  const upper = new THREE.CapsuleGeometry(isMale ? 0.0052 : 0.0058, halfW * 1.45, 6, 14);
  upper.rotateZ(Math.PI / 2);
  bendAlongFace(upper, true);

  const lower = new THREE.CapsuleGeometry(isMale ? 0.0058 : 0.0068, halfW * 1.25, 6, 14);
  lower.rotateZ(Math.PI / 2);
  bendAlongFace(lower, false);

  return { upper, lower };
}

function createSculptedEarGeometry(side: -1 | 1, compact = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Outer helix C-rim
  const helix = new THREE.TorusGeometry(0.0155, 0.0048, compact ? 5 : 6, compact ? 10 : 12, Math.PI * 1.42);
  helix.rotateZ(-Math.PI * 0.24);
  helix.scale(0.85, 1.18, 0.75);
  parts.push(helix);

  // Inner backing bowl so ear is solid from back/front/side
  const concha = new THREE.SphereGeometry(0.014, compact ? 8 : 10, compact ? 6 : 8);
  concha.scale(0.68, 1.05, 0.36);
  concha.translate(-0.0015, -0.001, -0.002);
  parts.push(concha);

  // Earlobe
  const lobe = new THREE.SphereGeometry(0.0072, compact ? 6 : 8, compact ? 5 : 6);
  lobe.scale(0.75, 1.1, 0.72);
  lobe.translate(-0.001, -0.0155, 0.0015);
  parts.push(lobe);

  const ear = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  // Orient left vs right ear cleanly outward along side * +X with slight natural posterior angle
  ear.rotateY(side * (Math.PI * 0.41));
  ear.computeVertexNormals();
  return ear;
}

/**
 * Eyeball sphere with planar front-hemisphere UV mapping on the iris/pupil face (+Z)
 * so human iris, limbal ring, radial collagen fibers, and pupil are circular with zero distortion.
 */
function createPlanarUvEyeballGeometry(radius = 0.0128, compact = false): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(
    radius,
    compact ? 12 : 16,
    compact ? 8 : 12,
    -Math.PI * 0.5,
    Math.PI * 2
  );
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (z >= -radius * 0.25) {
      const u = THREE.MathUtils.clamp(0.5 + x / (radius * 2.02), 0.02, 0.98);
      const v = THREE.MathUtils.clamp(0.5 + y / (radius * 2.02), 0.02, 0.98);
      uv.setXY(i, u, v);
    } else {
      // Back hemisphere maps cleanly to pale sclera edge
      uv.setXY(i, 0.04, 0.5);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Solid watertight sculpted upper & lower eyelid geometry framing the eyeball without any open undersides.
 */
function createSolidEyelidGeometries(): {
  upper: THREE.BufferGeometry;
  lower: THREE.BufferGeometry;
} {
  const makeLidArc = (isUpper: boolean) => {
    const r = 0.0138;
    const thick = isUpper ? 0.003 : 0.0022;
    const tube = new THREE.CapsuleGeometry(thick, 0.024, 5, 12);
    tube.rotateZ(Math.PI * 0.5);
    const pos = tube.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const nx = x / 0.015;
      // Almond arch upward for upper lid, gentle cradle downward for lower lid
      const arch = isUpper
        ? Math.cos(nx * 1.1) * 0.0068 + 0.0028
        : -Math.cos(nx * 1.1) * 0.0046 - 0.0038;
      // Curve tightly around front surface of eyeball
      const wrapZ = Math.sqrt(Math.max(0.00001, r * r - Math.min(r * r * 0.88, x * x * 0.85)));
      y += arch;
      z = wrapZ + z * 0.55 - (isUpper ? 0.0004 : 0.001);
      pos.setXYZ(i, x, y, z);
    }
    tube.computeVertexNormals();
    return tube;
  };

  return {
    upper: makeLidArc(true),
    lower: makeLidArc(false),
  };
}

function createSculptedBrowGeometry(variant: CharacterId, side: -1 | 1): THREE.BufferGeometry {
  const isMale = variant === 'male';
  const brow = new THREE.CapsuleGeometry(isMale ? 0.004 : 0.003, 0.028, 5, 10);
  brow.rotateZ(Math.PI * 0.5);
  const pos = brow.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    // Lateral direction from nose outward
    const outward = side * x; // -0.016 inner -> +0.016 outer
    const u = (outward + 0.016) / 0.032; // 0 inner, 1 outer
    const arch = Math.sin(u * Math.PI) * (isMale ? 0.0034 : 0.0054) - (u > 0.65 ? (u - 0.65) * 0.005 : 0);
    const taper = THREE.MathUtils.lerp(1.08, 0.52, Math.pow(Math.max(0, u), 1.3));
    y = y * taper + arch;
    z *= 0.65 * taper;
    // Wrap backward smoothly along forehead brow bone
    z -= 3.2 * x * x;
    pos.setXYZ(i, x, y, z);
  }
  brow.computeVertexNormals();
  return brow;
}

/**
 * Builds anatomically true left (side = -1) or right (side = 1) sculpted 5-finger human hand.
 * Never relies on negative scale, ensuring positive determinant & outward normals on both hands.
 */
function createSculptedHandGeometry(
  variant: CharacterId,
  side: -1 | 1,
  compact = false
): THREE.BufferGeometry {
  const s = variant === 'male' ? 1.0 : 0.91;
  const parts: THREE.BufferGeometry[] = [];
  const inward = -side; // Palm faces inward toward body (-side * X)
  const capSegs = 2;
  const radSegs = compact ? 5 : 6;
  const kSegsW = compact ? 5 : 6;
  const kSegsH = compact ? 4 : 5;

  // Sculpted palm: thin in X, broad front-to-back in Z so 4 fingers line up naturally along Z
  const palm = createLoftedBodyGeo(
    [
      { y: -0.072 * s, rx: 0.0135 * s, rz: 0.036 * s }, // knuckles edge
      { y: -0.038 * s, rx: 0.0155 * s, rz: 0.037 * s }, // mid palm
      { y: 0.008 * s, rx: 0.015 * s, rz: 0.029 * s }, // wrist base overlaps forearm cleanly
    ],
    compact ? 10 : 12
  );
  parts.push(palm);

  // Thenar thumb muscle pad on inner-front palm
  const thenar = new THREE.SphereGeometry(0.014 * s, compact ? 7 : 8, compact ? 5 : 6);
  thenar.scale(0.85, 1.45, 0.95);
  thenar.translate(inward * 0.007 * s, -0.028 * s, 0.022 * s);
  parts.push(thenar);

  // 4 fingers aligned front-to-back (index at +Z -> pinky at -Z), 2-segment natural curve inward
  const fingerSpecs = [
    { z: 0.025, len1: 0.034, len2: 0.028, rad: 0.0066, curl1: 0.14, curl2: 0.36 },
    { z: 0.0085, len1: 0.039, len2: 0.031, rad: 0.007, curl1: 0.17, curl2: 0.42 },
    { z: -0.0085, len1: 0.036, len2: 0.028, rad: 0.0066, curl1: 0.2, curl2: 0.48 },
    { z: -0.0245, len1: 0.028, len2: 0.023, rad: 0.0058, curl1: 0.24, curl2: 0.52 },
  ];

  for (const f of fingerSpecs) {
    const knuckleX = 0.001 * s * side;
    const baseY = -0.072 * s;

    // Knuckle joint
    const knuckle = new THREE.SphereGeometry(f.rad * 1.06 * s, kSegsW, kSegsH);
    knuckle.translate(knuckleX, baseY, f.z * s);
    parts.push(knuckle);

    // Proximal phalanx
    const l1 = f.len1 * s;
    const dx1 = inward * Math.sin(f.curl1) * l1;
    const dy1 = -Math.cos(f.curl1) * l1;
    const seg1 = new THREE.CapsuleGeometry(f.rad * s, l1 * 0.72, capSegs, radSegs);
    seg1.rotateZ(inward * f.curl1);
    seg1.translate(knuckleX + dx1 * 0.5, baseY + dy1 * 0.5, f.z * s);
    parts.push(seg1);

    // Distal phalanx
    const l2 = f.len2 * s;
    const dx2 = inward * Math.sin(f.curl2) * l2;
    const dy2 = -Math.cos(f.curl2) * l2;
    const seg2 = new THREE.CapsuleGeometry(f.rad * 0.84 * s, l2 * 0.72, capSegs, radSegs);
    seg2.rotateZ(inward * f.curl2);
    seg2.translate(knuckleX + dx1 + dx2 * 0.5, baseY + dy1 + dy2 * 0.5, f.z * s);
    parts.push(seg2);
  }

  // Articulated thumb extending forward (+Z) and curving inward (-side * X)
  const tBase = new THREE.CapsuleGeometry(0.008 * s, 0.025 * s, capSegs, radSegs);
  tBase.rotateX(0.62);
  tBase.rotateZ(inward * 0.28);
  tBase.translate(inward * 0.011 * s, -0.038 * s, 0.036 * s);
  parts.push(tBase);

  const tTip = new THREE.CapsuleGeometry(0.0068 * s, 0.021 * s, capSegs, radSegs);
  tTip.rotateX(0.32);
  tTip.rotateZ(inward * 0.45);
  tTip.translate(inward * 0.018 * s, -0.058 * s, 0.048 * s);
  parts.push(tTip);

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

function createSculptedBootGeometries(
  variant: CharacterId,
  compact = false
): {
  upper: THREE.BufferGeometry;
  sole: THREE.BufferGeometry;
} {
  const s = variant === 'male' ? 1.0 : 0.94;
  const upperParts: THREE.BufferGeometry[] = [];
  const bootSegs = compact ? 12 : 14;

  // Ankle shaft rises slightly higher (y=0.165) for generous overlap inside trouser hem
  const shaft = createLoftedBodyGeo(
    [
      { y: 0.03, rx: 0.054 * s, rz: 0.062 * s },
      { y: 0.095, rx: 0.05 * s, rz: 0.056 * s },
      { y: 0.165, rx: 0.052 * s, rz: 0.056 * s },
    ],
    bootSegs
  );
  upperParts.push(shaft);

  // Sculpted foot vamp & rounded toe box (+Z forward)
  const vamp = createLoftedBodyGeo(
    [
      { y: 0.018, rx: 0.053 * s, rz: 0.125 * s, cz: 0.05 * s },
      { y: 0.052, rx: 0.047 * s, rz: 0.105 * s, cz: 0.045 * s },
      { y: 0.08, rx: 0.038 * s, rz: 0.07 * s, cz: 0.02 * s },
    ],
    bootSegs
  );
  upperParts.push(vamp);

  // Laced tongue crossbars
  for (let i = 0; i < 4; i++) {
    const lace = new THREE.BoxGeometry(0.042 * s, 0.007, 0.009);
    lace.rotateX(-0.42);
    lace.translate(0, 0.068 + i * 0.017, 0.058 * s - i * 0.006);
    upperParts.push(lace);
  }

  const upper = mergeGeometries(upperParts, false);
  upperParts.forEach((p) => p.dispose());
  upper.computeVertexNormals();

  // Sole bottom flush at y = 0.000
  const sole = createLoftedBodyGeo(
    [
      { y: 0.0, rx: 0.058 * s, rz: 0.135 * s, cz: 0.052 * s },
      { y: 0.024, rx: 0.056 * s, rz: 0.132 * s, cz: 0.051 * s },
    ],
    bootSegs
  );

  return { upper, sole };
}

/**
 * Watertight 3D curved hair lock/strand with closed root and tip caps and
 * mathematically guaranteed outward normals.
 */
function createHairStrandGeo(
  points: [number, number, number][],
  baseRadius: number,
  tipRadius: number,
  radialSegs = 7,
  tubularSegs = 10
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const frames = curve.computeFrenetFrames(tubularSegs, false);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const pt = curve.getPointAt(t);
    const T = frames.tangents[i];
    const N = frames.normals[i];
    // Guarantee right-handed frame B = T x N
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, Math.pow(t, 0.8));

    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const angle = v * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rx = radius * 1.38;
      const ry = radius * 0.72;
      positions.push(
        pt.x + cosA * rx * N.x + sinA * ry * B.x,
        pt.y + cosA * rx * N.y + sinA * ry * B.y,
        pt.z + cosA * rx * N.z + sinA * ry * B.z
      );
      uvs.push(v, t);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + j + 1;
      const d = i * stride + j + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  // Root cap (t = 0)
  const rootCenterIdx = positions.length / 3;
  const pStart = curve.getPointAt(0);
  positions.push(pStart.x, pStart.y, pStart.z);
  uvs.push(0.5, 0);
  for (let j = 0; j < radialSegs; j++) {
    indices.push(rootCenterIdx, j, j + 1);
  }

  // Tip cap (t = 1)
  const tipCenterIdx = positions.length / 3;
  const pEnd = curve.getPointAt(1);
  positions.push(pEnd.x, pEnd.y, pEnd.z);
  uvs.push(0.5, 1);
  const tipBase = tubularSegs * stride;
  for (let j = 0; j < radialSegs; j++) {
    indices.push(tipCenterIdx, tipBase + j + 1, tipBase + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return ensureOutwardWinding(geo);
}

/**
 * Builds closed volumetric hair cap sphere (never open hem shell) where lower front face
 * region tucks inside skull safely while crown/temples/nape sweep smoothly around head.
 */
function createClosedHairVolumeCap(variant: CharacterId, compact = false): THREE.BufferGeometry {
  const isMale = variant === 'male';
  const geo = new THREE.SphereGeometry(
    0.108,
    compact ? 20 : 24,
    compact ? 14 : 18,
    -Math.PI * 0.5,
    Math.PI * 2
  );
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i) / 0.108;
    const uy = pos.getY(i) / 0.108;
    const uz = pos.getZ(i) / 0.108;

    let x = ux * (isMale ? 0.097 : 0.093);
    let y = uy * 0.122 + 0.008;
    let z = uz * 0.109 - 0.007;

    // Tuck lower-front & lower-side facial zone safely inside skull so hairline wraps seamlessly
    // without leaving any exposed open shell edge or clipping forehead/face
    const inFaceMask = uz > -0.15 && uy < 0.38;
    if (inFaceMask) {
      const faceWeight =
        THREE.MathUtils.smoothstep(0.38 - uy, 0, 0.55) *
        THREE.MathUtils.smoothstep(uz + 0.15, 0, 0.55);
      // Taper cleanly inside skull core (leaving sideburns/nape intact outside)
      const shrink = THREE.MathUtils.lerp(1.0, 0.68, faceWeight);
      x *= shrink;
      y *= THREE.MathUtils.lerp(1.0, 0.78, faceWeight);
      z *= shrink;
    }

    // Female fuller crown & gentle back sweep volume; male sculpted crop nape taper
    if (!isMale && uy > 0.1 && uz < 0.25) {
      y += 0.006 * (1 - Math.abs(ux) * 0.4);
      z -= 0.006 * Math.max(0, -uz);
    } else if (isMale && uz < -0.25 && uy < 0) {
      const napeFade = THREE.MathUtils.clamp(-uy, 0, 1);
      x *= 1 - napeFade * 0.12;
      z *= 1 - napeFade * 0.1;
    }

    pos.setXYZ(i, x, y, z);
  }

  return ensureOutwardWinding(geo);
}

function buildHairGeometries(
  variant: CharacterId,
  compact = false
): {
  capGeo: THREE.BufferGeometry;
  tieGeo: THREE.BufferGeometry | null;
  lockGroups: CharacterVariantPool['hairLockGroups'];
} {
  const sRad = compact ? 4 : 5;
  const sTub = compact ? 6 : 7;
  const sTubLong = compact ? 7 : 8;

  if (variant === 'male') {
    const capParts: THREE.BufferGeometry[] = [createClosedHairVolumeCap('male', compact)];

    // Sculpted layered crown-to-nape strands
    const mCrownCount = compact ? 16 : 20;
    for (let i = 0; i < mCrownCount; i++) {
      const side = (i - (mCrownCount - 1) * 0.5) / ((mCrownCount - 1) * 0.5);
      const xStart = side * 0.074;
      const topY = 0.12 - Math.abs(side) * 0.026;
      const strand = createHairStrandGeo(
        [
          [xStart * 0.72, topY, 0.032],
          [xStart * 0.94, topY + 0.009, -0.026],
          [xStart * 1.05, topY - 0.038, -0.09],
          [xStart * 0.94, 0.012 - Math.abs(side) * 0.018, -0.106],
        ],
        0.016,
        0.007,
        sRad,
        sTub
      );
      capParts.push(strand);
    }
    // Sideburns / temple fade strands
    for (const s of [-1, 1] as const) {
      for (let k = 0; k < 4; k++) {
        const strand = createHairStrandGeo(
          [
            [s * 0.084, 0.078 - k * 0.014, 0.026 - k * 0.01],
            [s * 0.089, 0.044 - k * 0.012, 0.019 - k * 0.01],
            [s * 0.082, 0.006 - k * 0.009, 0.011 - k * 0.01],
          ],
          0.012,
          0.005,
          sRad,
          compact ? 4 : 5
        );
        capParts.push(strand);
      }
    }

    const capGeo = mergeGeometries(capParts, false);
    capParts.forEach((g) => g.dispose());
    capGeo.computeVertexNormals();

    // Textured parted front/crown locks (dynamic spring physics)
    const frontStrands: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 10; i++) {
      const f = (i - 4.5) / 4.5;
      const x = f * 0.064;
      const lock = createHairStrandGeo(
        [
          [x * 0.75, 0.012, -0.022],
          [x * 0.92, 0.025 - Math.abs(f) * 0.007, 0.028],
          [x * 1.02 + 0.016, 0.006 - Math.abs(f) * 0.008, 0.064],
          [x * 1.06 + 0.024, -0.015, 0.072 - Math.abs(f) * 0.012],
        ],
        0.0145,
        0.005,
        sRad,
        sTub
      );
      frontStrands.push(lock);
    }
    const frontGroupGeo = mergeGeometries(frontStrands, false);
    frontStrands.forEach((g) => g.dispose());
    frontGroupGeo.computeVertexNormals();

    return {
      capGeo,
      tieGeo: null,
      lockGroups: [
        {
          geo: frontGroupGeo,
          anchor: [0, 0.258, 0.022],
          restPitch: 0.04,
          restRoll: 0,
          restYaw: 0,
          pitchFactor: 0.35,
          rollFactor: 0.22,
          phaseOffset: 0.2,
          maxBackwardPitch: -0.25,
          maxForwardPitch: 0.3,
        },
      ],
    };
  }

  // Female hairstyle: long, lush layered 3D wavy hair parted at crown and flowing down her back to waist level
  const capParts: THREE.BufferGeometry[] = [createClosedHairVolumeCap('female', compact)];

  // Layered crown & parted skull strands sweeping down into the long back cascade
  const fCrownCount = compact ? 18 : 24;
  for (let i = 0; i < fCrownCount; i++) {
    const f = (i - (fCrownCount - 1) * 0.5) / ((fCrownCount - 1) * 0.5);
    const partShift = 0.012; // subtle natural off-center crown part
    const xStart = f * 0.072 + partShift * (1 - Math.abs(f));
    const crownY = 0.122 - Math.abs(f) * 0.028;
    const strand = createHairStrandGeo(
      [
        [xStart * 0.42, crownY, 0.044 - Math.abs(f) * 0.018],
        [xStart * 0.96, crownY - 0.022, -0.024],
        [xStart * 1.04, 0.015 - Math.abs(f) * 0.016, -0.094 + Math.abs(f) * 0.024],
        [xStart * 0.96, -0.048 - Math.abs(f) * 0.012, -0.106 + Math.abs(f) * 0.032],
      ],
      compact ? 0.017 : 0.0155,
      0.0085,
      sRad,
      sTub
    );
    capParts.push(strand);
  }

  // Temple hairline waves blending crown seamlessly into front/side locks
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 3; k++) {
      const temple = createHairStrandGeo(
        [
          [side * (0.022 + k * 0.016), 0.108 - k * 0.01, 0.056 - k * 0.012],
          [side * (0.074 + k * 0.007), 0.056 - k * 0.012, 0.036 - k * 0.016],
          [side * (0.086 + k * 0.004), -0.006 - k * 0.012, 0.006 - k * 0.016],
        ],
        0.013,
        0.0065,
        sRad,
        compact ? 5 : 6
      );
      capParts.push(temple);
    }
  }

  const capGeo = mergeGeometries(capParts, false);
  capParts.forEach((g) => g.dispose());
  capGeo.computeVertexNormals();

  const lockGroups: CharacterVariantPool['hairLockGroups'] = [];

  // Index 0 & 1: Long soft face-framing front locks draping gracefully over collarbones
  for (const side of [-1, 1] as const) {
    const frontWaves: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const wOff = Math.sin(k * 1.6 + side) * 0.006;
      const sGeo = createHairStrandGeo(
        [
          [side * (0.018 + k * 0.015), 0.014, 0.01 - k * 0.008],
          [side * (0.078 + k * 0.006), -0.052, 0.022 - k * 0.012],
          [side * (0.098 + k * 0.005) + wOff, -0.172 - k * 0.012, 0.068 - k * 0.014],
          [side * (0.092 + k * 0.004) - wOff, -0.264 - k * 0.014, 0.088 - k * 0.012],
          [side * (0.082 + k * 0.005) + wOff * 0.8, -0.345 - k * 0.018, 0.076 - k * 0.01],
        ],
        0.0125,
        0.004,
        sRad,
        sTubLong
      );
      frontWaves.push(sGeo);
    }
    const mergedFront = mergeGeometries(frontWaves, false);
    frontWaves.forEach((g) => g.dispose());
    mergedFront.computeVertexNormals();
    lockGroups.push({
      geo: mergedFront,
      anchor: [0, 0.244, 0.026],
      restPitch: 0.02,
      restRoll: 0,
      restYaw: 0,
      pitchFactor: 0.34,
      rollFactor: 0.38,
      phaseOffset: side > 0 ? 0.35 : 1.05,
      maxBackwardPitch: -0.32,
      maxForwardPitch: 0.14,
    });
  }

  // Index 2 & 3: Lush shoulder-drape side curtains framing arms & back silhouette
  for (const side of [-1, 1] as const) {
    const sideCurtains: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const wave = Math.sin(k * 1.45) * 0.007;
      const cGeo = createHairStrandGeo(
        [
          [side * (0.056 + k * 0.008), 0.018, -0.014 - k * 0.012],
          [side * (0.104 + k * 0.007) + wave, -0.088, -0.028 - k * 0.014],
          [side * (0.126 + k * 0.005) - wave, -0.208, -0.048 - k * 0.012],
          [side * (0.120 + k * 0.005) + wave, -0.328, -0.068 - k * 0.01],
          [side * (0.108 + k * 0.006), -0.428 - k * 0.014, -0.082 - k * 0.008],
        ],
        0.014,
        0.0045,
        sRad,
        sTubLong
      );
      sideCurtains.push(cGeo);
    }
    const mergedCurtain = mergeGeometries(sideCurtains, false);
    sideCurtains.forEach((g) => g.dispose());
    mergedCurtain.computeVertexNormals();
    lockGroups.push({
      geo: mergedCurtain,
      anchor: [0, 0.215, -0.024],
      restPitch: 0.03,
      restRoll: 0,
      restYaw: 0,
      pitchFactor: -0.68, // negative so negative rig.hairPitch trails strands BACKWARD (-Z)
      rollFactor: 0.55,
      phaseOffset: side > 0 ? 0.65 : 1.45,
      maxBackwardPitch: -0.04,
      maxForwardPitch: 0.78,
    });
  }

  // Index 4: Upper Back Flowing Hair Mantle (root tier cascading behind shoulder blades)
  const upperBackStrands: THREE.BufferGeometry[] = [];
  const backCount = compact ? 14 : 18;
  for (let i = 0; i < backCount; i++) {
    const f = (i - (backCount - 1) * 0.5) / ((backCount - 1) * 0.5); // -1 .. +1
    const waveX = Math.sin(i * 1.35) * 0.006;
    const waveZ = Math.cos(i * 1.1) * 0.005;
    const outerLift = Math.abs(f) * 0.012;
    const lock = createHairStrandGeo(
      [
        [f * 0.072, 0.0, 0.004 + Math.abs(f) * 0.018],
        [f * 0.098 + waveX, -0.075, -0.034 + waveZ + outerLift],
        [f * 0.114 - waveX, -0.165, -0.052 + waveZ * 0.8 + outerLift],
        [f * 0.118 + waveX * 0.7, -0.258 + Math.abs(f) * 0.014, -0.048 + outerLift],
      ],
      compact ? 0.019 : 0.017,
      0.011,
      sRad,
      sTub
    );
    upperBackStrands.push(lock);
  }
  const upperBackGeo = mergeGeometries(upperBackStrands, false);
  upperBackStrands.forEach((g) => g.dispose());
  upperBackGeo.computeVertexNormals();

  const upperBackIdx = lockGroups.length;
  lockGroups.push({
    geo: upperBackGeo,
    anchor: [0, 0.145, -0.106],
    restPitch: 0.03,
    restRoll: 0,
    restYaw: 0,
    pitchFactor: -0.78,
    rollFactor: 0.45,
    phaseOffset: 0.0,
    maxBackwardPitch: -0.04,
    maxForwardPitch: 0.85,
  });

  // Index 5: Mid-Back Layered Wave Cascade (chained to upperBack)
  const midBackStrands: THREE.BufferGeometry[] = [];
  for (let i = 0; i < backCount; i++) {
    const f = (i - (backCount - 1) * 0.5) / ((backCount - 1) * 0.5);
    const waveX = Math.cos(i * 1.5) * 0.009;
    const waveZ = Math.sin(i * 1.25) * 0.007;
    const outerTaper = Math.abs(f) * 0.015;
    const lock = createHairStrandGeo(
      [
        [f * 0.114, 0.0, 0.006 + outerTaper],
        [f * 0.126 + waveX, -0.078, -0.014 + waveZ + outerTaper],
        [f * 0.130 - waveX, -0.162, -0.008 - waveZ + outerTaper],
        [f * 0.122 + waveX * 0.6, -0.238 + Math.abs(f) * 0.02, -0.010 + outerTaper * 0.8],
      ],
      compact ? 0.016 : 0.0145,
      0.0085,
      sRad,
      sTub
    );
    midBackStrands.push(lock);
  }
  const midBackGeo = mergeGeometries(midBackStrands, false);
  midBackStrands.forEach((g) => g.dispose());
  midBackGeo.computeVertexNormals();

  const midBackIdx = lockGroups.length;
  lockGroups.push({
    geo: midBackGeo,
    anchor: [0, -0.235, -0.048],
    restPitch: 0.02,
    restRoll: 0,
    restYaw: 0,
    pitchFactor: -0.65,
    rollFactor: 0.68,
    phaseOffset: 0.9,
    maxBackwardPitch: -0.05,
    maxForwardPitch: 0.78,
    parentIndex: upperBackIdx,
  });

  // Index 6: Lower Waist-Length Tapered Flowing Tips (chained to midBack)
  const lowerTipsStrands: THREE.BufferGeometry[] = [];
  const lowerCount = compact ? 12 : 16;
  for (let i = 0; i < lowerCount; i++) {
    const f = (i - (lowerCount - 1) * 0.5) / ((lowerCount - 1) * 0.5);
    const len = 0.235 - Math.abs(f) * 0.055 + Math.sin(i * 1.7) * 0.016; // soft layered V-cut
    const curlX = Math.sin(i * 1.4) * 0.011;
    const curlZ = Math.cos(i * 1.3) * 0.009;
    const lock = createHairStrandGeo(
      [
        [f * 0.116, 0.0, Math.abs(f) * 0.01],
        [f * 0.122 + curlX, -len * 0.34, -0.010 + curlZ],
        [f * 0.112 - curlX, -len * 0.70, -0.004 - curlZ],
        [f * 0.095 + curlX * 0.5, -len, 0.008 + curlZ * 0.4],
      ],
      compact ? 0.0135 : 0.012,
      0.0032,
      sRad,
      sTub
    );
    lowerTipsStrands.push(lock);
  }
  const lowerTipsGeo = mergeGeometries(lowerTipsStrands, false);
  lowerTipsStrands.forEach((g) => g.dispose());
  lowerTipsGeo.computeVertexNormals();

  lockGroups.push({
    geo: lowerTipsGeo,
    anchor: [0, -0.218, -0.01],
    restPitch: 0.01,
    restRoll: 0,
    restYaw: 0,
    pitchFactor: -0.58,
    rollFactor: 0.85,
    phaseOffset: 1.85,
    maxBackwardPitch: -0.06,
    maxForwardPitch: 0.72,
    parentIndex: midBackIdx,
  });

  return { capGeo, tieGeo: null, lockGroups };
}

function getCharacterVariantPool(bundle: TextureBundle, variant: CharacterId): CharacterVariantPool {
  const rootPool = getCharacterPool(bundle);
  const existing = rootPool.variants[variant];
  if (existing) return existing;

  const tex = rootPool.textures;
  const compact = Boolean((bundle as { compact?: boolean }).compact);
  const isMale = variant === 'male';
  const bodySegs = compact ? 16 : 20;
  const torsoSegs = compact ? 18 : 22;
  const limbSegs = compact ? 14 : 16;
  const jointSegsW = compact ? 10 : 12;
  const jointSegsH = compact ? 8 : 10;
  const geometries: THREE.BufferGeometry[] = [];
  const reg = <T extends THREE.BufferGeometry>(g: T): T => {
    tagShared(g);
    geometries.push(g);
    return g;
  };

  // Calibrated fast PBR human materials (MeshStandardMaterial avoids expensive physical clearcoat/sheen passes on every frame)
  const skinMat = tagShared(
    new THREE.MeshStandardMaterial({
      map: isMale ? tex.maleSkinAlbedo : tex.femaleSkinAlbedo,
      bumpMap: tex.skinBump,
      bumpScale: 0.0035,
      roughness: 0.56,
      metalness: 0.0,
    })
  );

  const faceMat = tagShared(
    new THREE.MeshStandardMaterial({
      map: isMale ? tex.maleFaceMap : tex.femaleFaceMap,
      bumpMap: tex.skinBump,
      bumpScale: 0.003,
      roughness: 0.54,
      metalness: 0.0,
    })
  );

  const lipMat = tagShared(
    new THREE.MeshStandardMaterial({
      color: isMale ? 0x9e6058 : 0xb45c64,
      roughness: 0.36,
      metalness: 0.02,
    })
  );

  // Solid opaque eyeball with crisp wet cornea specular gleam
  const eyeMat = tagShared(
    new THREE.MeshStandardMaterial({
      map: isMale ? tex.maleEyeMap : tex.femaleEyeMap,
      roughness: 0.08,
      metalness: 0.06,
      envMapIntensity: 1.45,
    })
  );

  const browLashMat = tagShared(
    new THREE.MeshStandardMaterial({
      color: isMale ? 0x1d1511 : 0x281712,
      roughness: 0.76,
      metalness: 0.0,
    })
  );

  const hairMat = tagShared(
    new THREE.MeshStandardMaterial({
      map: isMale ? tex.maleHairMap : tex.femaleHairMap,
      bumpMap: tex.hairBump,
      bumpScale: 0.012,
      roughness: 0.36,
      metalness: 0.06,
    })
  );

  const topMat = tagShared(
    new THREE.MeshStandardMaterial({
      map: isMale ? tex.maleShirtMap : tex.femaleJacketMap,
      bumpMap: tex.fabricBump,
      bumpScale: 0.012,
      roughness: 0.8,
      metalness: 0.04,
    })
  );

  const innerTopMat = tagShared(
    new THREE.MeshStandardMaterial({
      color: isMale ? 0x1c2429 : 0x1d2326,
      bumpMap: tex.fabricBump,
      bumpScale: 0.008,
      roughness: 0.84,
      metalness: 0.02,
    })
  );

  const pantsMat = tagShared(
    new THREE.MeshStandardMaterial({
      map: tex.pantsMap,
      bumpMap: tex.fabricBump,
      bumpScale: 0.014,
      roughness: 0.82,
      metalness: 0.04,
    })
  );

  const leatherMat = tagShared(
    new THREE.MeshStandardMaterial({
      map: tex.leatherMap,
      bumpMap: tex.fabricBump,
      bumpScale: 0.009,
      roughness: 0.46,
      metalness: 0.08,
    })
  );

  const bootSoleMat = tagShared(
    new THREE.MeshStandardMaterial({
      color: 0x15181a,
      roughness: 0.88,
      metalness: 0.04,
    })
  );

  const metalMat = tagShared(
    new THREE.MeshStandardMaterial({
      color: 0xb6c3c9,
      roughness: 0.24,
      metalness: 0.86,
    })
  );

  const lampLensMat = tagShared(
    new THREE.MeshStandardMaterial({
      color: 0xeaf8ff,
      emissive: 0xc8f0ff,
      emissiveIntensity: 1.9,
      roughness: 0.1,
    })
  );

  // Pelvis & hips (deeply overlapping with torso & thighs)
  const pelvisGeo = reg(
    createLoftedBodyGeo(
      isMale
        ? [
            { y: -0.11, rx: 0.156, rz: 0.118, cz: -0.004 },
            { y: -0.02, rx: 0.174, rz: 0.125, backBoost: 0.016 },
            { y: 0.095, rx: 0.164, rz: 0.118 },
          ]
        : [
            { y: -0.11, rx: 0.162, rz: 0.122, cz: -0.006 },
            { y: -0.015, rx: 0.182, rz: 0.132, backBoost: 0.022 },
            { y: 0.095, rx: 0.15, rz: 0.112 },
          ],
      bodySegs
    )
  );

  // Sculpted torso extending down to -0.075 (overlaps cleanly inside pelvis/belt) up to 0.505
  const torsoGeo = reg(
    createLoftedBodyGeo(
      isMale
        ? [
            { y: -0.075, rx: 0.16, rz: 0.115 },
            { y: 0.02, rx: 0.162, rz: 0.116 },
            { y: 0.13, rx: 0.172, rz: 0.12 },
            { y: 0.26, rx: 0.198, rz: 0.136, frontBoost: 0.02, sternumPinch: 0.008, backBoost: 0.012 },
            { y: 0.375, rx: 0.216, rz: 0.138, frontBoost: 0.026, sternumPinch: 0.009, shoulderSquare: 1.0, backBoost: 0.014 },
            { y: 0.45, rx: 0.198, rz: 0.118, shoulderSquare: 1.0 },
            { y: 0.505, rx: 0.104, rz: 0.092 },
          ]
        : [
            { y: -0.075, rx: 0.152, rz: 0.112 },
            { y: 0.02, rx: 0.148, rz: 0.109 },
            { y: 0.12, rx: 0.138, rz: 0.102 },
            { y: 0.255, rx: 0.168, rz: 0.128, frontBoost: 0.036, sternumPinch: 0.012, backBoost: 0.01 },
            { y: 0.37, rx: 0.178, rz: 0.122, frontBoost: 0.018, backBoost: 0.012 },
            { y: 0.45, rx: 0.166, rz: 0.106 },
            { y: 0.505, rx: 0.094, rz: 0.086 },
          ],
      torsoSegs
    )
  );

  // Solid closed watertight collar + placket/lapels
  const collarParts: THREE.BufferGeometry[] = [];
  if (isMale) {
    collarParts.push(createClosedCollarRingGeo(0.465, 0.518, 0.074, 0.07, 0.098, 0.092, 0.004, bodySegs));
    const placket = new THREE.BoxGeometry(0.036, 0.14, 0.02);
    placket.translate(0, 0.395, 0.146);
    collarParts.push(placket);
    for (let b = 0; b < 3; b++) {
      const btn = new THREE.CylinderGeometry(0.006, 0.006, 0.009, 8);
      btn.rotateX(Math.PI / 2);
      btn.translate(0, 0.435 - b * 0.038, 0.156);
      collarParts.push(btn);
    }
  } else {
    collarParts.push(createClosedCollarRingGeo(0.465, 0.525, 0.068, 0.066, 0.095, 0.09, -0.002, bodySegs));
    for (const s of [-1, 1]) {
      const lapel = new THREE.BoxGeometry(0.038, 0.125, 0.022);
      lapel.rotateZ(s * 0.22);
      lapel.rotateY(s * -0.25);
      lapel.translate(s * 0.044, 0.408, 0.126);
      collarParts.push(lapel);
    }
    const zipPlacket = new THREE.BoxGeometry(0.024, 0.43, 0.02);
    zipPlacket.translate(0, 0.215, 0.134);
    collarParts.push(zipPlacket);
  }
  const collarGeo = reg(mergeGeometries(collarParts, false));
  collarParts.forEach((g) => g.dispose());
  collarGeo.computeVertexNormals();

  // Tactical cross-chest harness / waist pockets
  const harnessParts: THREE.BufferGeometry[] = [];
  if (isMale) {
    const strap = new THREE.TorusGeometry(0.18, 0.015, 7, bodySegs);
    strap.scale(1.06, 1.32, 0.8);
    strap.rotateZ(0.45);
    strap.translate(0, 0.28, 0.006);
    harnessParts.push(strap);
    const chestPack = new THREE.BoxGeometry(0.075, 0.095, 0.032);
    chestPack.translate(-0.08, 0.31, 0.152);
    harnessParts.push(chestPack);
  } else {
    for (const s of [-1, 1]) {
      const pocket = new THREE.BoxGeometry(0.072, 0.082, 0.026);
      pocket.rotateY(s * 0.24);
      pocket.translate(s * 0.092, 0.065, 0.118);
      harnessParts.push(pocket);
    }
  }
  const harnessGeo = reg(mergeGeometries(harnessParts, false));
  harnessParts.forEach((g) => g.dispose());
  harnessGeo.computeVertexNormals();

  const beltGeo = reg(
    createLoftedBodyGeo(
      isMale
        ? [
            { y: -0.026, rx: 0.172, rz: 0.125 },
            { y: 0.026, rx: 0.17, rz: 0.123 },
          ]
        : [
            { y: -0.024, rx: 0.156, rz: 0.118 },
            { y: 0.024, rx: 0.152, rz: 0.114 },
          ],
      bodySegs
    )
  );

  const buckleGeo = reg(new THREE.BoxGeometry(0.056, 0.044, 0.024));

  // Neck deeply anchored into upper chest (-0.075) and base of cranium (+0.11)
  const neckGeo = reg(
    createLoftedBodyGeo(
      isMale
        ? [
            { y: -0.075, rx: 0.072, rz: 0.068 },
            { y: -0.015, rx: 0.064, rz: 0.062 },
            { y: 0.045, rx: 0.058, rz: 0.058 },
            { y: 0.11, rx: 0.056, rz: 0.058 },
          ]
        : [
            { y: -0.075, rx: 0.062, rz: 0.058 },
            { y: -0.015, rx: 0.054, rz: 0.053 },
            { y: 0.045, rx: 0.049, rz: 0.049 },
            { y: 0.11, rx: 0.048, rz: 0.05 },
          ],
      limbSegs
    )
  );

  const headGeo = reg(createSculptedHeadGeometry(variant, compact));
  const noseBuilt = createHumanNoseGeometry(variant);
  const noseGeo = reg(noseBuilt.nose);
  const nostrilGeo = reg(noseBuilt.nostrils);

  const lipsBuilt = createSculptedLipsGeometry(variant);
  const upperLipGeo = reg(lipsBuilt.upper);
  const lowerLipGeo = reg(lipsBuilt.lower);

  const leftEarGeo = reg(createSculptedEarGeometry(-1, compact));
  const rightEarGeo = reg(createSculptedEarGeometry(1, compact));

  const eyeballGeo = reg(createPlanarUvEyeballGeometry(0.0128, compact));
  const lidsBuilt = createSolidEyelidGeometries();
  const upperEyelidGeo = reg(lidsBuilt.upper);
  const lowerEyelidGeo = reg(lidsBuilt.lower);

  const leftBrowGeo = reg(createSculptedBrowGeometry(variant, -1));
  const rightBrowGeo = reg(createSculptedBrowGeometry(variant, 1));

  const hairBuilt = buildHairGeometries(variant, compact);
  const hairCapGeo = reg(hairBuilt.capGeo);
  const hairTieGeo = hairBuilt.tieGeo ? reg(hairBuilt.tieGeo) : null;
  for (const lg of hairBuilt.lockGroups) {
    reg(lg.geo);
  }

  // Deltoid shoulder joint cap + upper arm + sleeve + elbow joint + forearm + cuff + L/R hands
  const shoulderCapGeo = reg(
    new THREE.SphereGeometry(isMale ? 0.058 : 0.05, jointSegsW, jointSegsH)
  );

  const upperArmGeo = reg(
    createLoftedBodyGeo(
      isMale
        ? [
            { y: -0.275, rx: 0.046, rz: 0.044 },
            { y: -0.145, rx: 0.056, rz: 0.054 },
            { y: -0.025, rx: 0.062, rz: 0.058 },
            { y: 0.045, rx: 0.054, rz: 0.052 },
          ]
        : [
            { y: -0.275, rx: 0.04, rz: 0.039 },
            { y: -0.145, rx: 0.047, rz: 0.046 },
            { y: -0.025, rx: 0.051, rz: 0.049 },
            { y: 0.042, rx: 0.046, rz: 0.044 },
          ],
      limbSegs
    )
  );

  const sleeveUpperGeo = reg(
    createLoftedBodyGeo(
      isMale
        ? [
            { y: -0.245, rx: 0.051, rz: 0.049 },
            { y: -0.13, rx: 0.06, rz: 0.058 },
            { y: -0.02, rx: 0.066, rz: 0.062 },
            { y: 0.042, rx: 0.056, rz: 0.054 },
          ]
        : [
            { y: -0.265, rx: 0.046, rz: 0.045 },
            { y: -0.13, rx: 0.053, rz: 0.052 },
            { y: -0.02, rx: 0.057, rz: 0.055 },
            { y: 0.04, rx: 0.049, rz: 0.047 },
          ],
      limbSegs
    )
  );

  const elbowGeo = reg(
    new THREE.SphereGeometry(isMale ? 0.045 : 0.04, compact ? 8 : 10, compact ? 7 : 8)
  );

  const forearmGeo = reg(
    createLoftedBodyGeo(
      isMale
        ? [
            { y: -0.232, rx: 0.033, rz: 0.03 },
            { y: -0.11, rx: 0.045, rz: 0.044 },
            { y: 0.018, rx: 0.046, rz: 0.045 },
          ]
        : [
            { y: -0.232, rx: 0.029, rz: 0.027 },
            { y: -0.11, rx: 0.039, rz: 0.038 },
            { y: 0.018, rx: 0.04, rz: 0.039 },
          ],
      limbSegs
    )
  );

  const cuffGeo = reg(
    createLoftedBodyGeo(
      isMale
        ? [
            { y: -0.095, rx: 0.048, rz: 0.047 },
            { y: -0.03, rx: 0.05, rz: 0.049 },
            { y: 0.022, rx: 0.049, rz: 0.048 },
          ]
        : [
            { y: -0.205, rx: 0.036, rz: 0.034 },
            { y: -0.1, rx: 0.045, rz: 0.044 },
            { y: 0.02, rx: 0.046, rz: 0.045 },
          ],
      limbSegs
    )
  );

  const leftHandGeo = reg(createSculptedHandGeometry(variant, -1, compact));
  const rightHandGeo = reg(createSculptedHandGeometry(variant, 1, compact));

  // Sculpted thigh & knee & calf/shin & boots
  const thighGeo = reg(
    createLoftedBodyGeo(
      isMale
        ? [
            { y: -0.425, rx: 0.062, rz: 0.062 },
            { y: -0.28, rx: 0.078, rz: 0.078, frontBoost: 0.008 },
            { y: -0.12, rx: 0.092, rz: 0.094, frontBoost: 0.01 },
            { y: 0.055, rx: 0.095, rz: 0.096 },
          ]
        : [
            { y: -0.425, rx: 0.056, rz: 0.056 },
            { y: -0.28, rx: 0.073, rz: 0.074, frontBoost: 0.007 },
            { y: -0.12, rx: 0.088, rz: 0.09, frontBoost: 0.008 },
            { y: 0.055, rx: 0.092, rz: 0.094 },
          ],
      limbSegs
    )
  );

  const kneeGeo = reg(new THREE.SphereGeometry(isMale ? 0.064 : 0.058, jointSegsW, jointSegsH));

  const shinGeo = reg(
    createLoftedBodyGeo(
      isMale
        ? [
            { y: -0.365, rx: 0.052, rz: 0.052 },
            { y: -0.22, rx: 0.064, rz: 0.066, backBoost: 0.008 },
            { y: -0.11, rx: 0.068, rz: 0.072, backBoost: 0.01 },
            { y: 0.02, rx: 0.062, rz: 0.062 },
          ]
        : [
            { y: -0.365, rx: 0.046, rz: 0.046 },
            { y: -0.22, rx: 0.058, rz: 0.06, backBoost: 0.007 },
            { y: -0.11, rx: 0.062, rz: 0.066, backBoost: 0.009 },
            { y: 0.02, rx: 0.056, rz: 0.056 },
          ],
      limbSegs
    )
  );

  const boot = createSculptedBootGeometries(variant, compact);
  const bootUpperGeo = reg(boot.upper);
  const bootSoleGeo = reg(boot.sole);

  const trimBandGeo = reg(
    new THREE.CylinderGeometry(isMale ? 0.047 : 0.042, isMale ? 0.047 : 0.042, 0.032, compact ? 12 : 14)
  );
  const lampBodyGeo = reg(new THREE.BoxGeometry(0.026, 0.038, 0.022));
  const lampLensGeo = reg(new THREE.CircleGeometry(0.009, 10));

  // Pre-merge static same-bone same-material sub-meshes once per variant to cut draw calls ~45% with identical geometry
  const headSkinMergedGeo = reg(
    bakeAndMergeStaticParts([
      { geo: neckGeo, py: -0.005 },
      { geo: noseGeo, py: 0.145, pz: 0.098, rx: -0.14 },
      { geo: upperEyelidGeo, px: -0.0305, py: 0.154, pz: 0.0835, ry: -0.08 },
      { geo: lowerEyelidGeo, px: -0.0305, py: 0.154, pz: 0.0835, ry: -0.08 },
      { geo: upperEyelidGeo, px: 0.0305, py: 0.154, pz: 0.0835, ry: 0.08 },
      { geo: lowerEyelidGeo, px: 0.0305, py: 0.154, pz: 0.0835, ry: 0.08 },
      { geo: leftEarGeo, px: -(isMale ? 0.085 : 0.08), py: 0.145, pz: -0.005 },
      { geo: rightEarGeo, px: isMale ? 0.085 : 0.08, py: 0.145, pz: -0.005 },
    ])
  );
  const headBrowNostrilMergedGeo = reg(
    bakeAndMergeStaticParts([
      { geo: nostrilGeo, py: 0.145, pz: 0.098, rx: -0.14 },
      { geo: leftBrowGeo, px: -0.031, py: isMale ? 0.174 : 0.176, pz: isMale ? 0.1005 : 0.098, ry: -0.18 },
      { geo: rightBrowGeo, px: 0.031, py: isMale ? 0.174 : 0.176, pz: isMale ? 0.1005 : 0.098, ry: 0.18 },
    ])
  );
  const headLipsMergedGeo = reg(
    bakeAndMergeStaticParts([
      { geo: upperLipGeo, py: 0.105, pz: isMale ? 0.1085 : 0.1075 },
      { geo: lowerLipGeo, py: 0.097, pz: isMale ? 0.1065 : 0.1055 },
    ])
  );
  const headEyesMergedGeo = reg(
    bakeAndMergeStaticParts([
      { geo: eyeballGeo, px: -0.0305, py: 0.154, pz: 0.0835, ry: -0.08 },
      { geo: eyeballGeo, px: 0.0305, py: 0.154, pz: 0.0835, ry: 0.08 },
    ])
  );
  const upperArmTopMergedGeo = reg(
    bakeAndMergeStaticParts([
      { geo: shoulderCapGeo, py: 0.005 },
      { geo: sleeveUpperGeo },
    ])
  );
  const lowerLegPantsMergedGeo = reg(
    bakeAndMergeStaticParts([
      { geo: kneeGeo },
      { geo: shinGeo },
    ])
  );

  const vp: CharacterVariantPool = {
    skinMat,
    faceMat,
    lipMat,
    eyeMat,
    browLashMat,
    hairMat,
    topMat,
    innerTopMat,
    pantsMat,
    leatherMat,
    bootSoleMat,
    metalMat,
    lampLensMat,
    geometries,
    pelvisGeo,
    torsoGeo,
    collarGeo,
    harnessGeo,
    beltGeo,
    buckleGeo,
    headGeo,
    headSkinMergedGeo,
    headBrowNostrilMergedGeo,
    headLipsMergedGeo,
    headEyesMergedGeo,
    hairCapGeo,
    hairTieGeo,
    hairLockGroups: hairBuilt.lockGroups,
    upperArmTopMergedGeo,
    upperArmGeo,
    elbowGeo,
    forearmGeo,
    cuffGeo,
    leftHandGeo,
    rightHandGeo,
    thighGeo,
    lowerLegPantsMergedGeo,
    bootUpperGeo,
    bootSoleGeo,
    trimBandGeo,
    lampBodyGeo,
    lampLensGeo,
  };

  applyTierToVariantPool(vp, tex, rootPool.quality);
  rootPool.variants[variant] = vp;
  return vp;
}

export function createRealisticHumanRig(
  textures: TextureBundle,
  characterId: CharacterId = 'male',
  accentColor: string | number = 0x52e0b6,
  isRemote = false
): PlayerRig {
  const root = new THREE.Group();
  const rootPool = getCharacterPool(textures);
  const pool = getCharacterVariantPool(textures, characterId);
  const isMale = characterId === 'male';

  const trimHex = _trimColorTmp.set(accentColor).getHexString();
  let trimMat = rootPool.trimMats.get(trimHex);
  if (!trimMat) {
    trimMat = tagShared(
      new THREE.MeshStandardMaterial({
        color: _trimColorTmp.getHex(),
        roughness: 0.42,
        metalness: 0.22,
      })
    );
    rootPool.trimMats.set(trimHex, trimMat);
  }

  const primaryShadowMeshes: THREE.Mesh[] = [];
  const detailShadowMeshes: THREE.Mesh[] = [];

  // Grounded at y=0, hips center at y=0.92 (identical height/joint contract for both characters)
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  const pelvis = new THREE.Mesh(pool.pelvisGeo, pool.pantsMat);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  primaryShadowMeshes.push(pelvis);
  hips.add(pelvis);

  const belt = new THREE.Mesh(pool.beltGeo, pool.leatherMat);
  belt.position.y = 0.055;
  hips.add(belt);

  const buckle = new THREE.Mesh(pool.buckleGeo, pool.metalMat);
  buckle.position.set(0, 0.055, isMale ? 0.123 : 0.115);
  hips.add(buckle);

  // Torso
  const torso = new THREE.Group();
  torso.position.y = 0.09;
  hips.add(torso);

  const torsoMesh = new THREE.Mesh(pool.torsoGeo, pool.topMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  primaryShadowMeshes.push(torsoMesh);
  torso.add(torsoMesh);

  const collarMesh = new THREE.Mesh(pool.collarGeo, isMale ? pool.topMat : pool.innerTopMat);
  torso.add(collarMesh);

  const harnessMesh = new THREE.Mesh(pool.harnessGeo, pool.leatherMat);
  harnessMesh.castShadow = true;
  detailShadowMeshes.push(harnessMesh);
  torso.add(harnessMesh);

  const chestLampBody = new THREE.Mesh(pool.lampBodyGeo, pool.metalMat);
  chestLampBody.position.set(isMale ? -0.072 : 0.068, 0.355, isMale ? 0.148 : 0.134);
  torso.add(chestLampBody);

  const chestLampLens = new THREE.Mesh(pool.lampLensGeo, pool.lampLensMat);
  chestLampLens.position.set(isMale ? -0.072 : 0.068, 0.355, (isMale ? 0.148 : 0.134) + 0.012);
  torso.add(chestLampLens);

  // Head + Anatomically Seated Facial Features + Solid Hair
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.54;
  torso.add(headGroup);

  const head = new THREE.Mesh(pool.headGeo, pool.faceMat);
  head.position.y = 0.148;
  head.castShadow = true;
  head.receiveShadow = true;
  primaryShadowMeshes.push(head);
  headGroup.add(head);

  // Merged static head features (neck+nose+lids+ears, brows+nostrils, lips, eyeballs -> 4 draw calls instead of 15)
  headGroup.add(new THREE.Mesh(pool.headSkinMergedGeo, pool.skinMat));
  headGroup.add(new THREE.Mesh(pool.headBrowNostrilMergedGeo, pool.browLashMat));
  headGroup.add(new THREE.Mesh(pool.headLipsMergedGeo, pool.lipMat));
  headGroup.add(new THREE.Mesh(pool.headEyesMergedGeo, pool.eyeMat));

  // Hair cap + tie band + dynamic hair locks
  const hairCap = new THREE.Mesh(pool.hairCapGeo, pool.hairMat);
  hairCap.position.set(0, 0.148, 0);
  hairCap.castShadow = true;
  detailShadowMeshes.push(hairCap);
  headGroup.add(hairCap);

  if (pool.hairTieGeo) {
    const hairTie = new THREE.Mesh(pool.hairTieGeo, pool.leatherMat);
    hairTie.position.set(0, 0.172, -0.118);
    headGroup.add(hairTie);
  }

  const hairNodes: HairPhysicsNode[] = [];
  const hairLockGroupsCreated: THREE.Group[] = [];
  for (let i = 0; i < pool.hairLockGroups.length; i++) {
    const def = pool.hairLockGroups[i];
    const g = new THREE.Group();
    g.position.set(def.anchor[0], def.anchor[1], def.anchor[2]);
    g.rotation.set(def.restPitch, def.restYaw, def.restRoll);

    const m = new THREE.Mesh(def.geo, pool.hairMat);
    m.castShadow = true;
    detailShadowMeshes.push(m);
    g.add(m);

    const parentGroup =
      def.parentIndex !== undefined && hairLockGroupsCreated[def.parentIndex]
        ? hairLockGroupsCreated[def.parentIndex]
        : headGroup;
    parentGroup.add(g);
    hairLockGroupsCreated.push(g);

    hairNodes.push({
      group: g,
      restPitch: def.restPitch,
      restRoll: def.restRoll,
      restYaw: def.restYaw,
      pitchFactor: def.pitchFactor,
      rollFactor: def.rollFactor,
      phaseOffset: def.phaseOffset,
      maxBackwardPitch: def.maxBackwardPitch,
      maxForwardPitch: def.maxForwardPitch,
    });
  }

  // Player forward headlamp Spotlight
  const lampAnchor = new THREE.Group();
  lampAnchor.position.set(0, 1.55, 0);
  root.add(lampAnchor);

  const headlamp = new THREE.SpotLight(0xe4f2fc, isRemote ? 0 : 5.6, 36, Math.PI / 3.85, 0.68, 1.26);
  headlamp.position.set(0, 0.27, 0.18);
  const lampTarget = new THREE.Object3D();
  lampTarget.position.set(0, -0.18, 7.5);
  if (!isRemote) {
    lampAnchor.add(lampTarget);
    headlamp.target = lampTarget;
    lampAnchor.add(headlamp);
  }

  // Arms (with rounded deltoid shoulder cap + elbow cap + properly wound L/R hands)
  const shoulderX = isMale ? 0.214 : 0.182;
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * shoulderX, 0.432, 0);
    torso.add(shoulder);

    const upperSkin = new THREE.Mesh(pool.upperArmGeo, pool.skinMat);
    shoulder.add(upperSkin);

    const sleeve = new THREE.Mesh(pool.upperArmTopMergedGeo, pool.topMat);
    sleeve.castShadow = true;
    detailShadowMeshes.push(sleeve);
    shoulder.add(sleeve);

    const forearm = new THREE.Group();
    forearm.position.y = -0.265;
    shoulder.add(forearm);

    const elbow = new THREE.Mesh(pool.elbowGeo, isMale ? pool.topMat : pool.skinMat);
    forearm.add(elbow);

    const lowerSkin = new THREE.Mesh(pool.forearmGeo, pool.skinMat);
    lowerSkin.castShadow = true;
    detailShadowMeshes.push(lowerSkin);
    forearm.add(lowerSkin);

    const cuff = new THREE.Mesh(pool.cuffGeo, pool.topMat);
    forearm.add(cuff);

    if (side === -1) {
      const trimBand = new THREE.Mesh(pool.trimBandGeo, trimMat);
      trimBand.position.y = -0.18;
      forearm.add(trimBand);
    }

    const handJoint = new THREE.Group();
    handJoint.position.y = -0.225;
    forearm.add(handJoint);

    const hand = new THREE.Mesh(side === -1 ? pool.leftHandGeo : pool.rightHandGeo, pool.skinMat);
    handJoint.add(hand);

    return { shoulder, forearm, handJoint };
  };

  // Legs (hip/knee/ankle/boot shaft overlapped cleanly; boot sole flush at y = 0.000)
  const hipX = isMale ? 0.104 : 0.102;
  const buildLeg = (side: -1 | 1) => {
    const hipJoint = new THREE.Group();
    hipJoint.position.set(side * hipX, -0.05, 0);
    hips.add(hipJoint);

    const thigh = new THREE.Mesh(pool.thighGeo, pool.pantsMat);
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    detailShadowMeshes.push(thigh);
    hipJoint.add(thigh);

    const shinJoint = new THREE.Group();
    shinJoint.position.y = -0.415; // world y = 0.455
    hipJoint.add(shinJoint);

    const shin = new THREE.Mesh(pool.lowerLegPantsMergedGeo, pool.pantsMat);
    shin.castShadow = true;
    shin.receiveShadow = true;
    detailShadowMeshes.push(shin);
    shinJoint.add(shin);

    const ankleJoint = new THREE.Group();
    ankleJoint.position.y = -0.375; // anatomical ankle height (0.08m above sole)
    shinJoint.add(ankleJoint);

    const bootGroup = new THREE.Group();
    bootGroup.position.y = -0.08; // boot sole flush at world y = 0.000
    ankleJoint.add(bootGroup);

    const bootUpper = new THREE.Mesh(pool.bootUpperGeo, pool.leatherMat);
    bootUpper.castShadow = true;
    detailShadowMeshes.push(bootUpper);
    bootGroup.add(bootUpper);

    const bootSole = new THREE.Mesh(pool.bootSoleGeo, pool.bootSoleMat);
    bootGroup.add(bootSole);

    return { hipJoint, shinJoint, ankleJoint };
  };

  const lArm = buildArm(-1);
  const rArm = buildArm(1);
  const lLeg = buildLeg(-1);
  const rLeg = buildLeg(1);

  const setShadowDetail = (tier: ActiveQualityTier) => {
    const castPrimary = tier !== 'smooth';
    const castDetail = tier === 'ultra' && !isRemote;
    for (let i = 0; i < primaryShadowMeshes.length; i++) primaryShadowMeshes[i].castShadow = castPrimary;
    for (let i = 0; i < detailShadowMeshes.length; i++) detailShadowMeshes[i].castShadow = castDetail;
  };
  setShadowDetail('standard');

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.frustumCulled = false;
    }
  });

  return {
    characterId,
    root,
    hips,
    torso,
    headGroup,
    leftArm: lArm.shoulder,
    leftForearm: lArm.forearm,
    leftHand: lArm.handJoint,
    rightArm: rArm.shoulder,
    rightForearm: rArm.forearm,
    rightHand: rArm.handJoint,
    leftLeg: lLeg.hipJoint,
    leftShin: lLeg.shinJoint,
    leftFoot: lLeg.ankleJoint,
    rightLeg: rLeg.hipJoint,
    rightShin: rLeg.shinJoint,
    rightFoot: rLeg.ankleJoint,
    headlamp,
    lampAnchor,
    pushAnimTimer: 0,
    pushedAnimTimer: 0,
    hairNodes,
    hairPitch: 0,
    hairPitchVel: 0,
    hairRoll: 0,
    hairRollVel: 0,
    prevHipsY: 0.92,
    prevTorsoX: 0,
    gaitPhase: 0,
    swimPhase: 0,
    prevAnimState: 'idle',
    airTime: 0,
    jumpTime: 0,
    landTimer: 0,
    landDuration: 0.22,
    landStrength: 0,
    deathTimer: -1,
    setVisible: (visible: boolean) => {
      root.visible = visible;
      hips.visible = visible;
      if (!isRemote) {
        headlamp.intensity = visible ? 5.6 : 0;
      }
    },
    setShadowDetail,
    dispose: () => {
      lampAnchor.removeFromParent();
      if (!isRemote) {
        headlamp.dispose();
      }
    },
  };
}

const _legPoseL = { thighX: 0, shinX: 0, footX: 0 };
const _legPoseR = { thighX: 0, shinX: 0, footX: 0 };
const _crawlArmL = { armX: 0, armY: 0, armZ: 0, foreX: 0, handX: 0 };
const _crawlArmR = { armX: 0, armY: 0, armZ: 0, foreX: 0, handX: 0 };

function solveWalkRunLeg(
  phase: number,
  swingAmp: number,
  sprintMix: number,
  walkMix: number,
  out: { thighX: number; shinX: number; footX: number }
) {
  // Phase 0 = left heel strike / forward extension, PI/2 = mid-stance, PI = push-off, 3PI/2 = swing peak
  const s = Math.sin(phase);
  const c = Math.cos(phase);

  // Asymmetric hip flexion: high knee drive forward, strong push-off extension back
  const forwardLift = Math.max(0, s);
  const backExt = Math.max(0, -s);
  const thighX = -forwardLift * swingAmp * (1.06 + sprintMix * 0.14) + backExt * swingAmp * (0.9 + walkMix * 0.08);

  // Biomechanical knee curve:
  // 1) Loading shock-absorption bend just after heel strike (c > 0, s > 0)
  // 2) Full push-off extension (s < 0, c < 0)
  // 3) High heel-kick recovery flexion during forward swing (c < 0, s around 0)
  const stanceLoad = Math.max(0, Math.sin(phase - 0.35)) * Math.max(0, c) * (0.18 + sprintMix * 0.12);
  const swingKick = Math.pow(Math.max(0, -c), 1.15) * (0.72 + walkMix * 0.12 + sprintMix * 0.72);
  const kneeExtend = Math.max(0, s) * Math.max(0, c) * 0.08;
  const shinX = Math.max(0.03, stanceLoad + swingKick - kneeExtend);

  // Anatomical ankle curve:
  // Heel strike dorsiflexion (-), flat mid-stance (0), explosive toe-off plantarflexion (+), swing toe clearance (-)
  const posS = Math.max(0, s);
  const heelStrike = posS * posS * Math.max(0, c) * -0.26;
  const pushOff = Math.pow(Math.max(0, -s), 1.4) * Math.max(0, -c * 0.6 + 0.55) * (0.36 + sprintMix * 0.16);
  const swingClear = Math.max(0, -c) * Math.max(0, s + 0.4) * -0.18;
  const footX = heelStrike + pushOff + swingClear;

  out.thighX = thighX;
  out.shinX = shinX;
  out.footX = footX;
  return out;
}

function solveCrawlArm(
  armPhase: number,
  side: -1 | 1,
  out: { armX: number; armY: number; armZ: number; foreX: number; handX: number }
) {
  const reach = Math.cos(armPhase);
  const pull = Math.sin(armPhase);
  out.armX = -1.45 + pull * 1.15;
  out.armZ = side * (0.24 + Math.max(0, -pull) * 0.34);
  out.armY = side * reach * 0.22;
  out.foreX = -0.34 - Math.max(0, reach) * 0.68 - Math.max(0, -pull) * 0.35;
  out.handX = 0.14 - Math.max(0, pull) * 0.24;
  return out;
}

function updateCharacterHairAndLamp(
  rig: PlayerRig,
  state: PlayerAnimState,
  horizSpeed: number,
  time: number,
  safeDt: number,
  isDead = false
): void {
  const safeSpeed = finiteOr(horizSpeed, 0);
  const safeTime = finiteOr(time, 0);
  const hipsY = finiteOr(rig.hips.position.y, 0.92);
  const torsoX = finiteOr(rig.torso.rotation.x, 0);
  const prevY = finiteOr(rig.prevHipsY, hipsY);
  const prevTX = finiteOr(rig.prevTorsoX, torsoX);
  const vertVel = THREE.MathUtils.clamp((hipsY - prevY) / safeDt, -12, 12);
  const torsoPitchVel = THREE.MathUtils.clamp((torsoX - prevTX) / safeDt, -12, 12);
  rig.prevHipsY = hipsY;
  rig.prevTorsoX = torsoX;

  let goalPitch = -Math.min(0.55, safeSpeed * 0.055) - torsoPitchVel * 0.04;
  let goalRoll = Math.sin(finiteOr(rig.gaitPhase, 0)) * Math.min(0.16, safeSpeed * 0.018);

  if (isDead) {
    goalPitch = -0.35;
    goalRoll = 0.18;
  } else if (state === 'jump') {
    goalPitch -= 0.14 + Math.max(0, vertVel) * 0.12;
  } else if (state === 'fall') {
    goalPitch -= 0.62 + Math.sin(safeTime * 13.0) * 0.12;
    goalRoll += Math.cos(safeTime * 9.5) * 0.16;
  } else if (state === 'swim') {
    const sp = finiteOr(rig.swimPhase, 0);
    goalPitch = -0.35 + Math.sin(sp) * 0.16;
    goalRoll = Math.cos(sp * 0.85) * 0.22;
  } else if (state === 'idle') {
    goalPitch = Math.sin(safeTime * 1.4) * 0.022;
    goalRoll = Math.cos(safeTime * 0.9) * 0.018;
  }

  rig.hairPitch = finiteOr(rig.hairPitch, 0);
  rig.hairPitchVel = finiteOr(rig.hairPitchVel, 0);
  rig.hairRoll = finiteOr(rig.hairRoll, 0);
  rig.hairRollVel = finiteOr(rig.hairRollVel, 0);

  const springK = 54;
  const damping = 8.5;
  const pitchAcc = (goalPitch - rig.hairPitch) * springK - rig.hairPitchVel * damping;
  const rollAcc = (goalRoll - rig.hairRoll) * springK - rig.hairRollVel * damping;
  rig.hairPitchVel = THREE.MathUtils.clamp(rig.hairPitchVel + pitchAcc * safeDt, -15, 15);
  rig.hairRollVel = THREE.MathUtils.clamp(rig.hairRollVel + rollAcc * safeDt, -15, 15);
  rig.hairPitch = THREE.MathUtils.clamp(rig.hairPitch + rig.hairPitchVel * safeDt, -1.1, 0.55);
  rig.hairRoll = THREE.MathUtils.clamp(rig.hairRoll + rig.hairRollVel * safeDt, -0.45, 0.45);

  for (let i = 0; i < rig.hairNodes.length; i++) {
    const hn = rig.hairNodes[i];
    const wave =
      Math.sin(safeTime * (state === 'swim' ? 4.2 : 6.4) + hn.phaseOffset) *
      (state === 'idle' || isDead ? 0.014 : Math.min(0.11, 0.024 + safeSpeed * 0.009));
    const swayYaw =
      Math.cos(safeTime * (state === 'swim' ? 3.2 : 4.8) + hn.phaseOffset) *
      (state === 'idle' || isDead ? 0.01 : Math.min(0.08, 0.018 + safeSpeed * 0.006)) *
      Math.abs(hn.rollFactor);
    const localPitch = THREE.MathUtils.clamp(
      rig.hairPitch * hn.pitchFactor + wave,
      hn.maxBackwardPitch,
      hn.maxForwardPitch
    );
    hn.group.rotation.x = hn.restPitch + localPitch;
    hn.group.rotation.y = hn.restYaw + swayYaw;
    hn.group.rotation.z = hn.restRoll + rig.hairRoll * hn.rollFactor;
  }

  const headBaseY = 0.09 + 0.54 * Math.cos(torsoX);
  const headBaseZ = 0.54 * Math.sin(torsoX);
  rig.lampAnchor.position.set(0, hipsY + headBaseY, headBaseZ);
  rig.lampAnchor.rotation.set(
    finiteOr(rig.hips.rotation.x, 0) + torsoX + finiteOr(rig.headGroup.rotation.x, 0),
    finiteOr(rig.hips.rotation.y, 0) + finiteOr(rig.torso.rotation.y, 0) + finiteOr(rig.headGroup.rotation.y, 0),
    finiteOr(rig.hips.rotation.z, 0) + finiteOr(rig.torso.rotation.z, 0)
  );
}

export function resetHumanRigPose(rig: PlayerRig): void {
  rig.root.visible = true;
  rig.hips.visible = true;
  rig.root.scale.setScalar(1);
  rig.root.rotation.set(0, 0, 0);
  rig.root.quaternion.identity();
  rig.hips.position.set(0, 0.92, 0);
  rig.hips.rotation.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);

  rig.leftArm.rotation.set(0, 0, -0.125);
  rig.rightArm.rotation.set(0, 0, 0.125);
  rig.leftForearm.rotation.set(-0.22, 0, 0);
  rig.rightForearm.rotation.set(-0.22, 0, 0);
  rig.leftHand.rotation.set(0.06, 0, 0);
  rig.rightHand.rotation.set(0.06, 0, 0);

  rig.leftLeg.rotation.set(0, 0, 0.022);
  rig.rightLeg.rotation.set(0, 0, -0.022);
  rig.leftShin.rotation.set(0.02, 0, 0);
  rig.rightShin.rotation.set(0.02, 0, 0);
  rig.leftFoot.rotation.set(0, 0, 0);
  rig.rightFoot.rotation.set(0, 0, 0);

  for (let i = 0; i < rig.hairNodes.length; i++) {
    const hn = rig.hairNodes[i];
    hn.group.rotation.set(hn.restPitch, hn.restYaw, hn.restRoll);
  }

  rig.hairPitch = 0;
  rig.hairPitchVel = 0;
  rig.hairRoll = 0;
  rig.hairRollVel = 0;
  rig.prevHipsY = 0.92;
  rig.prevTorsoX = 0;
  rig.gaitPhase = 0;
  rig.swimPhase = 0;
  rig.prevAnimState = 'idle';
  rig.airTime = 0;
  rig.jumpTime = 0;
  rig.landTimer = 0;
  rig.landDuration = 0.22;
  rig.landStrength = 0;
  rig.deathTimer = -1;
  rig.pushAnimTimer = 0;
  rig.pushedAnimTimer = 0;

  rig.lampAnchor.position.set(0, 1.55, 0);
  rig.lampAnchor.rotation.set(0, 0, 0);
  rig.root.updateMatrixWorld(true);
}

export function animateHumanDeath(rig: PlayerRig, progress: number, time: number, dt: number): void {
  const safeDt = Math.min(0.05, Math.max(0.001, dt));
  const u = THREE.MathUtils.clamp(progress, 0, 1);
  const k = Math.min(1, safeDt * 18);

  // 3-phase collapse: stagger & knee buckle (0..0.32) -> heavy fall forward/side (0.32..0.72) -> limp settle (0.72..1.0)
  const buckle = THREE.MathUtils.smoothstep(u, 0, 0.34);
  const fall = THREE.MathUtils.smoothstep(u, 0.28, 0.78);
  const settle = THREE.MathUtils.smoothstep(u, 0.72, 1.0);

  const targetHipsY = THREE.MathUtils.lerp(0.92, 0.56, buckle) * (1 - fall * 0.72);
  const targetHipsX = -fall * 0.06;
  const targetHipsPitch = fall * 1.38;
  const targetHipsRoll = buckle * 0.14 + fall * 0.28;
  const targetHipsYaw = buckle * -0.18;

  const targetTorsoX = buckle * 0.32 - fall * 0.16 + settle * 0.08;
  const targetTorsoY = buckle * 0.18 * (1 - settle);
  const targetTorsoZ = fall * 0.12;
  const targetHeadX = buckle * 0.28 + fall * -0.35 + settle * 0.14;
  const targetHeadY = fall * 0.22;

  const lArmX = THREE.MathUtils.lerp(-0.22, -0.85, buckle * (1 - fall)) - fall * 1.15 + settle * 0.25;
  const rArmX = THREE.MathUtils.lerp(0.14, -0.55, buckle * (1 - fall)) - fall * 0.92 + settle * 0.22;
  const lArmZ = -0.24 - fall * 0.38;
  const rArmZ = 0.22 + fall * 0.44;
  const lForeX = -0.45 - buckle * 0.45 + fall * 0.32;
  const rForeX = -0.38 - buckle * 0.38 + fall * 0.28;

  const lLegX = -buckle * 0.48 + fall * 0.36;
  const rLegX = -buckle * 0.24 + fall * 0.42;
  const lShinX = buckle * 1.05 * (1 - fall * 0.58) + settle * 0.25;
  const rShinX = buckle * 0.85 * (1 - fall * 0.52) + settle * 0.2;
  const lFootX = fall * 0.38;
  const rFootX = fall * 0.42;

  rig.hips.position.set(
    THREE.MathUtils.lerp(rig.hips.position.x, targetHipsX, k),
    THREE.MathUtils.lerp(rig.hips.position.y, Math.max(0.14, targetHipsY), k),
    0
  );
  rig.hips.rotation.set(
    THREE.MathUtils.lerp(rig.hips.rotation.x, targetHipsPitch, k),
    THREE.MathUtils.lerp(rig.hips.rotation.y, targetHipsYaw, k),
    THREE.MathUtils.lerp(rig.hips.rotation.z, targetHipsRoll, k)
  );
  rig.torso.rotation.set(
    THREE.MathUtils.lerp(rig.torso.rotation.x, targetTorsoX, k),
    THREE.MathUtils.lerp(rig.torso.rotation.y, targetTorsoY, k),
    THREE.MathUtils.lerp(rig.torso.rotation.z, targetTorsoZ, k)
  );
  rig.headGroup.rotation.set(
    THREE.MathUtils.lerp(rig.headGroup.rotation.x, targetHeadX, k),
    THREE.MathUtils.lerp(rig.headGroup.rotation.y, targetHeadY, k),
    0
  );

  rig.leftArm.rotation.set(
    THREE.MathUtils.lerp(rig.leftArm.rotation.x, lArmX, k),
    0,
    THREE.MathUtils.lerp(rig.leftArm.rotation.z, lArmZ, k)
  );
  rig.leftForearm.rotation.x = THREE.MathUtils.lerp(rig.leftForearm.rotation.x, lForeX, k);
  rig.leftHand.rotation.x = THREE.MathUtils.lerp(rig.leftHand.rotation.x, 0.18, k);

  rig.rightArm.rotation.set(
    THREE.MathUtils.lerp(rig.rightArm.rotation.x, rArmX, k),
    0,
    THREE.MathUtils.lerp(rig.rightArm.rotation.z, rArmZ, k)
  );
  rig.rightForearm.rotation.x = THREE.MathUtils.lerp(rig.rightForearm.rotation.x, rForeX, k);
  rig.rightHand.rotation.x = THREE.MathUtils.lerp(rig.rightHand.rotation.x, 0.18, k);

  rig.leftLeg.rotation.set(THREE.MathUtils.lerp(rig.leftLeg.rotation.x, lLegX, k), 0, 0.08);
  rig.leftShin.rotation.x = THREE.MathUtils.lerp(rig.leftShin.rotation.x, lShinX, k);
  rig.leftFoot.rotation.x = THREE.MathUtils.lerp(rig.leftFoot.rotation.x, lFootX, k);

  rig.rightLeg.rotation.set(THREE.MathUtils.lerp(rig.rightLeg.rotation.x, rLegX, k), 0, -0.08);
  rig.rightShin.rotation.x = THREE.MathUtils.lerp(rig.rightShin.rotation.x, rShinX, k);
  rig.rightFoot.rotation.x = THREE.MathUtils.lerp(rig.rightFoot.rotation.x, rFootX, k);

  updateCharacterHairAndLamp(rig, 'idle', 0, time, safeDt, true);
}

export function animateHumanRig(
  rig: PlayerRig,
  state: PlayerAnimState,
  horizSpeed: number,
  time: number,
  dt: number,
  deathProgress = -1
): void {
  const safeHorizSpeed = Number.isFinite(horizSpeed) ? Math.max(0, Math.min(20, horizSpeed)) : 0;
  const safeTime = Number.isFinite(time) ? time : 0;
  const safeDt = Math.min(0.05, Math.max(0.001, Number.isFinite(dt) ? dt : 0.016));
  const safeDeath = Number.isFinite(deathProgress) ? deathProgress : -1;

  if (safeDeath >= 0) {
    animateHumanDeath(rig, safeDeath, safeTime, safeDt);
    return;
  }

  // Self-heal if any accumulated phase or hip coordinate ever became non-finite
  if (!Number.isFinite(rig.gaitPhase)) rig.gaitPhase = 0;
  if (!Number.isFinite(rig.swimPhase)) rig.swimPhase = 0;
  if (!Number.isFinite(rig.hips.position.y)) {
    resetHumanRigPose(rig);
  }

  horizSpeed = safeHorizSpeed;
  time = safeTime;
  const wasAir = rig.prevAnimState === 'jump' || rig.prevAnimState === 'fall';
  const isAir = state === 'jump' || state === 'fall';
  const isGround = state === 'idle' || state === 'walk' || state === 'run';

  if (wasAir && isGround && rig.airTime > 0.08) {
    rig.landDuration = THREE.MathUtils.clamp(0.18 + rig.airTime * 0.22, 0.18, 0.34);
    rig.landTimer = rig.landDuration;
    rig.landStrength = THREE.MathUtils.clamp(0.42 + rig.airTime * 0.9, 0.42, 1.0);
  }
  if (isAir) {
    rig.airTime += safeDt;
    rig.jumpTime = state === 'jump' ? rig.jumpTime + safeDt : rig.jumpTime;
  } else {
    rig.airTime = 0;
    rig.jumpTime = 0;
  }
  rig.prevAnimState = state;

  const hasActionAnim = rig.pushAnimTimer > 0 || rig.pushedAnimTimer > 0 || rig.landTimer > 0;
  const k = Math.min(1, safeDt * (hasActionAnim ? 24 : 15));

  let targetHipsX = 0;
  let targetHipsY = 0.92;
  let targetHipsPitch = 0;
  let targetHipsYaw = 0;
  let targetHipsRoll = 0;

  let targetTorsoX = 0;
  let targetTorsoY = 0;
  let targetTorsoZ = 0;
  let targetHeadX = 0;
  let targetHeadY = 0;
  let targetHeadZ = 0;

  let lArmX = 0;
  let lArmY = 0;
  let lArmZ = -0.125;
  let lForeX = -0.18;
  let lHandX = 0;

  let rArmX = 0;
  let rArmY = 0;
  let rArmZ = 0.125;
  let rForeX = -0.18;
  let rHandX = 0;

  let lLegX = 0;
  let lLegZ = 0;
  let lShinX = 0.02;
  let lFootX = 0;

  let rLegX = 0;
  let rLegZ = 0;
  let rShinX = 0.02;
  let rFootX = 0;

  if (state === 'idle') {
    const breath = Math.sin(time * 1.85);
    const weightShift = Math.sin(time * 0.62);
    const lookScan = Math.sin(time * 0.48) * 0.075 + Math.sin(time * 1.15) * 0.022;

    targetHipsX = weightShift * 0.014;
    targetHipsY = 0.916 + breath * 0.007 - Math.abs(weightShift) * 0.004;
    targetHipsRoll = -weightShift * 0.024;
    targetHipsYaw = weightShift * 0.028;

    targetTorsoX = breath * 0.015;
    targetTorsoZ = weightShift * 0.02;
    targetTorsoY = -weightShift * 0.025;
    targetHeadY = lookScan;
    targetHeadX = breath * -0.012 + Math.sin(time * 0.7) * 0.015;

    // Slight relaxed stance alternation so knees & arms never freeze like a statue
    lLegX = weightShift > 0 ? 0.02 : -0.03;
    rLegX = weightShift > 0 ? -0.03 : 0.02;
    lLegZ = 0.022;
    rLegZ = -0.022;
    lShinX = Math.max(0.02, -weightShift * 0.055);
    rShinX = Math.max(0.02, weightShift * 0.055);
    lFootX = -lLegX - lShinX * 0.45;
    rFootX = -rLegX - rShinX * 0.45;

    lArmX = Math.sin(time * 1.25) * 0.028 + 0.02;
    rArmX = -Math.sin(time * 1.25) * 0.028 + 0.02;
    lArmZ = -(0.125 + breath * 0.008);
    rArmZ = 0.125 + breath * 0.008;
    lForeX = -0.22 + breath * 0.015;
    rForeX = -0.22 + breath * 0.015;
    lHandX = 0.06;
    rHandX = 0.06;
  } else if (state === 'walk' || state === 'run') {
    const speed = Math.max(0.8, horizSpeed);
    const runMix = state === 'run' ? 1 : THREE.MathUtils.smoothstep(speed, 5.2, 6.4);
    const sprintMix = state === 'run' ? THREE.MathUtils.smoothstep(speed, 7.2, 8.6) : 0;
    const walkMix = 1 - runMix;

    // Lock cadence directly to ground speed / biomechanical stride length -> zero foot sliding!
    const strideLen = THREE.MathUtils.lerp(1.48, THREE.MathUtils.lerp(2.26, 2.74, sprintMix), runMix);
    const cadence = (speed / strideLen) * Math.PI * 2;
    rig.gaitPhase = (rig.gaitPhase + cadence * safeDt) % (Math.PI * 2);
    const p = rig.gaitPhase;

    const swingAmp = THREE.MathUtils.lerp(
      THREE.MathUtils.clamp(0.42 + (speed / 5.7) * 0.24, 0.38, 0.68),
      THREE.MathUtils.lerp(0.82, 1.04, sprintMix),
      runMix
    );

    const leftLegPose = solveWalkRunLeg(p, swingAmp, sprintMix, walkMix, _legPoseL);
    const rightLegPose = solveWalkRunLeg(p + Math.PI, swingAmp, sprintMix, walkMix, _legPoseR);

    lLegX = leftLegPose.thighX;
    lShinX = leftLegPose.shinX;
    lFootX = leftLegPose.footX;

    rLegX = rightLegPose.thighX;
    rShinX = rightLegPose.shinX;
    rFootX = rightLegPose.footX;

    lLegZ = 0.015;
    rLegZ = -0.015;

    // Realistic CoM bounce, lateral weight shift over stance leg & pelvic/thoracic counter-twist
    const s = Math.sin(p);
    const c = Math.cos(p);
    const vertAmp = THREE.MathUtils.lerp(0.022, THREE.MathUtils.lerp(0.048, 0.066, sprintMix), runMix);
    targetHipsY = (walkMix * 0.908 + runMix * 0.892) - Math.cos(p * 2) * vertAmp;
    targetHipsX = -c * (0.026 * walkMix + 0.018 * runMix);
    targetHipsYaw = s * (0.075 * walkMix + 0.115 * runMix);
    targetHipsRoll = c * (0.042 * walkMix + 0.055 * runMix);

    targetTorsoX = THREE.MathUtils.lerp(0.065, THREE.MathUtils.lerp(0.20, 0.30, sprintMix), runMix);
    targetTorsoY = -s * (0.095 * walkMix + (0.14 + sprintMix * 0.05) * runMix);
    targetTorsoZ = -c * (0.028 * walkMix + 0.036 * runMix);
    targetHeadX = -targetTorsoX * 0.78;
    targetHeadY = s * 0.025;
    targetHeadZ = -targetTorsoZ * 0.5;

    // Opposite arm counterbalance with dynamic elbow curl & cross-chest sprint drive
    const armDrive = swingAmp * THREE.MathUtils.lerp(0.76, THREE.MathUtils.lerp(1.02, 1.18, sprintMix), runMix);
    lArmX = s * armDrive + (runMix * 0.08);
    rArmX = -s * armDrive + (runMix * 0.08);

    const baseAbduct = THREE.MathUtils.lerp(0.125, 0.16 + sprintMix * 0.04, runMix);
    lArmZ = -baseAbduct;
    rArmZ = baseAbduct;
    lArmY = -Math.max(0, -s) * (0.12 * runMix + 0.06 * sprintMix);
    rArmY = Math.max(0, s) * (0.12 * runMix + 0.06 * sprintMix);

    // Elbows flex more deeply on forward swing and open slightly on backswing
    const baseElbow = THREE.MathUtils.lerp(-0.32, THREE.MathUtils.lerp(-1.12, -1.36, sprintMix), runMix);
    const elbowSwing = THREE.MathUtils.lerp(0.18, 0.32, runMix);
    lForeX = baseElbow + s * elbowSwing;
    rForeX = baseElbow - s * elbowSwing;
    lHandX = THREE.MathUtils.lerp(0.06, -0.08, runMix);
    rHandX = THREE.MathUtils.lerp(0.06, -0.08, runMix);
  } else if (state === 'jump') {
    const launchBlend = THREE.MathUtils.smoothstep(rig.jumpTime, 0.02, 0.18);
    targetHipsY = THREE.MathUtils.lerp(0.9, 0.96, launchBlend);
    targetHipsPitch = THREE.MathUtils.lerp(0.08, -0.04, launchBlend);
    targetTorsoX = THREE.MathUtils.lerp(0.16, 0.1, launchBlend);
    targetTorsoY = 0.06;
    targetHeadX = -0.1;

    // Dynamic leap: lead knee snaps up, push-off leg trails behind then tucks slightly
    lLegX = THREE.MathUtils.lerp(-0.25, -0.68, launchBlend);
    lShinX = THREE.MathUtils.lerp(0.35, 1.12, launchBlend);
    lFootX = THREE.MathUtils.lerp(0.28, -0.12, launchBlend);

    rLegX = THREE.MathUtils.lerp(0.38, 0.2, launchBlend);
    rShinX = THREE.MathUtils.lerp(0.12, 0.44, launchBlend);
    rFootX = THREE.MathUtils.lerp(0.45, 0.25, launchBlend);

    // Arms drive upward on takeoff then stabilize forward
    lArmX = THREE.MathUtils.lerp(-1.12, -0.78, launchBlend);
    rArmX = THREE.MathUtils.lerp(-0.55, -0.68, launchBlend);
    lArmZ = -0.24;
    rArmZ = 0.24;
    lForeX = -0.62;
    rForeX = -0.52;
  } else if (state === 'fall') {
    const airFactor = THREE.MathUtils.smoothstep(rig.airTime, 0.05, 0.45);
    const balanceCycle = Math.sin(time * 5.2);

    targetHipsY = 0.93;
    targetHipsPitch = -0.06 * airFactor;
    targetTorsoX = THREE.MathUtils.lerp(0.06, -0.08, airFactor);
    targetHeadX = 0.14;

    // Wind-bracing arms & anticipatory split-leg readiness for ground touch
    lArmX = -1.08 + balanceCycle * 0.11;
    rArmX = -0.96 - balanceCycle * 0.11;
    lArmZ = -(0.44 + Math.cos(time * 4.4) * 0.06);
    rArmZ = 0.44 + Math.cos(time * 4.4) * 0.06;
    lForeX = -0.48;
    rForeX = -0.54;

    lLegX = -0.28 + balanceCycle * 0.08;
    rLegX = 0.14 - balanceCycle * 0.08;
    lShinX = 0.46;
    rShinX = 0.56;
    lFootX = 0.24;
    rFootX = 0.28;
  } else if (state === 'swim') {
    const moving = horizSpeed > 0.55;
    const strokeRate = moving ? 4.4 + THREE.MathUtils.clamp(horizSpeed * 0.45, 0, 2.2) : 2.6;
    rig.swimPhase = (rig.swimPhase + strokeRate * safeDt) % (Math.PI * 2);
    const p = rig.swimPhase;

    if (moving) {
      // Streamlined front-crawl freestyle with coordinated body roll & 6-beat flutter kick
      const roll = Math.sin(p) * 0.26;
      targetHipsY = 0.64 + Math.sin(p * 2) * 0.025;
      targetHipsPitch = 0.36;
      targetHipsRoll = roll;
      targetTorsoX = 0.54;
      targetTorsoY = -roll * 0.65;
      targetHeadX = -0.78;
      targetHeadY = -roll * 0.35;

      // Left & right alternating crawl stroke (reach overhead -> pull deep -> hip push -> high elbow recovery)
      const la = solveCrawlArm(p, -1, _crawlArmL);
      const ra = solveCrawlArm(p + Math.PI, 1, _crawlArmR);

      lArmX = la.armX;
      lArmY = la.armY;
      lArmZ = la.armZ;
      lForeX = la.foreX;
      lHandX = la.handX;

      rArmX = ra.armX;
      rArmY = ra.armY;
      rArmZ = ra.armZ;
      rForeX = ra.foreX;
      rHandX = ra.handX;

      // 6-beat hydrodynamic flutter kick with trailing knees & pointed boots
      const kickP = p * 3.0;
      const kL = Math.sin(kickP);
      const kR = -kL;
      lLegX = 0.26 + kL * 0.36;
      rLegX = 0.26 + kR * 0.36;
      lShinX = 0.22 + Math.max(0, -Math.cos(kickP)) * 0.32;
      rShinX = 0.22 + Math.max(0, Math.cos(kickP)) * 0.32;
      lFootX = 0.45 + kL * 0.12;
      rFootX = 0.45 + kR * 0.12;
    } else {
      // Calm upright treading water with figure-8 sculling hands & alternating kick
      targetHipsY = 0.60 + Math.sin(p) * 0.042;
      targetTorsoX = 0.16;
      targetTorsoY = Math.sin(p * 0.5) * 0.08;
      targetHeadX = -0.14;

      const scull = Math.sin(p);
      const scullOut = Math.cos(p);
      lArmX = -0.58 + scull * 0.24;
      rArmX = -0.58 - scull * 0.24;
      lArmZ = -(0.52 + scullOut * 0.28);
      rArmZ = 0.52 + scullOut * 0.28;
      lForeX = -0.72 + scullOut * 0.16;
      rForeX = -0.72 - scullOut * 0.16;

      lLegX = -0.18 + Math.sin(p * 1.5) * 0.34;
      rLegX = -0.18 - Math.sin(p * 1.5) * 0.34;
      lShinX = 0.58 + Math.cos(p * 1.5) * 0.26;
      rShinX = 0.58 - Math.cos(p * 1.5) * 0.26;
      lFootX = 0.34;
      rFootX = 0.34;
    }
  }

  // Natural kinetic landing shock-absorption blend (never snaps!)
  if (rig.landTimer > 0) {
    rig.landTimer = Math.max(0, rig.landTimer - safeDt);
    const lu = 1 - rig.landTimer / Math.max(0.08, rig.landDuration);
    const landEnv = Math.sin(Math.PI * Math.pow(lu, 0.62)) * rig.landStrength;
    targetHipsY -= landEnv * 0.14;
    targetTorsoX += landEnv * 0.22;
    targetHeadX -= landEnv * 0.16;
    lLegX -= landEnv * 0.28;
    rLegX -= landEnv * 0.28;
    lShinX += landEnv * 0.56;
    rShinX += landEnv * 0.56;
    lFootX -= landEnv * 0.26;
    rFootX -= landEnv * 0.26;
    lArmZ -= landEnv * 0.2;
    rArmZ += landEnv * 0.2;
    lArmX += landEnv * 0.16;
    rArmX += landEnv * 0.16;
  }

  if (rig.pushAnimTimer > 0) {
    rig.pushAnimTimer = Math.max(0, rig.pushAnimTimer - safeDt);
    const u = Math.max(0, Math.min(1, 1 - rig.pushAnimTimer / 0.38));
    const shove = Math.sin(Math.PI * Math.pow(u, 0.65));
    targetTorsoX += shove * 0.42;
    targetHeadX -= shove * 0.2;
    lArmX = THREE.MathUtils.lerp(lArmX, -1.52, shove * 0.92);
    rArmX = THREE.MathUtils.lerp(rArmX, -1.52, shove * 0.92);
    lArmZ = THREE.MathUtils.lerp(lArmZ, -0.06, shove);
    rArmZ = THREE.MathUtils.lerp(rArmZ, 0.06, shove);
    lForeX = THREE.MathUtils.lerp(lForeX, -0.08, shove * 0.9);
    rForeX = THREE.MathUtils.lerp(rForeX, -0.08, shove * 0.9);
    lHandX = THREE.MathUtils.lerp(lHandX, -0.45, shove * 0.8);
    rHandX = THREE.MathUtils.lerp(rHandX, -0.45, shove * 0.8);
  }

  if (rig.pushedAnimTimer > 0) {
    rig.pushedAnimTimer = Math.max(0, rig.pushedAnimTimer - safeDt);
    const v = Math.max(0, Math.min(1, 1 - rig.pushedAnimTimer / 0.45));
    const stagger = Math.sin(Math.PI * Math.pow(v, 0.6));
    targetHipsY -= stagger * 0.06;
    targetTorsoX -= stagger * 0.48;
    targetHeadX += stagger * 0.32;
    lArmX -= stagger * 0.75;
    rArmX -= stagger * 0.75;
    lArmZ -= stagger * 0.52;
    rArmZ += stagger * 0.52;
  }

  rig.hips.position.x = safeLerp(rig.hips.position.x, targetHipsX, k, 0);
  rig.hips.position.y = safeLerp(rig.hips.position.y, targetHipsY, k, 0.92);
  rig.hips.position.z = 0;
  rig.hips.rotation.x = safeLerp(rig.hips.rotation.x, targetHipsPitch, k, 0);
  rig.hips.rotation.y = safeLerp(rig.hips.rotation.y, targetHipsYaw, k, 0);
  rig.hips.rotation.z = safeLerp(rig.hips.rotation.z, targetHipsRoll, k, 0);

  rig.torso.rotation.x = safeLerp(rig.torso.rotation.x, targetTorsoX, k, 0);
  rig.torso.rotation.y = safeLerp(rig.torso.rotation.y, targetTorsoY, k, 0);
  rig.torso.rotation.z = safeLerp(rig.torso.rotation.z, targetTorsoZ, k, 0);

  rig.headGroup.rotation.x = safeLerp(rig.headGroup.rotation.x, targetHeadX, k, 0);
  rig.headGroup.rotation.y = safeLerp(rig.headGroup.rotation.y, targetHeadY, k * 0.65, 0);
  rig.headGroup.rotation.z = safeLerp(rig.headGroup.rotation.z, targetHeadZ, k, 0);

  rig.leftArm.rotation.x = safeLerp(rig.leftArm.rotation.x, lArmX, k, 0);
  rig.leftArm.rotation.y = safeLerp(rig.leftArm.rotation.y, lArmY, k, 0);
  rig.leftArm.rotation.z = safeLerp(rig.leftArm.rotation.z, lArmZ, k, -0.125);
  rig.leftForearm.rotation.x = safeLerp(rig.leftForearm.rotation.x, lForeX, k, -0.22);
  rig.leftHand.rotation.x = safeLerp(rig.leftHand.rotation.x, lHandX, k, 0.06);

  rig.rightArm.rotation.x = safeLerp(rig.rightArm.rotation.x, rArmX, k, 0);
  rig.rightArm.rotation.y = safeLerp(rig.rightArm.rotation.y, rArmY, k, 0);
  rig.rightArm.rotation.z = safeLerp(rig.rightArm.rotation.z, rArmZ, k, 0.125);
  rig.rightForearm.rotation.x = safeLerp(rig.rightForearm.rotation.x, rForeX, k, -0.22);
  rig.rightHand.rotation.x = safeLerp(rig.rightHand.rotation.x, rHandX, k, 0.06);

  rig.leftLeg.rotation.x = safeLerp(rig.leftLeg.rotation.x, lLegX, k, 0);
  rig.leftLeg.rotation.z = safeLerp(rig.leftLeg.rotation.z, lLegZ, k, 0.022);
  rig.leftShin.rotation.x = safeLerp(rig.leftShin.rotation.x, lShinX, k, 0.02);
  rig.leftFoot.rotation.x = safeLerp(rig.leftFoot.rotation.x, lFootX, k, 0);

  rig.rightLeg.rotation.x = safeLerp(rig.rightLeg.rotation.x, rLegX, k, 0);
  rig.rightLeg.rotation.z = safeLerp(rig.rightLeg.rotation.z, rLegZ, k, -0.022);
  rig.rightShin.rotation.x = safeLerp(rig.rightShin.rotation.x, rShinX, k, 0.02);
  rig.rightFoot.rotation.x = safeLerp(rig.rightFoot.rotation.x, rFootX, k, 0);

  updateCharacterHairAndLamp(rig, state, horizSpeed, time, safeDt, false);
}
