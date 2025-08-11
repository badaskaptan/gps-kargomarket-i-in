import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GPS Sefer Takip',
  slug: 'gps-sefer',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.yourcompany.gpssefer',
    infoPlist: {
      NSLocationAlwaysAndWhenInUseUsageDescription: 'Bu uygulama sefer sırasında konum takibi yapmak için gereklidir.',
      NSLocationWhenInUseUsageDescription: 'Bu uygulama sefer sırasında konum takibi yapmak için gereklidir.',
      NSLocationAlwaysUsageDescription: 'Bu uygulama arka planda sefer takibi yapmak için gereklidir.',
      UIBackgroundModes: ['location']
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF'
    },
    package: 'com.yourcompany.gpssefer',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION'
    ]
  },
  web: {
    favicon: './assets/favicon.png'
  },
  plugins: [
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'Bu uygulama sefer sırasında konum takibi yapmak için gereklidir.',
        locationAlwaysPermission: 'Bu uygulama arka planda sefer takibi yapmak için gereklidir.',
        locationWhenInUsePermission: 'Bu uygulama sefer sırasında konum takibi yapmak için gereklidir.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true
      }
    ]
  ],
  extra: {
    eas: {
      projectId: 'your-eas-project-id'
    }
  }
});
