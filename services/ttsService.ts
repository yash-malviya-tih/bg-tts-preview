import { API_URL } from '../constants';
import { TTSRequest } from '../types';

const LANGUAGE_MAP: Record<string, string> = {
  en: 'english',
  english: 'english',
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
  sa: 'sanskrit',
  sanskrit: 'sanskrit',
  or: 'odia',
  odia: 'odia',
  oriya: 'odia',
  pa: 'punjabi',
  punjabi: 'punjabi',
  zh: 'chinese',
  chinese: 'chinese',
  ja: 'japanese',
  japanese: 'japanese',
  ko: 'korean',
  korean: 'korean',
};

const resolveLanguage = (language?: string) => {
  const normalized = (language || '').trim().toLowerCase();
  if (!normalized) return 'hindi';
  return LANGUAGE_MAP[normalized] || normalized;
};

const buildErrorMessage = async (response: Response) => {
  const prefix = 'API Error: ' + response.status;
  const errorText = await response.text();

  if (!errorText) return prefix;

  try {
    const parsed = JSON.parse(errorText) as { detail?: string };
    if (parsed?.detail && typeof parsed.detail === 'string') {
      return prefix + ' - ' + parsed.detail;
    }
  } catch {
    // Ignore parsing errors and fall through to raw text.
  }

  return prefix + ' - ' + errorText;
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

    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await buildErrorMessage(response));
    }

    const audioBlob = await response.blob();
    if (!audioBlob.size) {
      throw new Error('No audio data received from server');
    }

    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error('TTS Generation failed:', error);
    throw error;
  }
};
