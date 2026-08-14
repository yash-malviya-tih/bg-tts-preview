import { API_URL } from '../constants';
import { TTSRequest } from '../types';

const LANGUAGE_MAP: Record<string, string> = {
  en: 'indian_english',
  english: 'indian_english',
  indian_english: 'indian_english',
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

export const generateSpeech = async (payload: TTSRequest): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('text', payload.text);
    formData.append('ref_text', payload.refText);
    formData.append('language', resolveLanguage(payload.language));
    formData.append('nfe_step', String(payload.nfeStep ?? 32));
    formData.append('speed', String(payload.speed ?? 1));

    const audioName = payload.refAudio instanceof File ? payload.refAudio.name : 'reference.wav';
    formData.append('ref_audio', payload.refAudio, audioName);

    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });
    } catch {
      throw new Error('Voice generation service is unavailable. Check your connection and try again.');
    }

    if (!response.ok) {
      throw new Error(await buildErrorMessage(response));
    }

    const audioBlob = await response.blob();
    if (!audioBlob.size) {
      throw new Error('The service returned no audio. Please try again, or try a different voice sample.');
    }

    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error('TTS Generation failed:', error);
    throw error;
  }
};
