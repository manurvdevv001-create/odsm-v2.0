import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.odsm.app',
  appName: 'ODSM',
  webDir: 'out',
  server: {
    url: 'mobile-discovery.html'
  }
};

export default config;
