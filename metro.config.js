const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// On web, `@supabase/node-fetch` is unnecessary (browsers have native fetch).
// The dynamic import() of it in @supabase/realtime-js causes Metro to fail.
// We tell Metro to resolve it to an empty module on web.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@supabase/node-fetch') {
    return {
      type: 'empty',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
