import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sourceImage = path.resolve(process.cwd(), 'public/assets/aistudio/snak_4a7a3ad6.jpg');
const iconsDir = path.resolve(process.cwd(), 'src-tauri/icons');

if (!fs.existsSync(sourceImage)) {
  console.error(`Missing source icon image at ${sourceImage}`);
  process.exit(1);
}

fs.mkdirSync(iconsDir, { recursive: true });

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serpentis-icons-'));
try {
  const resizePng = (size, destPath) => {
    execFileSync(
      'convert',
      [sourceImage, '-filter', 'Lanczos', '-resize', `${size}x${size}!`, '-strip', destPath],
      { stdio: 'inherit' }
    );
  };

  resizePng(32, path.join(iconsDir, '32x32.png'));
  resizePng(128, path.join(iconsDir, '128x128.png'));
  resizePng(256, path.join(iconsDir, '128x128@2x.png'));
  resizePng(512, path.join(iconsDir, 'icon.png'));

  const ico16 = path.join(tmpDir, '16.png');
  const ico48 = path.join(tmpDir, '48.png');
  resizePng(16, ico16);
  resizePng(48, ico48);

  execFileSync(
    'convert',
    [
      ico16,
      path.join(iconsDir, '32x32.png'),
      ico48,
      path.join(iconsDir, '128x128@2x.png'),
      path.join(iconsDir, 'icon.ico'),
    ],
    { stdio: 'inherit' }
  );

  console.log('Generated SERPENTIS Tauri PNG & ICO icons in src-tauri/icons/ from official source asset.');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
