import React from 'react';

export interface TTSRequest {
  refAudio: Blob;
  refText: string;
  text: string;
  language?: string;
  nfeStep?: number;
  speed?: number;
  genTextIsIpa?: boolean;
  checkpointId?: string;
}

export interface TTSCheckpoint {
  id: string;
  name: string;
  run: string;
  file: string;
  checkpoint: string;
  vocab: string;
  config: string;
  tokenizer: string;
  is_default: boolean;
}

export interface TTSGenerationResult {
  audioUrl: string;
  rtf: number | null;
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
  region: string;
  audioUrl: string;
  audioPath?: string;
  refText: string;
}
