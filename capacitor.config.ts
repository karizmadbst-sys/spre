import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.serpentis.horror',
  appName: 'SERPENTIS',
  webDir: 'dist',
  server: {
    // HTTPS scheme required so Android WebView exposes navigator.mediaDevices.getUserMedia for WebRTC voice chat
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0b1012',
  },
  plugins: {
    SystemBars: {
      hidden: true,
      insetsHandling: 'disable',
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
