module.exports = {
  expo: {
    name: 'Storyspire',
    slug: 'storyspire',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'myapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      infoPlist: {
        CFBundleDisplayName: 'Storyspire',
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    plugins: ['expo-router', 'expo-font', 'expo-web-browser'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      unsplashAccessKey: process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY,
      pexelsApiKey: process.env.EXPO_PUBLIC_PEXELS_API_KEY,
    },
  },
};

