import * as THREE from 'three';

export interface TextureBundle {
  tileAlbedo: THREE.CanvasTexture;
  tileBump: THREE.CanvasTexture;
  tileRoughness: THREE.CanvasTexture;
  wallAlbedo: THREE.CanvasTexture;
  wallBump: THREE.CanvasTexture;
  concreteAlbedo: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  cautionAlbedo: THREE.CanvasTexture;
  metalAlbedo: THREE.CanvasTexture;
  metalBump: THREE.CanvasTexture;
  woodAlbedo: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  woodRoughness: THREE.CanvasTexture;
  ceilingAlbedo: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  monsterSkin: THREE.CanvasTexture;
  monsterBump: THREE.CanvasTexture;
  monsterNormal: THREE.CanvasTexture;
  monsterRoughness: THREE.CanvasTexture;
  monsterEmissive: THREE.CanvasTexture;
  monsterFinSkin: THREE.CanvasTexture;
  monsterFinEmissive: THREE.CanvasTexture;
  monsterEye: THREE.CanvasTexture;
  readonly compact?: boolean;
  setAnisotropy: (maxAniso: number) => void;
  markAllDirty?: () => void;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  maxAniso: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAniso: number, compact = false): TextureBundle {
  const aniso = Math.min(compact ? 4 : 8, Math.max(1, maxAniso));
  const texSize = compact ? 256 : 512;
  const texScale = texSize / 512;

  // 1. Aged, Cracked & Damp Ceramic Pool Tile Albedo + Bump + Roughness (512 desktop / 256 compact)
  const [tileCanvas, tCtx] = makeCanvas(texSize);
  const [bumpCanvas, bCtx] = makeCanvas(texSize);
  const [roughCanvas, rCtx] = makeCanvas(texSize);

  tCtx.fillStyle = '#1e2628'; // dark mold-stained mineral grout
  tCtx.fillRect(0, 0, texSize, texSize);
  bCtx.fillStyle = '#181818'; // deeply recessed grout
  bCtx.fillRect(0, 0, texSize, texSize);
  rCtx.fillStyle = '#e2e2e2'; // matte rough grout
  rCtx.fillRect(0, 0, texSize, texSize);

  const cells = 8;
  const step = texSize / cells;
  const gap = 4.5 * texScale;

  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const x = col * step + gap * 0.5;
      const y = row * step + gap * 0.5;
      const w = step - gap;
      const h = step - gap;
      const cellHash = Math.abs(Math.sin(row * 17.31 + col * 31.17) * 43758.5453) % 1;

      // Aged damp porcelain with subtle grime & mineral discoloration
      const shade = 112 + Math.floor(Math.sin(row * 13.7 + col * 7.3) * 14);
      const blueShift = Math.floor(Math.cos(row * 5.1 - col * 9.7) * 6);
      const grimeTint = cellHash > 0.72 ? 12 : 0;
      const grad = tCtx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, `rgb(${shade - 6 + grimeTint}, ${shade + 4 + Math.floor(grimeTint * 0.6)}, ${shade + 7 + blueShift})`);
      grad.addColorStop(1, `rgb(${shade - 18 + grimeTint}, ${shade - 7}, ${shade - 3 + blueShift})`);
      tCtx.fillStyle = grad;
      tCtx.fillRect(x, y, w, h);

      // Subtle worn glazed bevel rim
      tCtx.strokeStyle = 'rgba(195, 215, 220, 0.22)';
      tCtx.lineWidth = Math.max(1, 1.5 * texScale);
      tCtx.strokeRect(x + texScale, y + texScale, w - 2 * texScale, h - 2 * texScale);
      tCtx.strokeStyle = 'rgba(12, 18, 20, 0.38)';
      tCtx.lineWidth = Math.max(0.75, texScale);
      tCtx.strokeRect(x + 0.5 * texScale, y + 0.5 * texScale, w - texScale, h - texScale);

      // Bump: raised tile face with chamfered edge
      bCtx.fillStyle = '#868686';
      bCtx.fillRect(x, y, w, h);
      bCtx.fillStyle = '#dfdfdf';
      bCtx.fillRect(x + 2 * texScale, y + 2 * texScale, w - 4 * texScale, h - 4 * texScale);

      // Hairline cracks & chipped corners on select worn tiles
      if (cellHash > 0.78) {
        const cx0 = x + w * (0.2 + (cellHash * 7 % 1) * 0.5);
        const cy0 = y + (cellHash > 0.89 ? 0 : h * 0.2);
        const cx1 = x + w * (0.35 + (cellHash * 13 % 1) * 0.5);
        const cy1 = y + h * 0.55;
        const cx2 = x + w * (0.15 + (cellHash * 19 % 1) * 0.65);
        const cy2 = y + h * 0.94;
        tCtx.strokeStyle = 'rgba(18, 24, 26, 0.72)';
        tCtx.lineWidth = Math.max(0.8, 1.3 * texScale);
        tCtx.beginPath();
        tCtx.moveTo(cx0, cy0);
        tCtx.lineTo(cx1, cy1);
        tCtx.lineTo(cx2, cy2);
        tCtx.stroke();

        bCtx.strokeStyle = '#202020';
        bCtx.lineWidth = Math.max(1, 1.6 * texScale);
        bCtx.beginPath();
        bCtx.moveTo(cx0, cy0);
        bCtx.lineTo(cx1, cy1);
        bCtx.lineTo(cx2, cy2);
        bCtx.stroke();
      } else if (cellHash < 0.09) {
        // Chipped missing tile corner revealing dark mortar bed
        tCtx.fillStyle = '#2a3235';
        tCtx.beginPath();
        tCtx.moveTo(x, y);
        tCtx.lineTo(x + w * 0.36, y);
        tCtx.lineTo(x, y + h * 0.34);
        tCtx.closePath();
        tCtx.fill();
        bCtx.fillStyle = '#242424';
        bCtx.beginPath();
        bCtx.moveTo(x, y);
        bCtx.lineTo(x + w * 0.36, y);
        bCtx.lineTo(x, y + h * 0.34);
        bCtx.closePath();
        bCtx.fill();
      }

      // Roughness: glistening wet puddles vs damp/chalky ceramic
      const puddle = Math.sin(row * 2.7 + col * 4.3) * 0.5 + 0.5;
      const roughVal = Math.round(28 + puddle * 68);
      rCtx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
      rCtx.fillRect(x, y, w, h);
    }
  }

  // Organic damp calcification, black mold & standing puddle blotches across tiles
  const blotchCount = compact ? 52 : 84;
  for (let i = 0; i < blotchCount; i++) {
    const gx = ((i * 97 + 19) % 512) * texScale;
    const gy = ((i * 53 + 31) % 512) * texScale;
    const gr = (16 + (i % 38)) * texScale;
    const g2 = tCtx.createRadialGradient(gx, gy, 2 * texScale, gx, gy, gr);
    if (i % 4 === 0) {
      g2.addColorStop(0, 'rgba(34, 24, 16, 0.22)'); // rust/mineral grime
      g2.addColorStop(1, 'rgba(34, 24, 16, 0)');
    } else if (i % 3 === 0) {
      g2.addColorStop(0, 'rgba(10, 18, 18, 0.30)'); // dark mildew
      g2.addColorStop(1, 'rgba(10, 18, 18, 0)');
    } else {
      g2.addColorStop(0, 'rgba(130, 150, 152, 0.10)'); // lime mineral ring
      g2.addColorStop(1, 'rgba(38, 52, 54, 0)');
    }
    tCtx.fillStyle = g2;
    tCtx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);

    if (i % 2 === 0) {
      const rg = rCtx.createRadialGradient(gx, gy, 2 * texScale, gx, gy, gr);
      rg.addColorStop(0, 'rgba(18, 18, 18, 0.58)');
      rg.addColorStop(1, 'rgba(18, 18, 18, 0)');
      rCtx.fillStyle = rg;
      rCtx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
  }

  // 2. Wall Larger Weathered Ceramic Masonry Tile Albedo + Bump (512 desktop / 256 compact)
  const [wallCanvas, wCtx] = makeCanvas(texSize);
  const [wallBumpCanvas, wbCtx] = makeCanvas(texSize);
  wCtx.fillStyle = '#1b2224';
  wCtx.fillRect(0, 0, texSize, texSize);
  wbCtx.fillStyle = '#181818';
  wbCtx.fillRect(0, 0, texSize, texSize);

  const wCols = 4;
  const wRows = 8;
  const wW = texSize / wCols;
  const wH = texSize / wRows;
  for (let r = 0; r < wRows; r++) {
    for (let c = 0; c < wCols; c++) {
      const offset = (r % 2) * (wW * 0.5);
      const x = (c * wW + offset) % texSize;
      const v = 94 + Math.floor(Math.sin(r * 9.3 + c * 4.7) * 12);
      const brickSeed = Math.abs(Math.sin(r * 19.1 + c * 41.7) * 9173.1) % 1;
      const drawWallBrick = (bx: number) => {
        if (brickSeed > 0.94) {
          // Missing fallen wall brick revealing dark rough mortar backing
          wCtx.fillStyle = '#252c2e';
          wCtx.fillRect(bx + 2 * texScale, r * wH + 2 * texScale, wW - 4 * texScale, wH - 4 * texScale);
          wbCtx.fillStyle = '#282828';
          wbCtx.fillRect(bx + 2 * texScale, r * wH + 2 * texScale, wW - 4 * texScale, wH - 4 * texScale);
          return;
        }
        const g = wCtx.createLinearGradient(bx, r * wH, bx, r * wH + wH);
        g.addColorStop(0, `rgb(${v - 4}, ${v + 4}, ${v + 7})`);
        g.addColorStop(1, `rgb(${v - 16}, ${v - 6}, ${v - 3})`);
        wCtx.fillStyle = g;
        wCtx.fillRect(bx + 2 * texScale, r * wH + 2 * texScale, wW - 4 * texScale, wH - 4 * texScale);
        wCtx.strokeStyle = 'rgba(185, 205, 210, 0.14)';
        wCtx.lineWidth = Math.max(1, 1.4 * texScale);
        wCtx.strokeRect(bx + 3 * texScale, r * wH + 3 * texScale, wW - 6 * texScale, wH - 6 * texScale);

        wbCtx.fillStyle = '#888888';
        wbCtx.fillRect(bx + 2 * texScale, r * wH + 2 * texScale, wW - 4 * texScale, wH - 4 * texScale);
        wbCtx.fillStyle = '#dcdcdc';
        wbCtx.fillRect(bx + 4 * texScale, r * wH + 4 * texScale, wW - 8 * texScale, wH - 8 * texScale);
      };
      drawWallBrick(x);
      if (x + wW > texSize) drawWallBrick(x - texSize);
    }
  }
  // Heavy damp black-mold water-line staining & vertical rust/sludge drip streaks
  const dampStart = 180 * texScale;
  const dampGrad = wCtx.createLinearGradient(0, dampStart, 0, texSize);
  dampGrad.addColorStop(0, 'rgba(10, 18, 20, 0)');
  dampGrad.addColorStop(0.55, 'rgba(10, 17, 18, 0.34)');
  dampGrad.addColorStop(1, 'rgba(6, 11, 12, 0.66)');
  wCtx.fillStyle = dampGrad;
  wCtx.fillRect(0, dampStart, texSize, texSize - dampStart);
  for (let i = 0; i < 32; i++) {
    const sx = ((i * 41 + 13) % 512) * texScale;
    const isRust = i % 5 === 0;
    const sg = wCtx.createLinearGradient(sx, 0, sx, texSize);
    if (isRust) {
      sg.addColorStop(0, 'rgba(38, 18, 12, 0)');
      sg.addColorStop(0.45, 'rgba(38, 18, 12, 0.22)');
      sg.addColorStop(1, 'rgba(22, 12, 9, 0.38)');
    } else {
      sg.addColorStop(0, 'rgba(10, 18, 19, 0)');
      sg.addColorStop(0.5, 'rgba(10, 18, 19, 0.18)');
      sg.addColorStop(1, 'rgba(6, 12, 13, 0.36)');
    }
    wCtx.fillStyle = sg;
    wCtx.fillRect(sx, 0, (4 + (i % 6)) * texScale, texSize);
  }

  // 3. Weathered Brutalist Cast Concrete Albedo + Bump (512 desktop / 256 compact)
  const [concCanvas, cCtx] = makeCanvas(texSize);
  const [concBumpCanvas, cbCtx] = makeCanvas(texSize);
  cCtx.fillStyle = '#475053';
  cCtx.fillRect(0, 0, texSize, texSize);
  cbCtx.fillStyle = '#888888';
  cbCtx.fillRect(0, 0, texSize, texSize);

  const concImg = cCtx.getImageData(0, 0, texSize, texSize);
  const concBumpImg = cbCtx.getImageData(0, 0, texSize, texSize);
  const cData = concImg.data;
  const cbData = concBumpImg.data;
  const concSpecks = compact ? 2400 : 4800;
  for (let i = 0; i < concSpecks; i++) {
    const pxBase = (((i * 73) % 512) * texScale) | 0;
    const pyBase = (((i * 139) % 512) * texScale) | 0;
    const sz = Math.max(1, ((2 + (i % 4)) * texScale + 0.5) | 0);
    const v = 52 + ((i * 29) % 44);
    const bv = 92 + ((i * 37) % 68);
    const yEnd = Math.min(texSize, pyBase + sz);
    const xEnd = Math.min(texSize, pxBase + sz);
    for (let y = pyBase; y < yEnd; y++) {
      const rowOff = y * texSize;
      for (let x = pxBase; x < xEnd; x++) {
        const p4 = (rowOff + x) * 4;
        cData[p4] = ((cData[p4] * 176 + v * 80) >> 8);
        cData[p4 + 1] = ((cData[p4 + 1] * 176 + (v + 4) * 80) >> 8);
        cData[p4 + 2] = ((cData[p4 + 2] * 176 + (v + 6) * 80) >> 8);
        cbData[p4] = cbData[p4 + 1] = cbData[p4 + 2] = ((cbData[p4] * 135 + bv * 121) >> 8);
      }
    }
  }
  cCtx.putImageData(concImg, 0, 0);
  cbCtx.putImageData(concBumpImg, 0, 0);
  // Formwork panel seams, damp mold patches & rebar rust-weeping tie-rod dimples
  cCtx.strokeStyle = 'rgba(14, 20, 22, 0.52)';
  cCtx.lineWidth = Math.max(1.5, 3 * texScale);
  cbCtx.strokeStyle = '#2a2a2a';
  cbCtx.lineWidth = Math.max(2, 4 * texScale);
  for (const pos of [0, texSize * 0.5]) {
    cCtx.beginPath();
    cCtx.moveTo(0, pos);
    cCtx.lineTo(texSize, pos);
    cCtx.moveTo(pos, 0);
    cCtx.lineTo(pos, texSize);
    cCtx.stroke();

    cbCtx.beginPath();
    cbCtx.moveTo(0, pos);
    cbCtx.lineTo(texSize, pos);
    cbCtx.moveTo(pos, 0);
    cbCtx.lineTo(pos, texSize);
    cbCtx.stroke();
  }
  const tieRadius = 5 * texScale;
  for (const ty of [64 * texScale, 192 * texScale, 320 * texScale, 448 * texScale]) {
    for (const tx of [64 * texScale, 192 * texScale, 320 * texScale, 448 * texScale]) {
      // Rust weeping streak below tie-rod dimple
      const rustStreak = cCtx.createLinearGradient(tx, ty, tx, ty + 48 * texScale);
      rustStreak.addColorStop(0, 'rgba(66, 30, 16, 0.36)');
      rustStreak.addColorStop(1, 'rgba(34, 18, 12, 0)');
      cCtx.fillStyle = rustStreak;
      cCtx.fillRect(tx - 4 * texScale, ty, 8 * texScale, 48 * texScale);

      cCtx.fillStyle = 'rgba(16, 22, 24, 0.62)';
      cCtx.beginPath();
      cCtx.arc(tx, ty, tieRadius, 0, Math.PI * 2);
      cCtx.fill();
      cbCtx.fillStyle = '#181818';
      cbCtx.beginPath();
      cbCtx.arc(tx, ty, tieRadius, 0, Math.PI * 2);
      cbCtx.fill();
    }
  }
  // Hairline concrete stress cracks
  cCtx.strokeStyle = 'rgba(14, 18, 20, 0.55)';
  cCtx.lineWidth = Math.max(1, 1.4 * texScale);
  cbCtx.strokeStyle = '#222222';
  cbCtx.lineWidth = Math.max(1, 1.8 * texScale);
  for (let i = 0; i < 6; i++) {
    const sx = ((i * 89 + 40) % 440 + 30) * texScale;
    const sy = ((i * 113 + 20) % 400 + 20) * texScale;
    cCtx.beginPath();
    cCtx.moveTo(sx, sy);
    cCtx.lineTo(sx + 28 * texScale, sy + 42 * texScale);
    cCtx.lineTo(sx + 14 * texScale, sy + 88 * texScale);
    cCtx.stroke();
    cbCtx.beginPath();
    cbCtx.moveTo(sx, sy);
    cbCtx.lineTo(sx + 28 * texScale, sy + 42 * texScale);
    cbCtx.lineTo(sx + 14 * texScale, sy + 88 * texScale);
    cbCtx.stroke();
  }

  // 4. Weathered, Scuffed Industrial Caution Deck Trim (512 desktop / 256 compact)
  const [cautCanvas, caCtx] = makeCanvas(texSize);
  caCtx.fillStyle = '#50585b';
  caCtx.fillRect(0, 0, texSize, texSize);
  caCtx.fillStyle = '#191f22';
  const cStep = 64 * texScale;
  const cSpan = 1024 * texScale;
  for (let i = -texSize; i < cSpan; i += cStep) {
    caCtx.beginPath();
    caCtx.moveTo(i, 0);
    caCtx.lineTo(i + 32 * texScale, 0);
    caCtx.lineTo(i - 48 * texScale, 92 * texScale);
    caCtx.lineTo(i - 80 * texScale, 92 * texScale);
    caCtx.closePath();
    caCtx.fill();
  }
  caCtx.fillStyle = '#997024';
  caCtx.fillRect(0, 0, texSize, 22 * texScale);
  caCtx.fillStyle = '#171d1f';
  caCtx.fillRect(0, 90 * texScale, texSize, 6 * texScale);
  // Perforated industrial deck panels + oil/rust grime
  caCtx.strokeStyle = '#293235';
  caCtx.lineWidth = Math.max(2, 4 * texScale);
  const deckStart = 96 * texScale;
  const deckStep = 128 * texScale;
  for (let i = 0; i <= texSize; i += deckStep) {
    caCtx.beginPath();
    caCtx.moveTo(i, deckStart);
    caCtx.lineTo(i, texSize);
    caCtx.stroke();
    caCtx.beginPath();
    caCtx.moveTo(0, Math.max(deckStart, i));
    caCtx.lineTo(texSize, Math.max(deckStart, i));
    caCtx.stroke();
  }
  for (let i = 0; i < 28; i++) {
    const gx = ((i * 67 + 11) % 512) * texScale;
    const gy = ((i * 43 + 7) % 512) * texScale;
    const gr = (12 + (i % 24)) * texScale;
    const g = caCtx.createRadialGradient(gx, gy, 1, gx, gy, gr);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(42, 22, 12, 0.36)' : 'rgba(14, 18, 20, 0.34)');
    g.addColorStop(1, 'rgba(14, 18, 20, 0)');
    caCtx.fillStyle = g;
    caCtx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }

  // 5. Oxidized / Tarnished Diamond-Plate Stainless Catwalk Metal Albedo + Bump (256x256)
  const [metalCanvas, mCtx] = makeCanvas(256);
  const [metalBumpCanvas, mbCtx] = makeCanvas(256);
  mCtx.fillStyle = '#6f7c80';
  mCtx.fillRect(0, 0, 256, 256);
  mbCtx.fillStyle = '#707070';
  mbCtx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    const lum = 104 + Math.floor(Math.sin(y * 0.9) * 14);
    mCtx.fillStyle = `rgb(${lum}, ${lum + 5}, ${lum + 9})`;
    mCtx.fillRect(0, y, 256, 1);
  }
  // Raised non-slip diamond tread lozenges
  const stepM = 32;
  for (let y = 0; y < 256; y += stepM) {
    for (let x = 0; x < 256; x += stepM) {
      const horiz = ((x / stepM + y / stepM) & 1) === 0;
      const cx = x + stepM * 0.5;
      const cy = y + stepM * 0.5;
      mCtx.save();
      mCtx.translate(cx, cy);
      mCtx.rotate(horiz ? Math.PI / 4 : -Math.PI / 4);
      mCtx.fillStyle = 'rgba(165, 180, 185, 0.32)';
      mCtx.fillRect(-8, -2.5, 16, 5);
      mCtx.restore();

      mbCtx.save();
      mbCtx.translate(cx, cy);
      mbCtx.rotate(horiz ? Math.PI / 4 : -Math.PI / 4);
      mbCtx.fillStyle = '#f0f0f0';
      mbCtx.fillRect(-8, -2.5, 16, 5);
      mbCtx.restore();
    }
  }
  for (let i = 0; i < 18; i++) {
    const rx = (i * 59 + 17) % 256;
    const ry = (i * 97 + 23) % 256;
    const rg = mCtx.createRadialGradient(rx, ry, 2, rx, ry, 18 + (i % 14));
    rg.addColorStop(0, 'rgba(56, 28, 16, 0.28)');
    rg.addColorStop(1, 'rgba(56, 28, 16, 0)');
    mCtx.fillStyle = rg;
    mCtx.fillRect(rx - 32, ry - 32, 64, 64);
  }

  // 6. Ceiling Water-Damaged Acoustic / Concrete Coffer Grid (256x256)
  const [ceilCanvas, ceCtx] = makeCanvas(256);
  ceCtx.fillStyle = '#1e2528';
  ceCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      const tone = 34 + (((x * 7 + y * 13) >> 5) % 8);
      ceCtx.fillStyle = `rgb(${tone}, ${tone + 6}, ${tone + 9})`;
      ceCtx.fillRect(x + 4, y + 4, 56, 56);
      ceCtx.strokeStyle = '#111618';
      ceCtx.lineWidth = 4;
      ceCtx.strokeRect(x + 2, y + 2, 60, 60);
    }
  }
  for (let i = 0; i < 12; i++) {
    const lx = (i * 71 + 19) % 256;
    const ly = (i * 107 + 31) % 256;
    const lg = ceCtx.createRadialGradient(lx, ly, 4, lx, ly, 28 + (i % 16));
    lg.addColorStop(0, 'rgba(10, 14, 15, 0.48)');
    lg.addColorStop(1, 'rgba(10, 14, 15, 0)');
    ceCtx.fillStyle = lg;
    ceCtx.fillRect(lx - 44, ly - 44, 88, 88);
  }

  // 7. Procedural Water Normal Map (512 desktop / 256 compact)
  const wnSize = compact ? 256 : 512;
  const wnTauStep = (Math.PI * 2) / wnSize;
  const [wnCanvas, wnCtx] = makeCanvas(wnSize);
  const imgData = wnCtx.createImageData(wnSize, wnSize);
  const data = imgData.data;
  for (let y = 0; y < wnSize; y++) {
    const v = y * wnTauStep;
    const rowOff = y * wnSize;
    for (let x = 0; x < wnSize; x++) {
      const u = x * wnTauStep;
      const dx =
        Math.cos(u * 3 + v * 2) * 0.38 +
        Math.cos(u * 7 - v * 5) * 0.24 +
        Math.sin(u * 13 + v * 9) * 0.14 +
        Math.cos(u * 21 - v * 17) * 0.08;
      const dy =
        Math.sin(u * 2 - v * 4) * 0.38 +
        Math.cos(u * 5 + v * 8) * 0.24 +
        Math.cos(u * 11 - v * 13) * 0.14 +
        Math.sin(u * 19 + v * 23) * 0.08;
      const idx = (rowOff + x) * 4;
      data[idx] = Math.floor((dx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor((dy * 0.5 + 0.5) * 255);
      data[idx + 2] = 242;
      data[idx + 3] = 255;
    }
  }
  wnCtx.putImageData(imgData, 0, 0);

  // 8. AAA Giant Sea Serpent PBR Albedo, Tangent-Space Normal, Subtle Accent Emissive & Wet Roughness Maps
  // UV convention on continuous body:
  //   u = 0.0 / 1.0 -> dorsal spine ridge (top)
  //   u = 0.25 / 0.75 -> muscular lateral flanks
  //   u = 0.5 -> ventral belly scutes (underside)
  const monSize = compact ? 256 : 384;
  const [monCanvas, monCtx] = makeCanvas(monSize);
  const [monNormalCanvas, monNormalCtx] = makeCanvas(monSize);
  const [monRoughCanvas, monRoughCtx] = makeCanvas(monSize);
  const [monEmissiveCanvas, monEmissiveCtx] = makeCanvas(monSize);

  const heightField = new Float32Array(monSize * monSize);
  const monAlbedoData = monCtx.createImageData(monSize, monSize);
  const monRoughData = monRoughCtx.createImageData(monSize, monSize);
  const monEmisData = monEmissiveCtx.createImageData(monSize, monSize);
  const aPix = monAlbedoData.data;
  const rPix = monRoughData.data;
  const ePix = monEmisData.data;
  const clampByte = (v: number): number => (v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0);

  // Deterministic fast 2D hash / value noise for organic skin mottling & micro-pores
  const inv2e32 = 1 / 4294967295;
  const hash2 = (ix: number, iy: number): number => {
    let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) * inv2e32;
  };
  const smoothNoise = (x: number, y: number, periodX: number, periodY: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    let x0 = ix % periodX;
    if (x0 < 0) x0 += periodX;
    const x1 = x0 + 1 >= periodX ? 0 : x0 + 1;
    let y0 = iy % periodY;
    if (y0 < 0) y0 += periodY;
    const y1 = y0 + 1 >= periodY ? 0 : y0 + 1;
    const a = hash2(x0, y0);
    const b = hash2(x1, y0);
    const c = hash2(x0, y1);
    const d = hash2(x1, y1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  const fbm = (u: number, v: number, baseFreqX: number, baseFreqY: number, octaves = 4): number => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < octaves; o++) {
      const px = baseFreqX * freq;
      const py = baseFreqY * freq;
      sum += amp * smoothNoise(u * px, v * py, px, py);
      amp *= 0.5;
      freq *= 2;
    }
    return sum;
  };

  // Pre-generate jagged lightning-like electric-blue vein segments & natural scars
  const scars = [
    { u: 0.21, v: 0.16, du: 0.08, dv: 0.045, w: 0.0052 },
    { u: 0.78, v: 0.33, du: -0.065, dv: 0.055, w: 0.0048 },
    { u: 0.18, v: 0.61, du: 0.055, dv: -0.04, w: 0.0045 },
    { u: 0.81, v: 0.77, du: -0.075, dv: -0.045, w: 0.0055 },
  ];

  const scaleCols = 52;
  const scaleRows = 64;
  const bellyPlateRows = 6; // 6 * repeatY(7) = 42 plates aligned 1-to-1 with 3D sculpted chevron scutes
  const invMonSize = 1 / monSize;
  const scarMeta = scars.map((sc) => ({
    ...sc,
    len2: sc.du * sc.du + sc.dv * sc.dv,
    vMin: Math.min(sc.v, sc.v + sc.dv) - sc.w * 1.5,
    vMax: Math.max(sc.v, sc.v + sc.dv) + sc.w * 1.5,
  }));
  const activeScars: typeof scarMeta = [];

  for (let py = 0; py < monSize; py++) {
    const v = py * invMonSize;
    const rowOff = py * monSize;
    const rowF = v * scaleRows;
    const rowI = Math.floor(rowF);
    const colShift = (rowI & 1) * 0.5;
    activeScars.length = 0;
    for (let s = 0; s < scarMeta.length; s++) {
      const sc = scarMeta[s];
      if (v >= sc.vMin && v <= sc.vMax) activeScars.push(sc);
    }

    for (let px = 0; px < monSize; px++) {
      const u = px * invMonSize;
      const idx = rowOff + px;
      const p4 = idx * 4;

      // Distance from ventral belly centerline (u = 0.5)
      const bellyDist = Math.abs(u - 0.5);
      // Prominent armored chevron belly scutes across u=[0.33..0.67] matching SERPENTIS icon
      const bellyMask = Math.max(0, Math.min(1, (0.175 - bellyDist) / 0.032));
      const bellyBorderArg = (bellyDist - 0.17) * (1 / 0.018);
      const bellyBorder = Math.exp(-(bellyBorderArg * bellyBorderArg));
      const dorsalFactor = Math.cos(u * Math.PI * 2) * 0.5 + 0.5; // 1 at dorsal u=0/1, 0 at belly u=0.5

      // Organic dark-crimson micro-grain & subtle pelagic shading
      const nLow = fbm(u, v, 8, 8, compact ? 2 : 4);
      const nHigh = fbm(u, v, 32, 32, compact ? 2 : 3);
      const nVein = fbm(u, v, 16, 16, compact ? 2 : 3);
      const bandWave = Math.sin(v * Math.PI * 8 + (nLow - 0.5) * 2.4) * 0.5 + 0.5;

      // 1) Sharp overlapping keeled dorsal/flank scales
      const colF = u * scaleCols + colShift;
      const colI = Math.floor(colF);

      let bestScaleDist = 99;
      let bestLx = 0;
      let bestLy = 0;
      let bestSeed = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const rr = rowI + dr;
        const rShift = (rr & 1) * 0.5;
        const wr = ((rr % scaleRows) + scaleRows) % scaleRows;
        const ly = rowF - (rr + 0.5);
        const shieldW = 0.54 - Math.max(0, ly) * 0.26;
        const invShieldW = 1 / shieldW;
        const lyMetric = Math.abs(ly) * 0.96;
        for (let dc = -1; dc <= 1; dc++) {
          const cc = colI + dc;
          const lx = colF - (cc + 0.5 - rShift + colShift);
          const d = Math.abs(lx) * invShieldW + lyMetric;
          if (d < bestScaleDist) {
            bestScaleDist = d;
            bestLx = lx;
            bestLy = ly;
            const wc = ((cc % scaleCols) + scaleCols) % scaleCols;
            bestSeed = hash2(wc, wr);
          }
        }
      }

      // Scale crown + sharp central ridge keel + deep dark overlap pockets
      const edgeFalloff = Math.max(0, Math.min(1, (0.98 - bestScaleDist) / 0.22));
      const crownDome = Math.sqrt(edgeFalloff);
      const keel =
        Math.exp(-(bestLx * bestLx) / 0.008) *
        Math.max(0, 1 - Math.abs(bestLy) * 1.35) *
        edgeFalloff;
      const scaleMicro = (nHigh - 0.5) * 0.1;
      const scaleHeight = Math.max(0, Math.min(1, crownDome * 0.65 + keel * 0.4 + scaleMicro));

      // 2) Bold overlapping V-chevron armored ventral belly plates (matching icon underside 1-to-1)
      const chevronOffset = bellyDist * 6.0;
      const plateCoord = v * bellyPlateRows + chevronOffset + (nLow - 0.5) * 0.08;
      const platePhase = plateCoord - Math.floor(plateCoord);
      const plateGroove = Math.min(platePhase, 1 - platePhase);
      const plateBevel = Math.sqrt(Math.max(0, Math.min(1, plateGroove / 0.13)));
      const bellyPlateH =
        plateBevel * 0.78 +
        (1 - platePhase) * 0.2 +
        (nHigh - 0.5) * 0.04;

      // Blend obsidian flank scales with stepped chevron armor plates
      let h = scaleHeight * (1 - bellyMask) + bellyPlateH * bellyMask;

      // Biological scars / battle nicks
      let scarAmount = 0;
      for (let s = 0; s < activeScars.length; s++) {
        const sc = activeScars[s];
        const rx = u - sc.u;
        const ry = v - sc.v;
        const t = Math.max(0, Math.min(1, (rx * sc.du + ry * sc.dv) / sc.len2));
        const pxS = rx - sc.du * t;
        const pyS = ry - sc.dv * t;
        const distSq = pxS * pxS + pyS * pyS;
        const taper = Math.sin(t * Math.PI);
        const w = sc.w * (0.35 + 0.65 * taper);
        if (distSq < w * w) {
          const k = 1 - Math.sqrt(distSq) / w;
          scarAmount = Math.max(scarAmount, k * taper);
        }
      }
      h = Math.max(0.02, h - scarAmount * 0.35);
      heightField[idx] = h;

      // Dominant Albedo Color: Deep Blood Red & Dark Crimson Armored Scales (with dark crimson-black overlap pockets)
      const jitter = (bestSeed - 0.5) * 16 + (nHigh - 0.5) * 14;
      const pocketDark = 0.22 + 0.78 * Math.min(1, edgeFalloff * 1.18);
      const bandShade = 0.8 + bandWave * 0.28;

      // Deep dark crimson dorsal -> rich blood-red flanks
      let rCol = (92 + (1 - dorsalFactor) * 32 + jitter * 1.1) * bandShade * pocketDark;
      let gCol = (10 + (1 - dorsalFactor) * 4 + jitter * 0.22) * bandShade * pocketDark;
      let bCol = (14 + (1 - dorsalFactor) * 5 + jitter * 0.26) * bandShade * pocketDark;

      // Wet blood-crimson specular keel ridge highlight
      rCol += keel * 28;
      gCol += keel * 5;
      bCol += keel * 6;

      // Chevron armored belly scutes (deep dark crimson-oxblood plates with dark blood crevices)
      const plateShadow = 0.24 + 0.76 * Math.min(1, plateGroove / 0.14) * (0.76 + 0.24 * (1 - platePhase));
      const bellyR = (84 + (nLow - 0.5) * 18 + (nHigh - 0.5) * 12) * plateShadow;
      const bellyG = (12 + (nLow - 0.5) * 4 + (nHigh - 0.5) * 3) * plateShadow;
      const bellyB = (15 + (nLow - 0.5) * 5 + (nHigh - 0.5) * 3) * plateShadow;

      rCol = rCol * (1 - bellyMask) + bellyR * bellyMask;
      gCol = gCol * (1 - bellyMask) + bellyG * bellyMask;
      bCol = bCol * (1 - bellyMask) + bellyB * bellyMask;

      // Deep healed crimson-maroon scar tissue
      if (scarAmount > 0.01) {
        rCol = rCol * (1 - scarAmount * 0.65) + 64 * (scarAmount * 0.65);
        gCol = gCol * (1 - scarAmount * 0.65) + 15 * (scarAmount * 0.65);
        bCol = bCol * (1 - scarAmount * 0.65) + 18 * (scarAmount * 0.65);
      }

      // Electric-Blue Lightning / Bioluminescent Accents in EXACT SERPENTIS icon locations & shapes:
      // 1) Lateral seam bordering the chevron belly plates
      // 2) Upper neck & dorsal-flank crevices just beneath the dorsal spikes
      // 3) Jagged lateral flank lightning forks & select belly plate seams
      const veinRidge = Math.max(0, 1 - Math.abs(nVein - 0.5) * 24);
      const pulseWindow = Math.pow(Math.max(0, Math.sin(v * Math.PI * 6 + nLow * 4.5)), 4);
      const seamVein = bellyBorder * veinRidge * (0.48 + 0.52 * pulseWindow);
      const dorsalNeckVein =
        (1 - bellyMask) *
        Math.exp(-Math.pow((dorsalFactor - 0.84) / 0.14, 2)) *
        Math.pow(veinRidge, 1.25) *
        (0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(v * Math.PI * 4.5 + 0.6)), 3));
      const flankCreviceVein =
        (1 - bellyMask) *
        Math.exp(-Math.pow((bellyDist - 0.26) / 0.06, 2)) *
        Math.pow(veinRidge, 1.35) *
        pulseWindow;
      const plateCrackVein =
        bellyMask *
        Math.max(0, 1 - plateGroove * 18) *
        Math.pow(Math.max(0, Math.sin(v * Math.PI * 5 + u * 8)), 9);
      const blueVein = Math.min(
        1,
        seamVein * 1.15 + dorsalNeckVein * 1.1 + flankCreviceVein * 1.1 + plateCrackVein * 0.8
      );

      if (blueVein > 0.03) {
        const blueMix = Math.min(1, blueVein * 1.18);
        rCol = rCol * (1 - blueMix) + 22 * blueMix;
        gCol = gCol * (1 - blueMix * 0.85) + 148 * blueMix;
        bCol = bCol * (1 - blueMix * 0.55) + 255 * blueMix;
      }

      aPix[p4] = clampByte(rCol);
      aPix[p4 + 1] = clampByte(gCol);
      aPix[p4 + 2] = clampByte(bCol);
      aPix[p4 + 3] = 255;

      // Emissive map: pure black everywhere except exact electric-blue lightning areas
      if (blueVein > 0.05) {
        const core = Math.pow(blueVein, 1.28);
        ePix[p4] = clampByte(24 * core);
        ePix[p4 + 1] = clampByte(152 * core);
        ePix[p4 + 2] = clampByte(255 * blueVein);
      } else {
        ePix[p4] = 0;
        ePix[p4 + 1] = 0;
        ePix[p4 + 2] = 0;
      }
      ePix[p4 + 3] = 255;

      // Wet storm-drenched skin roughness: slick glossy scale crowns & plate bevels, matte crevices
      const wetCrown = (1 - edgeFalloff) * (1 - bellyMask) * 96;
      const grooveMatte = bellyMask * (1 - Math.min(1, plateGroove / 0.12)) * 88;
      const scarMatte = scarAmount * 84;
      const roughRaw = (32 + wetCrown + grooveMatte + scarMatte + (nHigh - 0.5) * 24) | 0;
      const roughVal = roughRaw < 22 ? 22 : roughRaw > 210 ? 210 : roughRaw;
      rPix[p4] = roughVal;
      rPix[p4 + 1] = roughVal;
      rPix[p4 + 2] = roughVal;
      rPix[p4 + 3] = 255;
    }
  }
  monCtx.putImageData(monAlbedoData, 0, 0);
  monRoughCtx.putImageData(monRoughData, 0, 0);
  monEmissiveCtx.putImageData(monEmisData, 0, 0);

  // Convert heightField -> Seamless Tangent-Space Normal Map via Sobel gradients
  const monNormalData = monNormalCtx.createImageData(monSize, monSize);
  const nPix = monNormalData.data;
  const normalStrength = 5.6;
  for (let py = 0; py < monSize; py++) {
    const pyU = (py - 1 + monSize) % monSize;
    const pyD = (py + 1) % monSize;
    const rowU = pyU * monSize;
    const rowC = py * monSize;
    const rowD = pyD * monSize;
    for (let px = 0; px < monSize; px++) {
      const pxL = (px - 1 + monSize) % monSize;
      const pxR = (px + 1) % monSize;
      const tl = heightField[rowU + pxL];
      const t = heightField[rowU + px];
      const tr = heightField[rowU + pxR];
      const l = heightField[rowC + pxL];
      const r = heightField[rowC + pxR];
      const bl = heightField[rowD + pxL];
      const b = heightField[rowD + px];
      const br = heightField[rowD + pxR];

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * normalStrength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * normalStrength;
      const nx = -dX;
      const ny = -dY;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + 1);

      const p4 = (rowC + px) * 4;
      nPix[p4] = clampByte((nx * invLen * 0.5 + 0.5) * 255);
      nPix[p4 + 1] = clampByte((ny * invLen * 0.5 + 0.5) * 255);
      nPix[p4 + 2] = clampByte((invLen * 0.5 + 0.5) * 255);
      nPix[p4 + 3] = 255;
    }
  }
  monNormalCtx.putImageData(monNormalData, 0, 0);

  // 8b. Serpent Dorsal Spines / Crest Chitin Albedo & Electric-Blue Root Fissure Emissive Maps
  const finSize = compact ? 128 : 256;
  const [finCanvas, finCtx] = makeCanvas(finSize);
  const [finEmisCanvas, finEmisCtx] = makeCanvas(finSize);
  const finData = finCtx.createImageData(finSize, finSize);
  const finEData = finEmisCtx.createImageData(finSize, finSize);
  const fPix = finData.data;
  const fePix = finEData.data;
  const invFinSize = 1 / finSize;
  for (let py = 0; py < finSize; py++) {
    const v = 1 - py * invFinSize; // 0 = spine root, 1 = razor spine tip
    for (let px = 0; px < finSize; px++) {
      const u = px * invFinSize;
      const p4 = (py * finSize + px) * 4;
      const striation = Math.sin(u * Math.PI * 2 * 14) * 0.5 + 0.5;
      const tipSharpen = 1 - Math.pow(v, 1.8) * 0.45;
      const rootFissure = Math.exp(-Math.pow(v / 0.28, 2)) * Math.pow(Math.max(0, Math.sin(u * Math.PI * 2 * 6)), 6);

      // Deep dark crimson / blood-red serrated spine chitin matching dominant blood-red body
      let r = (48 + striation * 38) * tipSharpen + v * 28;
      let g = (5 + striation * 5) * tipSharpen + v * 4;
      let b = (7 + striation * 6) * tipSharpen + v * 5;

      if (rootFissure > 0.06) {
        const blueMix = Math.min(1, rootFissure * 1.18);
        r = r * (1 - blueMix) + 20 * blueMix;
        g = g * (1 - blueMix * 0.85) + 140 * blueMix;
        b = b * (1 - blueMix * 0.55) + 255 * blueMix;
        fePix[p4] = clampByte(20 * rootFissure);
        fePix[p4 + 1] = clampByte(142 * rootFissure);
        fePix[p4 + 2] = clampByte(255 * rootFissure);
      } else {
        fePix[p4] = 0;
        fePix[p4 + 1] = 0;
        fePix[p4 + 2] = 0;
      }
      fePix[p4 + 3] = 255;

      fPix[p4] = clampByte(r);
      fPix[p4 + 1] = clampByte(g);
      fPix[p4 + 2] = clampByte(b);
      fPix[p4 + 3] = 255;
    }
  }
  finCtx.putImageData(finData, 0, 0);
  finEmisCtx.putImageData(finEData, 0, 0);

  // 9. Blazing Glowing Crimson-Red Eye Texture (Obsidian Sclera + Intense Fiery Red Iris + Vertical Slit Pupil)
  const eyeSize = compact ? 256 : 512;
  const [eyeCanvas, eyeCtx] = makeCanvas(eyeSize);
  if (eyeSize !== 512) {
    eyeCtx.scale(eyeSize / 512, eyeSize / 512);
  }
  const ecx = 256;
  const ecy = 256;

  // Deep obsidian-black eye socket sclera so blazing red iris pierces cleanly like SERPENTIS icon
  const scleraGrad = eyeCtx.createRadialGradient(ecx, ecy, 85, ecx, ecy, 256);
  scleraGrad.addColorStop(0, '#3a0205');
  scleraGrad.addColorStop(0.55, '#120103');
  scleraGrad.addColorStop(0.85, '#070102');
  scleraGrad.addColorStop(1, '#030102');
  eyeCtx.fillStyle = scleraGrad;
  eyeCtx.fillRect(0, 0, 512, 512);

  // Intense glowing scarlet-crimson iris disc
  const irisR = 162;
  const irisBase = eyeCtx.createRadialGradient(ecx, ecy, 12, ecx, ecy, irisR);
  irisBase.addColorStop(0, '#ff6852');
  irisBase.addColorStop(0.24, '#ff1c24');
  irisBase.addColorStop(0.62, '#c8060e');
  irisBase.addColorStop(0.88, '#540205');
  irisBase.addColorStop(1, '#070102');
  eyeCtx.fillStyle = irisBase;
  eyeCtx.beginPath();
  eyeCtx.arc(ecx, ecy, irisR, 0, Math.PI * 2);
  eyeCtx.fill();

  // Sharp fiery radial iris fibers
  for (let i = 0; i < 200; i++) {
    const ang = (i / 200) * Math.PI * 2;
    const r0 = 18 + (i % 6) * 3;
    const r1 = irisR - 6 - ((i * 5) % 16);
    eyeCtx.strokeStyle =
      i % 3 === 0
        ? 'rgba(255, 110, 88, 0.55)'
        : i % 3 === 1
          ? 'rgba(72, 2, 5, 0.45)'
          : 'rgba(255, 30, 36, 0.42)';
    eyeCtx.lineWidth = 1 + (i % 2) * 0.8;
    eyeCtx.beginPath();
    eyeCtx.moveTo(ecx + Math.cos(ang) * r0, ecy + Math.sin(ang) * r0);
    eyeCtx.lineTo(
      ecx + Math.cos(ang + Math.sin(i) * 0.03) * r1,
      ecy + Math.sin(ang + Math.sin(i) * 0.03) * r1
    );
    eyeCtx.stroke();
  }

  // Razor vertical abyssal slit pupil with intense crimson rim
  eyeCtx.fillStyle = '#040001';
  eyeCtx.beginPath();
  eyeCtx.moveTo(ecx, ecy - 118);
  eyeCtx.bezierCurveTo(ecx + 24, ecy - 48, ecx + 24, ecy + 48, ecx, ecy + 118);
  eyeCtx.bezierCurveTo(ecx - 24, ecy + 48, ecx - 24, ecy - 48, ecx, ecy - 118);
  eyeCtx.closePath();
  eyeCtx.fill();

  eyeCtx.strokeStyle = 'rgba(255, 72, 60, 0.92)';
  eyeCtx.lineWidth = 2.5;
  eyeCtx.stroke();

  // 9. Procedural PBR Weathered Dock Timber Planks (384x384 desktop / 256x256 compact)
  const woodSize = compact ? 256 : 384;
  const invWoodSize = 1 / woodSize;
  const [woodCanvas, woodCtx] = makeCanvas(woodSize);
  const [woodBumpCanvas, woodBumpCtx] = makeCanvas(woodSize);
  const [woodRoughCanvas, woodRoughCtx] = makeCanvas(woodSize);

  const woodAlbData = woodCtx.createImageData(woodSize, woodSize);
  const woodBmpData = woodBumpCtx.createImageData(woodSize, woodSize);
  const woodRghData = woodRoughCtx.createImageData(woodSize, woodSize);
  const wA = woodAlbData.data;
  const wB = woodBmpData.data;
  const wR = woodRghData.data;

  const plankCount = 8;
  const plankPx = woodSize / plankCount;
  const invPlankCount = 1 / plankCount;
  const nailScale = woodSize / 512;
  const nailOuter = 3.4 * nailScale;
  const invNailRamp = 1 / (1.4 * nailScale);
  // Deterministic staggered end-butt joints & knot locations per plank
  const plankJoints = [0.28, 0.64, 0.14, 0.78, 0.44, 0.86, 0.35, 0.57];
  const plankKnots = [
    { u: 0.72, vLocal: 0.45, r: 0.032 },
    { u: 0.22, vLocal: 0.62, r: 0.026 },
    { u: 0.56, vLocal: 0.38, r: 0.036 },
    { u: 0.18, vLocal: 0.52, r: 0.024 },
    { u: 0.81, vLocal: 0.42, r: 0.03 },
    { u: 0.41, vLocal: 0.65, r: 0.028 },
    { u: 0.68, vLocal: 0.35, r: 0.025 },
    { u: 0.15, vLocal: 0.58, r: 0.033 },
  ];

  for (let py = 0; py < woodSize; py++) {
    const v = py * invWoodSize;
    const rowOff = py * woodSize;
    const plankIdx = Math.floor(py / plankPx);
    const localY = (py % plankPx) / plankPx; // 0..1 across plank width
    const jointU = plankJoints[plankIdx % plankCount];
    const nailTargetU1 = (jointU + 0.028) % 1;
    const nailTargetU2 = (jointU - 0.028 + 1) % 1;
    const knot = plankKnots[plankIdx % plankCount];
    const dvKnot = (localY - knot.vLocal) * invPlankCount;
    const invKnotVar = 1 / (knot.r * knot.r * 1.8);
    const invKnotCore = 1 / (knot.r * 0.58);
    const nailV = Math.min(Math.abs(localY - 0.28), Math.abs(localY - 0.72));
    const nearNailRow = nailV * plankPx < nailOuter;
    const tone0 = 0.86 + hash2(plankIdx, plankIdx * 3) * 0.26;
    const tone1 = 0.86 + hash2(plankIdx + 13, plankIdx * 3) * 0.26;

    // Longitudinal chamfer & recessed dark gap between planks
    const edgeDistY = Math.min(localY, 1 - localY);
    const seamMaskY = Math.min(1, Math.max(0, (edgeDistY - 0.028) / 0.055));

    for (let px = 0; px < woodSize; px++) {
      const u = px * invWoodSize;
      const p4 = (rowOff + px) * 4;

      // Board segment variation split at end-butt joint
      const distJoint = Math.min(Math.abs(u - jointU), 1 - Math.abs(u - jointU));
      const seamMaskX = Math.min(1, Math.max(0, (distJoint - 0.005) / 0.014));
      const boardSide = u < jointU ? 0 : 1;
      const boardSeed = plankIdx * 7 + boardSide * 3.1;
      const boardTone = boardSide === 0 ? tone0 : tone1;

      // End-butt joint nail pairs (galvanized weathered iron fasteners)
      let nailMask = 0;
      if (nearNailRow) {
        const nailDistU1 = Math.min(Math.abs(u - nailTargetU1), 1 - Math.abs(u - nailTargetU1));
        const nailDistU2 = Math.min(Math.abs(u - nailTargetU2), 1 - Math.abs(u - nailTargetU2));
        const nailU = Math.min(nailDistU1, nailDistU2);
        const nailR = Math.hypot(nailU * woodSize, nailV * plankPx);
        nailMask = Math.max(0, Math.min(1, (nailOuter - nailR) * invNailRamp));
      }

      // Growth-ring distortion around knot
      let duKnot = u - knot.u;
      if (duKnot > 0.5) duKnot -= 1;
      if (duKnot < -0.5) duKnot += 1;
      const knotDist = Math.hypot(duKnot * 0.42, dvKnot * 2.1);
      const knotInfluence = Math.exp(-(knotDist * knotDist) * invKnotVar);
      const knotCenter = Math.max(0, 1 - knotDist * invKnotCore);

      // Multi-octave wood fiber grain flowing along U with organic warp
      const woodOct = compact ? 2 : 3;
      const warp = fbm((u + boardSeed * 0.17) % 1, v, 4, 16, woodOct) * 0.48;
      const ringCoord =
        (localY + boardSeed * 0.31) * 9.5 +
        warp * 4.2 +
        knotInfluence * 3.4 +
        fbm(u, v, 16, 48, woodOct) * 1.1;
      const ringWave = 0.5 + 0.5 * Math.sin(ringCoord * Math.PI * 2);
      const fineFiber = fbm(u, v, 4, 96, woodOct);
      const grain = ringWave * 0.58 + fineFiber * 0.42;

      // Subtle damp water-stain & weathered algae darkening near plank joints
      const dampNoise = fbm(u, v, 6, 6, woodOct);
      const dampFactor = Math.max(0, Math.min(1, (dampNoise - 0.38) * 1.8));
      const plankSeam = Math.min(seamMaskX, seamMaskY);

      // Rich waterlogged, weathered dock timber color with dark damp rot
      let r = (104 + grain * 36 - knotCenter * 46) * boardTone;
      let g = (74 + grain * 27 - knotCenter * 36) * boardTone;
      let b = (49 + grain * 18 - knotCenter * 25) * boardTone;

      // Heavy damp rot & moss patina near plank seams
      r *= 1 - dampFactor * 0.36;
      g *= 1 - dampFactor * 0.28;
      b *= 1 - dampFactor * 0.28;

      // Deep dark recessed seams between planks
      const seamShade = 0.16 + 0.84 * plankSeam;
      r *= seamShade;
      g *= seamShade;
      b *= seamShade;

      // Rusted iron nail heads
      if (nailMask > 0.01) {
        r = r * (1 - nailMask) + 74 * nailMask;
        g = g * (1 - nailMask) + 52 * nailMask;
        b = b * (1 - nailMask) + 42 * nailMask;
      }

      wA[p4] = clampByte(r);
      wA[p4 + 1] = clampByte(g);
      wA[p4 + 2] = clampByte(b);
      wA[p4 + 3] = 255;

      // Bump: recessed plank gaps, carved fiber striations, chamfered edges, inset nails
      const bumpVal =
        (32 + (140 + grain * 78 - knotCenter * 24) * plankSeam) * (1 - nailMask * 0.35) +
        nailMask * 165;
      const bByte = clampByte(bumpVal);
      wB[p4] = bByte;
      wB[p4 + 1] = bByte;
      wB[p4 + 2] = bByte;
      wB[p4 + 3] = 255;

      // Roughness: weathered dry fibers (~175) vs damp water-stained wood (~95) & recessed seams (~228)
      const roughVal =
        (178 - grain * 28 - dampFactor * 56) * plankSeam +
        228 * (1 - plankSeam) -
        nailMask * 70;
      const rByte = roughVal < 40 ? 40 : roughVal > 245 ? 245 : (roughVal + 0.5) | 0;
      wR[p4] = rByte;
      wR[p4 + 1] = rByte;
      wR[p4 + 2] = rByte;
      wR[p4 + 3] = 255;
    }
  }

  woodCtx.putImageData(woodAlbData, 0, 0);
  woodBumpCtx.putImageData(woodBmpData, 0, 0);
  woodRoughCtx.putImageData(woodRghData, 0, 0);

  const tileAlbedo = configureTexture(tileCanvas, true, 1, 1, aniso);
  const tileBump = configureTexture(bumpCanvas, false, 1, 1, aniso);
  const tileRoughness = configureTexture(roughCanvas, false, 1, 1, aniso);
  const wallAlbedo = configureTexture(wallCanvas, true, 1, 1, aniso);
  const wallBump = configureTexture(wallBumpCanvas, false, 1, 1, aniso);
  const concreteAlbedo = configureTexture(concCanvas, true, 1, 1, aniso);
  const concreteBump = configureTexture(concBumpCanvas, false, 1, 1, aniso);
  const cautionAlbedo = configureTexture(cautCanvas, true, 1, 1, aniso);
  const metalAlbedo = configureTexture(metalCanvas, true, 1, 1, aniso);
  const metalBump = configureTexture(metalBumpCanvas, false, 1, 1, aniso);
  const woodAlbedo = configureTexture(woodCanvas, true, 1, 1, aniso);
  const woodBump = configureTexture(woodBumpCanvas, false, 1, 1, aniso);
  const woodRoughness = configureTexture(woodRoughCanvas, false, 1, 1, aniso);
  const ceilingAlbedo = configureTexture(ceilCanvas, true, 4, 4, aniso);
  const waterNormal = configureTexture(wnCanvas, false, 8, 8, aniso);
  const monsterSkin = configureTexture(monCanvas, true, 1, 7, aniso);
  const monsterNormal = configureTexture(monNormalCanvas, false, 1, 7, aniso);
  // Alias monsterBump to monsterNormal (unused by current normal-mapped shaders) to save a full texture upload & canvas
  const monsterBump = monsterNormal;
  const monsterRoughness = configureTexture(monRoughCanvas, false, 1, 7, aniso);
  const monsterEmissive = configureTexture(monEmissiveCanvas, true, 1, 7, aniso);
  const monsterFinSkin = configureTexture(finCanvas, true, 1, 1, aniso);
  monsterFinSkin.wrapT = THREE.ClampToEdgeWrapping;
  const monsterFinEmissive = configureTexture(finEmisCanvas, true, 1, 1, aniso);
  monsterFinEmissive.wrapT = THREE.ClampToEdgeWrapping;
  const monsterEye = configureTexture(eyeCanvas, true, 1, 1, aniso);
  monsterEye.wrapS = THREE.ClampToEdgeWrapping;
  monsterEye.wrapT = THREE.ClampToEdgeWrapping;

  const all = [
    tileAlbedo,
    tileBump,
    tileRoughness,
    wallAlbedo,
    wallBump,
    concreteAlbedo,
    concreteBump,
    cautionAlbedo,
    metalAlbedo,
    metalBump,
    woodAlbedo,
    woodBump,
    woodRoughness,
    ceilingAlbedo,
    waterNormal,
    monsterSkin,
    monsterNormal,
    monsterRoughness,
    monsterEmissive,
    monsterFinSkin,
    monsterFinEmissive,
    monsterEye,
  ];

  let currentAniso = aniso;

  return {
    tileAlbedo,
    tileBump,
    tileRoughness,
    wallAlbedo,
    wallBump,
    concreteAlbedo,
    concreteBump,
    cautionAlbedo,
    metalAlbedo,
    metalBump,
    woodAlbedo,
    woodBump,
    woodRoughness,
    ceilingAlbedo,
    waterNormal,
    monsterSkin,
    monsterBump,
    monsterNormal,
    monsterRoughness,
    monsterEmissive,
    monsterFinSkin,
    monsterFinEmissive,
    monsterEye,
    compact,
    setAnisotropy: (targetAniso: number) => {
      const clamped = Math.min(16, Math.max(1, targetAniso));
      if (clamped === currentAniso) return;
      currentAniso = clamped;
      for (let i = 0; i < all.length; i++) {
        all[i].anisotropy = clamped;
        all[i].needsUpdate = true;
      }
    },
    markAllDirty: () => {
      for (let i = 0; i < all.length; i++) {
        all[i].needsUpdate = true;
      }
    },
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}
