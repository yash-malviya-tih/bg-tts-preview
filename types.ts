import React from 'react';

export interface TTSRequest {
  refAudio: Blob;
  refText: string;
  text: string;
  language?: string;
  genLanguage?: string;
  nfeStep?: number;
  speed?: number;
}

export interface LanguageDemo {
  id: string;
  name: string;
  scriptLabel: string; // Native script label
  demos: {
    title: string;
    display_text: string; // English/Transliterated for UI
    actual_text: string; // Native script for API
    type: 'Normal' | 'Code-Mix';
  }[];
}

export interface FeatureItem {
  title: string;
  description: string;
  icon: React.ElementType;
}

export interface VoicePreset {
  id: string;
  name: string;
  audioUrl: string;
  refText?: string;
  languageId?: string;
}

export interface BharatGenVoice {
  id: string;
  name: string;
  languageId: string;
  languageName: string;
  genLanguageId?: string;
  genLanguageName?: string;
  refLanguageId?: string;
  refLanguageName?: string;
  accentName?: string;
  state: string;
  stateId: string; // matches the `id` property in data/india-states.json
  district: string;
  coordinates: [number, number]; // [lng, lat] pin location on the accent map
  audioUrl: string;
  refText: string;
  sampleGenText: string;
}

export const getAccentDisplayName = (voice: BharatGenVoice): string =>
  voice.accentName || `${voice.district} ${voice.genLanguageName ?? voice.languageName}`;
