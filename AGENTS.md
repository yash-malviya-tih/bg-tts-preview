# AGENTS.md

React 19 + Vite 6 + TypeScript demo widget for BharatGen Sooktam TTS (voice cloning + 22-language synthesis), deployed to AI Studio / bharatgen.dev at base path `/sooktam/`.

## Commands

- `npm run dev` — Vite dev server on port **3000** (host `0.0.0.0`).
- `npm run build` / `npm run preview` — production build/preview.
- `npx tsc --noEmit` — typecheck (only validation available; there is **no lint, no test suite, no CI**).

## TTS backend wiring (the non-obvious part)

- Backend endpoint: `POST /v1/tts?lang=<language-name>` with JSON `{ref_audio_base64, ref_text, gen_text}` → `{audio_base64, ref_text_ipa, gen_text_ipa}` (base64 WAV).
- In dev, Vite proxies `<base>/api/tts` → `TTS_API_TARGET` and optionally injects `TTS_API_KEY` as `X-API-Key` (see `vite.config.ts`). `constants.tsx` defaults `API_URL` to `<BASE_URL>/api/tts`; override with `VITE_TTS_API_URL`.
- `.env` is gitignored and sets `TTS_API_TARGET` to an **internal IP** (`10.20.155.194:8112`) — changing it only affects local dev; the default is `https://voices.bharatgen.dev/api/tts`.
- `GEMINI_API_KEY` / `API_KEY` are inlined at build via `vite.config.ts` `define` (AI Studio requirement).

## Base path gotcha

The app must work under `VITE_APP_BASE` (default `/sooktam/`). Never hardcode asset URLs — use `buildAppUrl()` (`constants.tsx`) or `resolveAssetUrl()` (`components/demo/shared.ts`), which prepend `BASE_URL`. This applies to `/voices/*.wav`, `bharatgen-logo.png`, and `bharatgen-voices.json` fetches.

## Language support caveats

- `services/ttsService.ts` `LANGUAGE_MAP` includes all 22 Eighth-Schedule languages, but the last 11 (assamese, bodo, dogri, kashmiri, konkani, maithili, manipuri, nepali, sanskrit, santali, sindhi) are **not confirmed supported by the backend** — requests will likely fail server-side. Don't treat them as working.
- Correspondingly, the last 11 entries of `LANGUAGE_DEMOS` in `constants.tsx` are best-effort placeholder text, **not native-speaker verified**. Default language fallback is `hindi`.

## Data / assets

- Voice catalog: `public/bharatgen-voices.json` + `public/voices/*.wav`. `BharatGenVoice.stateId` must match `id` in `data/india-states.json`.
- Map (`components/common/IndiaAccentMap.tsx`): `data/india-states.json` is imported as a parsed topojson object (not a URL — the map lib rejects plain-HTTP geography URLs in local dev) and features with `id === '-99'` are filtered out.

## UI stack quirks

- Tailwind is loaded from the **CDN script in `index.html`** — no Tailwind config/build step; utilities can't be customized there.
- `react`, `react-dom`, `lucide-react` are also served via an `esm.sh` importmap in `index.html`. Keep importmap versions in sync with `package.json`.
- `metadata.json` declares microphone frame permission (AI Studio).
- Voice cloning requires a reference audio + its transcript (`refText`); clone tab and BharatGen tab share the same `generateSpeech` path.
- `DemoWidget.tsx` is only the shell (tabs, text box, Generate, playback). Each tab lives in `components/demo/{CloneTab,BharatGenTab,AccentsTab}.tsx` as a `use*Tab()` hook plus its panel, and returns a `TabController` (`components/demo/shared.ts`). Every tab tracks its own gen text / ref text / ref audio via `useVoiceSession()`, so switching tabs never mixes them. Widget-agnostic pieces (accent map, logo visualizer, recorder hook) live in `components/common/`.
