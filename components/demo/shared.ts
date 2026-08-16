import { useEffect, useState } from 'react';
import { BharatGenVoice } from '../../types';
import { LANGUAGE_DEMOS } from '../../constants';

export type TabId = 'clone' | 'bharatgen' | 'accents';

/**
 * The three inputs a generation needs, tracked per tab so switching tabs never
 * leaks one tab's text / transcript / reference audio into another.
 */
export interface VoiceSession {
  /** Text to synthesise. */
  genText: string;
  setGenText: (text: string) => void;
  /** Transcript of the reference audio — required for style matching. */
  refText: string;
  setRefText: (text: string) => void;
  /** Reference audio the voice is cloned from. */
  refFile: File | null;
  setRefFile: (file: File | null) => void;
  /** Object URL for previewing `refFile`; null while there is no reference audio. */
  refPreviewUrl: string | null;
  clearRef: () => void;
}

/** Reference-audio playback — owned by the shell, shared with each tab's UI. */
export interface RefPreview {
  url: string | null;
  isPlaying: boolean;
  toggle: () => void;
}

/**
 * What the shell (text box, Generate button, status bar) needs from whichever tab
 * is active. Everything else stays inside that tab's own file.
 */
export interface TabController {
  session: VoiceSession;
  /** Language id sent to the TTS backend. */
  language: string;
  /** Tab-level load error, rendered by that tab's own panel. */
  error: string | null;
  /** Hint under the disabled Generate button while there is no reference audio. */
  emptyRefHint: string;
  /** Error shown if Generate is triggered without reference audio. */
  missingRefError: string;
  closeMenus: () => void;
}

export const DEFAULT_GEN_TEXT = LANGUAGE_DEMOS[0].demos[0].actual_text;

export const useVoiceSession = (initialGenText: string = DEFAULT_GEN_TEXT): VoiceSession => {
  const [genText, setGenText] = useState(initialGenText);
  const [refText, setRefText] = useState('');
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!refFile) {
      setRefPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(refFile);
    setRefPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [refFile]);

  const clearRef = () => {
    setRefFile(null);
    setRefText('');
  };

  return { genText, setGenText, refText, setRefText, refFile, setRefFile, refPreviewUrl, clearRef };
};

/**
 * The app is served under VITE_APP_BASE (default `/sooktam/`), so bundled asset
 * paths must be prefixed with BASE_URL. Absolute URLs pass through.
 */
export const resolveAssetUrl = (url: string) => {
  if (/^https?:\/\//.test(url)) return url;
  const base = (import.meta as any).env?.BASE_URL || '/';
  return `${base}${url.replace(/^\//, '')}`;
};

export const loadAudioAsFile = async (url: string, filename: string) => {
  const resolvedUrl = resolveAssetUrl(url);
  let response: Response;
  try {
    response = await fetch(resolvedUrl);
  } catch {
    throw new Error("Couldn't reach the server to load this voice. Check your connection and try again.");
  }
  if (!response.ok) {
    throw new Error("Couldn't load this voice's audio sample. Try selecting a different voice.");
  }
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'audio/wav' });
};

/** Fetches one of the voice catalogs shipped as static JSON in `public/`. */
export const fetchVoices = async (path: string, unavailable: string, unreachable: string) => {
  let response: Response;
  try {
    response = await fetch(resolveAssetUrl(path));
  } catch {
    throw new Error(unreachable);
  }
  if (!response.ok) throw new Error(unavailable);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(unavailable);
  return data as BharatGenVoice[];
};

/**
 * Hydrates a session from a catalog voice: its transcript and sample text land
 * immediately, its audio once fetched. Shared by the BharatGen and Accents tabs,
 * which pick from different catalogs but hydrate the same way. Returns a load error.
 */
export const useVoiceHydration = (
  voice: BharatGenVoice | null,
  session: VoiceSession,
  resolveGenText: (voice: BharatGenVoice) => string
): string | null => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!voice) return;
    let isActive = true;
    setError(null);
    session.setRefText(voice.refText || '');
    session.setGenText(resolveGenText(voice));

    const load = async () => {
      try {
        const file = await loadAudioAsFile(voice.audioUrl, `${voice.id}.wav`);
        if (isActive) session.setRefFile(file);
      } catch (err: any) {
        if (isActive) setError(err?.message || "Couldn't load this voice. Try selecting a different one.");
      }
    };
    load();

    return () => {
      isActive = false;
    };
    // Re-hydrate only when the selected voice changes — not when the user edits the
    // session's text, which would otherwise overwrite what they typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice?.id]);

  return error;
};
