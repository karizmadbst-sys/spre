import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  attachAndroidFullscreenLifecycle,
  isCapacitorNativeAndroid,
  requestAndroidFullscreen,
} from '../src/game/fullscreen.ts';

function testAndroidNativeConfigureScript(): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serpentis-android-fs-'));
  try {
    const mainDir = path.join(tmpDir, 'android/app/src/main');
    const javaPkgDir = path.join(mainDir, 'java/com/serpentis/horror');
    const valuesDir = path.join(mainDir, 'res/values');
    fs.mkdirSync(javaPkgDir, { recursive: true });
    fs.mkdirSync(valuesDir, { recursive: true });

    fs.writeFileSync(
      path.join(mainDir, 'AndroidManifest.xml'),
      `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:label="@string/app_name">
        <activity android:name=".MainActivity" android:theme="@style/AppTheme.NoActionBarLaunch" android:exported="true">
        </activity>
    </application>
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
`,
      'utf8'
    );

    fs.writeFileSync(
      path.join(javaPkgDir, 'MainActivity.java'),
      `package com.serpentis.horror;\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {}\n`,
      'utf8'
    );

    fs.writeFileSync(
      path.join(valuesDir, 'strings.xml'),
      `<?xml version="1.0" encoding="utf-8"?><resources><string name="app_name">Old</string><string name="title_activity_main">Old</string></resources>`,
      'utf8'
    );

    // Copy android-icons if present in workspace so script exercises full path
    const scriptPath = path.resolve(process.cwd(), 'scripts/configure-android.mjs');
    execFileSync(process.execPath, [scriptPath], { cwd: tmpDir, stdio: 'pipe' });
    // Re-run to verify idempotency
    execFileSync(process.execPath, [scriptPath], { cwd: tmpDir, stdio: 'pipe' });

    const manifest = fs.readFileSync(path.join(mainDir, 'AndroidManifest.xml'), 'utf8');
    assert.ok(manifest.includes('android:screenOrientation="sensorLandscape"'), 'Must enforce sensorLandscape');
    assert.ok(manifest.includes('android.permission.RECORD_AUDIO'), 'Must keep RECORD_AUDIO permission');

    const mainActivity = fs.readFileSync(path.join(javaPkgDir, 'MainActivity.java'), 'utf8');
    assert.ok(mainActivity.includes('package com.serpentis.horror;'), 'Must preserve package name');
    assert.ok(
      mainActivity.includes('WindowCompat.setDecorFitsSystemWindows(window, false)'),
      'Must enable edge-to-edge decor layout'
    );
    assert.ok(
      mainActivity.includes('BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE'),
      'Must configure sticky transient bars behavior'
    );
    assert.ok(
      mainActivity.includes('WindowInsetsCompat.Type.systemBars()'),
      'Must hide both status bar and navigation/gesture bar'
    );
    assert.ok(
      mainActivity.includes('SYSTEM_UI_FLAG_IMMERSIVE_STICKY') &&
        mainActivity.includes('SYSTEM_UI_FLAG_HIDE_NAVIGATION') &&
        mainActivity.includes('SYSTEM_UI_FLAG_FULLSCREEN'),
      'Must reinforce sticky immersive flags across older & OEM Android skins'
    );
    assert.ok(
      mainActivity.includes('LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES') &&
        mainActivity.includes('LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS'),
      'Must extend display into notch/cutout areas'
    );
    assert.ok(
      mainActivity.includes('SerpentisAndroidFullscreen'),
      'Must register native JS fullscreen bridge on WebView'
    );
    assert.ok(
      mainActivity.includes('onWindowFocusChanged') && mainActivity.includes('onResume'),
      'Must re-assert immersive fullscreen on resume and focus changes'
    );

    const stylesBase = fs.readFileSync(path.join(valuesDir, 'styles.xml'), 'utf8');
    const stylesV28 = fs.readFileSync(path.join(mainDir, 'res/values-v28/styles.xml'), 'utf8');
    const stylesV29 = fs.readFileSync(path.join(mainDir, 'res/values-v29/styles.xml'), 'utf8');
    assert.ok(stylesBase.includes('android:windowFullscreen'), 'Base theme must set windowFullscreen');
    assert.ok(stylesV28.includes('shortEdges'), 'API 28+ theme must set displayCutoutMode shortEdges');
    assert.ok(
      stylesV29.includes('enforceNavigationBarContrast') &&
        stylesV29.includes('enforceStatusBarContrast'),
      'API 29+ theme must disable contrast scrims on hidden bars'
    );

    console.log('1. PASS: configure-android.mjs patches MainActivity, styles, cutouts, and manifest idempotently.');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function testWebAndCapacitorRuntimeFullscreenHelpers(): Promise<void> {
  const prevWindow = (globalThis as any).window;
  const prevDocument = (globalThis as any).document;
  const prevNavigator = (globalThis as any).navigator;

  try {
    const listeners = new Map<string, Array<(e: any) => void>>();
    let nativeBridgeCalls = 0;
    let browserFsCalls: any[] = [];
    let orientationLockArg: string | null = null;
    let currentFsEl: any = null;

    const fakeDocEl: any = {
      requestFullscreen: async (opts: any) => {
        browserFsCalls.push(opts);
        currentFsEl = fakeDocEl;
      },
    };

    const fakeDoc: any = {
      documentElement: fakeDocEl,
      visibilityState: 'visible',
      get fullscreenElement() {
        return currentFsEl;
      },
      addEventListener: (ev: string, fn: (e: any) => void) => {
        const arr = listeners.get(`doc:${ev}`) ?? [];
        arr.push(fn);
        listeners.set(`doc:${ev}`, arr);
      },
      removeEventListener: (ev: string, fn: (e: any) => void) => {
        const arr = listeners.get(`doc:${ev}`) ?? [];
        listeners.set(`doc:${ev}`, arr.filter((x) => x !== fn));
      },
    };

    const fakeWindow: any = {
      innerWidth: 915,
      innerHeight: 412,
      screen: {
        width: 915,
        height: 412,
        orientation: {
          lock: async (val: string) => {
            orientationLockArg = val;
          },
        },
      },
      matchMedia: () => ({ matches: true }),
      addEventListener: (ev: string, fn: (e: any) => void) => {
        const arr = listeners.get(`win:${ev}`) ?? [];
        arr.push(fn);
        listeners.set(`win:${ev}`, arr);
      },
      removeEventListener: (ev: string, fn: (e: any) => void) => {
        const arr = listeners.get(`win:${ev}`) ?? [];
        listeners.set(`win:${ev}`, arr.filter((x) => x !== fn));
      },
    };

    Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'document', { value: fakeDoc, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
        maxTouchPoints: 5,
      },
      configurable: true,
      writable: true,
    });

    // A. Android Chrome / PWA browser path
    assert.equal(isCapacitorNativeAndroid(), false);
    const enteredBrowser = await requestAndroidFullscreen(false);
    assert.equal(enteredBrowser, true, 'Android browser must request fullscreen');
    assert.deepEqual(browserFsCalls[0], { navigationUI: 'hide' }, 'Must hide Android navigation & gesture UI');
    assert.equal(orientationLockArg, 'landscape', 'Must lock landscape orientation');

    // Lifecycle listener ignores text inputs while re-requesting on regular game taps
    currentFsEl = null;
    browserFsCalls = [];
    const detach = attachAndroidFullscreenLifecycle();
    const clickHandlers = listeners.get('win:click') ?? [];
    assert.ok(clickHandlers.length > 0, 'Must attach gesture handler');

    clickHandlers[0]({ target: { tagName: 'INPUT' } });
    await Promise.resolve();
    assert.equal(browserFsCalls.length, 0, 'Must not hijack focus when typing in INPUT fields');

    clickHandlers[0]({ target: { tagName: 'CANVAS' } });
    await Promise.resolve();
    assert.equal(browserFsCalls.length, 1, 'Must enter fullscreen on canvas/UI tap when exited');
    detach();

    // B. Native Capacitor Android APK path
    currentFsEl = null;
    browserFsCalls = [];
    fakeWindow.SerpentisAndroidFullscreen = {
      enterFullscreen: () => {
        nativeBridgeCalls++;
      },
    };
    assert.equal(isCapacitorNativeAndroid(), true);
    const enteredNative = await requestAndroidFullscreen(false);
    assert.equal(enteredNative, true);
    assert.equal(nativeBridgeCalls, 1, 'Must invoke native Android bridge');
    assert.equal(browserFsCalls.length, 0, 'Must NOT call HTML5 requestFullscreen inside Capacitor WebView');

    console.log('2. PASS: Android browser (navigationUI: hide) & Capacitor native fullscreen bridge verified.');
  } finally {
    Object.defineProperty(globalThis, 'window', { value: prevWindow, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'document', { value: prevDocument, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'navigator', { value: prevNavigator, configurable: true, writable: true });
  }
}

function testConfigManifestAndHeaders(): void {
  const capCfg = fs.readFileSync('capacitor.config.ts', 'utf8');
  assert.ok(capCfg.includes('SystemBars'), 'capacitor.config.ts must configure SystemBars');
  assert.ok(capCfg.includes('hidden: true'), 'SystemBars must default to hidden: true');
  assert.ok(capCfg.includes("insetsHandling: 'disable'"), 'SystemBars insetsHandling must be disabled');

  const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.display, 'fullscreen');
  assert.equal(manifest.orientation, 'landscape');

  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.includes('viewport-fit=cover'), 'index.html must include viewport-fit=cover');

  const headers = fs.readFileSync('public/_headers', 'utf8');
  assert.ok(headers.includes('fullscreen=(self)'), 'public/_headers must permit fullscreen=(self)');

  console.log('3. PASS: capacitor.config.ts, manifest.webmanifest, index.html & _headers verified.');
}

async function main(): Promise<void> {
  testAndroidNativeConfigureScript();
  await testWebAndCapacitorRuntimeFullscreenHelpers();
  testConfigManifestAndHeaders();
  console.log('ALL ANDROID TRUE FULLSCREEN TESTS PASSED!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
