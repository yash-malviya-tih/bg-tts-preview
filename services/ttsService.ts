import { API_URL } from '../constants';
import { TTSCheckpoint, TTSGenerationResult, TTSRequest } from '../types';

const LANGUAGE_MAP: Record<string, string> = {
  as: 'as',
  assamese: 'as',
  bn: 'bn',
  bengali: 'bn',
  brx: 'brx',
  bodo: 'brx',
  doi: 'doi',
  dogri: 'doi',
  en: 'en',
  english: 'en',
  indian_english: 'en',
  hi: 'hi',
  hindi: 'hi',
  gu: 'gu',
  gujarati: 'gu',
  kn: 'kn',
  kannada: 'kn',
  ks: 'ks',
  kashmiri: 'ks',
  kok: 'kok',
  konkani: 'kok',
  mai: 'mai',
  maithili: 'mai',
  ml: 'ml',
  malayalam: 'ml',
  mni: 'mni',
  manipuri: 'mni',
  mr: 'mr',
  marathi: 'mr',
  ne: 'ne',
  nepali: 'ne',
  or: 'or',
  odia: 'or',
  oriya: 'or',
  pa: 'pa',
  punjabi: 'pa',
  sa: 'sa',
  sanskrit: 'sa',
  sat: 'sat',
  santali: 'sat',
  sd: 'sd',
  sindhi: 'sd',
  ta: 'ta',
  tamil: 'ta',
  te: 'te',
  telugu: 'te',
  ur: 'ur',
  urdu: 'ur'
};

const TARGET_SAMPLE_RATE = 24000;

const buildTtsApiUrl = (path: string) => {
  const base = API_URL.replace(/\/synthesize\/upload\/?$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const resolveLanguage = (language?: string) => {
  const normalized = (language || '').trim().toLowerCase();
  if (!normalized) return 'hindi';
  return LANGUAGE_MAP[normalized] || normalized;
};

const mixToMono = (audioBuffer: AudioBuffer) => {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const mono = new Float32Array(audioBuffer.length);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < audioBuffer.length; i += 1) {
      mono[i] += channelData[i] / audioBuffer.numberOfChannels;
    }
  }
  return mono;
};

const encodeWav = (samples: Float32Array, sampleRate: number) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
};

const normalizeReferenceAudio = async (audio: Blob) => {
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) {
    return audio;
  }

  let audioContext: AudioContext | null = null;
  try {
    audioContext = new AudioContextCtor();
    const inputBuffer = await audio.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(inputBuffer.slice(0));
    const mono = mixToMono(decoded);
    const frameCount = Math.max(1, Math.ceil(mono.length * TARGET_SAMPLE_RATE / decoded.sampleRate));
    const offlineContext = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
    const monoBuffer = offlineContext.createBuffer(1, mono.length, decoded.sampleRate);
    monoBuffer.copyToChannel(mono, 0);

    const source = offlineContext.createBufferSource();
    source.buffer = monoBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    const rendered = await offlineContext.startRendering();
    const wav = encodeWav(rendered.getChannelData(0), TARGET_SAMPLE_RATE);
    const audioName = audio instanceof File ? audio.name.replace(/.[^/.]+$/, '') : 'reference';
    return new File([wav], audioName + '.wav', { type: 'audio/wav' });
  } catch (error) {
    console.warn('Failed to normalize reference audio, using original file.', error);
    return audio;
  } finally {
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close().catch(() => undefined);
    }
  }
};

const readNumericHeader = (headers: Headers, key: string): number | null => {
  const value = headers.get(key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

export const generateSpeech = async (payload: TTSRequest): Promise<TTSGenerationResult> => {
  try {
    const formData = new FormData();
    formData.append('text', payload.text);
    formData.append('ref_text', payload.refText);
    formData.append('language', resolveLanguage(payload.language));
    formData.append('nfe_step', String(payload.nfeStep ?? 32));
    formData.append('speed', String(payload.speed ?? 1));
    formData.append('gen_text_is_ipa', String(payload.genTextIsIpa ?? false));
    if (payload.checkpointId) {
      formData.append('checkpoint_id', payload.checkpointId);
    }

    const normalizedRefAudio = await normalizeReferenceAudio(payload.refAudio);
    const audioName = normalizedRefAudio instanceof File ? normalizedRefAudio.name : 'reference.wav';
    formData.append('ref_audio', normalizedRefAudio, audioName);

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

    return {
      audioUrl: URL.createObjectURL(audioBlob),
      rtf: readNumericHeader(response.headers, 'x-inference-rtf'),
    };
  } catch (error) {
    console.error('TTS Generation failed:', error);
    throw error;
  }
};


export const fetchCheckpoints = async (): Promise<TTSCheckpoint[]> => {
  const response = await fetch(buildTtsApiUrl('/checkpoints'));
  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }
  const payload = await response.json() as { checkpoints?: TTSCheckpoint[] };
  return Array.isArray(payload.checkpoints) ? payload.checkpoints : [];
};
