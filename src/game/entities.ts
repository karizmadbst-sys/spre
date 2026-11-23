import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  animateHumanDeath,
  animateHumanRig,
  createRealisticHumanRig,
  disposeCharacterResources,
  markCharacterTexturesDirty,
  resetHumanRigPose,
  setCharacterQualityTier,
  type HairPhysicsNode,
  type PlayerAnimState,
  type PlayerRig,
} from './characters';
import { TextureBundle } from './textures';
import type { ActiveQualityTier, CharacterId } from './types';

export type { HairPhysicsNode, PlayerAnimState, PlayerRig };
export { markCharacterTexturesDirty as markEntityTexturesDirty };

function tagShared<T extends THREE.BufferGeometry | THREE.Material>(obj: T): T {
  obj.userData.sharedPool = true;
  return obj;
}

interface MonsterSharedPool {
  skinMat: THREE.MeshStandardMaterial;
  finMat: THREE.MeshStandardMaterial;
  hornMat: THREE.MeshStandardMaterial;
  mouthMat: THREE.MeshStandardMaterial;
  eyeIrisMat: THREE.MeshStandardMaterial;
  corneaMat: THREE.MeshStandardMaterial;
  toothMat: THREE.MeshStandardMaterial;
  upperSkullGeo: THREE.BufferGeometry;
  palateGeo: THREE.BufferGeometry;
  mergedHornsGeo: THREE.BufferGeometry | null;
  mergedLowerHornsGeo: THREE.BufferGeometry | null;
  headCrestGeo: THREE.BufferGeometry;
  eyeballGeo: THREE.BufferGeometry;
  corneaGeo: THREE.BufferGeometry;
  mergedUpperTeeth: THREE.BufferGeometry | null;
  lowerJawGeo: THREE.BufferGeometry;
  sublingualGeo: THREE.BufferGeometry;
  mergedLowerTeeth: THREE.BufferGeometry | null;
  tendonGeo: THREE.BufferGeometry;
  mergedTongueGeo: THREE.BufferGeometry | null;
  wakeRingGeo: THREE.BufferGeometry;
  scaledBodies: Map<string, { bodyGeo: THREE.BufferGeometry; finGeo: THREE.BufferGeometry; bowGeo: THREE.BufferGeometry }>;
}

interface PropSharedPool {
  cpBaseMat: THREE.MeshStandardMaterial;
  cpCollarMat: THREE.MeshStandardMaterial;
  cpBasePlateGeo: THREE.BufferGeometry;
  cpInnerRingGeo: THREE.BufferGeometry;
  cpStrutGeo: THREE.BufferGeometry;
  cpRingGeo: THREE.BufferGeometry;
  cpCoreGeo: THREE.BufferGeometry;
  exitFrameMat: THREE.MeshStandardMaterial;
  exitTrimSteelMat: THREE.MeshStandardMaterial;
  exitGlowMat: THREE.MeshStandardMaterial;
  exitBollardGeo: THREE.BufferGeometry;
  exitCapGeo: THREE.BufferGeometry;
  exitSignHousingGeo: THREE.BufferGeometry;
  exitSignGeo: THREE.BufferGeometry;
  exitSizedGeos: Map<
    string,
    {
      postGeo: THREE.BufferGeometry;
      footGeo: THREE.BufferGeometry;
      ribGeo: THREE.BufferGeometry;
      lintelGeo: THREE.BufferGeometry;
      upperBeamGeo: THREE.BufferGeometry;
      thresholdGeo: THREE.BufferGeometry;
      portalGeo: THREE.BufferGeometry;
    }
  >;
}

interface EntityResourcePool {
  textures: TextureBundle;
  quality: ActiveQualityTier;
  monster?: MonsterSharedPool;
  props?: PropSharedPool;
}

const entityPools = new WeakMap<TextureBundle, EntityResourcePool>();

function getEntityPool(textures: TextureBundle): EntityResourcePool {
  let pool = entityPools.get(textures);
  if (!pool) {
    pool = { textures, quality: 'standard' };
    entityPools.set(textures, pool);
  }
  return pool;
}

let fallbackPropPool: PropSharedPool | null = null;
function getPropSharedPool(): PropSharedPool {
  if (fallbackPropPool) return fallbackPropPool;
  fallbackPropPool = {
    cpBaseMat: tagShared(new THREE.MeshStandardMaterial({ color: 0x1b2225, roughness: 0.58, metalness: 0.72 })),
    cpCollarMat: tagShared(new THREE.MeshStandardMaterial({ color: 0x677479, roughness: 0.36, metalness: 0.84 })),
    cpBasePlateGeo: tagShared(new THREE.CylinderGeometry(0.84, 0.96, 0.12, 8)),
    cpInnerRingGeo: tagShared(new THREE.CylinderGeometry(0.62, 0.68, 0.08, 16)),
    cpStrutGeo: tagShared(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 8)),
    cpRingGeo: tagShared(new THREE.TorusGeometry(0.58, 0.05, 12, 28)),
    cpCoreGeo: tagShared(new THREE.OctahedronGeometry(0.2, 1)),
    exitFrameMat: tagShared(new THREE.MeshStandardMaterial({ color: 0x151c1f, roughness: 0.5, metalness: 0.78 })),
    exitTrimSteelMat: tagShared(new THREE.MeshStandardMaterial({ color: 0x6b797f, roughness: 0.34, metalness: 0.86 })),
    exitGlowMat: tagShared(
      new THREE.MeshStandardMaterial({
        color: 0x72f2c8,
        emissive: 0x38d9a9,
        emissiveIntensity: 2.1,
        roughness: 0.14,
        transparent: true,
        opacity: 0.84,
        side: THREE.DoubleSide,
      })
    ),
    exitBollardGeo: tagShared(new THREE.CylinderGeometry(0.09, 0.11, 0.95, 12)),
    exitCapGeo: tagShared(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 12)),
    exitSignHousingGeo: tagShared(new THREE.BoxGeometry(1.75, 0.4, 0.72)),
    exitSignGeo: tagShared(new THREE.BoxGeometry(1.52, 0.24, 0.76)),
    exitSizedGeos: new Map(),
  };
  return fallbackPropPool;
}

export function setEntityQualityTier(textures: TextureBundle, tier: ActiveQualityTier): void {
  const pool = getEntityPool(textures);
  pool.quality = tier;
  setCharacterQualityTier(textures, tier);
  if (pool.monster) {
    const m = pool.monster;
    const isSmooth = tier === 'smooth';
    const isUltra = tier === 'ultra';
    const nScale = isSmooth ? 0.35 : textures.compact ? 1.75 : isUltra ? 2.05 : 1.85;
    m.skinMat.normalScale.set(nScale, nScale);
    m.skinMat.roughness = textures.compact ? 0.22 : 0.28;
    m.skinMat.envMapIntensity = isSmooth ? 0.92 : isUltra ? 1.56 : 1.32;
    const nextClearcoat = isSmooth ? 0.22 : isUltra ? 1.0 : 0.78;
    if ('clearcoat' in m.skinMat) {
      (m.skinMat as THREE.MeshPhysicalMaterial).clearcoat = nextClearcoat;
    }
    if ('clearcoat' in m.finMat) {
      (m.finMat as THREE.MeshPhysicalMaterial).clearcoat = isSmooth ? 0.2 : isUltra ? 0.92 : 0.74;
    }
    if ('clearcoat' in m.mouthMat) {
      (m.mouthMat as THREE.MeshPhysicalMaterial).clearcoat = isSmooth ? 0.25 : isUltra ? 1.0 : 0.82;
    }
    if ('clearcoat' in m.toothMat) {
      (m.toothMat as THREE.MeshPhysicalMaterial).clearcoat = isSmooth ? 0.2 : isUltra ? 0.9 : 0.7;
    }
  }
}

export function disposeEntityResources(textures: TextureBundle): void {
  disposeCharacterResources(textures);
  const pool = entityPools.get(textures);
  if (pool) {
    if (pool.monster) {
      const m = pool.monster;
      m.upperSkullGeo.dispose();
      m.palateGeo.dispose();
      m.mergedHornsGeo?.dispose();
      m.mergedLowerHornsGeo?.dispose();
      m.headCrestGeo.dispose();
      m.eyeballGeo.dispose();
      m.corneaGeo.dispose();
      m.mergedUpperTeeth?.dispose();
      m.lowerJawGeo.dispose();
      m.sublingualGeo.dispose();
      m.mergedLowerTeeth?.dispose();
      m.tendonGeo.dispose();
      m.mergedTongueGeo?.dispose();
      m.wakeRingGeo.dispose();
      m.scaledBodies.forEach((sb) => {
        sb.bodyGeo.dispose();
        sb.finGeo.dispose();
        sb.bowGeo.dispose();
      });
      m.scaledBodies.clear();
      m.skinMat.dispose();
      m.finMat.dispose();
      m.hornMat.dispose();
      m.mouthMat.dispose();
      m.eyeIrisMat.dispose();
      m.corneaMat.dispose();
      m.toothMat.dispose();
    }
    entityPools.delete(textures);
  }
  if (fallbackPropPool) {
    const pr = fallbackPropPool;
    pr.cpBaseMat.dispose();
    pr.cpCollarMat.dispose();
    pr.cpBasePlateGeo.dispose();
    pr.cpInnerRingGeo.dispose();
    pr.cpStrutGeo.dispose();
    pr.cpRingGeo.dispose();
    pr.cpCoreGeo.dispose();
    pr.exitFrameMat.dispose();
    pr.exitTrimSteelMat.dispose();
    pr.exitGlowMat.dispose();
    pr.exitBollardGeo.dispose();
    pr.exitCapGeo.dispose();
    pr.exitSignHousingGeo.dispose();
    pr.exitSignGeo.dispose();
    pr.exitSizedGeos.forEach((sg) => {
      sg.postGeo.dispose();
      sg.footGeo.dispose();
      sg.ribGeo.dispose();
      sg.lintelGeo.dispose();
      sg.upperBeamGeo.dispose();
      sg.thresholdGeo.dispose();
      sg.portalGeo.dispose();
    });
    pr.exitSizedGeos.clear();
    fallbackPropPool = null;
  }
}

export function createPlayerRig(
  textures: TextureBundle,
  accentColor: string | number = 0x52e0b6,
  isRemote = false,
  characterId: CharacterId = 'male'
): PlayerRig {
  const rig = createRealisticHumanRig(textures, characterId, accentColor, isRemote);
  rig.setShadowDetail(getEntityPool(textures).quality);
  return rig;
}

export function createNameplateSprite(username: string, accentColor: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(8, 16, 19, 0.78)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 232, 40, 12);
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#eaf6f8';
    ctx.font = 'bold 22px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.slice(0, 16), 128, 33);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.85, 0.46, 1);
  sprite.position.set(0, 2.08, 0);
  return sprite;
}

export function animatePlayerRig(
  rig: PlayerRig,
  state: PlayerAnimState,
  horizSpeed: number,
  time: number,
  dt: number,
  deathProgress = -1
): void {
  animateHumanRig(rig, state, horizSpeed, time, dt, deathProgress);
}

export function animatePlayerDeath(
  rig: PlayerRig,
  deathProgress: number,
  time: number,
  dt: number
): void {
  animateHumanDeath(rig, deathProgress, time, dt);
}

export function resetPlayerRigPose(rig: PlayerRig): void {
  resetHumanRigPose(rig);
}

export interface SerpentSegment {
  group: THREE.Object3D;
  bone: THREE.Bone;
  worldPos: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
  radius: number;
}

export type SerpentIntimidationPhase =
  | 'none'
  | 'approaching'
  | 'rising'
  | 'staring'
  | 'lowering'
  | 'retreating';

export interface SerpentIntimidationAnim {
  phase: SerpentIntimidationPhase;
  phaseProgress: number;
  stareElapsed: number;
}

export interface MonsterRig {
  root: THREE.Group;
  headAssembly: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  jaw: THREE.Group;
  jawTendons: THREE.Mesh[];
  tongue: THREE.Group;
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  segments: SerpentSegment[];
  bodyMesh: THREE.SkinnedMesh;
  finMesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  wakeRing: THREE.Mesh;
  bowWake: THREE.Mesh;
  scale: number;
  swimPhase: number;
  emergeAmount: number;
  intimidationBlend: number;
  prevHeadPos: THREE.Vector3;
  prevHeadYaw: number;
  smoothedSpeed: number;
  smoothedTurnRate: number;
  lungeAmount: number;
  hasPrevFrame: boolean;
  setShadowDetail: (tier: ActiveQualityTier) => void;
  dispose: () => void;
}

const SERPENT_BONE_COUNT = 24;
const SERPENT_BONE_STEP = 0.86;

function buildContinuousSerpentBodyGeometry(scale: number, compact = false): THREE.BufferGeometry {
  const axialRings = compact ? 96 : 136;
  const radialSegs = compact ? 22 : 32;
  const totalLength = (SERPENT_BONE_COUNT - 1) * SERPENT_BONE_STEP; // ~19.78m before scale
  const zStart = 0.28; // locks deeply into rear skull collar
  const zSpan = totalLength + 0.62;

  const vertCount = (axialRings + 1) * (radialSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const skinIndices = new Uint16Array(vertCount * 4);
  const skinWeights = new Float32Array(vertCount * 4);

  const assignBoneWeights = (vIdx: number, zWorldUnscaled: number) => {
    const fb = THREE.MathUtils.clamp(-zWorldUnscaled / SERPENT_BONE_STEP, 0, SERPENT_BONE_COUNT - 1);
    const center = Math.round(fb);
    const candidates: number[] = [];
    for (let d = -1; d <= 1; d++) {
      const bi = THREE.MathUtils.clamp(center + d, 0, SERPENT_BONE_COUNT - 1);
      if (!candidates.includes(bi)) candidates.push(bi);
    }
    let wSum = 0;
    const rawW = [0, 0, 0, 0];
    const bIds = [0, 0, 0, 0];
    for (let k = 0; k < candidates.length; k++) {
      const bi = candidates[k];
      const dist = fb - bi;
      const w = Math.exp(-(dist * dist) / 0.5);
      bIds[k] = bi;
      rawW[k] = w;
      wSum += w;
    }
    const base = vIdx * 4;
    for (let k = 0; k < 4; k++) {
      skinIndices[base + k] = bIds[k];
      skinWeights[base + k] = wSum > 0 ? rawW[k] / wSum : k === 0 ? 1 : 0;
    }
  };

  for (let i = 0; i <= axialRings; i++) {
    const t = i / axialRings;
    const zUnscaled = zStart - t * zSpan;

    // SERPENTIS icon proportions: thick muscular neck -> powerful armored chest/trunk -> whip caudal tail
    let baseRadius: number;
    if (t < 0.08) {
      const k = t / 0.08;
      baseRadius = THREE.MathUtils.lerp(0.53, 0.7, k * k * (3 - 2 * k));
    } else if (t < 0.28) {
      const k = (t - 0.08) / 0.2;
      baseRadius = THREE.MathUtils.lerp(0.7, 0.9, Math.sin(k * Math.PI * 0.5));
    } else if (t < 0.72) {
      const k = (t - 0.28) / 0.44;
      baseRadius = THREE.MathUtils.lerp(0.9, 0.39, Math.pow(k, 1.05));
    } else {
      const k = (t - 0.72) / 0.28;
      baseRadius = THREE.MathUtils.lerp(0.39, 0.028, Math.pow(k, 1.32));
    }

    const paddleFactor = Math.max(0, (t - 0.6) / 0.4);
    const paddleFlare = Math.sin(paddleFactor * Math.PI * 0.86) * 0.38 * (1 - Math.pow(paddleFactor, 3));
    const hoodFlare = Math.exp(-Math.pow((t - 0.085) / 0.055, 2)) * 0.14;
    const rx = baseRadius * (1.1 + hoodFlare - paddleFactor * 0.68);
    const ry = baseRadius * (0.95 + paddleFactor * 0.48) + paddleFlare;

    // 46 dorsal osteoderm bosses matching the 46 sculpted dorsal blade spikes
    const osteodermPulse = Math.pow(Math.max(0, Math.sin(t * Math.PI * 46)), 6);

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      // Heavy epaxial back muscles + sharpened dorsal keel ridge
      const dorsalMask = Math.max(0, cosT);
      const epaxial = 1.0 + 0.13 * sinT * sinT * dorsalMask;
      const dorsalRidge = 1.0 + (0.105 + osteodermPulse * 0.05) * Math.pow(dorsalMask, 8) * (1 - t * 0.28);

      // 42 3D stepped V-chevron armored belly scutes matching textures.ts (6 plates * 7 repeatY = 42) 1-to-1!
      const bellyMask3D = Math.max(0, (-cosT - 0.34) / 0.66);
      const chevronT = t * 42 - Math.abs(sinT) * 1.15;
      const chevronPhase = chevronT - Math.floor(chevronT);
      const plateSlope = 1 - chevronPhase;
      const grooveDip = chevronPhase < 0.14 ? 0.028 * (1 - chevronPhase / 0.14) : 0;
      const ventralStep = bellyMask3D * (0.062 * plateSlope - grooveDip) * (1 - paddleFactor * 0.72);

      // Sharp lateral armor shelf bordering the belly scutes (iconic icon silhouette!)
      const flankChord = 1.0 + 0.065 * Math.pow(Math.abs(sinT), 3) * (1 - Math.abs(cosT));
      const ventralFlatten = cosT < 0 ? 0.84 : 1.0;
      const muscleTone = 1.0 + Math.sin(t * Math.PI * 28) * 0.018 * (1 - paddleFactor);

      const x = sinT * rx * epaxial * flankChord * muscleTone * scale;
      const y = (cosT * ry * dorsalRidge * ventralFlatten * muscleTone - ventralStep * ry) * scale;
      const z = zUnscaled * scale;

      const vIdx = i * (radialSegs + 1) + j;
      positions[vIdx * 3] = x;
      positions[vIdx * 3 + 1] = y;
      positions[vIdx * 3 + 2] = z;

      uvs[vIdx * 2] = u;
      uvs[vIdx * 2 + 1] = t;

      assignBoneWeights(vIdx, zUnscaled);
    }
  }

  const indices: number[] = [];
  const stride = radialSegs + 1;
  for (let i = 0; i < axialRings; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Weld seam normals (j=0 and j=radialSegs) so dorsal lighting has zero seam
  const normAttr = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i <= axialRings; i++) {
    const i0 = i * stride;
    const i1 = i0 + radialSegs;
    const nx = normAttr.getX(i0) + normAttr.getX(i1);
    const ny = normAttr.getY(i0) + normAttr.getY(i1);
    const nz = normAttr.getZ(i0) + normAttr.getZ(i1);
    const inv = 1 / Math.max(1e-5, Math.hypot(nx, ny, nz));
    normAttr.setXYZ(i0, nx * inv, ny * inv, nz * inv);
    normAttr.setXYZ(i1, nx * inv, ny * inv, nz * inv);
  }
  normAttr.needsUpdate = true;
  geo.computeTangents();
  return geo;
}

function buildContinuousDorsalFinGeometry(scale: number, compact = false): THREE.BufferGeometry {
  // Exact SERPENTIS icon dorsal blade silhouette:
  // 1) 46 tall concave-curved swept 3D obsidian-crimson dorsal blade spikes arching along neck & back
  // 2) Serrated caudal tail crest for predatory aquatic propulsion
  const totalLength = (SERPENT_BONE_COUNT - 1) * SERPENT_BONE_STEP;

  const evalBodyMetrics = (t: number) => {
    let baseRadius: number;
    if (t < 0.08) {
      const k = t / 0.08;
      baseRadius = THREE.MathUtils.lerp(0.53, 0.7, k * k * (3 - 2 * k));
    } else if (t < 0.28) {
      const k = (t - 0.08) / 0.2;
      baseRadius = THREE.MathUtils.lerp(0.7, 0.9, Math.sin(k * Math.PI * 0.5));
    } else if (t < 0.72) {
      const k = (t - 0.28) / 0.44;
      baseRadius = THREE.MathUtils.lerp(0.9, 0.39, Math.pow(k, 1.05));
    } else {
      const k = (t - 0.72) / 0.28;
      baseRadius = THREE.MathUtils.lerp(0.39, 0.028, Math.pow(k, 1.32));
    }
    const paddleFactor = Math.max(0, (t - 0.6) / 0.4);
    const paddleFlare = Math.sin(paddleFactor * Math.PI * 0.86) * 0.38 * (1 - Math.pow(paddleFactor, 3));
    const hoodFlare = Math.exp(-Math.pow((t - 0.085) / 0.055, 2)) * 0.14;
    const rx = baseRadius * (1.1 + hoodFlare - paddleFactor * 0.68);
    const ry = baseRadius * (0.95 + paddleFactor * 0.48) + paddleFlare;
    return { rx, ry };
  };

  const parts: THREE.BufferGeometry[] = [];

  const bindSpineWeights = (zUnscaled: number, skinIndices: Uint16Array, skinWeights: Float32Array, vIdx: number) => {
    const fb = THREE.MathUtils.clamp(-zUnscaled / SERPENT_BONE_STEP, 0, SERPENT_BONE_COUNT - 1);
    const b0 = Math.floor(fb);
    const b1 = Math.min(SERPENT_BONE_COUNT - 1, b0 + 1);
    const alpha = fb - b0;
    const sb = vIdx * 4;
    skinIndices[sb] = b0;
    skinIndices[sb + 1] = b1;
    skinIndices[sb + 2] = 0;
    skinIndices[sb + 3] = 0;
    skinWeights[sb] = 1 - alpha;
    skinWeights[sb + 1] = alpha;
    skinWeights[sb + 2] = 0;
    skinWeights[sb + 3] = 0;
  };

  // 1) 46 Swept Concave-Curved Dorsal Blade Spikes matching SERPENTIS icon neck & torso spines
  const spineCount = 46;
  const zStart = -0.32;
  const zSpan = totalLength - 0.22;
  const vertsPerSpike = 13; // 4 base + 4 lower-mid + 4 upper-mid + 1 curved razor tip
  const totalSpikeVerts = spineCount * vertsPerSpike;
  const spPos = new Float32Array(totalSpikeVerts * 3);
  const spUvs = new Float32Array(totalSpikeVerts * 2);
  const spIdxSkin = new Uint16Array(totalSpikeVerts * 4);
  const spWgtSkin = new Float32Array(totalSpikeVerts * 4);
  const spIndices: number[] = [];

  for (let s = 0; s < spineCount; s++) {
    const t = 0.012 + (s / (spineCount - 1)) * 0.92;
    const zUnscaled = zStart - t * zSpan;
    const { ry } = evalBodyMetrics(t);
    const baseY = ry * (1.0 + 0.105 * (1 - t * 0.28)) - 0.08;

    // Dramatic arching neck crest blades fading into serrated spinal blades down to tail
    const neckBoost = Math.exp(-Math.pow((t - 0.085) / 0.15, 2)) * 0.52;
    const trunkEnv = Math.pow(Math.max(0.14, 1 - t * 0.76), 0.72);
    const alt = s % 2 === 0 ? 1.08 : 0.88;
    const h = (0.44 * trunkEnv + neckBoost) * alt;
    const sweepBack = h * 1.04 + 0.16;
    const halfW = 0.058 * (1 - t * 0.52);
    const halfLen = 0.14 * (1 - t * 0.45);

    const vBase = s * vertsPerSpike;
    const ringPts = [
      // Base diamond (v = 0)
      { x: 0, y: baseY, z: zUnscaled + halfLen, v: 0 },
      { x: halfW, y: baseY, z: zUnscaled, v: 0 },
      { x: 0, y: baseY, z: zUnscaled - halfLen, v: 0 },
      { x: -halfW, y: baseY, z: zUnscaled, v: 0 },
      // Lower-mid (v = 0.34)
      { x: 0, y: baseY + h * 0.36, z: zUnscaled - sweepBack * 0.18 + halfLen * 0.65, v: 0.34 },
      { x: halfW * 0.62, y: baseY + h * 0.34, z: zUnscaled - sweepBack * 0.2, v: 0.34 },
      { x: 0, y: baseY + h * 0.32, z: zUnscaled - sweepBack * 0.22 - halfLen * 0.58, v: 0.34 },
      { x: -halfW * 0.62, y: baseY + h * 0.34, z: zUnscaled - sweepBack * 0.2, v: 0.34 },
      // Upper-mid concave scythe sweep (v = 0.7)
      { x: 0, y: baseY + h * 0.73, z: zUnscaled - sweepBack * 0.55 + halfLen * 0.26, v: 0.7 },
      { x: halfW * 0.28, y: baseY + h * 0.71, z: zUnscaled - sweepBack * 0.57, v: 0.7 },
      { x: 0, y: baseY + h * 0.69, z: zUnscaled - sweepBack * 0.59 - halfLen * 0.24, v: 0.7 },
      { x: -halfW * 0.28, y: baseY + h * 0.71, z: zUnscaled - sweepBack * 0.57, v: 0.7 },
      // Swept scythe tip (v = 1.0)
      { x: 0, y: baseY + h, z: zUnscaled - sweepBack, v: 1.0 },
    ];

    for (let k = 0; k < vertsPerSpike; k++) {
      const vi = vBase + k;
      const pt = ringPts[k];
      spPos[vi * 3] = pt.x * scale;
      spPos[vi * 3 + 1] = pt.y * scale;
      spPos[vi * 3 + 2] = pt.z * scale;
      spUvs[vi * 2] = (k % 4) * 0.25 + s * 0.17;
      spUvs[vi * 2 + 1] = pt.v;
      bindSpineWeights(pt.z, spIdxSkin, spWgtSkin, vi);
    }

    for (let j = 0; j < 4; j++) {
      const jNext = (j + 1) % 4;
      const b0 = vBase + j;
      const b1 = vBase + jNext;
      const m0 = vBase + 4 + j;
      const m1 = vBase + 4 + jNext;
      const u0 = vBase + 8 + j;
      const u1 = vBase + 8 + jNext;
      const tip = vBase + 12;
      spIndices.push(b0, m0, b1, b1, m0, m1);
      spIndices.push(m0, u0, m1, m1, u0, u1);
      spIndices.push(u0, tip, u1);
    }
  }
  const spikeGeo = new THREE.BufferGeometry();
  spikeGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  spikeGeo.setAttribute('uv', new THREE.BufferAttribute(spUvs, 2));
  spikeGeo.setAttribute('skinIndex', new THREE.BufferAttribute(spIdxSkin, 4));
  spikeGeo.setAttribute('skinWeight', new THREE.BufferAttribute(spWgtSkin, 4));
  spikeGeo.setIndex(spIndices);
  spikeGeo.computeVertexNormals();
  parts.push(spikeGeo);

  // 2) Serrated Caudal Tail Fin Blade (t > 0.66)
  {
    const rings = compact ? 26 : 34;
    const t0 = 0.66;
    const t1 = 1.0;
    const vertCount = (rings + 1) * 2;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const skinIndices = new Uint16Array(vertCount * 4);
    const skinWeights = new Float32Array(vertCount * 4);

    for (let i = 0; i <= rings; i++) {
      const u = i / rings;
      const t = THREE.MathUtils.lerp(t0, t1, u);
      const zUnscaled = zStart - t * zSpan;
      const { ry } = evalBodyMetrics(t);
      const baseY = ry * 0.92 - 0.04;
      const bladeH = Math.sin(u * Math.PI) * 0.48 * (0.72 + 0.28 * Math.sin(u * Math.PI * 16));

      for (let row = 0; row < 2; row++) {
        const vIdx = i * 2 + row;
        positions[vIdx * 3] = 0;
        positions[vIdx * 3 + 1] = (baseY + (row === 1 ? bladeH : 0)) * scale;
        positions[vIdx * 3 + 2] = (zUnscaled - (row === 1 ? 0.16 : 0)) * scale;
        uvs[vIdx * 2] = u * 1.8;
        uvs[vIdx * 2 + 1] = row;
        bindSpineWeights(zUnscaled, skinIndices, skinWeights, vIdx);
      }
    }

    const indices: number[] = [];
    for (let i = 0; i < rings; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));
    g.setIndex(indices);
    g.computeVertexNormals();
    parts.push(g);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged ?? new THREE.BufferGeometry();
}

function sculptUpperSkullGeometry(compact = false): THREE.BufferGeometry {
  // Exact SERPENTIS icon armored predator cranium (z: -0.84 neck blend -> +1.58 hooked snout tip)
  const slices = compact ? 24 : 32;
  const radials = compact ? 18 : 24;
  const vertCount = (slices + 1) * (radials + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  for (let i = 0; i <= slices; i++) {
    const s = i / slices;
    const z = THREE.MathUtils.lerp(-0.84, 1.58, s);

    // Wide armored temporal cheek & cranium flares narrowing cleanly to predatory hooked snout
    let w: number;
    if (s < 0.28) {
      const k = s / 0.28;
      w = THREE.MathUtils.lerp(0.61, 0.96, Math.sin(k * Math.PI * 0.5));
    } else if (s < 0.56) {
      const k = (s - 0.28) / 0.28;
      w = THREE.MathUtils.lerp(0.96, 0.56, k * k * (3 - 2 * k));
    } else {
      const k = (s - 0.56) / 0.44;
      w = THREE.MathUtils.lerp(0.56, 0.2, Math.pow(k, 1.24));
    }
    if (s > 0.93) {
      const tipK = (s - 0.93) / 0.07;
      w *= Math.sqrt(Math.max(0.02, 1 - tipK * tipK));
    }

    let hTop: number;
    if (s < 0.36) {
      hTop = THREE.MathUtils.lerp(0.47, 0.585, s / 0.36);
    } else {
      const k = (s - 0.36) / 0.64;
      hTop = THREE.MathUtils.lerp(0.585, 0.085, Math.pow(k, 1.26));
    }
    if (s > 0.95) {
      const tipK = (s - 0.95) / 0.05;
      hTop *= Math.sqrt(Math.max(0.02, 1 - tipK * tipK));
    }

    const mouthMask = THREE.MathUtils.smoothstep(s, 0.22, 0.4) * (1 - THREE.MathUtils.smoothstep(s, 0.92, 1.0));
    const eyeSocketMask = Math.exp(-Math.pow((s - 0.54) / 0.11, 2));
    const nostrilMask = Math.exp(-Math.pow((s - 0.88) / 0.05, 2));
    const snoutBridgeMask = THREE.MathUtils.smoothstep(s, 0.54, 0.9) * (1 - THREE.MathUtils.smoothstep(s, 0.93, 1.0));
    const armorScaleWave = Math.sin(s * Math.PI * 18) * 0.015;

    for (let j = 0; j <= radials; j++) {
      const u = j / radials;
      const theta = u * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      let x = sinT * w;
      let y: number;

      if (cosT >= 0) {
        const absAng = Math.abs(theta > Math.PI ? Math.PI * 2 - theta : theta);
        // Heavy furious diagonal V-brow ridge angling down toward nose bridge (keeps eyes clear across wide yaw)
        const browTargetAng = 0.74 + (s - 0.54) * 0.4;
        const browAngle = Math.abs(absAng - browTargetAng);
        const browRidge = Math.exp(-(browAngle * browAngle) / 0.08) * 0.178 * eyeSocketMask;
        // Recessed cheek/orbital channel sitting cleanly behind the forward-angled eye socket
        const socketAngle = Math.abs(absAng - 1.25);
        const socketIndent = Math.exp(-(socketAngle * socketAngle) / 0.055) * 0.165 * eyeSocketMask;
        // Flared nostrils & rugged nasal armor plates
        const nosAngle = Math.abs(absAng - 0.72);
        const nosIndent = Math.exp(-(nosAngle * nosAngle) / 0.05) * 0.055 * nostrilMask;
        const nasalKeel = Math.pow(cosT, 6) * 0.078 * snoutBridgeMask;
        const plateRelief = Math.cos(theta * 6) * 0.012 + armorScaleWave * cosT;

        const rScale = 1 - socketIndent - nosIndent;
        x *= rScale;
        y = cosT * hTop + browRidge + nasalKeel + plateRelief + 0.04;
      } else {
        const bellyH = THREE.MathUtils.lerp(0.38, 0.025, Math.pow(s, 1.35));
        const palateArch = mouthMask * (0.34 * Math.pow(-cosT, 1.15));
        const lipRim = mouthMask * Math.exp(-Math.pow(Math.abs(sinT) - 0.86, 2) / 0.04) * 0.082;
        y = cosT * bellyH + palateArch - lipRim + 0.04;
        x *= 1 - mouthMask * 0.08 * (-cosT);
      }

      const vIdx = i * (radials + 1) + j;
      positions[vIdx * 3] = x;
      positions[vIdx * 3 + 1] = y;
      positions[vIdx * 3 + 2] = z;

      uvs[vIdx * 2] = u;
      uvs[vIdx * 2 + 1] = s * 0.36;
    }
  }

  const indices: number[] = [];
  const stride = radials + 1;
  for (let i = 0; i < slices; i++) {
    for (let j = 0; j < radials; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const normAttr = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i <= slices; i++) {
    const i0 = i * stride;
    const i1 = i0 + radials;
    const nx = normAttr.getX(i0) + normAttr.getX(i1);
    const ny = normAttr.getY(i0) + normAttr.getY(i1);
    const nz = normAttr.getZ(i0) + normAttr.getZ(i1);
    const inv = 1 / Math.max(1e-5, Math.hypot(nx, ny, nz));
    normAttr.setXYZ(i0, nx * inv, ny * inv, nz * inv);
    normAttr.setXYZ(i1, nx * inv, ny * inv, nz * inv);
  }
  normAttr.needsUpdate = true;
  geo.computeTangents();
  return geo;
}

function sculptLowerJawGeometry(compact = false): THREE.BufferGeometry {
  // Narrow V-tapered rugged armored mandible matching SERPENTIS icon jaw silhouette
  const slices = compact ? 20 : 26;
  const radials = compact ? 16 : 20;
  const vertCount = (slices + 1) * (radials + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  for (let i = 0; i <= slices; i++) {
    const s = i / slices;
    const z = THREE.MathUtils.lerp(-0.22, 1.44, s);

    let w = THREE.MathUtils.lerp(0.64, 0.135, Math.pow(s, 1.15));
    if (s < 0.14) w *= THREE.MathUtils.lerp(0.76, 1.0, s / 0.14);
    if (s > 0.92) {
      const tk = (s - 0.92) / 0.08;
      w *= Math.sqrt(Math.max(0.02, 1 - tk * tk));
    }

    const hBot = THREE.MathUtils.lerp(0.28, 0.07, Math.pow(s, 1.24));
    const cavityMask = THREE.MathUtils.smoothstep(s, 0.12, 0.35) * (1 - THREE.MathUtils.smoothstep(s, 0.9, 1.0));
    const chinArmor = Math.exp(-Math.pow((s - 0.86) / 0.12, 2)) * 0.068;

    for (let j = 0; j <= radials; j++) {
      const u = j / radials;
      const theta = u * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      const x = sinT * w;
      let y: number;
      if (cosT >= 0) {
        const toothRim = cavityMask * Math.exp(-Math.pow(Math.abs(sinT) - 0.82, 2) / 0.05) * 0.064;
        const tongueTrough = -cavityMask * (0.098 * Math.pow(cosT, 1.2));
        y = cosT * 0.055 + toothRim + tongueTrough;
      } else {
        const chinKeel = Math.pow(-cosT, 6) * chinArmor;
        const ridgeSeg = Math.sin(s * Math.PI * 16) * 0.015 * (-cosT);
        y = cosT * hBot - chinKeel + ridgeSeg;
      }

      const vIdx = i * (radials + 1) + j;
      positions[vIdx * 3] = x;
      positions[vIdx * 3 + 1] = y;
      positions[vIdx * 3 + 2] = z;

      uvs[vIdx * 2] = u;
      uvs[vIdx * 2 + 1] = s * 0.28;
    }
  }

  const indices: number[] = [];
  const stride = radials + 1;
  for (let i = 0; i < slices; i++) {
    for (let j = 0; j < radials; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const normAttr = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i <= slices; i++) {
    const i0 = i * stride;
    const i1 = i0 + radials;
    const nx = normAttr.getX(i0) + normAttr.getX(i1);
    const ny = normAttr.getY(i0) + normAttr.getY(i1);
    const nz = normAttr.getZ(i0) + normAttr.getZ(i1);
    const inv = 1 / Math.max(1e-5, Math.hypot(nx, ny, nz));
    normAttr.setXYZ(i0, nx * inv, ny * inv, nz * inv);
    normAttr.setXYZ(i1, nx * inv, ny * inv, nz * inv);
  }
  normAttr.needsUpdate = true;
  geo.computeTangents();
  return geo;
}

function createSweptHornOrCrestGeometry(
  curvePoints: THREE.Vector3[],
  baseRadiusX: number,
  baseRadiusY: number,
  rings = 16,
  radials = 10
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const frames = curve.computeFrenetFrames(rings, false);
  const vertCount = (rings + 1) * (radials + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const pt = new THREE.Vector3();

  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    curve.getPointAt(t, pt);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const taper = Math.pow(Math.max(0.004, 1 - t), 0.72);
    const rx = baseRadiusX * taper;
    const ry = baseRadiusY * taper;

    for (let j = 0; j <= radials; j++) {
      const u = j / radials;
      const theta = u * Math.PI * 2;
      const c = Math.cos(theta);
      const s = Math.sin(theta);

      const vIdx = i * (radials + 1) + j;
      positions[vIdx * 3] = pt.x + (N.x * c * rx + B.x * s * ry);
      positions[vIdx * 3 + 1] = pt.y + (N.y * c * rx + B.y * s * ry);
      positions[vIdx * 3 + 2] = pt.z + (N.z * c * rx + B.z * s * ry);
      uvs[vIdx * 2] = u;
      uvs[vIdx * 2 + 1] = t;
    }
  }

  const indices: number[] = [];
  const stride = radials + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radials; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createRecurvedToothGeometry(
  length: number,
  baseRadius: number,
  curveBack: number,
  compact = false
): THREE.BufferGeometry {
  // Razor-thin needle predator fang catching inner red maw glow at root (10x10 desktop, 5x5 mobile)
  const rings = compact ? 5 : 10;
  const radials = compact ? 5 : 10;
  const vertCount = (rings + 1) * (radials + 1);
  const positions = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);

  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = t * length;
    const zOffset = -Math.pow(t, 1.85) * curveBack;
    const r = baseRadius * Math.pow(Math.max(0.01, 1 - t), 0.72);

    // Glowing blood-crimson lit gum root transitioning to sharp ivory/silver-tinted needle tip
    const rootMix = THREE.MathUtils.smoothstep(t, 0, 0.45);
    const cr = THREE.MathUtils.lerp(0.84, 0.94, rootMix);
    const cg = THREE.MathUtils.lerp(0.08, 0.85, rootMix);
    const cb = THREE.MathUtils.lerp(0.11, 0.82, rootMix);

    for (let j = 0; j <= radials; j++) {
      const theta = (j / radials) * Math.PI * 2;
      const vIdx = i * (radials + 1) + j;
      positions[vIdx * 3] = Math.cos(theta) * r * 0.72;
      positions[vIdx * 3 + 1] = y;
      positions[vIdx * 3 + 2] = zOffset + Math.sin(theta) * r * 1.15;
      colors[vIdx * 3] = cr;
      colors[vIdx * 3 + 1] = cg;
      colors[vIdx * 3 + 2] = cb;
    }
  }

  const indices: number[] = [];
  const stride = radials + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radials; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function getMonsterPool(textures: TextureBundle): MonsterSharedPool {
  const rootPool = getEntityPool(textures);
  if (rootPool.monster) return rootPool.monster;

  const isSmooth = rootPool.quality === 'smooth';
  const isUltra = rootPool.quality === 'ultra';
  const useLightMats = Boolean(textures.compact);

  const skinMat = tagShared(
    useLightMats
      ? new THREE.MeshStandardMaterial({
          map: textures.monsterSkin,
          normalMap: textures.monsterNormal,
          normalScale: new THREE.Vector2(isSmooth ? 0.35 : 1.75, isSmooth ? 0.35 : 1.75),
          roughnessMap: textures.monsterRoughness,
          roughness: 0.22,
          metalness: 0.18,
          emissive: new THREE.Color(0xffffff),
          emissiveMap: textures.monsterEmissive,
          emissiveIntensity: 1.05,
          envMapIntensity: isSmooth ? 0.92 : 1.35,
        })
      : new THREE.MeshPhysicalMaterial({
          map: textures.monsterSkin,
          normalMap: textures.monsterNormal,
          normalScale: new THREE.Vector2(isSmooth ? 0.35 : isUltra ? 2.05 : 1.85, isSmooth ? 0.35 : isUltra ? 2.05 : 1.85),
          roughnessMap: textures.monsterRoughness,
          roughness: 0.28,
          metalness: 0.14,
          emissive: new THREE.Color(0xffffff),
          emissiveMap: textures.monsterEmissive,
          emissiveIntensity: 1.05,
          clearcoat: isSmooth ? 0.22 : isUltra ? 1.0 : 0.78,
          clearcoatRoughness: 0.06,
          ior: 1.46,
          envMapIntensity: isSmooth ? 0.92 : isUltra ? 1.56 : 1.32,
        })
  );

  const finMat = tagShared(
    useLightMats
      ? new THREE.MeshStandardMaterial({
          map: textures.monsterFinSkin,
          emissive: new THREE.Color(0xffffff),
          emissiveMap: textures.monsterFinEmissive,
          emissiveIntensity: 0.88,
          roughness: 0.18,
          metalness: 0.2,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshPhysicalMaterial({
          map: textures.monsterFinSkin,
          emissive: new THREE.Color(0xffffff),
          emissiveMap: textures.monsterFinEmissive,
          emissiveIntensity: 0.88,
          roughness: 0.22,
          metalness: 0.16,
          clearcoat: isSmooth ? 0.3 : 0.88,
          clearcoatRoughness: 0.08,
          side: THREE.DoubleSide,
        })
  );

  // Dark blood-crimson obsidian chitin for horns & radiating whisker-spines matching icon
  const hornMat = tagShared(
    new THREE.MeshStandardMaterial({
      color: 0x2c0509,
      roughness: 0.2,
      metalness: 0.24,
      envMapIntensity: 1.25,
    })
  );

  const mouthMat = tagShared(
    useLightMats
      ? new THREE.MeshStandardMaterial({
          color: 0x4b0d14,
          emissive: 0xff101f,
          emissiveIntensity: 2.0,
          roughness: 0.12,
          metalness: 0.06,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0x4b0d14,
          emissive: 0xff101f,
          emissiveIntensity: 2.0,
          roughness: 0.14,
          metalness: 0.02,
          clearcoat: isSmooth ? 0.35 : 0.96,
          clearcoatRoughness: 0.06,
          side: THREE.DoubleSide,
        })
  );

  const eyeIrisMat = tagShared(
    new THREE.MeshStandardMaterial({
      map: textures.monsterEye,
      emissiveMap: textures.monsterEye,
      emissive: 0xff2020,
      emissiveIntensity: 2.25,
      roughness: 0.12,
      metalness: 0.06,
    })
  );

  const corneaMat = tagShared(
    useLightMats
      ? new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.04,
          metalness: 0.1,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.02,
          metalness: 0.0,
          clearcoat: 1.0,
          clearcoatRoughness: 0.02,
          ior: 1.4,
          transparent: true,
          opacity: 0.24,
          depthWrite: false,
        })
  );

  const toothMat = tagShared(
    useLightMats
      ? new THREE.MeshStandardMaterial({
          color: 0xf4e8e6,
          emissive: 0x380408,
          emissiveIntensity: 0.32,
          vertexColors: true,
          roughness: 0.14,
          metalness: 0.1,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0xf4e8e6,
          emissive: 0x380408,
          emissiveIntensity: 0.32,
          vertexColors: true,
          roughness: 0.16,
          metalness: 0.08,
          clearcoat: isSmooth ? 0.3 : 0.85,
          clearcoatRoughness: 0.08,
        })
  );

  const compact = Boolean(textures.compact);
  const hRingsL = compact ? 10 : 12;
  const hRingsM = compact ? 8 : 10;
  const hRingsS = compact ? 7 : 8;
  const hRadL = compact ? 5 : 6;
  const hRadS = compact ? 4 : 5;

  const upperSkullGeo = tagShared(sculptUpperSkullGeometry(compact));
  const palateGeo = tagShared(
    createSweptHornOrCrestGeometry(
      [
        new THREE.Vector3(0, 0.05, 0.05),
        new THREE.Vector3(0, 0.12, 0.56),
        new THREE.Vector3(0, 0.05, 1.24),
      ],
      0.34,
      0.085,
      hRingsS,
      compact ? 6 : 8
    )
  );

  // Exact SERPENTIS icon radiating head horns, bristling crown fan & long lateral whisker-spines
  const hornGeos: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    hornGeos.push(
      // 1) Signature ultra-long spear temple spine shooting straight back & wide (distinctive icon wing-horn)
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.44, 0.3, 0.3),
          new THREE.Vector3(side * 0.9, 0.49, -0.3),
          new THREE.Vector3(side * 1.36, 0.62, -0.96),
          new THREE.Vector3(side * 1.72, 0.68, -1.62),
        ],
        0.072,
        0.08,
        hRingsL,
        hRadL
      ),
      // 2) Secondary tall temporal crown horn arching upward & back above temple
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.34, 0.44, 0.32),
          new THREE.Vector3(side * 0.58, 0.74, -0.18),
          new THREE.Vector3(side * 0.78, 0.98, -0.78),
          new THREE.Vector3(side * 0.9, 1.12, -1.32),
        ],
        0.082,
        0.092,
        compact ? 9 : 11,
        hRadL
      ),
      // 3) Inner parietal swept crown blade flanking center crest
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.19, 0.5, 0.24),
          new THREE.Vector3(side * 0.3, 0.84, -0.22),
          new THREE.Vector3(side * 0.38, 1.06, -0.74),
        ],
        0.064,
        0.084,
        hRingsM,
        hRadL
      ),
      // 4) Furious swept supraorbital brow spike above glowing red eye
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.28, 0.35, 0.84),
          new THREE.Vector3(side * 0.45, 0.58, 0.44),
          new THREE.Vector3(side * 0.6, 0.75, -0.02),
        ],
        0.07,
        0.078,
        hRingsM,
        hRadL
      ),
      // 5) Anterior brow-bridge bristle spike
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.16, 0.26, 1.14),
          new THREE.Vector3(side * 0.26, 0.45, 0.82),
          new THREE.Vector3(side * 0.35, 0.58, 0.46),
        ],
        0.05,
        0.058,
        hRingsS,
        hRadS
      ),
      // 6) Forward-flaring upper cheek needle-whisker spine (distinct icon lateral spikes!)
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.54, 0.08, 0.44),
          new THREE.Vector3(side * 0.96, 0.01, 0.62),
          new THREE.Vector3(side * 1.38, -0.08, 0.76),
        ],
        0.036,
        0.038,
        hRingsS,
        hRadS
      ),
      // 7) Wide mid-cheek radiating lateral whisker-spine
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.66, 0.05, 0.06),
          new THREE.Vector3(side * 1.1, 0.0, -0.2),
          new THREE.Vector3(side * 1.48, -0.06, -0.48),
        ],
        0.044,
        0.046,
        hRingsS,
        hRadS
      ),
      // 8) Lower-cheek radiating gill-spine
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.64, -0.04, -0.24),
          new THREE.Vector3(side * 1.0, -0.1, -0.56),
          new THREE.Vector3(side * 1.28, -0.18, -0.9),
        ],
        0.045,
        0.045,
        hRingsS,
        hRadS
      ),
      // 9) Upper temporal sub-wing spur tucked beneath main spear horn
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.58, 0.2, 0.02),
          new THREE.Vector3(side * 0.96, 0.26, -0.46),
          new THREE.Vector3(side * 1.26, 0.28, -0.92),
        ],
        0.04,
        0.042,
        hRingsS,
        hRadS
      )
    );
  }
  // Central rostral & brow spikes
  hornGeos.push(
    createSweptHornOrCrestGeometry(
      [
        new THREE.Vector3(0, 0.23, 1.24),
        new THREE.Vector3(0, 0.43, 0.94),
        new THREE.Vector3(0, 0.56, 0.62),
      ],
      0.044,
      0.066,
      hRingsS,
      hRadS
    ),
    createSweptHornOrCrestGeometry(
      [
        new THREE.Vector3(0, 0.45, 0.64),
        new THREE.Vector3(0, 0.72, 0.26),
        new THREE.Vector3(0, 0.9, -0.14),
      ],
      0.05,
      0.08,
      hRingsS,
      hRadS
    )
  );
  const mergedHornsGeo = mergeGeometries(hornGeos, false);
  hornGeos.forEach((g) => g.dispose());
  if (mergedHornsGeo) tagShared(mergedHornsGeo);

  // Lower-mandible lateral whisker-spines + rugged ventral chin spurs (articulate WITH jaw!)
  const lowerHornGeos: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    lowerHornGeos.push(
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.36, -0.04, 0.54),
          new THREE.Vector3(side * 0.76, -0.15, 0.36),
          new THREE.Vector3(side * 1.12, -0.27, 0.2),
        ],
        0.032,
        0.034,
        hRingsS,
        hRadS
      ),
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.48, -0.06, 0.16),
          new THREE.Vector3(side * 0.88, -0.17, -0.12),
          new THREE.Vector3(side * 1.22, -0.28, -0.38),
        ],
        0.036,
        0.038,
        hRingsS,
        hRadS
      ),
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(side * 0.14, -0.1, 1.12),
          new THREE.Vector3(side * 0.22, -0.22, 0.86),
          new THREE.Vector3(side * 0.28, -0.3, 0.6),
        ],
        0.026,
        0.028,
        6,
        hRadS
      )
    );
  }
  const mergedLowerHornsGeo = mergeGeometries(lowerHornGeos, false);
  lowerHornGeos.forEach((g) => g.dispose());
  if (mergedLowerHornsGeo) tagShared(mergedLowerHornsGeo);

  // Tall, sharp multi-spike occipital crown crest arching back straight into the 46 dorsal blade spikes
  const crestParts: THREE.BufferGeometry[] = [
    createSweptHornOrCrestGeometry(
      [
        new THREE.Vector3(0, 0.52, 0.22),
        new THREE.Vector3(0, 0.9, -0.22),
        new THREE.Vector3(0, 1.14, -0.72),
      ],
      0.048,
      0.092,
      hRingsM,
      hRadL
    ),
    createSweptHornOrCrestGeometry(
      [
        new THREE.Vector3(0, 0.5, -0.14),
        new THREE.Vector3(0, 0.92, -0.58),
        new THREE.Vector3(0, 1.18, -1.08),
      ],
      0.052,
      0.098,
      hRingsM,
      hRadL
    ),
    createSweptHornOrCrestGeometry(
      [
        new THREE.Vector3(0, 0.46, -0.48),
        new THREE.Vector3(0, 0.86, -0.94),
        new THREE.Vector3(0, 1.08, -1.42),
      ],
      0.05,
      0.092,
      hRingsS,
      hRadL
    ),
  ];
  const headCrestGeo = tagShared(mergeGeometries(crestParts, false) ?? new THREE.BufferGeometry());
  crestParts.forEach((g) => g.dispose());

  const eyeballGeo = tagShared(new THREE.SphereGeometry(0.148, compact ? 14 : 18, compact ? 10 : 14));
  eyeballGeo.rotateY(-Math.PI / 2);
  const corneaGeo = tagShared(new THREE.SphereGeometry(0.155, compact ? 12 : 14, compact ? 8 : 10));

  const fangGeo = createRecurvedToothGeometry(0.32, 0.038, 0.095, compact);
  const toothGeo = createRecurvedToothGeometry(0.185, 0.023, 0.05, compact);
  const palatineToothGeo = createRecurvedToothGeometry(0.135, 0.017, 0.036, compact);

  const bakeTransformedTooth = (
    src: THREE.BufferGeometry,
    px: number,
    py: number,
    pz: number,
    rx: number,
    rz: number,
    sx: number,
    sy = sx,
    sz = sx
  ): THREE.BufferGeometry => {
    const g = src.clone();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz, 'XYZ')),
      new THREE.Vector3(sx, sy, sz)
    );
    g.applyMatrix4(m);
    return g;
  };

  // Dense serrated needle fangs matching SERPENTIS icon upper maw (indices 0..23 match raycast test layout)
  const upperTeethParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    upperTeethParts.push(
      bakeTransformedTooth(fangGeo, side * 0.25, 0.082, 1.24, Math.PI + 0.08, side * 0.04, 1.02, 1.08, 1.02)
    );
  }
  const upperLatX = [0.33, 0.382, 0.43, 0.474, 0.518, 0.562, 0.605];
  const upperLatY = [0.052, 0.036, 0.022, 0.008, -0.006, -0.018, -0.028];
  const upperIrregScale = [1.12, 0.94, 1.26, 0.96, 1.18, 0.92, 1.06];
  for (let i = 0; i < 7; i++) {
    for (const side of [-1, 1] as const) {
      const z = 1.1 - i * 0.14 + (i % 2 === 0 ? 0.01 : -0.01);
      const x = side * upperLatX[i];
      const y = upperLatY[i];
      const s = (1.04 - i * 0.05) * upperIrregScale[i];
      upperTeethParts.push(
        bakeTransformedTooth(toothGeo, x, y, z, Math.PI + 0.12, side * (0.06 + (i % 2) * 0.04), s * 0.88, s * 1.1, s)
      );
    }
  }
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1] as const) {
      upperTeethParts.push(
        bakeTransformedTooth(palatineToothGeo, side * 0.13, 0.028, 1.02 - i * 0.18, Math.PI + 0.18, side * 0.04, 1.0)
      );
    }
  }
  // Dense anterior & interstitial needle-teeth across the snout arc (after index 23)
  for (const side of [-1, 1] as const) {
    upperTeethParts.push(
      bakeTransformedTooth(toothGeo, side * 0.045, 0.092, 1.43, Math.PI + 0.05, side * -0.02, 0.78, 0.96, 0.78),
      bakeTransformedTooth(toothGeo, side * 0.125, 0.09, 1.38, Math.PI + 0.06, side * 0.01, 0.84, 1.02, 0.84),
      bakeTransformedTooth(toothGeo, side * 0.195, 0.086, 1.31, Math.PI + 0.07, side * 0.03, 0.82, 0.98, 0.82),
      bakeTransformedTooth(toothGeo, side * 0.305, 0.06, 1.18, Math.PI + 0.1, side * 0.06, 0.76, 0.96, 0.76),
      bakeTransformedTooth(toothGeo, side * 0.358, 0.044, 1.03, Math.PI + 0.12, side * 0.07, 0.74, 0.95, 0.74),
      bakeTransformedTooth(toothGeo, side * 0.408, 0.028, 0.88, Math.PI + 0.14, side * 0.08, 0.74, 0.98, 0.74),
      bakeTransformedTooth(toothGeo, side * 0.495, 0.002, 0.61, Math.PI + 0.15, side * 0.09, 0.72, 0.94, 0.72)
    );
  }
  const mergedUpperTeeth = mergeGeometries(upperTeethParts, false);
  upperTeethParts.forEach((g) => g.dispose());
  if (mergedUpperTeeth) tagShared(mergedUpperTeeth);

  const lowerJawGeo = tagShared(sculptLowerJawGeometry(compact));
  const sublingualGeo = tagShared(
    createSweptHornOrCrestGeometry(
      [
        new THREE.Vector3(0, 0.0, 0.06),
        new THREE.Vector3(0, 0.012, 0.62),
        new THREE.Vector3(0, 0.0, 1.2),
      ],
      0.2,
      0.042,
      hRingsS,
      compact ? 6 : 8
    )
  );

  // Dense serrated needle fangs along narrow V-shaped lower mandible (indices 0..15 match raycast test layout)
  const lowerTeethParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    lowerTeethParts.push(
      bakeTransformedTooth(fangGeo, side * 0.13, 0.054, 1.2, -0.08, side * -0.05, 0.84, 0.9, 0.84)
    );
  }
  const lowerIrregScale = [1.14, 0.84, 1.2, 0.86, 1.06, 0.74, 0.66];
  for (let i = 0; i < 7; i++) {
    for (const side of [-1, 1] as const) {
      const z = 1.05 - i * 0.135;
      const x = side * (0.195 + i * 0.041);
      const s = (0.96 - i * 0.045) * lowerIrregScale[i];
      lowerTeethParts.push(
        bakeTransformedTooth(
          toothGeo,
          x,
          0.052,
          z,
          -0.1 - (i % 2) * 0.05,
          side * (-0.06 - (i % 2) * 0.04),
          s * 0.88,
          s * 1.08,
          s
        )
      );
    }
  }
  // Dense anterior & interstitial lower needle teeth (after index 15)
  for (const side of [-1, 1] as const) {
    lowerTeethParts.push(
      bakeTransformedTooth(toothGeo, side * 0.045, 0.052, 1.32, -0.04, side * -0.01, 0.72, 0.92, 0.72),
      bakeTransformedTooth(toothGeo, side * 0.165, 0.054, 1.12, -0.07, side * -0.04, 0.74, 0.95, 0.74),
      bakeTransformedTooth(toothGeo, side * 0.255, 0.052, 0.86, -0.11, side * -0.08, 0.7, 0.94, 0.7),
      bakeTransformedTooth(toothGeo, side * 0.305, 0.051, 0.71, -0.12, side * -0.08, 0.68, 0.9, 0.68),
      bakeTransformedTooth(toothGeo, side * 0.345, 0.05, 0.56, -0.14, side * -0.09, 0.68, 0.88, 0.68)
    );
  }
  const mergedLowerTeeth = mergeGeometries(lowerTeethParts, false);
  lowerTeethParts.forEach((g) => g.dispose());
  fangGeo.dispose();
  toothGeo.dispose();
  palatineToothGeo.dispose();
  if (mergedLowerTeeth) tagShared(mergedLowerTeeth);

  const tendonGeo = tagShared(
    createSweptHornOrCrestGeometry(
      [
        new THREE.Vector3(0, 0, -0.08),
        new THREE.Vector3(0, -0.16, 0.06),
        new THREE.Vector3(0, -0.34, 0.14),
      ],
      0.055,
      0.095,
      6,
      hRadL
    )
  );

  const tongueParts: THREE.BufferGeometry[] = [
    createSweptHornOrCrestGeometry(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.02, 0.36),
        new THREE.Vector3(0, 0.01, 0.68),
      ],
      0.04,
      0.022,
      hRingsS,
      hRadL
    ),
  ];
  for (const side of [-1, 1] as const) {
    tongueParts.push(
      createSweptHornOrCrestGeometry(
        [
          new THREE.Vector3(0, 0.01, 0.64),
          new THREE.Vector3(side * 0.045, 0.015, 0.82),
          new THREE.Vector3(side * 0.1, 0.005, 0.98),
        ],
        0.018,
        0.012,
        6,
        hRadS
      )
    );
  }
  const mergedTongueGeo = mergeGeometries(tongueParts, false);
  tongueParts.forEach((g) => g.dispose());
  if (mergedTongueGeo) tagShared(mergedTongueGeo);

  const wakeRingGeo = tagShared(new THREE.RingGeometry(1.15, 2.45, compact ? 20 : 28));

  const mPool: MonsterSharedPool = {
    skinMat,
    finMat,
    hornMat,
    mouthMat,
    eyeIrisMat,
    corneaMat,
    toothMat,
    upperSkullGeo,
    palateGeo,
    mergedHornsGeo,
    mergedLowerHornsGeo,
    headCrestGeo,
    eyeballGeo,
    corneaGeo,
    mergedUpperTeeth,
    lowerJawGeo,
    sublingualGeo,
    mergedLowerTeeth,
    tendonGeo,
    mergedTongueGeo,
    wakeRingGeo,
    scaledBodies: new Map(),
  };
  rootPool.monster = mPool;
  return mPool;
}

export function createMonsterRig(textures: TextureBundle, scale = 1): MonsterRig {
  const root = new THREE.Group();
  const pool = getMonsterPool(textures);

  const wakeMat = new THREE.MeshBasicMaterial({
    color: 0xd8eef2,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const bowWakeMat = new THREE.MeshBasicMaterial({
    color: 0xe6f7fa,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // --- 1. Continuous Skinned Body & 3D Obsidian Dorsal Spine Array (24 Spine Bones) ---
  const bones: THREE.Bone[] = [];
  const segments: SerpentSegment[] = [];
  for (let i = 0; i < SERPENT_BONE_COUNT; i++) {
    const bone = new THREE.Bone();
    bone.rotation.order = 'YXZ';
    bone.position.set(0, 0, -i * SERPENT_BONE_STEP * scale);
    root.add(bone);
    bones.push(bone);

    const t = i / (SERPENT_BONE_COUNT - 1);
    const radiusProfile =
      t < 0.25 ? 0.54 + (t / 0.25) * 0.22 : 0.76 * Math.pow(1 - (t - 0.25) / 0.75, 0.85) + 0.05;
    segments.push({
      group: bone,
      bone,
      worldPos: new THREE.Vector3(0, 0, -i * SERPENT_BONE_STEP * scale),
      yaw: 0,
      pitch: 0,
      roll: 0,
      radius: radiusProfile * scale,
    });
  }

  const scaleKey = scale.toFixed(2);
  let scaled = pool.scaledBodies.get(scaleKey);
  if (!scaled) {
    const bodyGeo = tagShared(buildContinuousSerpentBodyGeometry(scale, Boolean(textures.compact)));
    const finGeo = tagShared(buildContinuousDorsalFinGeometry(scale, Boolean(textures.compact)));
    const bowGeo = tagShared(new THREE.PlaneGeometry(3.8 * scale, 7.5 * scale, textures.compact ? 8 : 10, textures.compact ? 10 : 12));
    bowGeo.rotateX(-Math.PI / 2);
    const bPos = bowGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bPos.count; i++) {
      const px = bPos.getX(i);
      const pz = bPos.getZ(i);
      const backT = THREE.MathUtils.clamp((3.75 * scale - pz) / (7.5 * scale), 0, 1);
      const spread = 0.55 + backT * 1.45;
      bPos.setX(i, px * spread);
      bPos.setY(i, Math.max(0, 0.18 * (1 - Math.abs(px) / (1.9 * scale)) * (1 - backT * 0.6)));
    }
    bowGeo.computeVertexNormals();
    scaled = { bodyGeo, finGeo, bowGeo };
    pool.scaledBodies.set(scaleKey, scaled);
  }

  const skeleton = new THREE.Skeleton(bones);
  root.updateMatrixWorld(true);

  const castTier = getEntityPool(textures).quality;
  const bodyMesh = new THREE.SkinnedMesh(scaled.bodyGeo, pool.skinMat);
  bodyMesh.castShadow = castTier !== 'smooth';
  bodyMesh.receiveShadow = true;
  bodyMesh.frustumCulled = false;
  bodyMesh.bind(skeleton);
  root.add(bodyMesh);

  const finMesh = new THREE.SkinnedMesh(scaled.finGeo, pool.finMat);
  finMesh.castShadow = castTier === 'ultra';
  finMesh.frustumCulled = false;
  finMesh.bind(skeleton);
  root.add(finMesh);

  // --- 2. Sculpted Predator Head Assembly (+Z is forward) ---
  const headAssembly = new THREE.Group();
  headAssembly.scale.setScalar(scale);
  root.add(headAssembly);

  const torso = new THREE.Group();
  headAssembly.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.22, 0.14);
  torso.add(headGroup);

  const upperSkullMesh = new THREE.Mesh(pool.upperSkullGeo, pool.skinMat);
  upperSkullMesh.castShadow = castTier !== 'smooth';
  upperSkullMesh.receiveShadow = true;
  headGroup.add(upperSkullMesh);

  const palateMesh = new THREE.Mesh(pool.palateGeo, pool.mouthMat);
  headGroup.add(palateMesh);

  let hornsMesh: THREE.Mesh | null = null;
  if (pool.mergedHornsGeo) {
    hornsMesh = new THREE.Mesh(pool.mergedHornsGeo, pool.hornMat);
    hornsMesh.castShadow = castTier === 'ultra';
    headGroup.add(hornsMesh);
  }

  const headCrest = new THREE.Mesh(pool.headCrestGeo, pool.finMat);
  headGroup.add(headCrest);

  // --- 3. Multi-Layer Blazing Crimson-Red Predator Eyes ---
  const makeSerpentEye = (side: -1 | 1) => {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(side * 0.506, 0.244, 0.568);
    eyePivot.rotation.y = side * 0.52;
    headGroup.add(eyePivot);

    const eyeball = new THREE.Mesh(pool.eyeballGeo, pool.eyeIrisMat);
    eyeball.scale.set(0.94, 0.98, 1.06);
    eyePivot.add(eyeball);

    const cornea = new THREE.Mesh(pool.corneaGeo, pool.corneaMat);
    cornea.scale.set(0.96, 1.0, 1.08);
    eyePivot.add(cornea);

    return eyePivot;
  };
  const leftEye = makeSerpentEye(-1);
  const rightEye = makeSerpentEye(1);

  if (pool.mergedUpperTeeth) {
    headGroup.add(new THREE.Mesh(pool.mergedUpperTeeth, pool.toothMat));
  }

  // --- 5. Hinged V-Tapered Lower Mandible + Whisker Spines + Glowing Red Throat ---
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.05, 0.06);
  headGroup.add(jaw);

  const lowerJawMesh = new THREE.Mesh(pool.lowerJawGeo, pool.skinMat);
  lowerJawMesh.castShadow = castTier === 'ultra';
  jaw.add(lowerJawMesh);

  if (pool.mergedLowerHornsGeo) {
    const lowerHornsMesh = new THREE.Mesh(pool.mergedLowerHornsGeo, pool.hornMat);
    lowerHornsMesh.castShadow = castTier === 'ultra';
    jaw.add(lowerHornsMesh);
  }

  const sublingual = new THREE.Mesh(pool.sublingualGeo, pool.mouthMat);
  jaw.add(sublingual);

  if (pool.mergedLowerTeeth) {
    jaw.add(new THREE.Mesh(pool.mergedLowerTeeth, pool.toothMat));
  }

  const jawTendons: THREE.Mesh[] = [];
  for (const side of [-1, 1] as const) {
    const tendon = new THREE.Mesh(pool.tendonGeo, pool.mouthMat);
    tendon.position.set(side * 0.44, 0.08, 0.28);
    tendon.rotation.y = side * 0.18;
    headGroup.add(tendon);
    jawTendons.push(tendon);
  }

  const tongue = new THREE.Group();
  tongue.position.set(0, 0.03, 0.56);
  jaw.add(tongue);
  if (pool.mergedTongueGeo) {
    tongue.add(new THREE.Mesh(pool.mergedTongueGeo, pool.mouthMat));
  }

  // Prevent small articulated head/eye/jaw/teeth meshes from ever being independently
  // frustum-culled while the skinned serpent body renders.
  headAssembly.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.frustumCulled = false;
    }
  });

  // --- 6. Surface Wake Ring + V-Shaped Bow-Wave Foam Mesh ---
  const wakeRing = new THREE.Mesh(pool.wakeRingGeo, wakeMat);
  wakeRing.rotation.x = -Math.PI / 2;
  wakeRing.position.y = 0.06;
  wakeRing.scale.setScalar(scale);
  root.add(wakeRing);

  const bowWake = new THREE.Mesh(scaled.bowGeo, bowWakeMat);
  bowWake.position.set(0, 0.06, -1.8 * scale);
  root.add(bowWake);

  return {
    root,
    headAssembly,
    torso,
    headGroup,
    jaw,
    jawTendons,
    tongue,
    leftEye,
    rightEye,
    segments,
    bodyMesh,
    finMesh,
    skeleton,
    wakeRing,
    bowWake,
    scale,
    swimPhase: Math.random() * Math.PI * 2,
    emergeAmount: 0,
    intimidationBlend: 0,
    prevHeadPos: new THREE.Vector3(),
    prevHeadYaw: 0,
    smoothedSpeed: 0,
    smoothedTurnRate: 0,
    lungeAmount: 0,
    hasPrevFrame: false,
    setShadowDetail: (tier: ActiveQualityTier) => {
      const primary = tier !== 'smooth';
      const detail = tier === 'ultra';
      bodyMesh.castShadow = primary;
      upperSkullMesh.castShadow = primary;
      finMesh.castShadow = detail;
      lowerJawMesh.castShadow = detail;
      if (hornsMesh) hornsMesh.castShadow = detail;
    },
    dispose: () => {
      skeleton.dispose();
      wakeMat.dispose();
      bowWakeMat.dispose();
    },
  };
}

const _tmpBoneDir = new THREE.Vector3();
const _tmpPrevUp = new THREE.Vector3(0, 1, 0);
const _tmpRight = new THREE.Vector3();
const _tmpTrueUp = new THREE.Vector3();
const _tmpLookMat = new THREE.Matrix4();
const _tmpRollQuat = new THREE.Quaternion();
const _tmpZAxis = new THREE.Vector3(0, 0, 1);

export function resetSerpentTrail(rig: MonsterRig, headPos: THREE.Vector3, yaw: number): void {
  const step = SERPENT_BONE_STEP * rig.scale;
  const bx = -Math.sin(yaw);
  const bz = -Math.cos(yaw);
  rig.emergeAmount = 0;
  rig.intimidationBlend = 0;
  rig.smoothedSpeed = 0;
  rig.smoothedTurnRate = 0;
  rig.lungeAmount = 0;
  rig.prevHeadPos.copy(headPos);
  rig.prevHeadYaw = yaw;
  rig.hasPrevFrame = false;

  rig.headAssembly.position.set(0, -0.04 * rig.scale, 0);
  rig.headAssembly.rotation.set(0, yaw, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);
  rig.jaw.rotation.x = 0.06;
  rig.leftEye.rotation.set(0, -0.52, 0);
  rig.rightEye.rotation.set(0, 0.52, 0);

  for (let i = 0; i < rig.segments.length; i++) {
    const seg = rig.segments[i];
    const dist = i * step;
    const yOff = i === 0 ? 0.12 * rig.scale : -0.08 * rig.scale;
    seg.worldPos.set(headPos.x + bx * dist, headPos.y + yOff, headPos.z + bz * dist);
    seg.yaw = yaw;
    seg.pitch = 0;
    seg.roll = 0;
    seg.bone.position.set(
      seg.worldPos.x - headPos.x,
      seg.worldPos.y - headPos.y,
      seg.worldPos.z - headPos.z
    );
    seg.bone.scale.set(1, 1, 1);
  }
  syncSerpentBones(rig, yaw);
}

export function syncSerpentBones(rig: MonsterRig, headYaw: number): void {
  // Parallel-transport twist-free orientation along the resolved spline (prevents gimbal spin on steep arches)
  const n = rig.segments.length;
  _tmpPrevUp.set(0, 1, 0);

  for (let i = 0; i < n; i++) {
    const seg = rig.segments[i];
    const curr = seg.bone.position;
    if (i === 0) {
      const next = rig.segments[1].bone.position;
      const netHeadYaw = headYaw + rig.torso.rotation.y * 0.45;
      _tmpBoneDir.set(
        Math.sin(netHeadYaw) * 0.55 + (curr.x - next.x) * 0.45,
        (curr.y - next.y) * 0.5,
        Math.cos(netHeadYaw) * 0.55 + (curr.z - next.z) * 0.45
      );
    } else if (i < n - 1) {
      const prev = rig.segments[i - 1].bone.position;
      const next = rig.segments[i + 1].bone.position;
      _tmpBoneDir.subVectors(prev, next);
    } else {
      const prev = rig.segments[i - 1].bone.position;
      _tmpBoneDir.subVectors(prev, curr);
    }

    if (_tmpBoneDir.lengthSq() < 1e-6) {
      _tmpBoneDir.set(Math.sin(headYaw), 0, Math.cos(headYaw));
    } else {
      _tmpBoneDir.normalize();
    }

    // Parallel-transport previous up vector onto plane perpendicular to _tmpBoneDir, blended gently toward world Y
    _tmpTrueUp.copy(_tmpPrevUp);
    _tmpTrueUp.y = THREE.MathUtils.lerp(_tmpTrueUp.y, 1, 0.25);
    const dot = _tmpTrueUp.dot(_tmpBoneDir);
    _tmpTrueUp.addScaledVector(_tmpBoneDir, -dot);
    if (_tmpTrueUp.lengthSq() < 1e-4) {
      _tmpRight.set(Math.cos(headYaw), 0, -Math.sin(headYaw));
      _tmpTrueUp.crossVectors(_tmpBoneDir, _tmpRight);
    }
    _tmpTrueUp.normalize();
    _tmpPrevUp.copy(_tmpTrueUp);

    _tmpRight.crossVectors(_tmpTrueUp, _tmpBoneDir).normalize();
    _tmpTrueUp.crossVectors(_tmpBoneDir, _tmpRight).normalize();

    _tmpLookMat.makeBasis(_tmpRight, _tmpTrueUp, _tmpBoneDir);
    seg.bone.quaternion.setFromRotationMatrix(_tmpLookMat);

    if (Math.abs(seg.roll) > 0.0005) {
      _tmpRollQuat.setFromAxisAngle(_tmpZAxis, seg.roll);
      seg.bone.quaternion.multiply(_tmpRollQuat);
    }
  }
}

const _tmpPreyLocal = new THREE.Vector3();
const _tmpPreyWorldPos = new THREE.Vector3();
const _tmpPreyWorldQuat = new THREE.Quaternion();
const _tmpPreyHeadQuat = new THREE.Quaternion();
const _tmpPreyHeadScale = new THREE.Vector3();
const _tmpPreyBasisMat = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 1, 0)
);
const _tmpPreyBasisQuat = new THREE.Quaternion().setFromRotationMatrix(_tmpPreyBasisMat);
const _tmpPreyMouthQuat = new THREE.Quaternion();
const _tmpPreyStartQuat = new THREE.Quaternion();
const _tmpPreyTumbleQuat = new THREE.Quaternion();
const _tmpPreyEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _tmpComWorld = new THREE.Vector3();
const _tmpComOffset = new THREE.Vector3();
const _tmpAirTarget = new THREE.Vector3();
const _tmpAirOffset = new THREE.Vector3();

export const SERPENT_DEVOUR_AIR_START = 0.14;
export const SERPENT_DEVOUR_AIR_END = 0.46;

export interface SerpentAirborneArc {
  active: boolean;
  tAir: number;
  forwardOffset: number;
  lateralOffset: number;
  verticalOffset: number;
}

export function computeSerpentDevourAirborneLift(
  eatProgress: number,
  scale: number,
  waterY: number,
  ceilingY = Infinity
): SerpentAirborneArc {
  const u = THREE.MathUtils.clamp(eatProgress, 0, 1);
  if (u <= SERPENT_DEVOUR_AIR_START || u >= SERPENT_DEVOUR_AIR_END) {
    return {
      active: false,
      tAir: u <= SERPENT_DEVOUR_AIR_START ? 0 : 1,
      forwardOffset: 0,
      lateralOffset: 0,
      verticalOffset: 0,
    };
  }
  const tAir = THREE.MathUtils.clamp(
    (u - SERPENT_DEVOUR_AIR_START) / (SERPENT_DEVOUR_AIR_END - SERPENT_DEVOUR_AIR_START),
    0,
    1
  );
  // Symmetric ballistic parabola (0 at release & catch, 1 at apex u=0.30)
  const arc = 4 * tAir * (1 - tAir);
  const sinArc = Math.sin(tAir * Math.PI);
  const forwardOffset = sinArc * 1.18 * scale;
  // Subtle lateral drift forces visible neck/skull yaw tracking alongside upward pitch
  const lateralOffset = sinArc * 0.34 * scale;
  const mouthBaseY = waterY + 2.25 * scale;
  const rawLift = 2.9 * scale + 0.55;
  const maxSafeLift = Number.isFinite(ceilingY)
    ? Math.max(0.75 * scale, ceilingY - 1.25 - mouthBaseY)
    : rawLift;
  const verticalOffset = arc * Math.min(rawLift, maxSafeLift);
  return {
    active: true,
    tAir,
    forwardOffset,
    lateralOffset,
    verticalOffset,
  };
}

export function animateMonsterRig(
  rig: MonsterRig,
  alert: 'calm' | 'searching' | 'chasing',
  playerWorldPos: THREE.Vector3,
  headWorldPos: THREE.Vector3,
  headYaw: number,
  waterY: number,
  time: number,
  dt: number,
  targetEmerge = 0,
  eatProgress = -1,
  intimidation?: SerpentIntimidationAnim | null,
  floorY = -Infinity,
  skipBoneSync = false,
  ceilingY = Infinity
): void {
  const safeDt = Math.min(0.06, Math.max(0.001, dt));
  const k = Math.min(1, safeDt * 14);
  const isEating = eatProgress >= 0;
  const eatU = isEating ? THREE.MathUtils.clamp(eatProgress, 0, 1) : 0;
  const intimPhase = !isEating && intimidation ? intimidation.phase : 'none';
  const isIntimTower =
    intimPhase === 'rising' || intimPhase === 'staring' || intimPhase === 'lowering';
  const isChasing = !isIntimTower && (alert === 'chasing' || isEating);
  const aggro = isChasing ? 1 : alert === 'searching' ? 0.5 : 0.15;

  // Measure actual frame velocity & turn rate smoothly (guarding teleports > 6 * scale)
  if (!rig.hasPrevFrame) {
    rig.prevHeadPos.copy(headWorldPos);
    rig.prevHeadYaw = headYaw;
    rig.hasPrevFrame = true;
  } else {
    const moveDx = headWorldPos.x - rig.prevHeadPos.x;
    const moveDz = headWorldPos.z - rig.prevHeadPos.z;
    const moveDist = Math.hypot(moveDx, moveDz);
    if (moveDist > 6.0 * rig.scale) {
      resetSerpentTrail(rig, headWorldPos, headYaw);
    } else {
      const instSpeed = moveDist / safeDt;
      let yawDelta = (headYaw - rig.prevHeadYaw) % (Math.PI * 2);
      if (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
      if (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
      const instTurnRate = yawDelta / safeDt;
      const velK = Math.min(1, safeDt * 10);
      rig.smoothedSpeed = THREE.MathUtils.lerp(rig.smoothedSpeed, THREE.MathUtils.clamp(instSpeed, 0, 26), velK);
      rig.smoothedTurnRate = THREE.MathUtils.lerp(
        rig.smoothedTurnRate,
        THREE.MathUtils.clamp(instTurnRate, -5.5, 5.5),
        velK
      );
      rig.prevHeadPos.copy(headWorldPos);
      rig.prevHeadYaw = headYaw;
    }
  }

  const distToPlayer = Math.hypot(playerWorldPos.x - headWorldPos.x, playerWorldPos.z - headWorldPos.z);
  const targetLunge = isChasing && !isEating && distToPlayer < 5.8 * rig.scale ? 1 - distToPlayer / (5.8 * rig.scale) : 0;
  rig.lungeAmount = THREE.MathUtils.lerp(rig.lungeAmount, targetLunge, Math.min(1, safeDt * 9));

  const intimU = THREE.MathUtils.clamp(intimidation?.phaseProgress ?? 0, 0, 1);
  const intimHeightTarget =
    intimPhase === 'rising'
      ? THREE.MathUtils.smoothstep(intimU, 0, 0.72)
      : intimPhase === 'staring'
        ? 1
        : intimPhase === 'lowering'
          ? 1 - THREE.MathUtils.smoothstep(intimU, 0, 1)
          : 0;
  rig.intimidationBlend = THREE.MathUtils.lerp(
    rig.intimidationBlend,
    isIntimTower ? 1 : 0,
    Math.min(1, safeDt * 8)
  );

  const effectiveTargetEmerge = isEating
    ? (0.42 + 0.58 * THREE.MathUtils.smoothstep(eatU, 0, 0.11)) *
      (1 - THREE.MathUtils.smoothstep(eatU, 0.88, 1.0) * 0.28)
    : isIntimTower
      ? intimHeightTarget
      : targetEmerge;
  const emergeLerpRate = isEating ? 20 : isIntimTower ? 6.2 : 11;
  rig.emergeAmount = THREE.MathUtils.lerp(
    rig.emergeAmount,
    effectiveTargetEmerge,
    Math.min(1, safeDt * emergeLerpRate)
  );

  // Speed-coupled swimming propulsion wave (slow eerie water tread while towering/staring)
  const speedNorm = THREE.MathUtils.clamp(rig.smoothedSpeed / (6.5 * rig.scale), 0, 1.8);
  const waveSpeed = isEating
    ? 8.2
    : isIntimTower
      ? 2.2
      : isChasing
        ? 21.0 + speedNorm * 6.5
        : 4.2 + speedNorm * 4.5;
  rig.swimPhase = (rig.swimPhase + safeDt * waveSpeed) % (Math.PI * 200);

  const patrolBob = Math.sin(rig.swimPhase * 0.55) * 0.07;
  const eatAirTower = isEating
    ? THREE.MathUtils.smoothstep(eatU, 0.08, 0.24) * (1 - THREE.MathUtils.smoothstep(eatU, 0.52, 0.86) * 0.45)
    : 0;
  const emergeHeightScale = isEating
    ? THREE.MathUtils.lerp(1.58, 2.18, eatAirTower)
    : THREE.MathUtils.lerp(1.52, 3.12, rig.intimidationBlend);
  const emergeLift = rig.emergeAmount * emergeHeightScale * rig.scale;
  const swimSubmerge = isChasing ? -0.24 * (1 - rig.emergeAmount) * rig.scale : -0.04 * rig.scale;

  let eatHeave = 0;
  if (isEating) {
    if (eatU < 0.06) {
      eatHeave = -0.14 * THREE.MathUtils.smoothstep(eatU, 0, 0.06) * rig.scale;
    } else if (eatU < 0.14) {
      eatHeave = THREE.MathUtils.lerp(-0.14, 0.26, THREE.MathUtils.smoothstep(eatU, 0.06, 0.14)) * rig.scale;
    } else if (eatU < 0.46) {
      const catchReach = THREE.MathUtils.smoothstep(eatU, 0.30, 0.46) * 0.22;
      eatHeave = (0.26 + catchReach) * rig.scale;
    } else if (eatU < 0.58) {
      const impact = Math.sin(THREE.MathUtils.clamp((eatU - 0.46) / 0.12, 0, 1) * Math.PI);
      eatHeave = (0.36 - impact * 0.32) * rig.scale;
    } else {
      const g1 = Math.sin(THREE.MathUtils.clamp((eatU - 0.58) / 0.16, 0, 1) * Math.PI);
      const g2 = Math.sin(THREE.MathUtils.clamp((eatU - 0.74) / 0.16, 0, 1) * Math.PI);
      eatHeave = (0.14 - THREE.MathUtils.smoothstep(eatU, 0.58, 0.98) * 0.18 + (g1 + g2 * 0.85) * 0.15) * rig.scale;
    }
  }

  const intimHeave =
    intimPhase === 'staring'
      ? Math.sin(time * 2.5) * 0.068 * rig.scale
      : intimPhase === 'rising'
        ? Math.sin(time * 2.1) * 0.04 * rig.emergeAmount * rig.scale
        : 0;
  const strikeRise = rig.lungeAmount * 0.24 * rig.scale;
  const headLocalY =
    emergeLift +
    swimSubmerge +
    patrolBob * (1 - rig.emergeAmount * 0.5) +
    eatHeave +
    intimHeave +
    strikeRise;
  const lungeZ = rig.lungeAmount * 0.28 * rig.scale;

  // Split look tracking smoothly between neck/torso base and cranium so skull collar stays locked
  let targetTorsoYaw = 0;
  let targetHeadYaw = 0;
  let targetHeadPitch = -0.08;
  let targetHeadRoll = 0;
  let targetJawX = 0.06;

  if (isEating) {
    let eyeTrackPitch = 0;
    let eyeConvYaw = 0;
    let jawSpeed = 24;

    if (eatU < 0.06) {
      // Act 1a: Strike & snap jaws onto the victim
      const p = THREE.MathUtils.smoothstep(eatU, 0, 0.06);
      targetHeadPitch = THREE.MathUtils.lerp(0.06, -0.14, p);
      targetHeadRoll = THREE.MathUtils.lerp(0, 0.06, p);
      targetJawX = THREE.MathUtils.lerp(0.76, 0.24, p);
      jawSpeed = 30;
    } else if (eatU < SERPENT_DEVOUR_AIR_START) {
      // Act 1b: Powerful muscular neck whip upward, releasing victim skyward
      const p = THREE.MathUtils.smoothstep(eatU, 0.06, SERPENT_DEVOUR_AIR_START);
      targetHeadPitch = THREE.MathUtils.lerp(-0.14, -0.68, p);
      targetTorsoYaw = Math.sin(p * Math.PI) * 0.09;
      targetHeadYaw = Math.sin(p * Math.PI) * 0.13;
      targetHeadRoll = THREE.MathUtils.lerp(0.06, -0.05, p);
      targetJawX = THREE.MathUtils.lerp(0.24, 0.62, Math.pow(p, 1.35));
      eyeTrackPitch = THREE.MathUtils.lerp(0, -0.12, p);
      jawSpeed = 28;
    } else if (eatU < SERPENT_DEVOUR_AIR_END) {
      // Act 2: Continuous skyward head & eye tracking through launch, apex & fall into gaping jaws
      const air = computeSerpentDevourAirborneLift(eatU, rig.scale, waterY, ceilingY);
      const fwdX = Math.sin(headYaw);
      const fwdZ = Math.cos(headYaw);
      const rightX = Math.cos(headYaw);
      const rightZ = -Math.sin(headYaw);

      _tmpAirTarget.set(
        headWorldPos.x + fwdX * (0.72 * rig.scale + air.forwardOffset) + rightX * air.lateralOffset,
        waterY + 2.25 * rig.scale + air.verticalOffset,
        headWorldPos.z + fwdZ * (0.72 * rig.scale + air.forwardOffset) + rightZ * air.lateralOffset
      );

      const skullPivotY = headWorldPos.y + headLocalY + 0.22 * rig.scale;
      const relX = _tmpAirTarget.x - headWorldPos.x;
      const relY = _tmpAirTarget.y - skullPivotY;
      const relZ = _tmpAirTarget.z - headWorldPos.z;
      const localX = relX * rightX + relZ * rightZ;
      const localZ = relX * fwdX + relZ * fwdZ;
      const horizDist = Math.max(0.42 * rig.scale, Math.hypot(localX, localZ));

      const trackYaw = THREE.MathUtils.clamp(Math.atan2(localX, localZ), -0.95, 0.95);
      const trackPitch = THREE.MathUtils.clamp(-Math.atan2(relY, horizDist), -1.16, 0.28);
      const trackBlend = THREE.MathUtils.smoothstep(eatU, SERPENT_DEVOUR_AIR_START, 0.20);

      targetTorsoYaw = trackYaw * 0.28;
      targetHeadYaw = trackYaw * 0.72;
      targetHeadPitch = THREE.MathUtils.lerp(-0.68, trackPitch, trackBlend);
      targetHeadRoll = Math.sin(air.tAir * Math.PI) * 0.08;

      // Open jaws terrifyingly wide in anticipation as character reaches apex & falls toward maw
      targetJawX = THREE.MathUtils.lerp(0.62, 1.12, THREE.MathUtils.smoothstep(eatU, 0.16, 0.39));
      eyeTrackPitch = THREE.MathUtils.clamp(trackPitch * 0.20, -0.22, 0.12);
      eyeConvYaw = Math.sin(air.tAir * Math.PI) * 0.14;
      jawSpeed = 20;
    } else if (eatU < 0.58) {
      // Act 3: Mid-air jaw interception & crushing bite closure
      const p = THREE.MathUtils.smoothstep(eatU, SERPENT_DEVOUR_AIR_END, 0.58);
      const biteShudder = Math.sin((eatU - SERPENT_DEVOUR_AIR_END) * 52) * 0.065 * (1 - p);
      targetHeadPitch = THREE.MathUtils.lerp(-0.46, -0.22, p);
      targetTorsoYaw = biteShudder * 0.3;
      targetHeadYaw = biteShudder * 0.7;
      targetHeadRoll = THREE.MathUtils.lerp(0.05, 0, p);
      targetJawX = THREE.MathUtils.lerp(1.12, 0.22, Math.pow(p, 0.68));
      eyeTrackPitch = THREE.MathUtils.lerp(-0.08, 0, p);
      eyeConvYaw = THREE.MathUtils.lerp(0.08, 0, p);
      jawSpeed = 34;
    } else if (eatU < 0.90) {
      // Act 4: Realistic rhythmic upward gulp throws driving prey down the esophagus
      const p = (eatU - 0.58) / 0.32;
      const gulpPulse1 = Math.sin(THREE.MathUtils.clamp((eatU - 0.58) / 0.16, 0, 1) * Math.PI);
      const gulpPulse2 = Math.sin(THREE.MathUtils.clamp((eatU - 0.74) / 0.16, 0, 1) * Math.PI);
      targetHeadPitch = -0.22 - gulpPulse1 * 0.34 - gulpPulse2 * 0.28 - p * 0.06;
      const sway = Math.sin(p * Math.PI * 2.4) * 0.08;
      targetTorsoYaw = sway * 0.26;
      targetHeadYaw = sway * 0.74;
      targetJawX =
        THREE.MathUtils.lerp(0.22, 0.08, THREE.MathUtils.smoothstep(p, 0, 1)) +
        gulpPulse1 * 0.18 +
        gulpPulse2 * 0.14;
      jawSpeed = 24;
    } else {
      const p = THREE.MathUtils.smoothstep(eatU, 0.90, 1.0);
      targetHeadPitch = THREE.MathUtils.lerp(-0.28, -0.10, p);
      targetTorsoYaw = 0;
      targetHeadYaw = 0;
      targetJawX = THREE.MathUtils.lerp(0.10, 0.06, p);
      jawSpeed = 18;
    }

    const eatK = Math.min(1, safeDt * 24);
    rig.torso.rotation.y = THREE.MathUtils.lerp(rig.torso.rotation.y, targetTorsoYaw, eatK);
    rig.headGroup.rotation.y = THREE.MathUtils.lerp(rig.headGroup.rotation.y, targetHeadYaw, eatK);
    rig.headGroup.rotation.x = THREE.MathUtils.lerp(rig.headGroup.rotation.x, targetHeadPitch, eatK);
    rig.headGroup.rotation.z = THREE.MathUtils.lerp(rig.headGroup.rotation.z, targetHeadRoll, eatK);
    rig.jaw.rotation.x = THREE.MathUtils.lerp(rig.jaw.rotation.x, targetJawX, Math.min(1, safeDt * jawSpeed));

    const eyeYawOff = THREE.MathUtils.clamp(targetHeadYaw * 0.26, -0.18, 0.18);
    rig.leftEye.rotation.y = -0.52 + eyeYawOff + eyeConvYaw;
    rig.rightEye.rotation.y = 0.52 + eyeYawOff - eyeConvYaw;
    rig.leftEye.rotation.x = THREE.MathUtils.lerp(rig.leftEye.rotation.x, eyeTrackPitch, eatK);
    rig.rightEye.rotation.x = THREE.MathUtils.lerp(rig.rightEye.rotation.x, eyeTrackPitch, eatK);

    const tongueRetract = eatU > SERPENT_DEVOUR_AIR_START && eatU < 0.52 ? 0.36 : 0.12;
    rig.tongue.position.z = THREE.MathUtils.lerp(rig.tongue.position.z, tongueRetract, eatK);
    rig.tongue.rotation.y = 0;
  } else if (isIntimTower) {
    const relX = playerWorldPos.x - headWorldPos.x;
    const relY = playerWorldPos.y - (headWorldPos.y + headLocalY + 0.22 * rig.scale);
    const relZ = playerWorldPos.z - headWorldPos.z;
    const cosY = Math.cos(headYaw);
    const sinY = Math.sin(headYaw);
    const localX = relX * cosY - relZ * sinY;
    const localZ = relX * sinY + relZ * cosY;

    const lookHorizDist = Math.max(0.45, Math.hypot(localX, localZ));
    const stareTotalYaw = THREE.MathUtils.clamp(
      Math.atan2(localX, localZ),
      -1.36,
      1.36
    );
    const stareTotalPitch = THREE.MathUtils.clamp(
      -Math.atan2(relY, lookHorizDist),
      -0.85,
      0.72
    );

    if (intimPhase === 'rising') {
      const skyRiseU = THREE.MathUtils.smoothstep(intimU, 0, 0.68);
      const turnToPlayerU = THREE.MathUtils.smoothstep(intimU, 0.66, 1.0);
      const skyPitch = THREE.MathUtils.lerp(-0.08, -0.88, skyRiseU);
      targetTorsoYaw = stareTotalYaw * 0.32 * turnToPlayerU;
      targetHeadYaw = stareTotalYaw * 0.68 * turnToPlayerU;
      targetHeadPitch = THREE.MathUtils.lerp(skyPitch, stareTotalPitch, turnToPlayerU);
      targetHeadRoll = Math.sin(intimU * Math.PI) * 0.04 * (1 - turnToPlayerU);
      targetJawX =
        THREE.MathUtils.lerp(0.1, 0.44, skyRiseU) +
        turnToPlayerU * 0.14 +
        Math.sin(time * 4.2) * 0.04;
    } else if (intimPhase === 'staring') {
      const stareT = intimidation?.stareElapsed ?? 0;
      const glareTwitch =
        Math.sin(stareT * 5.2) > 0.88 ? Math.sin(stareT * 26) * 0.09 : 0;
      targetTorsoYaw = stareTotalYaw * 0.32;
      targetHeadYaw = stareTotalYaw * 0.68;
      targetHeadPitch = stareTotalPitch + Math.sin(time * 2.1) * 0.035;
      // Predatory head-cocking tilt while sizing up the player
      targetHeadRoll = Math.sin(time * 1.35 + 0.5) * 0.11 + glareTwitch * 0.45;
      targetJawX =
        0.48 +
        Math.sin(time * 2.9) * 0.12 +
        Math.max(0, Math.sin(stareT * 1.7) * 0.14) +
        Math.abs(glareTwitch) * 0.9;
    } else {
      // 'lowering': smoothly untwist head back forward and sink back to water surface
      const lowerU = THREE.MathUtils.smoothstep(intimU, 0, 1);
      targetTorsoYaw = stareTotalYaw * 0.32 * (1 - lowerU);
      targetHeadYaw = stareTotalYaw * 0.68 * (1 - lowerU);
      targetHeadPitch = THREE.MathUtils.lerp(stareTotalPitch, -0.06, lowerU);
      targetHeadRoll = 0;
      targetJawX = THREE.MathUtils.lerp(0.46, 0.06, lowerU);
    }

    const intimK = Math.min(1, safeDt * 7.5);
    rig.torso.rotation.y = THREE.MathUtils.lerp(rig.torso.rotation.y, targetTorsoYaw, intimK);
    rig.headGroup.rotation.y = THREE.MathUtils.lerp(rig.headGroup.rotation.y, targetHeadYaw, intimK);
    rig.headGroup.rotation.x = THREE.MathUtils.lerp(rig.headGroup.rotation.x, targetHeadPitch, intimK);
    rig.headGroup.rotation.z = THREE.MathUtils.lerp(rig.headGroup.rotation.z, targetHeadRoll, intimK);
    rig.jaw.rotation.x = THREE.MathUtils.lerp(rig.jaw.rotation.x, targetJawX, Math.min(1, safeDt * 11));

    const eyeYawOff = THREE.MathUtils.clamp(targetHeadYaw * 0.22, -0.16, 0.16);
    rig.leftEye.rotation.y = -0.52 + eyeYawOff;
    rig.rightEye.rotation.y = 0.52 + eyeYawOff;
    rig.leftEye.rotation.x = 0;
    rig.rightEye.rotation.x = 0;

    const slowFlick =
      intimPhase === 'lowering'
        ? 0
        : Math.max(0, Math.sin(time * 4.4) * 1.6 - 0.35);
    rig.tongue.position.z = 0.38 + slowFlick * 0.44;
    rig.tongue.rotation.y = Math.sin(time * 18) * 0.24;
  } else {
    const relX = playerWorldPos.x - headWorldPos.x;
    const relY = playerWorldPos.y - (headWorldPos.y + headLocalY);
    const relZ = playerWorldPos.z - headWorldPos.z;
    const cosY = Math.cos(headYaw);
    const sinY = Math.sin(headYaw);
    const localX = relX * cosY - relZ * sinY;
    const localZ = relX * sinY + relZ * cosY;
    const totalLookYaw = THREE.MathUtils.clamp(Math.atan2(localX, localZ), -0.78, 0.78);
    const totalLookPitch = THREE.MathUtils.clamp(
      -Math.atan2(relY, Math.hypot(localX, localZ)),
      -0.55,
      0.45
    );
    // Neck absorbs ~24% of gaze angle, cranium ~76% -> seamless muscular neck-to-head lock
    targetTorsoYaw = totalLookYaw * 0.24;
    targetHeadYaw = totalLookYaw * 0.76;
    targetHeadPitch = isChasing
      ? totalLookPitch * 0.74 - rig.emergeAmount * 0.16 - rig.lungeAmount * 0.08
      : totalLookPitch * 0.44 - rig.emergeAmount * 0.1;

    rig.torso.rotation.y = THREE.MathUtils.lerp(rig.torso.rotation.y, targetTorsoYaw, k);
    rig.headGroup.rotation.y = THREE.MathUtils.lerp(rig.headGroup.rotation.y, targetHeadYaw, k);
    rig.headGroup.rotation.x = THREE.MathUtils.lerp(rig.headGroup.rotation.x, targetHeadPitch, k);
    rig.headGroup.rotation.z = THREE.MathUtils.lerp(rig.headGroup.rotation.z, 0, k);

    const eyeYawOff = THREE.MathUtils.clamp(targetHeadYaw * 0.18, -0.12, 0.12);
    rig.leftEye.rotation.y = -0.52 + eyeYawOff;
    rig.rightEye.rotation.y = 0.52 + eyeYawOff;
    rig.leftEye.rotation.x = 0;
    rig.rightEye.rotation.x = 0;

    const snapFreq = rig.lungeAmount > 0.2 ? 17 : 11;
    targetJawX = isChasing
      ? 0.52 + rig.emergeAmount * 0.34 + rig.lungeAmount * 0.22 + Math.abs(Math.sin(time * snapFreq)) * 0.2
      : 0.06 + Math.sin(time * 2.1) * 0.04;
    rig.jaw.rotation.x = THREE.MathUtils.lerp(rig.jaw.rotation.x, targetJawX, k);

    const flick = isChasing ? Math.sin(time * 20) : Math.max(0, Math.sin(time * 2.8) * 3 - 2);
    rig.tongue.position.z = 0.38 + Math.max(0, flick) * 0.46;
    rig.tongue.rotation.y = Math.sin(time * 28) * 0.22;
  }

  const bankRoll = THREE.MathUtils.clamp(-rig.smoothedTurnRate * 0.14, -0.26, 0.26);
  rig.headAssembly.position.set(
    Math.sin(headYaw) * lungeZ,
    headLocalY,
    Math.cos(headYaw) * lungeZ
  );
  rig.headAssembly.rotation.y = headYaw;
  rig.torso.rotation.z = isEating
    ? Math.sin(eatU * Math.PI * 4.5) * 0.11 * (1 - eatU * 0.55)
    : isIntimTower
      ? THREE.MathUtils.lerp(
          rig.torso.rotation.z,
          Math.sin(time * 1.9) * 0.075 * rig.emergeAmount,
          Math.min(1, safeDt * 6)
        )
      : THREE.MathUtils.lerp(rig.torso.rotation.z, Math.sin(rig.swimPhase) * (0.06 + aggro * 0.11) + bankRoll * 0.65, k);

  // Follow-the-leader spine path with natural emergence S-arch & turn-bank continuity
  const segSpacing = SERPENT_BONE_STEP * rig.scale;
  const neckAnchorY = headLocalY + 0.18 * rig.scale;
  const headOffX = Math.sin(headYaw) * lungeZ;
  const headOffZ = Math.cos(headYaw) * lungeZ;
  let anchorX = headWorldPos.x + headOffX;
  let anchorY = headWorldPos.y + neckAnchorY;
  let anchorZ = headWorldPos.z + headOffZ;
  let prevYaw = headYaw + rig.torso.rotation.y * 0.45;

  const seg0 = rig.segments[0];
  seg0.worldPos.set(anchorX, anchorY, anchorZ);
  seg0.yaw = prevYaw;
  seg0.roll = rig.torso.rotation.z * 0.72;
  seg0.bone.position.set(headOffX, neckAnchorY, headOffZ);

  // Throat peristalsis bulge travels down anterior spine segments as prey is swallowed (eatU 0.54 -> 0.99)
  const bulgeWave = isEating && eatU >= 0.54 ? THREE.MathUtils.clamp((eatU - 0.54) / 0.45, 0, 1) : -1;
  const bulgeCenter = bulgeWave >= 0 ? bulgeWave * 6.8 : -10;

  for (let i = 1; i < rig.segments.length; i++) {
    const seg = rig.segments[i];
    const dx = anchorX - seg.worldPos.x;
    const dy = anchorY - seg.worldPos.y;
    const dz = anchorZ - seg.worldPos.z;
    const dist = Math.hypot(dx, dy, dz);

    let nx: number;
    let ny: number;
    let nz: number;
    if (dist > 0.0001) {
      const invD = 1 / dist;
      nx = dx * invD;
      ny = THREE.MathUtils.clamp(dy * invD, -0.78, 0.78);
      nz = dz * invD;
    } else {
      nx = Math.sin(prevYaw);
      ny = 0;
      nz = Math.cos(prevYaw);
    }

    const horizLen = Math.hypot(nx, nz);
    if (horizLen > 0.001) {
      const rawYaw = Math.atan2(nx, nz);
      let yawDiff = (rawYaw - prevYaw) % (Math.PI * 2);
      if (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      if (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      const maxBend = 0.48; // tighter anatomical inter-vertebral yaw cap prevents pinching
      if (Math.abs(yawDiff) > maxBend) {
        const clampedYaw = prevYaw + Math.sign(yawDiff) * maxBend;
        nx = Math.sin(clampedYaw) * horizLen;
        nz = Math.cos(clampedYaw) * horizLen;
      }
      const uLen = Math.hypot(nx, ny, nz);
      if (uLen > 0.0001) {
        nx /= uLen;
        ny /= uLen;
        nz /= uLen;
      }
    }

    seg.worldPos.x = anchorX - nx * segSpacing;
    seg.worldPos.y = anchorY - ny * segSpacing;
    seg.worldPos.z = anchorZ - nz * segSpacing;
    seg.yaw = Math.atan2(nx, nz);
    seg.pitch = -Math.asin(THREE.MathUtils.clamp(ny, -0.78, 0.78));

    // Towering icon-like neck S-arch during emergence & devour tracking
    const archScale = isEating ? 1.72 : 1.15 + rig.intimidationBlend * 1.9;
    const emergeArch = i <= 6 ? Math.sin((1 - i / 7) * Math.PI * 0.5) * rig.emergeAmount * archScale * rig.scale : 0;
    const maxSegY = waterY - 0.14 * rig.scale + emergeArch;
    if (seg.worldPos.y > maxSegY) {
      seg.worldPos.y = THREE.MathUtils.lerp(seg.worldPos.y, maxSegY, Math.min(1, safeDt * 14));
    }
    const minSegY = floorY + seg.radius * 0.9;
    if (seg.worldPos.y < minSegY) {
      seg.worldPos.y = minSegY;
    }

    anchorX = seg.worldPos.x;
    anchorY = seg.worldPos.y;
    anchorZ = seg.worldPos.z;
    prevYaw = seg.yaw;
  }

  // Arc-length preserving traveling S-wave: displace smoothly laterally, then re-normalize exact bone step length
  let chainX = seg0.bone.position.x;
  let chainY = seg0.bone.position.y;
  let chainZ = seg0.bone.position.z;
  for (let i = 1; i < rig.segments.length; i++) {
    const seg = rig.segments[i];
    const t = i / (rig.segments.length - 1);
    // Smooth spatial envelope tapers gently at neck base (0) and peaks along tail whip (1)
    const neckRamp = THREE.MathUtils.smoothstep(t, 0.02, 0.24);
    const waveAmp =
      (0.04 + Math.pow(t, 1.08) * 0.76) *
      neckRamp *
      (isEating ? 1.02 : isIntimTower ? 0.42 : isChasing ? 1.32 : 0.86) *
      rig.scale;
    const phase = rig.swimPhase - i * 0.42;
    const wave = (Math.sin(phase) + 0.14 * Math.sin(phase * 2.0 - 0.5)) * waveAmp;
    const perpX = Math.cos(seg.yaw);
    const perpZ = -Math.sin(seg.yaw);
    const vertWave =
      Math.sin(rig.swimPhase * 0.75 - i * 0.36) *
      (isChasing ? 0.13 : isIntimTower ? 0.03 : 0.05) *
      t *
      rig.scale;

    const maxSubmergedY =
      i <= 6
        ? waterY + (1.05 + Math.max(rig.intimidationBlend * 2.05, isEating ? 0.75 : 0)) * rig.scale
        : isIntimTower
          ? waterY - 0.14 * rig.scale
          : waterY + 1.05 * rig.scale;
    const minBoneWorldY = floorY + seg.radius * 0.85;
    const rawBoneX = seg.worldPos.x - headWorldPos.x + perpX * wave;
    const rawBoneY = Math.max(minBoneWorldY, Math.min(maxSubmergedY, seg.worldPos.y + vertWave)) - headWorldPos.y;
    const rawBoneZ = seg.worldPos.z - headWorldPos.z + perpZ * wave;

    // Enforce exact arc-length spacing relative to previous posed bone so mesh never stretches or compresses
    const sx = rawBoneX - chainX;
    const sy = rawBoneY - chainY;
    const sz = rawBoneZ - chainZ;
    const sLen = Math.hypot(sx, sy, sz);
    if (sLen > 1e-4) {
      const scaleLen = segSpacing / sLen;
      chainX += sx * scaleLen;
      chainY += sy * scaleLen;
      chainZ += sz * scaleLen;
    } else {
      chainX -= Math.sin(seg.yaw) * segSpacing;
      chainZ -= Math.cos(seg.yaw) * segSpacing;
    }

    seg.bone.position.set(chainX, chainY, chainZ);
    seg.roll = Math.cos(phase) * (0.06 + t * 0.2) * (isChasing ? 1.3 : 0.78) + bankRoll * (1 - t * 0.65);
  }

  // Organic throat swallow bulge peristalsis expanding & contracting anterior neck bones
  for (let i = 0; i < rig.segments.length; i++) {
    const bone = rig.segments[i].bone;
    if (isEating && i <= 7 && bulgeWave >= 0) {
      const distB = i - bulgeCenter;
      const gulpMod = 0.85 + 0.2 * Math.sin(bulgeWave * Math.PI * 2.5);
      const b = Math.exp(-(distB * distB) / 2.4) * Math.sin(bulgeWave * Math.PI) * gulpMod;
      const s = 1 + Math.max(0, b) * 0.34;
      bone.scale.set(s, s * (1 + Math.max(0, b) * 0.08), 1);
    } else if (bone.scale.x !== 1 || bone.scale.y !== 1) {
      bone.scale.set(1, 1, 1);
    }
  }

  if (!skipBoneSync) {
    syncSerpentBones(rig, headYaw);
  }

  const jawOpenFactor = THREE.MathUtils.clamp(rig.jaw.rotation.x / 0.85, 0, 1);
  for (let i = 0; i < rig.jawTendons.length; i++) {
    const td = rig.jawTendons[i];
    td.visible = jawOpenFactor > 0.1;
    td.scale.set(1, 0.4 + jawOpenFactor * 1.15, 0.85 + jawOpenFactor * 0.3);
    td.rotation.x = -0.18 - rig.jaw.rotation.x * 0.42;
  }

  // Water surface wake ring + V-shaped surging bow-wave (fades cleanly when swimming deep underwater)
  const submergeFade = THREE.MathUtils.clamp(
    1 - Math.max(0, waterY - headWorldPos.y - 0.65 * rig.scale) / (0.85 * rig.scale),
    0,
    1
  );
  const wakePhase = (time * (isChasing ? 3.2 : 0.75)) % 1;
  const wakeScale = rig.scale * (1.05 + wakePhase * (isChasing ? 1.85 : 0.85));
  rig.wakeRing.position.set(0, waterY - headWorldPos.y + 0.06, 0);
  rig.wakeRing.scale.setScalar(wakeScale);
  (rig.wakeRing.material as THREE.MeshBasicMaterial).opacity =
    (1 - wakePhase) * (0.26 + aggro * 0.52) * submergeFade;

  rig.bowWake.position.set(
    -Math.sin(headYaw) * 1.6 * rig.scale,
    waterY - headWorldPos.y + 0.07,
    -Math.cos(headYaw) * 1.6 * rig.scale
  );
  rig.bowWake.rotation.y = headYaw;
  (rig.bowWake.material as THREE.MeshBasicMaterial).opacity =
    (isChasing ? 0.42 + Math.sin(time * 18) * 0.08 : 0.08) * submergeFade;
}

export function attachPreyToSerpentMouth(
  monsterRig: MonsterRig,
  preyRig: PlayerRig,
  eatProgress: number,
  time: number,
  dt: number,
  startWorldPos?: THREE.Vector3 | null,
  startYaw = 0,
  skipMatrixUpdate = false,
  ceilingY = Infinity
): void {
  const u = THREE.MathUtils.clamp(eatProgress, 0, 1);
  if (!skipMatrixUpdate) {
    monsterRig.root.updateMatrixWorld(true);
  }
  monsterRig.headGroup.matrixWorld.decompose(_tmpPreyWorldPos, _tmpPreyHeadQuat, _tmpPreyHeadScale);

  const jawDrop = THREE.MathUtils.clamp(monsterRig.jaw.rotation.x, 0, 1.2);
  const headYaw = monsterRig.headAssembly.rotation.y;
  const waterYApprox = monsterRig.root.position.y + 0.14;
  const air = computeSerpentDevourAirborneLift(u, monsterRig.scale, waterYApprox, ceilingY);

  // Compute Center-of-Mass (hips) target inside serpent headGroup space across all 4 acts
  let localComZ = 0.72;
  let localComY = -0.14;
  let localComX = 0;

  if (u < 0.06) {
    const p = THREE.MathUtils.smoothstep(u, 0, 0.06);
    localComZ = THREE.MathUtils.lerp(0.84, 0.68, p);
    localComY = THREE.MathUtils.lerp(-0.18, -0.14 - jawDrop * 0.12, p);
  } else if (u < SERPENT_DEVOUR_AIR_START) {
    const p = THREE.MathUtils.smoothstep(u, 0.06, SERPENT_DEVOUR_AIR_START);
    localComZ = THREE.MathUtils.lerp(0.68, 0.88, p);
    localComY = THREE.MathUtils.lerp(-0.14 - jawDrop * 0.12, -0.05, p);
  } else if (u < SERPENT_DEVOUR_AIR_END) {
    localComZ = THREE.MathUtils.lerp(0.88, 0.38, THREE.MathUtils.smoothstep(air.tAir, 0, 1));
    localComY = THREE.MathUtils.lerp(-0.05, -0.22 - jawDrop * 0.14, THREE.MathUtils.smoothstep(air.tAir, 0.45, 1));
  } else if (u < 0.58) {
    const p = THREE.MathUtils.smoothstep(u, SERPENT_DEVOUR_AIR_END, 0.58);
    localComZ = THREE.MathUtils.lerp(0.38, 0.08, p);
    localComY = THREE.MathUtils.lerp(-0.22 - jawDrop * 0.14, -0.17 - jawDrop * 0.1, p);
    localComX = Math.sin(time * 28) * 0.025 * (1 - p);
  } else {
    // Progressive gulps pull prey deep down the throat instead of vanishing abruptly in front of teeth
    const p = THREE.MathUtils.clamp((u - 0.58) / 0.40, 0, 1);
    const gulp1 = Math.sin(THREE.MathUtils.clamp((u - 0.58) / 0.16, 0, 1) * Math.PI);
    const gulp2 = Math.sin(THREE.MathUtils.clamp((u - 0.74) / 0.16, 0, 1) * Math.PI);
    const gulpSurge = (gulp1 + gulp2) * 0.06;
    localComZ = THREE.MathUtils.lerp(0.08, -1.95, THREE.MathUtils.smoothstep(p, 0, 1)) - gulpSurge;
    localComY = THREE.MathUtils.lerp(-0.17 - jawDrop * 0.08, -0.04, THREE.MathUtils.smoothstep(p, 0, 0.72));
  }

  _tmpPreyLocal.set(localComX, localComY, localComZ);
  _tmpPreyLocal.applyMatrix4(monsterRig.headGroup.matrixWorld);

  if (air.active) {
    const fwdX = Math.sin(headYaw);
    const fwdZ = Math.cos(headYaw);
    const rightX = Math.cos(headYaw);
    const rightZ = -Math.sin(headYaw);
    _tmpAirOffset.set(
      fwdX * air.forwardOffset + rightX * air.lateralOffset,
      air.verticalOffset,
      fwdZ * air.forwardOffset + rightZ * air.lateralOffset
    );
    _tmpPreyLocal.add(_tmpAirOffset);
  }

  // Continuous Center-of-Mass rotation from standing -> upward launch -> natural ballistic tumble -> open-mouth catch
  _tmpPreyMouthQuat.copy(_tmpPreyHeadQuat).multiply(_tmpPreyBasisQuat);
  let pitchTumble = 0;
  let yawTumble = 0;
  let rollTumble = 0;
  if (u < SERPENT_DEVOUR_AIR_START) {
    pitchTumble = Math.PI * 0.44;
    rollTumble = 0.14 * THREE.MathUtils.smoothstep(u, 0.04, SERPENT_DEVOUR_AIR_START);
  } else if (u < SERPENT_DEVOUR_AIR_END) {
    // Smooth 280-degree natural backwards tumble through apex, settling seamlessly into _tmpPreyMouthQuat at tAir=1
    const spinEase = THREE.MathUtils.lerp(air.tAir, THREE.MathUtils.smoothstep(air.tAir, 0, 1), 0.35);
    pitchTumble = THREE.MathUtils.lerp(Math.PI * 0.44, Math.PI * 2.0, spinEase);
    rollTumble = Math.sin(air.tAir * Math.PI) * 0.34 + (1 - air.tAir) * 0.14;
    yawTumble = Math.sin(air.tAir * Math.PI * 1.15) * 0.24;
  } else if (u < 0.74) {
    const wFade = 1 - THREE.MathUtils.smoothstep(u, 0.46, 0.74);
    yawTumble = Math.sin(time * 20) * 0.06 * wFade;
    rollTumble = Math.cos(time * 24) * 0.07 * wFade;
  }

  _tmpPreyEuler.set(pitchTumble, yawTumble, rollTumble, 'YXZ');
  _tmpPreyTumbleQuat.setFromEuler(_tmpPreyEuler);
  _tmpPreyWorldQuat.copy(_tmpPreyMouthQuat).multiply(_tmpPreyTumbleQuat);

  const grabBlend = THREE.MathUtils.smoothstep(u, 0, 0.09);
  if (startWorldPos && grabBlend < 1) {
    _tmpPreyEuler.set(0, startYaw, 0, 'YXZ');
    _tmpPreyStartQuat.setFromEuler(_tmpPreyEuler);
    preyRig.root.quaternion.copy(_tmpPreyStartQuat).slerp(_tmpPreyWorldQuat, grabBlend);
  } else {
    preyRig.root.quaternion.copy(_tmpPreyWorldQuat);
  }

  const caughtScale = Math.min(1.0, 0.88 * Math.max(0.85, monsterRig.scale));
  const flightScaleBlend = THREE.MathUtils.smoothstep(u, SERPENT_DEVOUR_AIR_END - 0.04, 0.58);
  const preSwallowScale = THREE.MathUtils.lerp(1.0, caughtScale, flightScaleBlend);
  // Constriction scaling happens only AFTER jaws close and victim slides deep down the esophagus
  const throatShrink = 1 - THREE.MathUtils.smoothstep(u, 0.60, 0.95) * 0.93;
  const finalScale = Math.max(0.05, preSwallowScale * throatShrink);
  preyRig.root.scale.setScalar(finalScale);

  // Offset root by rotated hip Center-of-Mass so victim tumbles cleanly around torso instead of feet
  _tmpComOffset.set(0, 0.88 * finalScale, 0).applyQuaternion(preyRig.root.quaternion);
  if (startWorldPos && grabBlend < 1) {
    _tmpPreyWorldPos.copy(startWorldPos);
    _tmpPreyWorldPos.y += 0.88;
    _tmpComWorld.lerpVectors(_tmpPreyWorldPos, _tmpPreyLocal, grabBlend);
  } else {
    _tmpComWorld.copy(_tmpPreyLocal);
  }
  preyRig.root.position.copy(_tmpComWorld).sub(_tmpComOffset);

  // Expressive horror limb/torso/head animation synced cleanly for both male and female skeletons
  const safeDt = Math.max(0.001, Math.min(0.06, dt));
  const k = Math.min(1, safeDt * 24);
  const inFlight = u >= SERPENT_DEVOUR_AIR_START && u < SERPENT_DEVOUR_AIR_END;
  const postCatch = THREE.MathUtils.smoothstep(u, SERPENT_DEVOUR_AIR_END, 0.64);
  const deepSwallow = THREE.MathUtils.smoothstep(u, 0.62, 0.90);
  const flailAmt = (inFlight ? 1.0 : 1 - postCatch) * (1 - deepSwallow);
  const flail = flailAmt * Math.sin(time * 24);

  preyRig.hips.position.x = THREE.MathUtils.lerp(preyRig.hips.position.x, 0, k);
  preyRig.hips.position.y = THREE.MathUtils.lerp(preyRig.hips.position.y, 0.92, k);
  preyRig.hips.rotation.set(
    THREE.MathUtils.lerp(preyRig.hips.rotation.x, 0, k),
    THREE.MathUtils.lerp(preyRig.hips.rotation.y, 0, k),
    THREE.MathUtils.lerp(preyRig.hips.rotation.z, 0, k)
  );

  // Mid-air arch & panic look -> tightly compressed swallow posture inside throat
  const targetTorsoX = inFlight
    ? -0.18 + Math.sin(air.tAir * Math.PI) * 0.34
    : THREE.MathUtils.lerp(0.16, 0.04, deepSwallow);
  const targetHeadX = inFlight
    ? 0.24 - Math.cos(air.tAir * Math.PI) * 0.16
    : THREE.MathUtils.lerp(-0.22, 0.16, deepSwallow);

  preyRig.torso.rotation.x = THREE.MathUtils.lerp(preyRig.torso.rotation.x, targetTorsoX, k);
  preyRig.torso.rotation.y = THREE.MathUtils.lerp(preyRig.torso.rotation.y, flail * 0.22, k);
  preyRig.torso.rotation.z = THREE.MathUtils.lerp(preyRig.torso.rotation.z, Math.cos(time * 19) * 0.11 * flailAmt, k);
  preyRig.headGroup.rotation.x = THREE.MathUtils.lerp(preyRig.headGroup.rotation.x, targetHeadX + flail * 0.08, k);
  preyRig.headGroup.rotation.y = THREE.MathUtils.lerp(preyRig.headGroup.rotation.y, flail * 0.14, k);

  const lArmXTarget = inFlight
    ? -1.45 + flail * 0.55
    : THREE.MathUtils.lerp(-1.05, -0.08, deepSwallow);
  const rArmXTarget = inFlight
    ? -1.32 - flail * 0.55
    : THREE.MathUtils.lerp(-0.98, -0.08, deepSwallow);
  const armSpread = inFlight ? 0.52 : THREE.MathUtils.lerp(0.24, 0.09, deepSwallow);

  preyRig.leftArm.rotation.x = THREE.MathUtils.lerp(preyRig.leftArm.rotation.x, lArmXTarget, k);
  preyRig.rightArm.rotation.x = THREE.MathUtils.lerp(preyRig.rightArm.rotation.x, rArmXTarget, k);
  preyRig.leftArm.rotation.z = THREE.MathUtils.lerp(preyRig.leftArm.rotation.z, -armSpread, k);
  preyRig.rightArm.rotation.z = THREE.MathUtils.lerp(preyRig.rightArm.rotation.z, armSpread, k);
  preyRig.leftForearm.rotation.x = THREE.MathUtils.lerp(
    preyRig.leftForearm.rotation.x,
    inFlight ? -0.45 + Math.cos(time * 22) * 0.25 : THREE.MathUtils.lerp(-0.95, -0.25, deepSwallow),
    k
  );
  preyRig.rightForearm.rotation.x = THREE.MathUtils.lerp(
    preyRig.rightForearm.rotation.x,
    inFlight ? -0.45 - Math.cos(time * 22) * 0.25 : THREE.MathUtils.lerp(-0.95, -0.25, deepSwallow),
    k
  );
  preyRig.leftHand.rotation.x = THREE.MathUtils.lerp(preyRig.leftHand.rotation.x, 0.18 * deepSwallow, k);
  preyRig.rightHand.rotation.x = THREE.MathUtils.lerp(preyRig.rightHand.rotation.x, 0.18 * deepSwallow, k);

  const kickL = inFlight ? -0.42 + Math.sin(time * 26) * 0.42 : THREE.MathUtils.lerp(-0.48, 0.06, deepSwallow);
  const kickR = inFlight ? -0.36 - Math.sin(time * 26) * 0.42 : THREE.MathUtils.lerp(-0.44, 0.06, deepSwallow);
  const shinBend = inFlight ? 0.72 : THREE.MathUtils.lerp(1.12, 0.14, deepSwallow);
  preyRig.leftLeg.rotation.x = THREE.MathUtils.lerp(preyRig.leftLeg.rotation.x, kickL, k);
  preyRig.rightLeg.rotation.x = THREE.MathUtils.lerp(preyRig.rightLeg.rotation.x, kickR, k);
  preyRig.leftLeg.rotation.z = THREE.MathUtils.lerp(preyRig.leftLeg.rotation.z, inFlight ? 0.14 : 0.02, k);
  preyRig.rightLeg.rotation.z = THREE.MathUtils.lerp(preyRig.rightLeg.rotation.z, inFlight ? -0.14 : -0.02, k);
  preyRig.leftShin.rotation.x = THREE.MathUtils.lerp(preyRig.leftShin.rotation.x, shinBend, k);
  preyRig.rightShin.rotation.x = THREE.MathUtils.lerp(preyRig.rightShin.rotation.x, shinBend, k);
  preyRig.leftFoot.rotation.x = THREE.MathUtils.lerp(preyRig.leftFoot.rotation.x, THREE.MathUtils.lerp(0.28, 0.62, deepSwallow), k);
  preyRig.rightFoot.rotation.x = THREE.MathUtils.lerp(preyRig.rightFoot.rotation.x, THREE.MathUtils.lerp(0.28, 0.62, deepSwallow), k);

  // Smooth hair simulation so female & male hair reacts naturally to airborne launch & tucks cleanly in jaws
  if (preyRig.hairNodes.length > 0) {
    const goalHairPitch = inFlight
      ? THREE.MathUtils.lerp(-0.72, 0.32, air.tAir)
      : u < SERPENT_DEVOUR_AIR_START
        ? -0.42
        : -0.16;
    const goalHairRoll = flailAmt * Math.cos(time * 14) * 0.22;
    preyRig.hairPitch = THREE.MathUtils.lerp(preyRig.hairPitch, goalHairPitch, Math.min(1, safeDt * 14));
    preyRig.hairRoll = THREE.MathUtils.lerp(preyRig.hairRoll, goalHairRoll, Math.min(1, safeDt * 14));
    for (let i = 0; i < preyRig.hairNodes.length; i++) {
      const hn = preyRig.hairNodes[i];
      const wave = flailAmt * Math.sin(time * 16 + hn.phaseOffset) * 0.1;
      const localPitch = THREE.MathUtils.clamp(
        preyRig.hairPitch * hn.pitchFactor + wave,
        hn.maxBackwardPitch,
        hn.maxForwardPitch
      );
      hn.group.rotation.x = hn.restPitch + localPitch;
      hn.group.rotation.y = hn.restYaw;
      hn.group.rotation.z = hn.restRoll + preyRig.hairRoll * hn.rollFactor;
    }
  }

  const headBaseY = 0.09 + 0.54 * Math.cos(preyRig.torso.rotation.x);
  const headBaseZ = 0.54 * Math.sin(preyRig.torso.rotation.x);
  preyRig.lampAnchor.position.set(0, preyRig.hips.position.y + headBaseY, headBaseZ);
  preyRig.lampAnchor.rotation.set(preyRig.torso.rotation.x + preyRig.headGroup.rotation.x, preyRig.torso.rotation.y, 0);
}

export interface CheckpointVisual {
  group: THREE.Group;
  ring: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
  lightColor: THREE.Color;
  activated: boolean;
}

export function createCheckpointVisual(pos: [number, number, number]): CheckpointVisual {
  const group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  const props = getPropSharedPool();

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xebb144,
    emissive: 0xd99626,
    emissiveIntensity: 1.7,
    roughness: 0.16,
  });

  // Heavy industrial octagonal anchor base + stainless inner ring
  const basePlate = new THREE.Mesh(props.cpBasePlateGeo, props.cpBaseMat);
  basePlate.position.y = 0.06;
  basePlate.receiveShadow = true;
  group.add(basePlate);

  const innerRing = new THREE.Mesh(props.cpInnerRingGeo, props.cpCollarMat);
  innerRing.position.y = 0.14;
  group.add(innerRing);

  // Corner anchor struts around pad
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    const strut = new THREE.Mesh(props.cpStrutGeo, props.cpCollarMat);
    strut.position.set(Math.cos(ang) * 0.66, 0.26, Math.sin(ang) * 0.66);
    strut.rotation.set(Math.sin(ang) * 0.25, 0, -Math.cos(ang) * 0.25);
    group.add(strut);
  }

  const ring = new THREE.Mesh(props.cpRingGeo, beaconMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.9;
  group.add(ring);

  const core = new THREE.Mesh(props.cpCoreGeo, beaconMat);
  core.position.y = 0.9;
  group.add(core);

  return { group, ring, beaconMat, lightColor: new THREE.Color(0xebb144), activated: false };
}

export function createExitGateMesh(pos: [number, number, number], size: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  const props = getPropSharedPool();

  const w = Math.max(3.0, size[0]);
  const h = Math.max(3.4, size[1]);
  const sizeKey = `${w.toFixed(2)}_${h.toFixed(2)}`;
  let sized = props.exitSizedGeos.get(sizeKey);
  if (!sized) {
    sized = {
      postGeo: tagShared(new THREE.BoxGeometry(0.42, h, 0.56)),
      footGeo: tagShared(new THREE.BoxGeometry(0.68, 0.22, 0.82)),
      ribGeo: tagShared(new THREE.BoxGeometry(0.48, 0.14, 0.62)),
      lintelGeo: tagShared(new THREE.BoxGeometry(w + 0.58, 0.48, 0.68)),
      upperBeamGeo: tagShared(new THREE.BoxGeometry(w + 0.3, 0.18, 0.74)),
      thresholdGeo: tagShared(new THREE.BoxGeometry(w - 0.35, 0.1, 0.52)),
      portalGeo: tagShared(new THREE.PlaneGeometry(w - 0.42, h - 0.26)),
    };
    props.exitSizedGeos.set(sizeKey, sized);
  }

  for (const side of [-1, 1] as const) {
    const px = side * w * 0.5;
    const post = new THREE.Mesh(sized.postGeo, props.exitFrameMat);
    post.position.set(px, h * 0.5, 0);
    post.castShadow = true;
    group.add(post);

    const foot = new THREE.Mesh(sized.footGeo, props.exitTrimSteelMat);
    foot.position.set(px, 0.11, 0);
    foot.receiveShadow = true;
    group.add(foot);

    for (const ry of [0.85, 1.75, 2.65]) {
      if (ry < h - 0.3) {
        const rib = new THREE.Mesh(sized.ribGeo, props.exitTrimSteelMat);
        rib.position.set(px, ry, 0);
        group.add(rib);
      }
    }

    // Side safety bollard emitter
    const bollard = new THREE.Mesh(props.exitBollardGeo, props.exitFrameMat);
    bollard.position.set(px + side * 0.55, 0.475, 0.45);
    group.add(bollard);
    const cap = new THREE.Mesh(props.exitCapGeo, props.exitGlowMat);
    cap.position.set(px + side * 0.55, 0.98, 0.45);
    group.add(cap);
  }

  // Heavy bulkhead lintel + upper bevel crown
  const lintel = new THREE.Mesh(sized.lintelGeo, props.exitFrameMat);
  lintel.position.set(0, h, 0);
  lintel.castShadow = true;
  group.add(lintel);

  const upperBeam = new THREE.Mesh(sized.upperBeamGeo, props.exitTrimSteelMat);
  upperBeam.position.set(0, h + 0.24, 0);
  group.add(upperBeam);

  // Glowing exit portal veil + recessed threshold sill
  const threshold = new THREE.Mesh(sized.thresholdGeo, props.exitTrimSteelMat);
  threshold.position.set(0, 0.05, 0);
  group.add(threshold);

  const portal = new THREE.Mesh(sized.portalGeo, props.exitGlowMat);
  portal.position.set(0, h * 0.5, 0);
  group.add(portal);

  // Overhead exit beacon bar + stainless housing
  const signHousing = new THREE.Mesh(props.exitSignHousingGeo, props.exitFrameMat);
  signHousing.position.set(0, h + 0.52, 0);
  group.add(signHousing);

  const sign = new THREE.Mesh(props.exitSignGeo, props.exitGlowMat);
  sign.position.set(0, h + 0.52, 0);
  group.add(sign);

  return group;
}
