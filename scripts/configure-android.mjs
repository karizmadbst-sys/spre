import fs from 'node:fs';
import path from 'node:path';

const androidMainDir = path.resolve(process.cwd(), 'android/app/src/main');
const manifestPath = path.join(androidMainDir, 'AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error('Android project not initialized yet. Run `npx cap add android` first.');
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, 'utf8');

const requiredPermissions = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
];

const insertions = [];
for (const perm of requiredPermissions) {
  if (!xml.includes(perm)) {
    insertions.push(`    <uses-permission android:name="${perm}" />`);
  }
}

if (!xml.includes('android.hardware.microphone')) {
  insertions.push('    <uses-feature android:name="android.hardware.microphone" android:required="false" />');
}

let manifestChanged = false;

if (insertions.length > 0) {
  const anchor = '<application';
  const idx = xml.indexOf(anchor);
  if (idx === -1) {
    console.error('Could not find <application> tag in AndroidManifest.xml');
    process.exit(1);
  }
  xml = `${xml.slice(0, idx)}${insertions.join('\n')}\n\n    ${xml.slice(idx)}`;
  manifestChanged = true;
  console.log(`Updated AndroidManifest.xml with ${insertions.length} permission entries.`);
} else {
  console.log('AndroidManifest.xml already contains all required permissions.');
}

// Enforce mandatory landscape-only orientation on Android (both left & right landscape)
if (/<activity\b[^>]*android:screenOrientation=/.test(xml)) {
  const nextXml = xml.replace(
    /(<activity\b[^>]*?)android:screenOrientation="[^"]*"/g,
    '$1android:screenOrientation="sensorLandscape"'
  );
  if (nextXml !== xml) {
    xml = nextXml;
    manifestChanged = true;
    console.log('Updated AndroidManifest.xml activity screenOrientation to sensorLandscape.');
  }
} else if (/<activity\b/.test(xml)) {
  xml = xml.replace(
    /<activity\b/,
    '<activity\n            android:screenOrientation="sensorLandscape"'
  );
  manifestChanged = true;
  console.log('Added android:screenOrientation="sensorLandscape" to AndroidManifest.xml.');
}

// Replace Theme.SplashScreen launch theme on MainActivity with dark AppTheme.NoActionBar so Android never installs an ActionBar or white launch frame
if (/<activity\b[^>]*android:theme=/.test(xml)) {
  const nextXml = xml.replace(
    /(<activity\b[^>]*?)android:theme="[^"]*"/g,
    '$1android:theme="@style/AppTheme.NoActionBar"'
  );
  if (nextXml !== xml) {
    xml = nextXml;
    manifestChanged = true;
    console.log('Updated AndroidManifest.xml MainActivity theme to @style/AppTheme.NoActionBar.');
  }
} else if (/<activity\b/.test(xml)) {
  xml = xml.replace(
    /<activity\b/,
    '<activity\n            android:theme="@style/AppTheme.NoActionBar"'
  );
  manifestChanged = true;
  console.log('Added android:theme="@style/AppTheme.NoActionBar" to AndroidManifest.xml.');
}

if (manifestChanged) {
  fs.writeFileSync(manifestPath, xml, 'utf8');
}

// Configure Android native themes/styles for true edge-to-edge fullscreen across all API levels (no DayNight light white bar, no SplashScreen ActionBar)
const resDir = path.join(androidMainDir, 'res');
const valuesDir = path.join(resDir, 'values');
const valuesV28Dir = path.join(resDir, 'values-v28');
const valuesV29Dir = path.join(resDir, 'values-v29');
const valuesV30Dir = path.join(resDir, 'values-v30');
const valuesV31Dir = path.join(resDir, 'values-v31');
const valuesV35Dir = path.join(resDir, 'values-v35');
for (const dir of [valuesDir, valuesV28Dir, valuesV29Dir, valuesV30Dir, valuesV31Dir, valuesV35Dir]) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(
  path.join(valuesDir, 'colors.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#0b1012</color>
    <color name="colorPrimaryDark">#0b1012</color>
    <color name="colorAccent">#52e0b6</color>
</resources>
`,
  'utf8'
);

function buildNoActionBarStylesXml(extraItems = '', extraV31SplashItems = '') {
  const baseItems = `        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowActionBar">false</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowContentOverlay">@null</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowBackground">@color/ic_launcher_background</item>
        <item name="android:colorBackground">@color/ic_launcher_background</item>
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>${extraItems ? `\n${extraItems}` : ''}`;

  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.NoActionBar">
${baseItems}
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.NoActionBar">
${baseItems}
        <item name="android:background">@null</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
${baseItems}
        <item name="android:background">@null</item>${extraV31SplashItems ? `\n${extraV31SplashItems}` : ''}
    </style>
</resources>
`;
}

fs.writeFileSync(path.join(valuesDir, 'styles.xml'), buildNoActionBarStylesXml(), 'utf8');
fs.writeFileSync(
  path.join(valuesV28Dir, 'styles.xml'),
  buildNoActionBarStylesXml(
    '        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>\n' +
      '        <item name="android:windowLightStatusBar">false</item>\n' +
      '        <item name="android:windowLightNavigationBar">false</item>'
  ),
  'utf8'
);
fs.writeFileSync(
  path.join(valuesV29Dir, 'styles.xml'),
  buildNoActionBarStylesXml(
    '        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>\n' +
      '        <item name="android:windowLightStatusBar">false</item>\n' +
      '        <item name="android:windowLightNavigationBar">false</item>\n' +
      '        <item name="android:enforceNavigationBarContrast">false</item>\n' +
      '        <item name="android:enforceStatusBarContrast">false</item>'
  ),
  'utf8'
);
fs.writeFileSync(
  path.join(valuesV30Dir, 'styles.xml'),
  buildNoActionBarStylesXml(
    '        <item name="android:windowLayoutInDisplayCutoutMode">always</item>\n' +
      '        <item name="android:windowLightStatusBar">false</item>\n' +
      '        <item name="android:windowLightNavigationBar">false</item>\n' +
      '        <item name="android:enforceNavigationBarContrast">false</item>\n' +
      '        <item name="android:enforceStatusBarContrast">false</item>'
  ),
  'utf8'
);
fs.writeFileSync(
  path.join(valuesV31Dir, 'styles.xml'),
  buildNoActionBarStylesXml(
    '        <item name="android:windowLayoutInDisplayCutoutMode">always</item>\n' +
      '        <item name="android:windowLightStatusBar">false</item>\n' +
      '        <item name="android:windowLightNavigationBar">false</item>\n' +
      '        <item name="android:enforceNavigationBarContrast">false</item>\n' +
      '        <item name="android:enforceStatusBarContrast">false</item>\n' +
      '        <item name="android:windowSplashScreenBackground">@color/ic_launcher_background</item>'
  ),
  'utf8'
);
fs.writeFileSync(
  path.join(valuesV35Dir, 'styles.xml'),
  buildNoActionBarStylesXml(
    '        <item name="android:windowLayoutInDisplayCutoutMode">always</item>\n' +
      '        <item name="android:windowLightStatusBar">false</item>\n' +
      '        <item name="android:windowLightNavigationBar">false</item>\n' +
      '        <item name="android:enforceNavigationBarContrast">false</item>\n' +
      '        <item name="android:enforceStatusBarContrast">false</item>\n' +
      '        <item name="android:windowSplashScreenBackground">@color/ic_launcher_background</item>\n' +
      '        <item name="android:windowOptOutEdgeToEdgeEnforcement">false</item>'
  ),
  'utf8'
);

// Locate and patch MainActivity.java to enforce Android Sticky Immersive Fullscreen without triggering PhoneWindow ActionBar before super.onCreate
function findMainActivity(dir) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivity(full);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java') {
      return full;
    }
  }
  return null;
}

const javaDir = path.join(androidMainDir, 'java');
const mainActivityPath = findMainActivity(javaDir) ?? path.join(javaDir, 'com/serpentis/horror/MainActivity.java');
let packageName = 'com.serpentis.horror';
if (fs.existsSync(mainActivityPath)) {
  const curSrc = fs.readFileSync(mainActivityPath, 'utf8');
  const pkgMatch = curSrc.match(/^\s*package\s+([a-zA-Z0-9_.]+)\s*;/m);
  if (pkgMatch) {
    packageName = pkgMatch[1];
  }
}

fs.mkdirSync(path.dirname(mainActivityPath), { recursive: true });
fs.writeFileSync(
  mainActivityPath,
  `package ${packageName};

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int DARK_BG_COLOR = 0xFF0B1012;
    private final Handler immersiveHandler = new Handler(Looper.getMainLooper());
    private final Runnable reapplyImmersiveRunnable = this::applyImmersiveFullscreen;
    private boolean jsBridgeAttached = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        applyDarkNoActionBarTheme();
        supportRequestWindowFeature(Window.FEATURE_NO_TITLE);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        super.onCreate(savedInstanceState);
        // Re-apply app dark edge-to-edge theme after BridgeActivity overrides it with Capacitor's library theme
        applyDarkNoActionBarTheme();
        hideAnyActionBar();
        applyImmersiveFullscreen();
        installSystemBarGuard();
        scheduleImmersiveReapply(50L);
    }

    @Override
    public void onStart() {
        super.onStart();
        hideAnyActionBar();
        applyImmersiveFullscreen();
        attachJsFullscreenBridge();
        scheduleImmersiveReapply(120L);
    }

    @Override
    public void onResume() {
        super.onResume();
        hideAnyActionBar();
        applyImmersiveFullscreen();
        scheduleImmersiveReapply(120L);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideAnyActionBar();
            applyImmersiveFullscreen();
        }
    }

    @Override
    public void onDestroy() {
        immersiveHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void applyDarkNoActionBarTheme() {
        int themeId = getResources().getIdentifier("AppTheme_NoActionBar", "style", getPackageName());
        if (themeId == 0) {
            themeId = getResources().getIdentifier("AppTheme.NoActionBar", "style", getPackageName());
        }
        if (themeId != 0) {
            setTheme(themeId);
        }
    }

    private void hideAnyActionBar() {
        androidx.appcompat.app.ActionBar supportActionBar = getSupportActionBar();
        if (supportActionBar != null) {
            supportActionBar.hide();
        }
        android.app.ActionBar nativeActionBar = getActionBar();
        if (nativeActionBar != null) {
            nativeActionBar.hide();
        }
    }

    @SuppressLint("AddJavascriptInterface")
    private void attachJsFullscreenBridge() {
        if (this.bridge == null) return;
        WebView webView = this.bridge.getWebView();
        if (webView == null) return;
        webView.setBackgroundColor(DARK_BG_COLOR);
        if (jsBridgeAttached) return;
        jsBridgeAttached = true;
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void enterFullscreen() {
                runOnUiThread(() -> {
                    hideAnyActionBar();
                    applyImmersiveFullscreen();
                });
            }
        }, "SerpentisAndroidFullscreen");
    }

    private void prepareImmersiveWindowFlags() {
        Window window = getWindow();
        if (window == null) return;
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.clearFlags(WindowManager.LayoutParams.FLAG_FORCE_NOT_FULLSCREEN);
        window.addFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN |
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );
        window.setBackgroundDrawable(new ColorDrawable(DARK_BG_COLOR));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }
    }

    @SuppressWarnings("deprecation")
    private void installSystemBarGuard() {
        Window window = getWindow();
        if (window == null) return;
        View decorView = window.getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
            boolean imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            boolean barsVisible = insets.isVisible(WindowInsetsCompat.Type.systemBars());
            if (!imeVisible) {
                v.setPadding(0, 0, 0, 0);
                View contentView = findViewById(android.R.id.content);
                if (contentView != null) {
                    contentView.setPadding(0, 0, 0, 0);
                }
                if (barsVisible) {
                    scheduleImmersiveReapply(80L);
                }
                return new WindowInsetsCompat.Builder(insets)
                    .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(), Insets.NONE)
                    .build();
            }
            return ViewCompat.onApplyWindowInsets(v, insets);
        });
        decorView.setOnSystemUiVisibilityChangeListener(visibility -> {
            boolean barsShown = (visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0
                || (visibility & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) == 0;
            if (barsShown) {
                scheduleImmersiveReapply(80L);
            }
        });
    }

    private void scheduleImmersiveReapply(long delayMs) {
        immersiveHandler.removeCallbacks(reapplyImmersiveRunnable);
        immersiveHandler.postDelayed(reapplyImmersiveRunnable, delayMs);
    }

    @SuppressWarnings("deprecation")
    private void applyImmersiveFullscreen() {
        Window window = getWindow();
        if (window == null) return;
        prepareImmersiveWindowFlags();

        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
            window.setStatusBarContrastEnforced(false);
        }

        View decorView = window.getDecorView();
        decorView.setBackgroundColor(DARK_BG_COLOR);
        decorView.setPadding(0, 0, 0, 0);
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(DARK_BG_COLOR);
            contentView.setPadding(0, 0, 0, 0);
        }
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setBackgroundColor(DARK_BG_COLOR);
        }

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }

        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }
}
`,
  'utf8'
);
console.log(`Configured sticky immersive edge-to-edge fullscreen in ${mainActivityPath} (${packageName}) and styles.xml.`);

// Sync official SERPENTIS launcher icons into Android res/mipmap-* folders
const sourceIconsRoot = path.resolve(process.cwd(), 'scripts/android-icons');

// Always ensure background color resource exists (referenced by styles.xml & adaptive icon)
const bgPath = path.join(resDir, 'values', 'ic_launcher_background.xml');
fs.mkdirSync(path.dirname(bgPath), { recursive: true });
fs.writeFileSync(
  bgPath,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0b1012</color>\n</resources>\n`,
  'utf8'
);

if (fs.existsSync(sourceIconsRoot)) {
  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  let copiedCount = 0;

  for (const density of densities) {
    const srcDensityDir = path.join(sourceIconsRoot, `mipmap-${density}`);
    const dstDensityDir = path.join(resDir, `mipmap-${density}`);
    if (!fs.existsSync(srcDensityDir)) continue;
    fs.mkdirSync(dstDensityDir, { recursive: true });

    for (const fileName of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      const srcFile = path.join(srcDensityDir, fileName);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.join(dstDensityDir, fileName));
        copiedCount++;
      }
    }
  }

  // Ensure Android strings.xml sets app_name to SERPENTIS
  const stringsPath = path.join(resDir, 'values', 'strings.xml');
  if (fs.existsSync(stringsPath)) {
    let stringsXml = fs.readFileSync(stringsPath, 'utf8');
    stringsXml = stringsXml
      .replace(/<string name="app_name">.*?<\/string>/g, '<string name="app_name">SERPENTIS</string>')
      .replace(/<string name="title_activity_main">.*?<\/string>/g, '<string name="title_activity_main">SERPENTIS</string>');
    fs.writeFileSync(stringsPath, stringsXml, 'utf8');
  }

  console.log(`Synced ${copiedCount} SERPENTIS Android launcher icons into ${resDir}.`);
}
