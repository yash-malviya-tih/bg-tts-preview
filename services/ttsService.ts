import { API_URL } from '../constants';
import { TTSRequest } from '../types';

const LANGUAGE_MAP: Record<string, string> = {
  en: 'english',
  english: 'english',
  indian_english: 'english',
  hi: 'hindi',
  hindi: 'hindi',
  bn: 'bengali',
  bengali: 'bengali',
  ta: 'tamil',
  tamil: 'tamil',
  mr: 'marathi',
  marathi: 'marathi',
  gu: 'gujarati',
  gujarati: 'gujarati',
  kn: 'kannada',
  kannada: 'kannada',
  ml: 'malayalam',
  malayalam: 'malayalam',
  te: 'telugu',
  telugu: 'telugu',
  ur: 'urdu',
  urdu: 'urdu',
  or: 'odia',
  odia: 'odia',
  oriya: 'odia',
  pa: 'punjabi',
  punjabi: 'punjabi',
  // NOTE: these 11 map to the remaining Eighth Schedule languages so requests are already
  // shaped correctly once the backend supports them — support is NOT confirmed yet, so
  // generation for these will likely fail server-side until that's verified.
  as: 'assamese',
  assamese: 'assamese',
  brx: 'bodo',
  bodo: 'bodo',
  doi: 'dogri',
  dogri: 'dogri',
  ks: 'kashmiri',
  kashmiri: 'kashmiri',
  kok: 'konkani',
  konkani: 'konkani',
  mai: 'maithili',
  maithili: 'maithili',
  mni: 'manipuri',
  manipuri: 'manipuri',
  ne: 'nepali',
  nepali: 'nepali',
  sa: 'sanskrit',
  sanskrit: 'sanskrit',
  sat: 'santali',
  santali: 'santali',
  sd: 'sindhi',
  sindhi: 'sindhi',
};

const resolveLanguage = (language?: string) => {
  const normalized = (language || '').trim().toLowerCase();
  if (!normalized) return 'hindi';
  return LANGUAGE_MAP[normalized] || normalized;
};

const STATUS_GUIDANCE: Record<number, string> = {
  413: 'Your reference audio or text is too large. Try a shorter sample or shorter text.',
  415: 'Unsupported audio format. Please upload a .wav or .mp3 file.',
  422: "The server couldn't process this input. Try different reference audio or text.",
  429: 'Too many requests right now. Please wait a moment and try again.',
  500: 'The voice generation service hit an error. Please try again.',
  502: 'The voice generation service is temporarily unreachable. Please try again shortly.',
  503: 'The voice generation service is temporarily unreachable. Please try again shortly.',
  504: 'The request took too long. Try a shorter piece of text and try again.',
};

const buildErrorMessage = async (response: Response) => {
  const guidance = STATUS_GUIDANCE[response.status];
  const errorText = await response.text();

  let detail = '';
  if (errorText) {
    try {
      const parsed = JSON.parse(errorText) as { detail?: string };
      detail = parsed?.detail && typeof parsed.detail === 'string' ? parsed.detail : errorText;
    } catch {
      detail = errorText;
    }
  }

  if (guidance) return detail ? `${guidance} (${detail})` : guidance;
  return detail ? `Failed to generate speech: ${detail}` : `Failed to generate speech (error ${response.status}). Please try again.`;
};

// btoa() on a huge string built with spread/apply blows the call stack, and reference
// uploads can be up to 20MB — so encode in chunks.
const toBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

const base64ToBlob = (base64: string, type: string): Blob => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
};

/**
 * POST /v1/tts?lang=<code>&gen_lang=<code> with JSON {ref_audio_base64, ref_text, gen_text}.
 * gen_lang overrides langauge for gen_text language; omit to use same as lang. Responds with
 * JSON {audio_base64, ref_text_ipa, gen_text_ipa}.
 */
export const generateSpeech = async (payload: TTSRequest): Promise<string> => {
  try {
    const refAudioBase64 = await toBase64(payload.refAudio);
    let url = `${API_URL}?lang=${encodeURIComponent(resolveLanguage(payload.language))}`;
    if (payload.genLanguage) {
      url += `&gen_lang=${encodeURIComponent(resolveLanguage(payload.genLanguage))}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref_audio_base64: refAudioBase64,
          ref_text: payload.refText,
          gen_text: payload.text,
        }),
      });
    } catch {
      throw new Error('Voice generation service is unavailable. Check your connection and try again.');
    }

    if (!response.ok) {
      throw new Error(await buildErrorMessage(response));
    }

    const result = (await response.json()) as { audio_base64?: string };
    if (!result?.audio_base64) {
      throw new Error('The service returned no audio. Please try again, or try a different voice sample.');
    }

    return URL.createObjectURL(base64ToBlob(result.audio_base64, 'audio/wav'));
  } catch (error) {
    console.error('TTS Generation failed:', error);
    throw error;
  }
};
