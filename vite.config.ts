import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const ttsTarget = env.TTS_API_TARGET || 'https://voices.bharatgen.dev/api/tts';
  const ttsApiKey = env.TTS_API_KEY;
  const whisperTarget = env.WHISPER_API_TARGET;
  const base = env.VITE_APP_BASE || '/sooktam/';
  const normalizedBase = base.startsWith('/') ? base : `/${base}`;
  const basePath = normalizedBase.endsWith('/') ? normalizedBase.slice(0, -1) : normalizedBase;

  return {
    base: normalizedBase,
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['voices.bharatgen.dev'],
      proxy: {
        [`${basePath}/api/tts`]: {
          target: ttsTarget,
          changeOrigin: true,
          secure: false,
          headers: ttsApiKey ? { 'X-API-Key': ttsApiKey } : undefined,
          rewrite: (requestPath) => requestPath.replace(new RegExp(`^${basePath}/api/tts`), ''),
        },
        [`${basePath}/api/whisper`]: {
          target: whisperTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (requestPath) => requestPath.replace(new RegExp(`^${basePath}/api/whisper`), '/transcribe'),
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
