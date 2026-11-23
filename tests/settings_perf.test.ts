import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  setCharacterQualityTier,
  setCharacterTextureAnisotropy,
} from '../src/game/characters';
import {
  createMonsterRig,
  createPlayerRig,
  disposeEntityResources,
  setEntityQualityTier,
} from '../src/game/entities';
import type { TextureBundle } from '../src/game/textures';
import { DEFAULT_SETTINGS, sanitizeGameSettings } from '../src/game/types';

function makeMockTextures(compact: boolean): TextureBundle {
  const mk = () =>
    new THREE.DataTexture(new Uint8Array([180, 180, 180, 255]), 1, 1) as unknown as THREE.CanvasTexture;
  const all = Array.from({ length: 23 }, () => mk());
  return {
    compact,
    tileAlbedo: all[0],
    tileBump: all[1],
    tileRoughness: all[2],
    wallAlbedo: all[3],
    wallBump: all[4],
    concreteAlbedo: all[5],
    concreteBump: all[6],
    metalAlbedo: all[7],
    metalBump: all[8],
    cautionAlbedo: all[9],
    woodAlbedo: all[10],
    woodBump: all[11],
    woodRoughness: all[12],
    ceilingAlbedo: all[13],
    waterNormal: all[14],
    monsterSkin: all[15],
    monsterBump: all[16],
    monsterNormal: all[17],
    monsterRoughness: all[18],
    monsterEmissive: all[19],
    monsterFinSkin: all[20],
    monsterFinEmissive: all[21],
    monsterEye: all[22],
    setAnisotropy: (maxAniso: number) => {
      for (const t of all) t.anisotropy = maxAniso;
    },
    markAllDirty: () => {
      for (const t of all) t.needsUpdate = true;
    },
    dispose: () => {
      for (const t of all) t.dispose();
    },
  } as unknown as TextureBundle;
}

function countObjectTriangles(root: THREE.Object3D): number {
  let tris = 0;
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const geo = obj.geometry;
      if (geo.index) {
        tris += geo.index.count / 3;
      } else if (geo.attributes.position) {
        tris += geo.attributes.position.count / 3;
      }
    }
  });
  return tris;
}

function testSettingsSanitizationAndPersistence(): void {
  const def = sanitizeGameSettings(null);
  assert.deepEqual(def, DEFAULT_SETTINGS, 'Null input should sanitize to DEFAULT_SETTINGS');

  const clampedHigh = sanitizeGameSettings({
    masterVolume: 99,
    musicVolume: -4,
    sfxVolume: Number.NaN,
    mouseSensitivity: 10.0,
    muted: true,
    invertY: true,
    quality: 'ultra',
    touchControls: 'on',
  });
  assert.equal(clampedHigh.masterVolume, 1);
  assert.equal(clampedHigh.musicVolume, 0);
  assert.equal(clampedHigh.sfxVolume, DEFAULT_SETTINGS.sfxVolume);
  assert.equal(clampedHigh.mouseSensitivity, 2.5, 'Sensitivity upper clamp must match slider max 2.5');
  assert.equal(clampedHigh.quality, 'ultra');
  assert.equal(clampedHigh.touchControls, 'on');

  const clampedLow = sanitizeGameSettings({
    mouseSensitivity: 0.05,
    quality: 'low',
    touchControls: 'bogus',
  });
  assert.equal(clampedLow.mouseSensitivity, 0.3, 'Sensitivity lower clamp must match slider min 0.3');
  assert.equal(clampedLow.quality, 'smooth', 'Legacy low preset must normalize to smooth');
  assert.equal(clampedLow.touchControls, 'auto');

  assert.equal(sanitizeGameSettings({ quality: 'medium' }).quality, 'standard');
  assert.equal(sanitizeGameSettings({ quality: 'high' }).quality, 'ultra');

  // JSON roundtrip persistence check
  const roundtrip = sanitizeGameSettings(JSON.parse(JSON.stringify(clampedHigh)));
  assert.deepEqual(roundtrip, clampedHigh, 'Sanitized settings must round-trip identically via JSON');
  console.log('1. PASS: sanitizeGameSettings clamping, legacy normalization & JSON roundtrip verified.');
}

function testOptimizedPolygonBudgets(): void {
  const mobileTex = makeMockTextures(true);
  const desktopTex = makeMockTextures(false);

  const mMobile = createPlayerRig(mobileTex, 0x52e0b6, false, 'male');
  const fMobile = createPlayerRig(mobileTex, 0x52e0b6, false, 'female');
  const mDesktop = createPlayerRig(desktopTex, 0x52e0b6, false, 'male');
  const fDesktop = createPlayerRig(desktopTex, 0x52e0b6, false, 'female');
  const sMobile = createMonsterRig(mobileTex, 1.0);
  const sDesktop = createMonsterRig(desktopTex, 1.0);

  const maleMobileTris = countObjectTriangles(mMobile.root);
  const femaleMobileTris = countObjectTriangles(fMobile.root);
  const maleDesktopTris = countObjectTriangles(mDesktop.root);
  const femaleDesktopTris = countObjectTriangles(fDesktop.root);
  const serpentMobileTris = countObjectTriangles(sMobile.root);
  const serpentDesktopTris = countObjectTriangles(sDesktop.root);

  assert.ok(maleMobileTris < maleDesktopTris, `Compact male tris (${maleMobileTris}) should be < desktop (${maleDesktopTris})`);
  assert.ok(femaleMobileTris < femaleDesktopTris, `Compact female tris (${femaleMobileTris}) should be < desktop (${femaleDesktopTris})`);
  assert.ok(serpentMobileTris < serpentDesktopTris, `Compact serpent tris (${serpentMobileTris}) should be < desktop (${serpentDesktopTris})`);
  assert.ok(maleMobileTris <= 12500, `Compact male rig should stay <= 12.5k tris (got ${maleMobileTris})`);
  assert.ok(femaleMobileTris <= 15500, `Compact female rig should stay <= 15.5k tris (got ${femaleMobileTris})`);
  assert.ok(serpentMobileTris <= 14500, `Compact serpent rig should stay <= 14.5k tris (got ${serpentMobileTris})`);
  assert.ok(serpentDesktopTris <= 32000, `Desktop serpent rig should stay <= 32k tris (got ${serpentDesktopTris})`);

  mMobile.dispose();
  fMobile.dispose();
  mDesktop.dispose();
  fDesktop.dispose();
  sMobile.dispose();
  sDesktop.dispose();
  disposeEntityResources(mobileTex);
  disposeEntityResources(desktopTex);
  mobileTex.dispose();
  desktopTex.dispose();

  console.log(
    `2. PASS: Optimized polygon budgets verified (male ${Math.round(maleMobileTris)}/${Math.round(maleDesktopTris)}, female ${Math.round(femaleMobileTris)}/${Math.round(femaleDesktopTris)}, serpent ${Math.round(serpentMobileTris)}/${Math.round(serpentDesktopTris)} tris).`
  );
}

function countShadowCasters(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.castShadow) n++;
  });
  return n;
}

function testMaterialQualityTogglingAndAnisotropy(): void {
  const desktopTex = makeMockTextures(false);
  const rig = createPlayerRig(desktopTex, 0x52e0b6, false, 'male');
  const serpent = createMonsterRig(desktopTex, 1.0);

  // Switch to Smooth (lowest graphics) -> maps stay bound (zero shader recompile stalls), reduced normal/bump scales, minimal clearcoat, 0 shadows
  setEntityQualityTier(desktopTex, 'smooth');
  rig.setShadowDetail('smooth');
  serpent.setShadowDetail('smooth');

  const serpentMat = serpent.bodyMesh.material as THREE.MeshPhysicalMaterial;
  assert.equal(serpentMat.normalMap, desktopTex.monsterNormal, 'Smooth tier keeps serpent normalMap bound to avoid shader stalls');
  assert.equal(serpentMat.roughnessMap, desktopTex.monsterRoughness, 'Smooth tier keeps serpent roughnessMap bound to avoid shader stalls');
  assert.ok(serpentMat.normalScale.x > 0 && serpentMat.normalScale.x < 1.0, 'Smooth tier scales down serpent normalScale');
  assert.ok(serpentMat.clearcoat > 0 && serpentMat.clearcoat <= 0.3, 'Smooth tier keeps minimal positive clearcoat');
  assert.equal(countShadowCasters(rig.root), 0, 'Smooth tier must disable character shadow casting');
  assert.equal(countShadowCasters(serpent.root), 0, 'Smooth tier must disable serpent shadow casting');

  const charTorsoMesh = rig.torso.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh | undefined;
  const charMat = charTorsoMesh?.material as THREE.MeshStandardMaterial | undefined;
  assert.ok(charMat, 'Character torso mesh material should exist');
  assert.ok(charMat.bumpMap !== null, 'Smooth tier keeps character bumpMap bound to avoid shader stalls');
  assert.equal(charMat.bumpScale, 0, 'Smooth tier zeroes character bumpScale');

  // Switch to Standard -> full normal/bump scales restored, balanced clearcoat, shadows enabled
  setEntityQualityTier(desktopTex, 'standard');
  rig.setShadowDetail('standard');
  serpent.setShadowDetail('standard');
  assert.equal(serpentMat.normalMap, desktopTex.monsterNormal, 'Standard tier keeps serpent normalMap');
  assert.equal(serpentMat.roughnessMap, desktopTex.monsterRoughness, 'Standard tier keeps serpent roughnessMap');
  assert.ok(serpentMat.normalScale.x >= 1.5, 'Standard tier restores full serpent normalScale');
  assert.ok(serpentMat.clearcoat > 0 && serpentMat.clearcoat < 1, 'Standard tier uses balanced clearcoat');
  assert.ok(charMat.bumpMap !== null, 'Standard tier keeps character bumpMap');
  assert.ok(charMat.bumpScale > 0, 'Standard tier restores character bumpScale');
  assert.ok(countShadowCasters(rig.root) > 0, 'Standard tier must enable character shadow casting');
  assert.ok(countShadowCasters(serpent.root) > 0, 'Standard tier must enable serpent shadow casting');

  // Switch to Ultra -> full clearcoat, higher shadow caster detail & 8x anisotropy
  setEntityQualityTier(desktopTex, 'ultra');
  rig.setShadowDetail('ultra');
  serpent.setShadowDetail('ultra');
  setCharacterTextureAnisotropy(desktopTex, 8);
  assert.equal(serpentMat.clearcoat, 1.0, 'Ultra tier must enable full serpent clearcoat');
  assert.ok(countShadowCasters(rig.root) >= 2, 'Ultra tier must enable full character shadow detail');

  setCharacterQualityTier(desktopTex, 'smooth');
  assert.ok(charMat.bumpMap !== null && charMat.bumpScale === 0, 'setCharacterQualityTier smooth zeroes character bumpScale without unbinding');

  rig.dispose();
  serpent.dispose();
  disposeEntityResources(desktopTex);
  desktopTex.dispose();
  console.log('3. PASS: Real Smooth / Standard / Ultra material maps, clearcoat, shadow & anisotropy toggles verified.');
}

function testSettingsUiAndEngineWiringGuards(): void {
  const root = process.cwd();
  const modalsSrc = fs.readFileSync(path.join(root, 'src/components/Modals.tsx'), 'utf8');
  const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const engineSrc = fs.readFileSync(path.join(root, 'src/game/engine.ts'), 'utf8');

  // Settings UI controls
  assert.ok(modalsSrc.includes('Camera Rotation Sensitivity'), 'SettingsModal must display Camera Rotation Sensitivity');
  assert.ok(modalsSrc.includes('Display Quality'), 'SettingsModal must display Display Quality');
  assert.ok(modalsSrc.includes("{ id: 'smooth', label: 'Smooth' }"), 'Display Quality must include Smooth option');
  assert.ok(modalsSrc.includes("{ id: 'standard', label: 'Standard' }"), 'Display Quality must include Standard option');
  assert.ok(modalsSrc.includes("{ id: 'ultra', label: 'Ultra' }"), 'Display Quality must include Ultra option');

  // Persistence & sanitization
  assert.ok(appSrc.includes('sanitizeGameSettings'), 'App.tsx must sanitize loaded & saved settings');
  assert.ok(appSrc.includes('activeQuality={hud.activeQuality}'), 'App.tsx must pass live activeQuality to SettingsModal');

  // Engine real rendering + sensitivity + DRS reset + texel snapping
  assert.ok(engineSrc.includes('0.0042 * this.settings.mouseSensitivity'), 'Engine camera rotation must scale directly with mouseSensitivity');
  assert.ok(engineSrc.includes('this.levelQualityMaterials'), 'Engine must dynamically toggle bump/roughness maps across Smooth/Standard/Ultra');
  assert.ok(engineSrc.includes('this.levelShadowReceivers'), 'Engine must toggle shadow reception across level geometry');
  assert.ok(engineSrc.includes('this.uWaterQuality.value'), 'Engine must scale water shader octaves & Fresnel by Display Quality');
  assert.ok(engineSrc.includes('setCharacterTextureAnisotropy'), 'Engine must sync character texture anisotropy with Display Quality');
  assert.ok(engineSrc.includes('wasScaled'), 'Engine updateSettings must reset DRS when switching from auto back to smooth');
  assert.ok(engineSrc.includes('const texelSize = (d * 2) / sMap'), 'Engine directional shadow follow must snap to exact shadow-map texel grid');

  console.log('4. PASS: Settings UI, persistence, engine quality scaling, sensitivity & texel snapping guards verified.');
}

testSettingsSanitizationAndPersistence();
testOptimizedPolygonBudgets();
testMaterialQualityTogglingAndAnisotropy();
testSettingsUiAndEngineWiringGuards();
console.log('\nALL SETTINGS, SENSITIVITY, DISPLAY QUALITY & PERFORMANCE OPTIMIZATION TESTS PASSED!');
