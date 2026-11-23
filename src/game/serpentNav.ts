export interface SerpentNavState {
  x: number;
  z: number;
  yaw: number;
  velX: number;
  velZ: number;
  wpIndex: number;
  waypoints: [number, number][];
  avoidDir: -1 | 1;
  avoidTimer: number;
  stuckTimer: number;
  navBestDist: number;
  navStallTimer: number;
  navAnchorX: number;
  navAnchorZ: number;
  navAnchorTimer: number;
  navTurnAccum: number;
}

export type CircleBlockedFn = (x: number, z: number, radius: number) => boolean;

export function normalizeAngle(rad: number): number {
  let a = rad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function shortestAngleDiffNav(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function resetSerpentNavProgress(
  nav: Pick<
    SerpentNavState,
    'x' | 'z' | 'navBestDist' | 'navStallTimer' | 'navAnchorX' | 'navAnchorZ' | 'navAnchorTimer' | 'navTurnAccum' | 'stuckTimer'
  >
): void {
  nav.navBestDist = Infinity;
  nav.navStallTimer = 0;
  nav.navAnchorX = nav.x;
  nav.navAnchorZ = nav.z;
  nav.navAnchorTimer = 0;
  nav.navTurnAccum = 0;
  nav.stuckTimer = 0;
}

/**
 * Selects the nearest reachable waypoint when transitioning from chase/eating back to calm patrol.
 */
export function selectClosestPatrolWaypoint(
  nav: SerpentNavState,
  monsterRadius: number,
  isBlocked: CircleBlockedFn
): void {
  const wps = nav.waypoints;
  if (wps.length === 0) return;
  const arrivalR = Math.max(2.6, monsterRadius * 2.4);
  let bestIdx = 0;
  let bestScore = Infinity;

  for (let i = 0; i < wps.length; i++) {
    const wp = wps[i];
    const d = Math.hypot(wp[0] - nav.x, wp[1] - nav.z);
    if (wps.length > 1 && d < arrivalR) continue;
    if (isBlocked(wp[0], wp[1], monsterRadius * 0.9)) continue;
    if (d < bestScore) {
      bestScore = d;
      bestIdx = i;
    }
  }

  if (bestScore === Infinity) {
    let nearestIdx = 0;
    let nearestD = Infinity;
    for (let i = 0; i < wps.length; i++) {
      const d = Math.hypot(wps[i][0] - nav.x, wps[i][1] - nav.z);
      if (d < nearestD) {
        nearestD = d;
        nearestIdx = i;
      }
    }
    bestIdx = wps.length > 1 && nearestD < arrivalR ? (nearestIdx + 1) % wps.length : nearestIdx;
  }

  nav.wpIndex = bestIdx;
  resetSerpentNavProgress(nav);
}

const _patrolTargetResult = { tx: 0, tz: 0, hasTarget: false };
const _steerAngleResult = { valid: false, steerAngle: 0 };

/**
 * Resolves the active patrol destination [tx, tz], automatically advancing past
 * already-reached or currently-blocked waypoints so the serpent never lingers on an unreachable point.
 */
export function resolvePatrolTarget(
  nav: SerpentNavState,
  monsterRadius: number,
  isBlocked: CircleBlockedFn
): { tx: number; tz: number; hasTarget: boolean } {
  const wps = nav.waypoints;
  if (wps.length === 0) {
    _patrolTargetResult.tx = nav.x;
    _patrolTargetResult.tz = nav.z;
    _patrolTargetResult.hasTarget = false;
    return _patrolTargetResult;
  }

  const n = wps.length;
  let idx = ((nav.wpIndex % n) + n) % n;
  const arrivalR = Math.max(2.6, monsterRadius * 2.4);

  if (n === 1) {
    const wp = wps[0];
    nav.wpIndex = 0;
    const dist = Math.hypot(wp[0] - nav.x, wp[1] - nav.z);
    if (dist < 0.35 || isBlocked(wp[0], wp[1], monsterRadius * 0.9)) {
      _patrolTargetResult.tx = nav.x;
      _patrolTargetResult.tz = nav.z;
      _patrolTargetResult.hasTarget = false;
      return _patrolTargetResult;
    }
    _patrolTargetResult.tx = wp[0];
    _patrolTargetResult.tz = wp[1];
    _patrolTargetResult.hasTarget = true;
    return _patrolTargetResult;
  }

  let chosenIdx = idx;
  let foundValid = false;

  for (let step = 0; step < n; step++) {
    const wp = wps[idx];
    const dist = Math.hypot(wp[0] - nav.x, wp[1] - nav.z);
    const alreadyReached = dist < arrivalR;
    const blockedTarget =
      dist < arrivalR * 2.8 && isBlocked(wp[0], wp[1], monsterRadius * 0.9);

    if (!alreadyReached && !blockedTarget) {
      chosenIdx = idx;
      foundValid = true;
      break;
    }
    idx = (idx + 1) % n;
  }

  if (!foundValid) {
    let farthestIdx = (nav.wpIndex + 1) % n;
    let farthestD = -1;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(wps[i][0] - nav.x, wps[i][1] - nav.z);
      if (d > farthestD) {
        farthestD = d;
        farthestIdx = i;
      }
    }
    chosenIdx = farthestIdx;
  }

  if (chosenIdx !== nav.wpIndex) {
    nav.wpIndex = chosenIdx;
    resetSerpentNavProgress(nav);
  }

  const target = wps[chosenIdx];
  const distToTarget = Math.hypot(target[0] - nav.x, target[1] - nav.z);
  if (distToTarget < nav.navBestDist - 0.5) {
    nav.navBestDist = distToTarget;
    nav.navStallTimer = 0;
  }

  _patrolTargetResult.tx = target[0];
  _patrolTargetResult.tz = target[1];
  _patrolTargetResult.hasTarget = distToTarget > 0.08;
  return _patrolTargetResult;
}

const PATROL_OFFSET_MAGS = [0.36, 0.74, 1.14, 1.56, 2.02, 2.52];
const CHASE_OFFSET_MAGS = [0.22, 0.48, 0.82, 1.25, 1.85];

/**
 * Computes obstacle-avoiding steering angle with heading continuity and hysteresis
 * so serpents curve cleanly around platforms instead of flipping 180° in pockets.
 */
export function computeSerpentSteerAngle(
  nav: SerpentNavState,
  tx: number,
  tz: number,
  monsterRadius: number,
  isChasing: boolean,
  isBlocked: CircleBlockedFn
): { valid: boolean; steerAngle: number } {
  const dirX = tx - nav.x;
  const dirZ = tz - nav.z;
  const len = Math.hypot(dirX, dirZ);
  if (len <= 0.05) {
    _steerAngleResult.valid = false;
    _steerAngleResult.steerAngle = nav.yaw;
    return _steerAngleResult;
  }

  const baseAngle = Math.atan2(dirX, dirZ);

  if (isChasing && len < 3.4) {
    const shortProbe = Math.min(len * 0.6, monsterRadius * 0.85 + 0.35);
    const sxShort = Math.sin(baseAngle);
    const szShort = Math.cos(baseAngle);
    if (!isBlocked(nav.x + sxShort * shortProbe, nav.z + szShort * shortProbe, monsterRadius * 0.65)) {
      _steerAngleResult.valid = true;
      _steerAngleResult.steerAngle = baseAngle;
      return _steerAngleResult;
    }
  }

  const bias = nav.avoidDir;
  const speedSq = nav.velX * nav.velX + nav.velZ * nav.velZ;
  const curHeading = speedSq > 0.0625 ? Math.atan2(nav.velX, nav.velZ) : nav.yaw;

  if (isChasing) {
    const probeR = monsterRadius * 0.72;
    const maxLook = Math.min(len, monsterRadius * 0.7 + 2.4);
    const d1 = Math.min(maxLook, monsterRadius * 0.65 + 0.55);
    const d2 = Math.min(maxLook, monsterRadius * 0.75 + 1.35);
    const d3 = maxLook;

    let bestOffset = 0;
    let bestScore = -1;

    const sxBase = Math.sin(baseAngle);
    const szBase = Math.cos(baseAngle);
    if (!isBlocked(nav.x + sxBase * d1, nav.z + szBase * d1, probeR)) {
      if (!isBlocked(nav.x + sxBase * d2, nav.z + szBase * d2, probeR)) {
        if (!isBlocked(nav.x + sxBase * d3, nav.z + szBase * d3, probeR)) {
          _steerAngleResult.valid = true;
          _steerAngleResult.steerAngle = baseAngle;
          return _steerAngleResult;
        }
        bestScore = 2;
      } else {
        bestScore = 1;
      }
    }

    for (let m = 0; m < CHASE_OFFSET_MAGS.length && bestScore < 3; m++) {
      const mag = CHASE_OFFSET_MAGS[m];
      for (let s = 0; s < 2; s++) {
        const sign = s === 0 ? bias : -bias;
        const off = mag * sign;
        const ang = baseAngle + off;
        const sx = Math.sin(ang);
        const sz = Math.cos(ang);
        let score = 0;
        if (!isBlocked(nav.x + sx * d1, nav.z + sz * d1, probeR)) {
          score = 1;
          if (!isBlocked(nav.x + sx * d2, nav.z + sz * d2, probeR)) {
            score = 2;
            if (!isBlocked(nav.x + sx * d3, nav.z + sz * d3, probeR)) {
              score = 3;
            }
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestOffset = off;
          if (bestScore === 3) break;
        }
      }
    }

    if (bestScore <= 0) {
      const d0 = monsterRadius * 0.55 + 0.25;
      let foundShort = false;
      for (let m = 0; m < CHASE_OFFSET_MAGS.length && !foundShort; m++) {
        const mag = CHASE_OFFSET_MAGS[m];
        for (let s = 0; s < 2; s++) {
          const off = mag * (s === 0 ? bias : -bias);
          const ang = baseAngle + off;
          if (!isBlocked(nav.x + Math.sin(ang) * d0, nav.z + Math.cos(ang) * d0, probeR * 0.85)) {
            bestOffset = off;
            foundShort = true;
            break;
          }
        }
      }
      if (!foundShort) {
        bestOffset = 1.57 * bias;
      }
    }

    if (bestOffset !== 0 && nav.avoidTimer <= 0) {
      nav.avoidDir = bestOffset > 0 ? 1 : -1;
      nav.avoidTimer = 0.35;
    }
    _steerAngleResult.valid = true;
    _steerAngleResult.steerAngle = baseAngle + bestOffset;
    return _steerAngleResult;
  }

  // Calm patrol steering: collision-consistent probes + anti-reversal heading continuity + committed detour bias
  const probeR = monsterRadius * 1.04;
  const dNear = Math.min(len, monsterRadius * 0.85 + 0.9);
  const dMid = Math.min(len, monsterRadius * 0.9 + 2.1);
  const dFar = Math.min(len, monsterRadius * 0.95 + 3.5);
  const dTight = monsterRadius * 0.55 + 0.3;

  const headingToTarget = Math.abs(shortestAngleDiffNav(curHeading, baseAngle));
  const sx0 = Math.sin(baseAngle);
  const sz0 = Math.cos(baseAngle);
  const straightClear =
    !isBlocked(nav.x + sx0 * dNear, nav.z + sz0 * dNear, probeR) &&
    !isBlocked(nav.x + sx0 * dMid, nav.z + sz0 * dMid, probeR) &&
    (dFar <= dMid + 0.15 || !isBlocked(nav.x + sx0 * dFar, nav.z + sz0 * dFar, probeR));

  if (straightClear && (nav.avoidTimer <= 0 || headingToTarget < 1.15)) {
    _steerAngleResult.valid = true;
    _steerAngleResult.steerAngle = baseAngle;
    return _steerAngleResult;
  }

  let bestAngle = baseAngle;
  let bestScore = -Infinity;
  let bestOff = 0;
  let bestReachBias = 0;
  let bestReachOpp = 0;

  const probeRNear = probeR * 0.96;
  const probeRMid = probeR * 0.94;
  const probeRFar = probeR * 0.92;
  const probeRTight = probeR * 0.85;
  const needFarProbe = dFar > dMid + 0.15;
  const sameSideBonusVal = nav.avoidTimer > 0 ? 1.3 : 0.45;
  const totalCandidates = 1 + PATROL_OFFSET_MAGS.length * 2;

  for (let c = 0; c < totalCandidates; c++) {
    let off = 0;
    if (c > 0) {
      const mIdx = (c - 1) >> 1;
      const sign = (c & 1) === 1 ? bias : -bias;
      off = PATROL_OFFSET_MAGS[mIdx] * sign;
    }

    const ang = baseAngle + off;
    const sx = Math.sin(ang);
    const sz = Math.cos(ang);

    let reach = 0;
    if (!isBlocked(nav.x + sx * dNear, nav.z + sz * dNear, probeRNear)) {
      reach = 1.25;
      if (!isBlocked(nav.x + sx * dMid, nav.z + sz * dMid, probeRMid)) {
        reach = 2.4;
        if (!needFarProbe || !isBlocked(nav.x + sx * dFar, nav.z + sz * dFar, probeRFar)) {
          reach = 3.5;
        }
      }
    } else if (!isBlocked(nav.x + sx * dTight, nav.z + sz * dTight, probeRTight)) {
      reach = 0.35;
    }

    if (off !== 0) {
      if (off * bias > 0) {
        if (reach > bestReachBias) bestReachBias = reach;
      } else if (reach > bestReachOpp) {
        bestReachOpp = reach;
      }
    }

    const headDelta = Math.abs(shortestAngleDiffNav(curHeading, ang));
    const reversalPenalty = headDelta > 1.75 ? (headDelta - 1.75) * 1.4 : 0;
    const sameSideBonus = off !== 0 && off * bias > 0 ? sameSideBonusVal : 0;
    const score =
      reach * 1.4 -
      Math.abs(off) * 0.4 -
      headDelta * 0.55 -
      reversalPenalty +
      sameSideBonus;

    if (score > bestScore) {
      bestScore = score;
      bestAngle = ang;
      bestOff = off;
    }
  }

  if (bestScore <= 0.1) {
    bestAngle = baseAngle + 1.57 * bias;
    bestOff = 1.57 * bias;
  }

  if (bestOff !== 0) {
    const chosenSide: -1 | 1 = bestOff > 0 ? 1 : -1;
    if (nav.avoidTimer <= 0) {
      nav.avoidDir = chosenSide;
      nav.avoidTimer = 1.5;
    } else if (chosenSide !== nav.avoidDir && bestReachBias < 1.0 && bestReachOpp >= 2.2) {
      nav.avoidDir = chosenSide;
      nav.avoidTimer = 1.5;
    }
  }

  _steerAngleResult.valid = true;
  _steerAngleResult.steerAngle = bestAngle;
  return _steerAngleResult;
}

/**
 * Updates progress/anti-spin timers after movement + solid resolution,
 * escaping loops or advancing to the next reachable waypoint if stalled.
 */
export function updateSerpentProgressAndYaw(
  nav: SerpentNavState,
  prevX: number,
  prevZ: number,
  prevSteerYaw: number,
  moveSpeed: number,
  subDt: number,
  isChasing: boolean,
  hasValidMove: boolean,
  isBlocked: CircleBlockedFn,
  clientChaseTurnRate = 24
): void {
  const actualMove = Math.hypot(nav.x - prevX, nav.z - prevZ);

  if (nav.avoidTimer > 0) {
    nav.avoidTimer = Math.max(0, nav.avoidTimer - subDt);
  }

  if (hasValidMove && moveSpeed > 0.05) {
    if (actualMove < moveSpeed * subDt * 0.2) {
      nav.stuckTimer += subDt;
    } else {
      nav.stuckTimer = Math.max(0, nav.stuckTimer - subDt * 1.2);
    }

    if (!isChasing) {
      nav.navStallTimer += subDt;
      nav.navAnchorTimer += subDt;

      let desiredYaw = nav.yaw;
      const minMotionForYaw = Math.max(0.015, moveSpeed * subDt * 0.35);
      if (actualMove > minMotionForYaw) {
        desiredYaw = Math.atan2(nav.x - prevX, nav.z - prevZ);
      } else if (Math.hypot(nav.velX, nav.velZ) > 0.25) {
        desiredYaw = Math.atan2(nav.velX, nav.velZ);
      }

      const yawDiff = shortestAngleDiffNav(nav.yaw, desiredYaw);
      const maxTurnStep = 2.65 * subDt; // smooth natural sea-serpent turn arc (~152 deg/s max)
      const smoothStep = yawDiff * Math.min(1, 7.0 * subDt);
      const clampedStep =
        Math.abs(smoothStep) > maxTurnStep ? Math.sign(smoothStep) * maxTurnStep : smoothStep;
      nav.yaw = normalizeAngle(nav.yaw + clampedStep);
      nav.navTurnAccum += Math.abs(shortestAngleDiffNav(prevSteerYaw, desiredYaw));

      if (nav.navAnchorTimer >= 1.15) {
        const netDisp = Math.hypot(nav.x - nav.navAnchorX, nav.z - nav.navAnchorZ);
        const minExpectedDisp = Math.max(1.3, moveSpeed * 0.42);
        const orbitingInPlace =
          netDisp < minExpectedDisp || (nav.navTurnAccum > 2.8 && netDisp < 2.6);

        if (orbitingInPlace) {
          nav.stuckTimer += 0.45;
          nav.avoidDir = nav.avoidDir === 1 ? -1 : 1;
          nav.avoidTimer = 1.85;
        }
        nav.navAnchorX = nav.x;
        nav.navAnchorZ = nav.z;
        nav.navAnchorTimer = 0;
        nav.navTurnAccum = 0;
      }

      if (nav.stuckTimer > 0.5) {
        nav.avoidDir = nav.avoidDir === 1 ? -1 : 1;
        nav.avoidTimer = 1.85;
        nav.stuckTimer = 0;
        if (nav.waypoints.length > 1 && nav.navStallTimer > 1.6) {
          advanceToNextClearWaypoint(nav, isBlocked);
        }
      } else if (nav.navStallTimer > 3.1 && nav.waypoints.length > 1) {
        advanceToNextClearWaypoint(nav, isBlocked);
      }
    } else {
      const velLen = Math.hypot(nav.velX, nav.velZ);
      let desiredYaw = nav.yaw;
      if (actualMove > 0.005) {
        desiredYaw = Math.atan2(nav.x - prevX, nav.z - prevZ);
      } else if (velLen > 0.1) {
        desiredYaw = Math.atan2(nav.velX, nav.velZ);
      }
      nav.yaw = normalizeAngle(
        nav.yaw + shortestAngleDiffNav(nav.yaw, desiredYaw) * Math.min(1, clientChaseTurnRate * subDt)
      );
      if (nav.stuckTimer > 0.25) {
        nav.avoidDir = nav.avoidDir === 1 ? -1 : 1;
        nav.avoidTimer = 0.45;
        nav.stuckTimer = 0;
      }
    }
  } else {
    const damp = Math.max(0, 1 - 10 * subDt);
    nav.velX *= damp;
    nav.velZ *= damp;
    nav.stuckTimer = 0;
    nav.navAnchorTimer = 0;
    nav.navTurnAccum = 0;
  }
}

function advanceToNextClearWaypoint(nav: SerpentNavState, isBlocked: CircleBlockedFn): void {
  const wps = nav.waypoints;
  const n = wps.length;
  if (n <= 1) return;
  let nextIdx = (nav.wpIndex + 1) % n;
  for (let step = 0; step < n - 1; step++) {
    const cand = wps[nextIdx];
    if (!isBlocked(cand[0], cand[1], 0.9)) {
      break;
    }
    nextIdx = (nextIdx + 1) % n;
  }
  nav.wpIndex = nextIdx;
  resetSerpentNavProgress(nav);
}

export const SERPENT_WATCH_CONE_RAD = 0.54; // ~31 deg half-angle direct gaze cone
export const SERPENT_WATCH_DURATION_SEC = 5.0;
export const SERPENT_INTIMIDATION_RISE_SEC = 2.15;
export const SERPENT_INTIMIDATION_LOWER_SEC = 1.15;
export const SERPENT_LOOK_AWAY_DURATION_SEC = 2.4;
export const SERPENT_WATCH_FREEZE_GRACE_SEC = 0.22;

export function getSerpentWatchStandoffDist(scale: number): number {
  return 4.2 * Math.max(0.6, scale);
}

export function isSerpentLookingAtTarget(
  monsterX: number,
  monsterZ: number,
  monsterYaw: number,
  targetX: number,
  targetZ: number,
  maxRange: number,
  hasWallBetween?: (mx: number, mz: number, tx: number, tz: number) => boolean
): boolean {
  const dx = targetX - monsterX;
  const dz = targetZ - monsterZ;
  const dist = Math.hypot(dx, dz);
  if (dist > maxRange) return false;
  if (dist < 0.05) return true;
  const toTargetYaw = Math.atan2(dx, dz);
  const diff = Math.abs(shortestAngleDiffNav(monsterYaw, toTargetYaw));
  if (diff > SERPENT_WATCH_CONE_RAD) return false;
  if (hasWallBetween && hasWallBetween(monsterX, monsterZ, targetX, targetZ)) {
    return false;
  }
  return true;
}

export function computeSerpentLookAwayYaw(
  monsterX: number,
  monsterZ: number,
  targetX: number,
  targetZ: number,
  avoidDir: 1 | -1
): number {
  const toTargetYaw = Math.atan2(targetX - monsterX, targetZ - monsterZ);
  return normalizeAngle(toTargetYaw + avoidDir * 2.15);
}

