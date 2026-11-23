import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  animateMonsterRig,
  animatePlayerRig,
  attachPreyToSerpentMouth,
  createMonsterRig,
  createPlayerRig,
  disposeEntityResources,
  resetPlayerRigPose,
  setEntityQualityTier,
  type PlayerAnimState,
} from '../src/game/entities.ts';
import { PoolGameEngine } from '../src/game/engine.ts';
import { getLevelById, LEVELS } from '../src/game/levels.ts';
import { LevelSpatialGrid } from '../src/game/spatialGrid.ts';
import type { TextureBundle } from '../src/game/textures.ts';

function createMockTextures(): TextureBundle {
  const mkTex = () => {
    const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    t.needsUpdate = true;
    return t as unknown as THREE.CanvasTexture;
  };
  return {
    tileAlbedo: mkTex(),
    tileBump: mkTex(),
    tileRoughness: mkTex(),
    wallAlbedo: mkTex(),
    wallBump: mkTex(),
    ceilingAlbedo: mkTex(),
    concreteAlbedo: mkTex(),
    concreteBump: mkTex(),
    metalAlbedo: mkTex(),
    metalBump: mkTex(),
    woodAlbedo: mkTex(),
    woodBump: mkTex(),
    woodRoughness: mkTex(),
    cautionAlbedo: mkTex(),
    waterNormal: mkTex(),
    monsterSkin: mkTex(),
    monsterBump: mkTex(),
    monsterNormal: mkTex(),
    monsterRoughness: mkTex(),
    monsterEmissive: mkTex(),
    monsterFinSkin: mkTex(),
    monsterFinEmissive: mkTex(),
    monsterEye: mkTex(),
    setAnisotropy: () => {},
    dispose: () => {},
  };
}

function createMinimalEngineHarness(levelId: number, textures: TextureBundle) {
  const def = getLevelById(levelId);
  const eng = Object.create(PoolGameEngine.prototype) as any;
  eng.disposed = false;
  eng.phase = 'playing';
  eng.isSoftwareGl = false;
  eng.isTouchDevice = false;
  eng.activeQuality = 'smooth';
  eng.activeRenderDist = 88;
  eng.currentLevel = def;
  eng.spatialGrid = new LevelSpatialGrid(def, 12);
  eng.scene = new THREE.Scene();
  eng.camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 145);
  eng.textures = textures;
  eng.sound = {
    unlock: () => {},
    playCheckpoint: () => {},
    playEatingStrike: () => {},
    playSwallowGulp: () => {},
    playCharacterEatingScream: () => {},
    playSnakeSwallowingAudio: () => {},
    playSnakeFinalGulpAudio: () => {},
    updateEatingScreamPosition: () => {},
    updateSnakeEatingAudioPosition: () => {},
    updateSnakeSwimmingAudio: () => {},
    pruneSnakeSwimmingAudio: () => {},
    stopSnakeSwimmingAudio: () => {},
    stopAttackEatingAudio: () => {},
    stopEatingScreams: () => {},
    playJumpscare: () => {},
    playSerpentEmerge: () => {},
    playVictory: () => {},
    updateAtmosphere: () => {},
    playJump: () => {},
    playLand: () => {},
    playSplash: () => {},
    playStep: () => {},
    playPlatformWarn: () => {},
    updateAudio: () => {},
  };
  eng.callbacks = {
    onHudUpdate: () => {},
    onPhaseChange: () => {},
  };
  eng.playerRig = createPlayerRig(textures);
  eng.scene.add(eng.playerRig.root);
  eng.playerPos = new THREE.Vector3(def.spawn[0], def.spawn[1], def.spawn[2]);
  eng.playerVel = new THREE.Vector3();
  eng.playerYaw = Math.PI;
  eng.activeSpawn = new THREE.Vector3(def.spawn[0], def.spawn[1], def.spawn[2]);
  eng.camYaw = 0;
  eng.camPitch = 0.25;
  eng.camShake = 0;
  eng.inWater = false;
  eng.wasInWater = false;
  eng.waterJumpTimer = 0;
  eng.waterJumpCooldown = 0;
  eng.coyoteTimer = 0;
  eng.jumpBufferTimer = 0;
  eng.stamina = 100;
  eng.exhausted = false;
  eng.grounded = false;
  eng.stoodPlatform = null;
  eng.monsters = [];
  eng.staticChunks = [];
  eng.dynamicPlatforms = [];
  eng.checkpoints = [];
  eng.splashPool = [];
  eng.splashMaxActive = 0;
  eng.spawnSplash = () => {};
  eng.swimSplashTimer = 0;
  eng.stepTimer = 0;
  eng.lastJumpInputAt = 0;
  eng.isWatchedFreezeActive = false;
  eng.watchFreezeGraceTimer = 0;
  eng.watchAnchorX = 0;
  eng.watchAnchorZ = 0;
  eng.watchMoveAttempted = false;
  eng.playerInWaterSession = false;
  eng.playerWaterEpoch = 0;
  eng.pendingClimbIntimidation = false;
  eng.heldKeys = new Set();
  eng.virtualMove = { x: 0, y: 0 };
  eng.virtualRun = false;
  eng.virtualAutoRun = false;
  eng.ensureLocalPlayerVisible = () => {};
  eng.lastHudSnap = {
    levelId: -1,
    timeRemaining: -1,
    timeElapsed: -1,
    stamina: -1,
    inWater: false,
    underwater: false,
    waterJumpCooldown: -1,
    monsterDist: -1,
    monsterAlert: '',
    checkpointIndex: -1,
    totalCheckpoints: -1,
    checkpointNotice: null,
    activeQuality: '',
    fps: -1,
    isPointerLocked: false,
    deathReason: null,
  };

  eng.walls = def.walls.map((w) => ({
    centerX: w.position[0],
    centerZ: w.position[2],
    boundRadiusXZ: Math.hypot(w.size[0] * 0.5, w.size[2] * 0.5),
    minX: w.position[0] - w.size[0] * 0.5,
    maxX: w.position[0] + w.size[0] * 0.5,
    minY: w.position[1] - w.size[1] * 0.5,
    maxY: w.position[1] + w.size[1] * 0.5,
    minZ: w.position[2] - w.size[2] * 0.5,
    maxZ: w.position[2] + w.size[2] * 0.5,
  }));

  eng.platforms = def.platforms.map((p) => {
    const q = new THREE.Quaternion();
    if (p.rotationSpeed) {
      const euler = new THREE.Euler(0, p.rotationPhase ?? 0.6, 0, 'YXZ');
      q.setFromEuler(euler);
    }
    return {
      def: p,
      mesh: new THREE.Object3D(),
      material: new THREE.MeshStandardMaterial(),
      baseColorHex: 0xb9c7ca,
      boundRadiusXZ: Math.hypot(p.size[0] * 0.5, p.size[2] * 0.5),
      currentPos: new THREE.Vector3(p.position[0], p.position[1], p.position[2]),
      prevPos: new THREE.Vector3(p.position[0], p.position[1], p.position[2]),
      currentQuat: q.clone(),
      prevQuat: q.clone(),
      invQuat: q.clone().invert(),
      prevInvQuat: q.clone().invert(),
      isRotated: Boolean(p.rotationSpeed),
      state: 'solid',
      stateTimer: 0,
    };
  });

  return eng;
}

function computeSignedVolume(geo: THREE.BufferGeometry): number {
  const pos = geo.attributes.position;
  const idx = geo.getIndex();
  if (!pos || !idx) return 0;
  const arr = idx.array;
  let vol6 = 0;
  for (let i = 0; i < arr.length; i += 3) {
    const i0 = arr[i];
    const i1 = arr[i + 1];
    const i2 = arr[i + 2];
    const x0 = pos.getX(i0), y0 = pos.getY(i0), z0 = pos.getZ(i0);
    const x1 = pos.getX(i1), y1 = pos.getY(i1), z1 = pos.getZ(i1);
    const x2 = pos.getX(i2), y2 = pos.getY(i2), z2 = pos.getZ(i2);
    vol6 += x0 * (y1 * z2 - z1 * y2) + y0 * (z1 * x2 - x1 * z2) + z0 * (x1 * y2 - y1 * x2);
  }
  return vol6 / 6;
}

function testPlayerRigFrustumAndAnimations(textures: TextureBundle): void {
  for (const charId of ['male', 'female'] as const) {
    for (const isRemote of [false, true]) {
      const rig = createPlayerRig(textures, 0xc99c38, isRemote, charId);
      assert.equal(rig.characterId, charId);
      rig.root.updateMatrixWorld(true);

      let meshCount = 0;
      const seenGeos = new Set<THREE.BufferGeometry>();
      rig.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          meshCount++;
          assert.equal(mesh.frustumCulled, false, `PlayerRig mesh must have frustumCulled=false (char=${charId}, remote=${isRemote})`);
          assert.equal(mesh.visible, true);
          assert.ok(mesh.matrixWorld.determinant() > 0, `PlayerRig mesh must have positive determinant (no negative scale flip) for ${charId}`);

          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            assert.equal(mat.transparent, false, `Character mesh material should be opaque (solid) for ${charId}`);
          }

          if (!seenGeos.has(mesh.geometry)) {
            seenGeos.add(mesh.geometry);
            if (mesh.geometry.getIndex()) {
              const sv = computeSignedVolume(mesh.geometry);
              assert.ok(sv >= -1e-9, `Character mesh geometry signed volume must be non-negative (outward winding) for ${charId}, got ${sv}`);
            }
          }
        }
      });
      assert.ok(meshCount >= 35, `Expected full player rig mesh hierarchy for ${charId}, found ${meshCount}`);

      // Full-body bounding box height & grounded boot soles check
      const box = new THREE.Box3().setFromObject(rig.root);
      const height = box.max.y - box.min.y;
      assert.ok(Math.abs(box.min.y) < 0.02, `Expected soles near y=0 for ${charId}, got min.y=${box.min.y.toFixed(4)}`);
      assert.ok(height >= 1.78 && height <= 1.9, `Expected realistic human height ~1.82m for ${charId}, got ${height.toFixed(3)}`);

      const states: PlayerAnimState[] = ['idle', 'walk', 'run', 'jump', 'fall', 'swim'];
      for (const st of states) {
        for (let step = 0; step < 6; step++) {
          if (step === 2) rig.pushAnimTimer = 0.3;
          if (step === 4) rig.pushedAnimTimer = 0.4;
          animatePlayerRig(rig, st, st === 'run' ? 8.8 : st === 'swim' && step >= 3 ? 0 : 5.5, step * 0.12, 0.016);
          assert.ok(Number.isFinite(rig.hips.position.y), `hips.y finite in ${st}`);
          assert.ok(Number.isFinite(rig.hips.rotation.x), `hips.rx finite in ${st}`);
          assert.ok(Number.isFinite(rig.torso.rotation.x), `torso.x finite in ${st}`);
          assert.ok(Number.isFinite(rig.leftFoot.rotation.x), `leftFoot.x finite in ${st}`);
          assert.equal(rig.hips.visible, true, `hips stays visible in ${st}`);
        }
      }

      // Verify landing absorption triggers naturally on fall -> idle transition
      animatePlayerRig(rig, 'fall', 4.5, 0.2, 0.05);
      animatePlayerRig(rig, 'fall', 4.5, 0.25, 0.08);
      animatePlayerRig(rig, 'idle', 0, 0.3, 0.016);
      assert.ok(rig.landTimer > 0, `Landing absorption timer must trigger on fall->idle for ${charId}`);

      // Verify multi-stage human death collapse animation stays finite and grounded
      for (const dp of [0.0, 0.25, 0.55, 0.85, 1.0]) {
        animatePlayerRig(rig, 'idle', 0, dp * 1.4, 0.03, dp);
        rig.root.updateMatrixWorld(true);
        assert.ok(Number.isFinite(rig.hips.position.y) && rig.hips.position.y > 0, `Death pose finite at p=${dp}`);
        assert.ok(Math.abs(rig.hips.rotation.x) < 2.2, `Death pose tilt within physical bounds at p=${dp}`);
      }

      // Reset to upright idle pose and verify outward front-face normals from all 6 angles
      // as well as facial features (eyes, nose, lips) visibility from front camera rays
      rig.pushAnimTimer = 0;
      rig.pushedAnimTimer = 0;
      rig.prevAnimState = 'idle';
      rig.airTime = 0;
      rig.jumpTime = 0;
      rig.landTimer = 0;
      rig.deathTimer = 0;
      rig.hips.position.set(0, 0.92, 0);
      rig.hips.rotation.set(0, 0, 0);
      rig.torso.rotation.set(0, 0, 0);
      rig.headGroup.rotation.set(0, 0, 0);
      rig.leftArm.rotation.set(0, 0, -0.125);
      rig.rightArm.rotation.set(0, 0, 0.125);
      rig.leftForearm.rotation.set(0, 0, 0);
      rig.rightForearm.rotation.set(0, 0, 0);
      rig.leftHand.rotation.set(0, 0, 0);
      rig.rightHand.rotation.set(0, 0, 0);
      rig.leftLeg.rotation.set(0, 0, 0);
      rig.rightLeg.rotation.set(0, 0, 0);
      rig.leftShin.rotation.set(0, 0, 0);
      rig.rightShin.rotation.set(0, 0, 0);
      rig.leftFoot.rotation.set(0, 0, 0);
      rig.rightFoot.rotation.set(0, 0, 0);
      rig.hairPitch = 0;
      rig.hairPitchVel = 0;
      rig.hairRoll = 0;
      rig.hairRollVel = 0;
      for (const hn of rig.hairNodes) {
        hn.group.rotation.set(hn.restPitch, hn.restYaw, hn.restRoll);
      }
      rig.root.updateMatrixWorld(true);

      const allMeshes: THREE.Mesh[] = [];
      rig.hips.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) allMeshes.push(obj as THREE.Mesh);
      });

      const rc = new THREE.Raycaster();
      const angleProbes: Array<{ origin: THREE.Vector3; target: THREE.Vector3; label: string }> = [
        { origin: new THREE.Vector3(0, 1.35, 3.0), target: new THREE.Vector3(0, 1.35, 0), label: 'front chest' },
        { origin: new THREE.Vector3(0, 1.35, -3.0), target: new THREE.Vector3(0, 1.35, 0), label: 'back torso' },
        { origin: new THREE.Vector3(3.0, 1.25, 0), target: new THREE.Vector3(0, 1.25, 0), label: 'right shoulder/arm' },
        { origin: new THREE.Vector3(-3.0, 1.25, 0), target: new THREE.Vector3(0, 1.25, 0), label: 'left shoulder/arm' },
        { origin: new THREE.Vector3(0, 3.5, 0.02), target: new THREE.Vector3(0, 1.6, 0.02), label: 'top hair crown' },
        { origin: new THREE.Vector3(0.104, 0.45, 2.5), target: new THREE.Vector3(0.104, 0.45, 0), label: 'front leg' },
        { origin: new THREE.Vector3(0.104, 0.05, 2.5), target: new THREE.Vector3(0.104, 0.05, 0.05), label: 'front boot' },
        { origin: new THREE.Vector3(0, 1.71, 2.0), target: new THREE.Vector3(0, 1.71, 0), label: 'front face' },
      ];

      const normalMat = new THREE.Matrix3();
      for (const probe of angleProbes) {
        const dir = probe.target.clone().sub(probe.origin).normalize();
        rc.set(probe.origin, dir);
        const hits = rc.intersectObjects(allMeshes, false);
        assert.ok(hits.length > 0, `Expected solid hit for ${charId} probe "${probe.label}"`);
        const first = hits[0];
        assert.ok(first.face, `Expected hit face normal for ${charId} probe "${probe.label}"`);
        normalMat.getNormalMatrix(first.object.matrixWorld);
        const worldNormal = first.face!.normal.clone().applyMatrix3(normalMat).normalize();
        assert.ok(
          worldNormal.dot(dir) < 0,
          `First hit surface for ${charId} "${probe.label}" must face outward toward camera (dot=${worldNormal.dot(dir).toFixed(3)})`
        );
      }

      // Verify eyes, nose tip, and lips sit cleanly unburied on the front face
      const headBox = new THREE.Box3();
      rig.headGroup.updateMatrixWorld(true);
      let hitEyeOrLid = false;
      const eyeOrigin = new THREE.Vector3(0.0305, 1.704, 1.5);
      rc.set(eyeOrigin, new THREE.Vector3(0, 0, -1));
      const eyeHits = rc.intersectObjects(allMeshes, false);
      assert.ok(eyeHits.length > 0, `Expected front eye socket ray hit for ${charId}`);
      if (eyeHits[0].point.z > 0.085) hitEyeOrLid = true;
      assert.ok(hitEyeOrLid, `Eye socket must sit forward & visible on face for ${charId}`);

      const lipOrigin = new THREE.Vector3(0, 1.655, 1.5);
      rc.set(lipOrigin, new THREE.Vector3(0, 0, -1));
      const lipHits = rc.intersectObjects(allMeshes, false);
      assert.ok(lipHits.length > 0, `Expected front lip ray hit for ${charId}`);
      // First hit must be lipMat (not buried inside faceMat skull!)
      const lipHitMat = (lipHits[0].object as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
      assert.ok(!lipHitMat.map, `Upper lip front ray must strike unburied lip mesh (not skin head) for ${charId}`);

      headBox.setFromObject(rig.headGroup);
      assert.ok(headBox.max.y >= 1.80, `Head & hair top must reach full standing height for ${charId}, got ${headBox.max.y.toFixed(3)}`);

      if (charId === 'female') {
        assert.ok(rig.hairNodes.length >= 6, 'Expected multi-tier flowing hair node hierarchy for female');
        const hairBox = new THREE.Box3();
        for (const hn of rig.hairNodes) {
          hairBox.expandByObject(hn.group);
        }
        assert.ok(
          hairBox.min.y <= 1.15,
          `Female long hair must extend down her back near waist level, got min.y=${hairBox.min.y.toFixed(3)}`
        );
        assert.ok(
          hairBox.min.z <= -0.135,
          `Female long back hair must drape behind shoulder blades, got min.z=${hairBox.min.z.toFixed(3)}`
        );

        // Verify natural trailing wave movement during run, jump, fall, and swim
        for (const moveState of ['run', 'jump', 'fall', 'swim'] as const) {
          for (let s = 0; s < 14; s++) {
            animatePlayerRig(rig, moveState, moveState === 'run' ? 8.8 : 4.2, s * 0.04, 0.016);
          }
          const backRoot = rig.hairNodes[4];
          const backMid = rig.hairNodes[5];
          const backTip = rig.hairNodes[6];
          assert.ok(
            backRoot.group.rotation.x > backRoot.restPitch + 0.05,
            `Female upper back hair must trail backward during ${moveState}, got rot.x=${backRoot.group.rotation.x.toFixed(3)}`
          );
          assert.ok(
            backMid.group.rotation.x > backMid.restPitch + 0.04 &&
              backTip.group.rotation.x > backTip.restPitch + 0.03,
            `Female mid & lower hair cascade must trail smoothly during ${moveState}`
          );
        }
      }

      // Verify arms abduct outward (left < 0, right > 0) and hands remain clearly separated from pelvis/torso across locomotion states
      const solidBody: THREE.Mesh[] = [];
      for (const g of [rig.hips, rig.torso, rig.headGroup, rig.leftLeg, rig.leftShin, rig.rightLeg, rig.rightShin]) {
        for (const c of g.children) {
          if ((c as THREE.Mesh).isMesh && !((c as THREE.Mesh).geometry instanceof THREE.CircleGeometry)) {
            const clone = new THREE.Mesh((c as THREE.Mesh).geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
            clone.matrixWorld.copy(c.matrixWorld);
            solidBody.push(clone);
          }
        }
      }
      const rayDirs = [new THREE.Vector3(1, 0.37, 0.21).normalize(), new THREE.Vector3(-0.31, 0.41, -0.85).normalize()];
      const handProbe = new THREE.Vector3();
      for (const checkState of ['idle', 'walk', 'run', 'jump', 'fall', 'swim'] as const) {
        for (let s = 0; s < 24; s++) {
          animatePlayerRig(rig, checkState, checkState === 'run' ? 8.8 : checkState === 'swim' && s >= 12 ? 0 : 4.8, s * 0.03, 0.03);
        }
        rig.root.updateMatrixWorld(true);
        for (let idx = 0; idx < solidBody.length; idx++) {
          // sync clone world matrices with updated rig
          let cursor = 0;
          for (const g of [rig.hips, rig.torso, rig.headGroup, rig.leftLeg, rig.leftShin, rig.rightLeg, rig.rightShin]) {
            for (const c of g.children) {
              if ((c as THREE.Mesh).isMesh && !((c as THREE.Mesh).geometry instanceof THREE.CircleGeometry)) {
                if (cursor === idx) solidBody[idx].matrixWorld.copy(c.matrixWorld);
                cursor++;
              }
            }
          }
        }
        assert.ok(rig.leftArm.rotation.z < 0, `${charId} leftArm.z must stay negative (outward) in ${checkState}, got ${rig.leftArm.rotation.z.toFixed(3)}`);
        assert.ok(rig.rightArm.rotation.z > 0, `${charId} rightArm.z must stay positive (outward) in ${checkState}, got ${rig.rightArm.rotation.z.toFixed(3)}`);
        for (const [label, handGroup] of [['leftHand', rig.leftHand], ['rightHand', rig.rightHand]] as const) {
          const handMesh = handGroup.children[0] as THREE.Mesh;
          const posAttr = handMesh.geometry.attributes.position;
          const step = Math.max(1, Math.floor(posAttr.count / 120));
          for (let vi = 0; vi < posAttr.count; vi += step) {
            handProbe.fromBufferAttribute(posAttr, vi).applyMatrix4(handMesh.matrixWorld);
            let votes = 0;
            for (const d of rayDirs) {
              rc.set(handProbe, d);
              if (rc.intersectObjects(solidBody, false).length % 2 === 1) votes++;
            }
            assert.equal(votes === 2, false, `${charId} ${label} must not clip inside body during ${checkState}`);
          }
        }
      }
      for (const s of solidBody) (s.material as THREE.Material).dispose();

      rig.dispose();
    }
  }
}

function testSerpentEyesAndTeethVisibility(textures: TextureBundle): void {
  const m = createMonsterRig(textures, 1.0);
  const headMeshes: THREE.Mesh[] = [];
  m.headAssembly.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      headMeshes.push(obj as THREE.Mesh);
      assert.equal(obj.frustumCulled, false, 'All monster head/eye/jaw/teeth meshes must disable frustumCulled');
    }
  });
  assert.ok(headMeshes.length >= 10, 'Expected full serpent head mesh hierarchy');

  let upperSkull!: THREE.Mesh;
  let palate!: THREE.Mesh;
  let upperTeeth!: THREE.Mesh;
  let lowerJaw!: THREE.Mesh;
  let sublingual!: THREE.Mesh;
  let lowerTeeth!: THREE.Mesh;
  let leftEyeball!: THREE.Mesh;
  let rightEyeball!: THREE.Mesh;

  m.headGroup.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox!;
    if (o.parent === m.headGroup && o.geometry.attributes.color) upperTeeth = o;
    else if (o.parent === m.jaw && o.geometry.attributes.color) lowerTeeth = o;
    else if (o.parent === m.headGroup && o.geometry.attributes.tangent) upperSkull = o;
    else if (o.parent === m.jaw && o.geometry.attributes.tangent) lowerJaw = o;
    else if (o.parent === m.leftEye && (o.material as THREE.MeshPhysicalMaterial).map) leftEyeball = o;
    else if (o.parent === m.rightEye && (o.material as THREE.MeshPhysicalMaterial).map) rightEyeball = o;
    else if (o.parent === m.headGroup && bb.max.z > 1.0 && (o.material as THREE.MeshPhysicalMaterial).color.getHex() === 0x4b0d14) palate = o;
    else if (o.parent === m.jaw && (o.material as THREE.MeshPhysicalMaterial).color.getHex() === 0x4b0d14) sublingual = o;
  });

  assert.ok(upperSkull && palate && upperTeeth && lowerJaw && sublingual && lowerTeeth && leftEyeball && rightEyeball);

  // Verify glowing red eyes, dark obsidian-crimson chitin, subtle accent emissive maps, and irregular teeth
  const eyeMat = leftEyeball.material as THREE.MeshPhysicalMaterial;
  assert.equal(eyeMat.emissive.getHex(), 0xff2020, 'Serpent eyes must glow menacing crimson-red');
  assert.ok(eyeMat.emissiveIntensity >= 1.2, 'Serpent eye red emissive intensity must be intense');
  const skinMat = upperSkull.material as THREE.MeshPhysicalMaterial;
  assert.ok(skinMat.emissiveMap === textures.monsterEmissive, 'Serpent skin uses subtle electric-blue accent emissiveMap');
  assert.ok(skinMat.emissiveIntensity > 0 && skinMat.emissiveIntensity <= 1.25, 'Electric-blue accent glow stays crisp and controlled');
  const mouthMat = palate.material as THREE.MeshPhysicalMaterial;
  assert.ok(mouthMat.emissive.getHex() === 0xff101f && mouthMat.emissiveIntensity >= 1.5, 'Serpent inner maw glows menacing crimson-red');
  const finMat = m.finMesh.material as THREE.MeshPhysicalMaterial;
  assert.ok(finMat.map === textures.monsterFinSkin && finMat.emissiveMap === textures.monsterFinEmissive);
  assert.ok(m.jaw.children.length >= 4, 'Lower mandible includes jaw mesh, lower whisker-spines, sublingual throat, teeth, and tongue');
  assert.ok(upperTeeth.geometry.attributes.position.count >= 28 * 121, 'Expected enhanced irregular upper dentition');
  assert.ok(lowerTeeth.geometry.attributes.position.count >= 18 * 121, 'Expected enhanced irregular lower dentition');
  assert.ok(m.bodyMesh.geometry.attributes.tangent && m.finMesh.geometry.attributes.normal);

  // 1. Quality tier clearcoat consistency check (never drops to 0 on smooth)
  setEntityQualityTier(textures, 'ultra');
  setEntityQualityTier(textures, 'smooth');
  assert.ok((upperSkull.material as THREE.MeshPhysicalMaterial).clearcoat > 0, 'skinMat keeps positive clearcoat on smooth');
  assert.ok((upperTeeth.material as THREE.MeshPhysicalMaterial).clearcoat > 0, 'toothMat keeps positive clearcoat on smooth');
  setEntityQualityTier(textures, 'standard');

  // 2. Eye raycast visibility across full lookYaw sweep and multi-angle viewpoints
  const rc = new THREE.Raycaster();
  const irisPts = [
    new THREE.Vector3(0, 0, 0.145),
    new THREE.Vector3(0.06, 0, 0.132),
    new THREE.Vector3(-0.06, 0, 0.132),
    new THREE.Vector3(0, 0.06, 0.132),
    new THREE.Vector3(0, -0.06, 0.132),
  ];

  let eyeVis = 0;
  let eyeTot = 0;
  let facingEyeVis = 0;
  let facingEyeTot = 0;
  m.swimPhase = 1.5;
  for (const lookYaw of [-0.78, -0.35, 0, 0.35, 0.78]) {
    const playerTarget = new THREE.Vector3(Math.sin(lookYaw) * 10, 0.8, Math.cos(lookYaw) * 10);
    // Settle animation lerp quickly
    for (let s = 0; s < 12; s++) {
      animateMonsterRig(m, 'calm', playerTarget, new THREE.Vector3(0, -0.14, 0), 0, 0, s * 0.05, 0.05, 0.4);
    }
    m.root.updateMatrixWorld(true);

    for (const [eye, side] of [
      [rightEyeball, 1],
      [leftEyeball, -1],
    ] as const) {
      const center = new THREE.Vector3(0, 0, 0).applyMatrix4(eye.matrixWorld);
      const dirs = [
        { name: 'front', vec: new THREE.Vector3(0, 0.2, 1).normalize() },
        { name: '3/4', vec: new THREE.Vector3(side * 0.7, 0.15, 0.7).normalize() },
        { name: 'side', vec: new THREE.Vector3(side, 0.1, 0).normalize() },
        { name: 'top', vec: new THREE.Vector3(side * 0.5, 0.75, 0.4).normalize() },
      ];
      for (const dir of dirs) {
        const cam = center.clone().addScaledVector(dir.vec, 4.0);
        const isCrossSnout = dir.name === 'front' && lookYaw * side > 0.5;
        for (const lp of irisPts) {
          eyeTot++;
          if (!isCrossSnout) facingEyeTot++;
          const wp = lp.clone().applyMatrix4(eye.matrixWorld);
          const rayDir = wp.clone().sub(cam);
          const dist = rayDir.length();
          rc.set(cam, rayDir.normalize());
          const hits = rc.intersectObject(upperSkull, false);
          if (hits.length === 0 || hits[0].distance >= dist - 0.015) {
            eyeVis++;
            if (!isCrossSnout) facingEyeVis++;
          }
        }
      }
    }
  }
  assert.equal(facingEyeVis, facingEyeTot, `Expected 100% iris visibility on all facing/side/top angles, got ${facingEyeVis}/${facingEyeTot}`);
  assert.ok(eyeVis / eyeTot >= 0.98, `Expected >=98% total iris visibility across extreme head turns, got ${eyeVis}/${eyeTot}`);

  // 3. Teeth visibility across opening and closing mouth states
  const occluders = [upperSkull, palate, lowerJaw, sublingual];
  const uToothPos = upperTeeth.geometry.attributes.position;
  const lToothPos = lowerTeeth.geometry.attributes.position;
  const viewDirs = [
    new THREE.Vector3(0, 0.05, 1).normalize(),
    new THREE.Vector3(0.65, 0.18, 0.72).normalize(),
    new THREE.Vector3(0.92, 0.08, 0.35).normalize(),
  ];

  m.headGroup.rotation.set(0, 0, 0);

  // Open mouth: upper & lower teeth must both be strongly unoccluded (>= 80% upper lateral/fang/palatine, >= 95% lower)
  for (const jawRot of [0.55, 1.08]) {
    m.jaw.rotation.x = jawRot;
    m.root.updateMatrixWorld(true);
    let uVis = 0;
    let uTot = 0;
    let lVis = 0;
    let lTot = 0;
    for (const vd of viewDirs) {
      const cam = new THREE.Vector3(0, 0.2, 0.6).addScaledVector(vd, 4.5);
      for (let t = 0; t < 24; t++) {
        for (const vOff of [60, 115]) {
          const idx = t * 121 + vOff;
          const wp = new THREE.Vector3(uToothPos.getX(idx), uToothPos.getY(idx), uToothPos.getZ(idx)).applyMatrix4(
            upperTeeth.matrixWorld
          );
          if (vd.x > 0.5 && wp.x < -0.05) continue;
          uTot++;
          const d = wp.clone().sub(cam);
          const dist = d.length();
          rc.set(cam, d.normalize());
          const hits = rc.intersectObjects(occluders, false);
          if (hits.length === 0 || hits[0].distance >= dist - 0.015) uVis++;
        }
      }
      for (let t = 0; t < 16; t++) {
        for (const vOff of [60, 115]) {
          const idx = t * 121 + vOff;
          const wp = new THREE.Vector3(lToothPos.getX(idx), lToothPos.getY(idx), lToothPos.getZ(idx)).applyMatrix4(
            lowerTeeth.matrixWorld
          );
          if (vd.x > 0.5 && wp.x < -0.05) continue;
          lTot++;
          const d = wp.clone().sub(cam);
          const dist = d.length();
          rc.set(cam, d.normalize());
          const hits = rc.intersectObjects(occluders, false);
          if (hits.length === 0 || hits[0].distance >= dist - 0.015) lVis++;
        }
      }
    }
    assert.ok(uVis / uTot >= 0.8, `Open jaw (${jawRot}) upperTeeth visibility >= 80%, got ${uVis}/${uTot}`);
    assert.ok(lVis / lTot >= 0.95, `Open jaw (${jawRot}) lowerTeeth visibility >= 95%, got ${lVis}/${lTot}`);
  }

  // Closing mouth: upper fangs & lateral teeth remain visible cleanly below lip rim (was 27% before fix!)
  m.jaw.rotation.x = 0.06;
  m.root.updateMatrixWorld(true);
  let closedUpperVis = 0;
  let closedUpperTot = 0;
  for (const vd of viewDirs) {
    const cam = new THREE.Vector3(0, 0.2, 0.6).addScaledVector(vd, 4.5);
    // Test fangs (0..1) and lateral teeth (2..15)
    for (let t = 0; t < 16; t++) {
      const idx = t * 121 + 115; // tooth tips
      const wp = new THREE.Vector3(uToothPos.getX(idx), uToothPos.getY(idx), uToothPos.getZ(idx)).applyMatrix4(
        upperTeeth.matrixWorld
      );
      if (vd.x > 0.5 && wp.x < -0.05) continue;
      closedUpperTot++;
      const d = wp.clone().sub(cam);
      const dist = d.length();
      rc.set(cam, d.normalize());
      const hits = rc.intersectObjects(occluders, false);
      if (hits.length === 0 || hits[0].distance >= dist - 0.015) closedUpperVis++;
    }
  }
  assert.ok(
    closedUpperVis / closedUpperTot >= 0.75,
    `Closed jaw upper fang+lateral tips must remain clearly visible (>=75%), got ${closedUpperVis}/${closedUpperTot}`
  );

  // Full eating animation sequence keeps eyes and teeth meshes visible
  const prey = createPlayerRig(textures, '#52e0b6', false);
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    animateMonsterRig(m, 'chasing', new THREE.Vector3(0, 0.5, 2), new THREE.Vector3(0, -0.14, 0), 0, 0, 1 + i * 0.25, 0.05, 1, u);
    attachPreyToSerpentMouth(m, prey, u, 1 + i * 0.25, 0.05, new THREE.Vector3(0, 0.3, 1.5), 0);
    assert.equal(upperTeeth.visible, true);
    assert.equal(lowerTeeth.visible, true);
    assert.equal(leftEyeball.visible, true);
    assert.equal(rightEyeball.visible, true);
  }
  // 4. Arc-length preserving S-wave & non-twisting stability across sharp turns and steep surface emergence
  const headPos = new THREE.Vector3(0, -0.14, 0);
  const chasePlayer = new THREE.Vector3(4, 1.2, 6);
  for (let step = 0; step < 32; step++) {
    const yaw = Math.sin(step * 0.22) * 1.65;
    headPos.x += Math.sin(yaw) * 0.24;
    headPos.z += Math.cos(yaw) * 0.24;
    animateMonsterRig(m, 'chasing', chasePlayer, headPos, yaw, 0, step * 0.032, 0.032, step > 10 ? 1.0 : 0.2);
    for (let i = 1; i < m.segments.length; i++) {
      const a = m.segments[i - 1].bone.position;
      const b = m.segments[i].bone.position;
      const segDist = a.distanceTo(b);
      assert.ok(Number.isFinite(segDist) && segDist > 0.8 && segDist < 0.92, `Serpent bone ${i} spacing stretched/kinked: ${segDist.toFixed(4)}`);
      assert.ok(Number.isFinite(m.segments[i].bone.quaternion.w), `Serpent bone ${i} quaternion finite`);
    }
  }

  prey.dispose();
  m.dispose();
}

function testCameraOcclusionRespawnAndMultiplayerVisibility(textures: TextureBundle): void {
  const eng = createMinimalEngineHarness(50, textures);

  // 1. Platform camera occlusion: camera behind an elevated platform must pull in cleanly
  const plat = eng.platforms[1]; // elevated static/rotated deck
  eng.playerPos.set(plat.currentPos.x, plat.currentPos.y - plat.def.size[1] * 0.5 - 1.6, plat.currentPos.z - plat.def.size[2] * 0.5 - 1.2);
  eng.camYaw = Math.PI; // camera tries to swing toward -Z -> into/through platform? let's aim directly through platform!
  const targetY = eng.playerPos.y + 1.48;
  const occ = eng.computeCameraWallOcclusion(
    eng.playerPos.x,
    targetY,
    eng.playerPos.z,
    plat.currentPos.x,
    plat.currentPos.y,
    plat.currentPos.z + plat.def.size[2] * 0.5 + 2.5,
    0.35
  );
  assert.ok(occ < 1.0, `Expected platform occlusion ray hit (occ < 1), got ${occ}`);

  // 2. Near-wall / corner anti-clipping: player backed right against maxZ perimeter wall looking horizontal
  const b = eng.currentLevel.bounds;
  eng.playerPos.set(0, 0.8, b.maxZ - 0.55);
  eng.camYaw = 0;
  eng.camPitch = 0.0; // eye-level horizontal look
  const goalT = new THREE.Vector3();
  const goalC = new THREE.Vector3();
  eng.computePlayCameraGoals(goalT, goalC);
  const horizSep = Math.hypot(goalC.x - eng.playerPos.x, goalC.z - eng.playerPos.z);
  const vertClear = goalC.y > eng.playerPos.y + 1.98;
  assert.ok(
    horizSep >= 0.72 || vertClear,
    `Camera must never clip inside player head against back wall (horizSep=${horizSep.toFixed(3)}, vertClear=${vertClear})`
  );

  // 3. Respawn camera snap: moving spawn 250m away must snap camera immediately (not lerp from old Z!)
  eng.camera.position.set(0, 4, 12);
  eng.activeSpawn.set(0, 1.5, -240);
  eng.respawnAtActiveCheckpoint(false);
  assert.ok(
    Math.abs(eng.camera.position.z - eng.playerPos.z) < 12,
    `Respawn must snap camera near respawn checkpoint, got camZ=${eng.camera.position.z} vs playerZ=${eng.playerPos.z}`
  );
  assert.equal(eng.playerRig.hips.visible, true, 'Player rig must remain visible after respawn');
  assert.equal(eng.playerRig.root.scale.x, 1, 'Player rig scale must be 1 after respawn');

  eng.playerRig.dispose();
}

function testSerpentIntimidationWaterInterrupt(textures: TextureBundle): void {
  const setupEng = () => {
    const eng = createMinimalEngineHarness(1, textures);
    eng.simTime = 10;
    eng.renderFrameIdx = 1;
    eng.playerWaterEpoch = 0;
    eng.playerInWaterSession = false;
    eng.pendingClimbIntimidation = false;
    eng.syncAudioListener = () => {};
    eng.syncAllMonstersSwimmingAudio = () => {};
    eng.triggerDeath = (reason: string, monster: unknown) => {
      eng.deathReason = reason;
      eng.jumpscareMonster = monster;
      eng.phase = 'jumpscare';
    };
    eng.checkMonsterBlockedFn = (cx: number, cz: number, cr: number) =>
      eng.isCircleBlocked(cx, cz, cr, eng.currentLevel.bounds.waterY - 1.5, eng.currentLevel.bounds.waterY + 4.2, eng.platforms, eng.walls);
    return eng;
  };

  const makeSerpent = (x: number, z: number) => {
    const rig = createMonsterRig(textures, 1.0);
    return {
      id: 'm-intim',
      rig,
      pos: new THREE.Vector3(x, 0 - 0.14, z),
      yaw: 0,
      targetYaw: 0,
      targetUserId: null,
      waypoints: [[x, z]],
      wpIndex: 0,
      patrolSpeed: 4,
      chaseSpeed: 8,
      detectionRadius: 15,
      waterDetectionRadius: 24,
      scale: 1,
      alert: 'calm',
      searchTarget: new THREE.Vector3(),
      searchTimer: 0,
      velX: 0,
      velZ: 0,
      avoidDir: 1 as const,
      avoidTimer: 0,
      stuckTimer: 0,
      navBestDist: Infinity,
      navStallTimer: 0,
      navAnchorX: x,
      navAnchorZ: z,
      navAnchorTimer: 0,
      navTurnAccum: 0,
      emerged: false,
      wakeSplashTimer: 0,
      diveTimer: 0,
      eatingUserId: null,
      eatingTimer: 0,
      eatingProgress: -1,
      eatingPreyStartPos: new THREE.Vector3(),
      eatingPreyStartYaw: 0,
      eatingGulpStage: 0,
      safeEpoch: 0,
      intimidationPhase: 'none',
      intimidationTimer: 0,
      intimidationDuration: 0,
      intimidationSpot: new THREE.Vector3(),
      intimidationPlatform: null,
      intimidationLocalOffset: new THREE.Vector3(),
      intimidationYaw: 0.7,
      visionState: 'none' as 'none' | 'watching' | 'look_away' | 'lunging',
      visionTimer: 0,
      watchingUserId: null as string | null,
      lookAway: false,
      lookAwayYaw: 0,
    };
  };

  // Case 1: Stationary player touches water -> immediate attack & devour without waiting for movement
  {
    const eng = setupEng();
    const waterY = eng.currentLevel.bounds.waterY;
    const plat = eng.platforms[0];
    const waterX = plat.currentPos.x + plat.def.size[0] * 0.5 + 2.5;
    const waterZ = plat.currentPos.z - 2.0;
    eng.grounded = false;
    eng.stoodPlatform = null;
    eng.inWater = true;
    eng.playerPos.set(waterX, waterY - 0.35, waterZ);
    const m = makeSerpent(waterX, waterZ - 4.5);
    m.pos.y = waterY - 0.14;
    eng.monsters = [m];

    for (let i = 0; i < 20 && eng.phase === 'playing'; i++) {
      eng.simTime += 0.05;
      eng.updatePlayer(0.05);
      eng.updateMonsters(0.05, true);
    }
    assert.equal(eng.phase, 'jumpscare', 'Stationary player touching water must be attacked & devoured immediately');
    assert.equal(eng.deathReason, 'caught');
    m.rig.dispose();
    eng.playerRig.dispose();
  }

  // Case 2: Player exits water onto platform -> arrives -> rises -> exact 5.0s stare + full freeze -> leaves safely, then moves freely & second water touch attacks immediately
  {
    const eng = setupEng();
    const waterY = eng.currentLevel.bounds.waterY;
    const plat = eng.platforms[0];
    const deckY = plat.currentPos.y + plat.def.size[1] * 0.5;
    // Simulate having been in water prior to climbing onto platform
    eng.playerInWaterSession = true;
    eng.playerWaterEpoch = 1;
    eng.grounded = true;
    eng.stoodPlatform = plat;
    eng.inWater = false;
    eng.playerPos.set(plat.currentPos.x, deckY, plat.currentPos.z);

    const m = makeSerpent(plat.currentPos.x, plat.currentPos.z - (plat.def.size[2] * 0.5 + 8.0));
    m.pos.y = waterY - 0.14;
    eng.monsters = [m];

    let sawApproaching = false;
    let sawRising = false;
    let sawNotFrozenDuringApproachOrRise = true;
    let stareStartTime = -1;
    let stareEndTime = -1;
    let frozeDuringStare = false;

    for (let i = 0; i < 260; i++) {
      eng.simTime += 0.05;
      eng.updatePlayer(0.05);
      eng.updateMonsters(0.05, true);

      if (m.intimidationPhase === 'approaching') {
        sawApproaching = true;
        if (eng.isLocalPlayerWatchedBySnake() || eng.isWatchedFreezeActive) {
          sawNotFrozenDuringApproachOrRise = false;
        }
      } else if (m.intimidationPhase === 'rising') {
        sawRising = true;
        if (eng.isLocalPlayerWatchedBySnake() || eng.isWatchedFreezeActive) {
          sawNotFrozenDuringApproachOrRise = false;
        }
      } else if (m.intimidationPhase === 'staring') {
        if (stareStartTime < 0) stareStartTime = eng.simTime;
        if (eng.isWatchedFreezeActive && eng.isLocalPlayerWatchedBySnake()) {
          frozeDuringStare = true;
        }
      } else if (stareStartTime >= 0 && stareEndTime < 0 && (m.intimidationPhase === 'lowering' || m.intimidationPhase === 'retreating')) {
        stareEndTime = eng.simTime;
      }
      if (stareEndTime >= 0 && m.intimidationPhase === 'none') break;
    }

    assert.ok(sawApproaching && sawRising, 'Serpent must approach and rise before staring');
    assert.ok(sawNotFrozenDuringApproachOrRise, 'Player must NOT be frozen and 5s timer must NOT start until serpent finishes approaching & rising');
    assert.ok(stareStartTime >= 0 && stareEndTime > stareStartTime, 'Serpent must complete staring phase');
    const stareDur = stareEndTime - stareStartTime;
    assert.ok(stareDur >= 4.95 && stareDur <= 5.2, `Expected fixed 5.0s watch duration, measured ${stareDur.toFixed(2)}s`);
    assert.ok(frozeDuringStare, 'Player must be completely frozen while serpent stares');
    assert.equal(eng.phase, 'playing', 'Standing still for full 5.0s must let player survive');
    assert.equal(eng.isLocalPlayerWatchedBySnake(), false, 'Watch must end after 5.0s');

    // Player can move & jump freely once watch ends (and no second timer restarts on platform)
    const startZ = eng.playerPos.z;
    eng.heldKeys.add('KeyW');
    for (let i = 0; i < 6; i++) {
      eng.simTime += 0.05;
      eng.updatePlayer(0.05);
      eng.updateMonsters(0.05, true);
    }
    eng.heldKeys.delete('KeyW');
    assert.ok(Math.abs(eng.playerPos.z - startZ) > 0.35, 'Player must move freely after 5s watch ends');
    assert.equal(m.intimidationPhase, 'none', 'No duplicate watch timer should start while staying on platform');

    // Player touches water a SECOND time while still -> immediate attack & devour again
    const w2X = plat.currentPos.x + plat.def.size[0] * 0.5 + 2.0;
    const w2Z = plat.currentPos.z;
    eng.grounded = false;
    eng.stoodPlatform = null;
    eng.inWater = true;
    eng.playerPos.set(w2X, waterY - 0.35, w2Z);
    eng.playerVel.set(0, 0, 0);
    for (let i = 0; i < 40 && eng.phase === 'playing'; i++) {
      eng.simTime += 0.05;
      eng.updatePlayer(0.05);
      eng.updateMonsters(0.05, true);
    }
    assert.equal(eng.phase, 'jumpscare', 'Second stationary water contact must immediately attack & devour player');
    assert.equal(eng.deathReason, 'caught');
    m.rig.dispose();
    eng.playerRig.dispose();
  }

  // Case 3: Moving OR jumping slightly during 5s staring freeze -> player stays blocked from escaping & serpent immediately strikes and devours
  for (const inputKind of ['walk', 'jump'] as const) {
    const eng = setupEng();
    const waterY = eng.currentLevel.bounds.waterY;
    const plat = eng.platforms[0];
    const deckY = plat.currentPos.y + plat.def.size[1] * 0.5;
    eng.grounded = true;
    eng.stoodPlatform = plat;
    eng.inWater = false;
    eng.playerPos.set(plat.currentPos.x, deckY, plat.currentPos.z);

    const m = makeSerpent(plat.currentPos.x, plat.currentPos.z - (plat.def.size[2] * 0.5 + 2.6));
    m.pos.y = waterY - 0.14;
    m.alert = 'searching';
    m.intimidationPhase = 'staring';
    m.intimidationTimer = 0;
    m.intimidationDuration = 5.0;
    m.intimidationSpot.set(m.pos.x, waterY - 0.14, m.pos.z);
    m.intimidationPlatform = plat;
    m.watchingUserId = '__local__';
    m.safeEpoch = 1;
    eng.playerWaterEpoch = 1;
    eng.monsters = [m];

    // One frame to lock freeze anchor
    eng.simTime += 0.05;
    eng.updatePlayer(0.05);
    eng.updateMonsters(0.05, true);
    assert.equal(eng.isWatchedFreezeActive, true, 'Freeze must engage while staring');

    const anchorX = eng.playerPos.x;
    const anchorZ = eng.playerPos.z;
    const anchorY = eng.playerPos.y;
    if (inputKind === 'walk') {
      eng.heldKeys.add('KeyW');
    } else {
      eng.jumpBufferTimer = 0.12;
    }

    eng.simTime += 0.05;
    eng.updatePlayer(0.05);
    assert.equal(eng.watchMoveAttempted, true, `Attempting ${inputKind} during stare must flag watchMoveAttempted immediately`);
    assert.ok(Math.hypot(eng.playerPos.x - anchorX, eng.playerPos.z - anchorZ) < 0.01, 'Frozen player must not move horizontally');
    assert.ok(eng.playerPos.y <= anchorY + 0.01, 'Frozen player must not be allowed to jump');

    eng.updateMonsters(0.05, true);
    assert.equal(m.visionState, 'lunging', `Serpent must immediately lunge when player attempts ${inputKind} during stare`);

    for (let i = 0; i < 20 && eng.phase === 'playing'; i++) {
      eng.simTime += 0.05;
      eng.updatePlayer(0.05);
      eng.updateMonsters(0.05, true);
    }
    assert.equal(eng.phase, 'jumpscare', `Serpent must devour player who attempted ${inputKind} during 5s stare`);
    assert.equal(eng.deathReason, 'caught');
    m.rig.dispose();
    eng.playerRig.dispose();
  }

  // Case 4: Falling into water mid-stare or mid-rising immediately interrupts & devours
  {
    const eng = setupEng();
    const waterY = eng.currentLevel.bounds.waterY;
    const plat = eng.platforms[0];
    const mStrike = makeSerpent(plat.currentPos.x, plat.currentPos.z - (plat.def.size[2] * 0.5 + 5.6));
    mStrike.pos.y = waterY - 0.14;
    mStrike.intimidationPhase = 'staring';
    mStrike.intimidationDuration = 5.0;
    mStrike.watchingUserId = '__local__';
    eng.monsters = [mStrike];
    eng.grounded = false;
    eng.stoodPlatform = null;
    eng.inWater = true;
    eng.playerInWaterSession = true;
    eng.playerWaterEpoch = 2;
    eng.playerPos.set(mStrike.pos.x, waterY - 0.25, mStrike.pos.z + 3.2);
    eng.simTime += 0.05;
    eng.updateMonsters(0.05, true);
    assert.equal(mStrike.intimidationPhase, 'none');
    assert.equal(mStrike.alert, 'chasing');
    for (let i = 0; i < 10 && eng.phase === 'playing'; i++) {
      eng.simTime += 0.05;
      eng.updateMonsters(0.05, true);
    }
    assert.equal(eng.phase, 'jumpscare');
    assert.equal(eng.deathReason, 'caught');
    mStrike.rig.dispose();
    eng.playerRig.dispose();
  }
}

function testSerpentUnderwaterNavigationUnderPlatforms(textures: TextureBundle): void {
  const eng = createMinimalEngineHarness(1, textures);
  eng.simTime = 12;
  eng.renderFrameIdx = 1;
  eng.playerWaterEpoch = 1;
  eng.playerInWaterSession = true;
  eng.pendingClimbIntimidation = false;
  eng.syncAudioListener = () => {};
  eng.syncAllMonstersSwimmingAudio = () => {};
  eng.triggerDeath = (reason: string, monster: unknown) => {
    eng.deathReason = reason;
    eng.jumpscareMonster = monster;
    eng.phase = 'jumpscare';
  };
  eng.checkMonsterBlockedFn = (cx: number, cz: number, cr: number) =>
    eng.isCircleBlocked(cx, cz, cr, eng._cbMobBotY, eng._cbMobTopY, undefined, undefined);

  const waterY = eng.currentLevel.bounds.waterY;
  // Isolate test with a single wide floating platform directly across the direct chase path (with clear water beneath it)
  const wideBarDef = {
    id: 'under-bar',
    position: [0, waterY + 0.18, 0] as [number, number, number],
    size: [26, 0.84, 5.5] as [number, number, number],
    kind: 'static' as const,
  };
  const customDef = {
    ...eng.currentLevel,
    platforms: [wideBarDef],
    walls: [
      {
        id: 'side-wall',
        position: [0, waterY, 12] as [number, number, number],
        size: [6, 8, 2] as [number, number, number],
      },
    ],
  };
  eng.currentLevel = customDef;
  eng.spatialGrid = new LevelSpatialGrid(customDef, 12);
  eng.platforms = [
    {
      def: wideBarDef,
      mesh: new THREE.Object3D(),
      material: new THREE.MeshStandardMaterial(),
      baseColorHex: 0xb9c7ca,
      boundRadiusXZ: Math.hypot(13, 2.75),
      currentPos: new THREE.Vector3(...wideBarDef.position),
      prevPos: new THREE.Vector3(...wideBarDef.position),
      currentQuat: new THREE.Quaternion(),
      prevQuat: new THREE.Quaternion(),
      invQuat: new THREE.Quaternion(),
      prevInvQuat: new THREE.Quaternion(),
      isRotated: false,
      state: 'solid',
      stateTimer: 0,
    },
  ];
  eng.walls = customDef.walls.map((w: any) => ({
    centerX: w.position[0],
    centerZ: w.position[2],
    boundRadiusXZ: Math.hypot(w.size[0] * 0.5, w.size[2] * 0.5),
    minX: w.position[0] - w.size[0] * 0.5,
    maxX: w.position[0] + w.size[0] * 0.5,
    minY: w.position[1] - w.size[1] * 0.5,
    maxY: w.position[1] + w.size[1] * 0.5,
    minZ: w.position[2] - w.size[2] * 0.5,
    maxZ: w.position[2] + w.size[2] * 0.5,
  }));

  // Stationary swimmer in water at z = +7.5; serpent starts on opposite side at z = -8.5 (26m-wide floating platform in between)
  eng.grounded = false;
  eng.stoodPlatform = null;
  eng.inWater = true;
  eng.playerPos.set(0, waterY - 0.35, 7.5);

  const rig = createMonsterRig(textures, 1.0);
  const m = {
    id: 'm-under',
    rig,
    pos: new THREE.Vector3(0, waterY - 0.14, -8.5),
    yaw: 0,
    targetYaw: 0,
    targetUserId: null,
    waypoints: [[0, -8.5], [0, 7.5]] as [number, number][],
    wpIndex: 0,
    patrolSpeed: 4,
    chaseSpeed: 8,
    detectionRadius: 20,
    waterDetectionRadius: 30,
    scale: 1,
    alert: 'calm',
    searchTarget: new THREE.Vector3(),
    searchTimer: 0,
    velX: 0,
    velZ: 0,
    avoidDir: 1 as const,
    avoidTimer: 0,
    stuckTimer: 0,
    navBestDist: Infinity,
    navStallTimer: 0,
    navAnchorX: 0,
    navAnchorZ: -8.5,
    navAnchorTimer: 0,
    navTurnAccum: 0,
    emerged: false,
    wakeSplashTimer: 0,
    diveTimer: 0,
    eatingUserId: null,
    eatingTimer: 0,
    eatingProgress: -1,
    eatingPreyStartPos: new THREE.Vector3(),
    eatingPreyStartYaw: 0,
    eatingGulpStage: 0,
    safeEpoch: 0,
    intimidationPhase: 'none',
    intimidationTimer: 0,
    intimidationDuration: 0,
    intimidationSpot: new THREE.Vector3(),
    intimidationPlatform: null,
    intimidationLocalOffset: new THREE.Vector3(),
    intimidationYaw: 0,
    visionState: 'none' as 'none' | 'watching' | 'look_away' | 'lunging',
    visionTimer: 0,
    watchingUserId: null as string | null,
    lookAway: false,
    lookAwayYaw: 0,
  };
  eng.monsters = [m];
  eng.watchMoveAttempted = false;

  let minObsY = Infinity;
  let sawUnderBar = false;
  let stayedBelowUndersideWhileUnderBar = true;
  const barUndersideY = wideBarDef.position[1] - wideBarDef.size[1] * 0.5;

  for (let i = 0; i < 40 && eng.phase === 'playing'; i++) {
    eng.simTime += 0.05;
    eng.updateMonsters(0.05, true);
    if (m.pos.y < minObsY) minObsY = m.pos.y;
    if (Math.abs(m.pos.z) < 2.2 && Math.abs(m.pos.x) < 12.0) {
      sawUnderBar = true;
      if (m.pos.y > barUndersideY - 0.3) {
        stayedBelowUndersideWhileUnderBar = false;
      }
    }
  }

  assert.ok(minObsY < waterY - 1.2, `Expected serpent to dive deep underwater (< ${waterY - 1.2}), got minY=${minObsY}`);
  assert.ok(sawUnderBar, 'Expected serpent to swim straight underneath the wide floating platform rather than getting trapped');
  assert.ok(stayedBelowUndersideWhileUnderBar, 'Serpent must stay submerged beneath the platform underside while passing under it');
  assert.ok(m.pos.z > 2.5, `Serpent must clear platform and reach swimmer side (z=${m.pos.z})`);
  assert.equal(eng.phase, 'jumpscare', 'After swimming underneath platform, serpent must immediately catch even a stationary swimmer');
  assert.equal(eng.deathReason, 'caught');

  // Sanity check: full-height wall still blocks horizontally even when submerged
  eng.phase = 'playing';
  eng.deathReason = null;
  m.visionState = 'lunging';
  m.pos.set(0, waterY - 1.9, 9.8);
  eng.playerPos.set(0, waterY - 0.35, 14.5);
  eng.updateMonsters(0.05, true);
  assert.ok(m.pos.z <= 10.6, `Full-height wall at z=11..13 must block serpent horizontally (z=${m.pos.z})`);

  rig.dispose();
  eng.playerRig.dispose();
}

function testSpawnVisibilityAndRigReset(textures: TextureBundle): void {
  // 1. Verify setVisible toggles BOTH root.visible and hips.visible + headlamp
  for (const charId of ['male', 'female'] as const) {
    const rig = createPlayerRig(textures, 0x52e0b6, false, charId);
    rig.root.visible = false;
    rig.hips.visible = false;
    rig.setVisible(true);
    assert.equal(rig.root.visible, true, `setVisible(true) must restore root.visible for ${charId}`);
    assert.equal(rig.hips.visible, true, `setVisible(true) must restore hips.visible for ${charId}`);
    assert.ok(rig.headlamp.intensity > 0, `setVisible(true) must enable headlamp for ${charId}`);
    rig.setVisible(false);
    assert.equal(rig.root.visible, false);
    assert.equal(rig.hips.visible, false);
    assert.equal(rig.headlamp.intensity, 0);

    // 2. Corrupt rig pose via death collapse & serpent mouth swallow, then verify resetPlayerRigPose restores frame-0 standing pose
    animatePlayerRig(rig, 'idle', 0, 1.2, 0.05, 0.95);
    const serpent = createMonsterRig(textures, 1.1);
    attachPreyToSerpentMouth(serpent, rig, 0.9, 2.0, 0.05, new THREE.Vector3(0, 1, 0), 0.7);
    assert.ok(rig.root.scale.x < 0.5, 'Swallowing should shrink rig scale prior to reset');

    resetPlayerRigPose(rig);
    assert.equal(rig.root.visible, true);
    assert.equal(rig.hips.visible, true);
    assert.ok(Math.abs(rig.root.scale.x - 1) < 1e-6 && Math.abs(rig.root.scale.y - 1) < 1e-6);
    assert.ok(Math.abs(rig.hips.position.y - 0.92) < 1e-6);
    assert.ok(Math.abs(rig.hips.rotation.x) < 1e-6 && Math.abs(rig.hips.rotation.z) < 1e-6);
    assert.ok(Math.abs(rig.torso.rotation.x) < 1e-6 && Math.abs(rig.headGroup.rotation.x) < 1e-6);
    assert.equal(rig.prevAnimState, 'idle');
    assert.equal(rig.deathTimer, -1);

    // Verify full bounding height at spawn is upright (~1.8m) immediately after reset
    rig.root.position.set(0, 0.5, 0);
    rig.root.rotation.set(0, Math.PI, 0);
    rig.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.root);
    assert.ok(Math.abs(box.min.y - 0.5) < 0.03, `Soles should rest on spawn y=0.5, got min.y=${box.min.y.toFixed(3)}`);
    assert.ok(box.max.y - box.min.y >= 1.76, `Standing height must be restored cleanly, got ${(box.max.y - box.min.y).toFixed(3)}`);

    serpent.dispose();
    rig.dispose();
  }

  // 3. Verify across all 100 levels that initial spawn + post-geometry camera snap leaves the player unoccluded & inside bounds
  for (const def of LEVELS) {
    const eng = createMinimalEngineHarness(def.id, textures);
    eng.simTime = 0;
    eng.phase = 'playing';
    eng.activeSpawn = new THREE.Vector3(def.spawn[0], def.spawn[1], def.spawn[2]);
    eng.playerPos = new THREE.Vector3(def.spawn[0], def.spawn[1], def.spawn[2]);
    eng.playerYaw = Math.PI;
    eng.camYaw = 0;
    eng.camPitch = 0.25;
    eng.syncLocalPlayerRigTransform('idle', 0);
    eng.snapPlayCameraImmediate();

    assert.equal(eng.playerRig.root.visible, true, `Level ${def.id}: playerRig.root must be visible on spawn`);
    assert.equal(eng.playerRig.hips.visible, true, `Level ${def.id}: playerRig.hips must be visible on spawn`);
    assert.ok(
      Number.isFinite(eng.camera.position.x) &&
        Number.isFinite(eng.camera.position.y) &&
        Number.isFinite(eng.camera.position.z),
      `Level ${def.id}: camera position must be finite on spawn`
    );
    const sepXZ = Math.hypot(eng.camera.position.x - eng.playerPos.x, eng.camera.position.z - eng.playerPos.z);
    assert.ok(sepXZ >= 0.72, `Level ${def.id}: spawn camera must not collapse into player body (sepXZ=${sepXZ.toFixed(3)})`);
    eng.playerRig.dispose();
  }

  // 4. Verify structural invariants in engine.ts: context loss handlers, viewport safety, post-build camera snap
  const engineSrc = readFileSync('src/game/engine.ts', 'utf8');
  assert.ok(engineSrc.includes('webglcontextlost'), 'engine.ts must handle webglcontextlost');
  assert.ok(engineSrc.includes('webglcontextrestored'), 'engine.ts must handle webglcontextrestored');
  assert.ok(engineSrc.includes('ResizeObserver'), 'engine.ts must observe container resize');
  const loadLevelBody = engineSrc.slice(engineSrc.indexOf('public loadLevel('), engineSrc.indexOf('private prewarmSceneShaders('));
  const buildWallsIdx = loadLevelBody.indexOf('this.buildInnerWalls(def)');
  const snapCamIdx = loadLevelBody.lastIndexOf('this.snapPlayCameraImmediate()');
  assert.ok(buildWallsIdx > 0 && snapCamIdx > buildWallsIdx, 'loadLevel must snap camera after platforms and walls are built');
  assert.equal(/spectat/i.test(engineSrc), false, 'engine.ts must not contain any Spectator Mode logic');
}

async function run(): Promise<void> {
  const prevDoc = (globalThis as { document?: unknown }).document;
  if (typeof prevDoc === 'undefined') {
    (globalThis as { document?: unknown }).document = {
      createElement: () => ({
        width: 256,
        height: 64,
        getContext: () => null,
      }),
    };
  }
  const textures = createMockTextures();
  try {
    testPlayerRigFrustumAndAnimations(textures);
    testSerpentEyesAndTeethVisibility(textures);
    testCameraOcclusionRespawnAndMultiplayerVisibility(textures);
    testSerpentIntimidationWaterInterrupt(textures);
    testSerpentUnderwaterNavigationUnderPlatforms(textures);
    testSpawnVisibilityAndRigReset(textures);
    console.log('ALL VISIBILITY REGRESSION CHECKS PASSED');
  } finally {
    disposeEntityResources(textures);
    if (typeof prevDoc === 'undefined') {
      delete (globalThis as { document?: unknown }).document;
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
