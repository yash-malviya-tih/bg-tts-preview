import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Loader2, FileAudio, Zap, Globe, ChevronDown, Check, X, RefreshCw, Mic, Square, Search, Shuffle, SlidersHorizontal, Cpu } from 'lucide-react';
import { fetchCheckpoints, generateSpeech } from '../services/ttsService';
import { buildAppUrl, LANGUAGE_DEMOS } from '../constants';
import { BharatGenVoice, TTSCheckpoint } from '../types';
import LogoVisualizer from './LogoVisualizer';


const DemoWidget: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<'clone' | 'bharatgen'>('bharatgen');
  const [selectedLang, setSelectedLang] = useState(LANGUAGE_DEMOS[0]);
  const [selectedDemoIdx, setSelectedDemoIdx] = useState(0);
  const [cloneSelectedLang, setCloneSelectedLang] = useState(LANGUAGE_DEMOS[0]);
  const [cloneSelectedDemoIdx, setCloneSelectedDemoIdx] = useState(0);
  const [cloneRefFile, setCloneRefFile] = useState<File | null>(null);
  const [cloneRefText, setCloneRefText] = useState('');
  const [cloneRefSource] = useState<'upload'>('upload');
  const [cloneUploadFile, setCloneUploadFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [bharatgenVoices, setBharatgenVoices] = useState<BharatGenVoice[]>([]);
  const [bharatgenError, setBharatgenError] = useState<string | null>(null);
  const [bharatgenSelectedId, setBharatgenSelectedId] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<TTSCheckpoint[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string>('');
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [bharatgenRefFile, setBharatgenRefFile] = useState<File | null>(null);
  const [bharatgenRefText, setBharatgenRefText] = useState('');
  const [genText, setGenText] = useState(LANGUAGE_DEMOS[0].demos[0].actual_text);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);
  const [isRefPlaying, setIsRefPlaying] = useState(false);
  const [generationMs, setGenerationMs] = useState<number | null>(null);
  const [inferenceRtf, setInferenceRtf] = useState<number | null>(null);
  const generateStartRef = useRef<number | null>(null);
  
  // UI State
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isBharatgenOpen, setIsBharatgenOpen] = useState(false);
  const [isCheckpointOpen, setIsCheckpointOpen] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [useIpaInput, setUseIpaInput] = useState(false);
  const [ipaText, setIpaText] = useState('');

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const refPreviewRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const activeRefFile = activeTab === 'clone' ? cloneRefFile : bharatgenRefFile;
  const activeRefText = activeTab === 'clone' ? cloneRefText : bharatgenRefText;
  const activeRefSource = activeTab === 'clone' ? cloneRefSource : 'bharatgen';
  const selectedBharatgenVoice = bharatgenVoices.find((voice) => voice.id === bharatgenSelectedId);
  const selectedCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === selectedCheckpointId);
  const normalizedVoiceSearch = voiceSearch.trim().toLowerCase();
  const visibleBharatgenVoices = normalizedVoiceSearch
    ? bharatgenVoices.filter((voice) =>
        [voice.name, voice.languageName, voice.languageId, voice.id]
          .some((value) => value.toLowerCase().includes(normalizedVoiceSearch))
      )
    : bharatgenVoices;
  const activeLanguageName = activeTab === 'bharatgen'
    ? selectedBharatgenVoice?.languageName || selectedLang.name
    : selectedLang.name;
  const activeVoiceName = activeTab === 'bharatgen'
    ? selectedBharatgenVoice?.name || 'BharatGen preset'
    : cloneUploadFile?.name || 'Custom voice';

  // Effects
  useEffect(() => {
    setGenText(selectedLang.demos[selectedDemoIdx].actual_text);
  }, [selectedLang, selectedDemoIdx]);

  const resolveAssetUrl = (url: string) => {
    if (/^https?:\/\//.test(url)) return url;
    return buildAppUrl(url);
  };

  const loadAudioAsFile = async (url: string, filename: string) => {
    const resolvedUrl = resolveAssetUrl(url);
    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      throw new Error(`Audio not found (${response.status})`);
    }
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'audio/wav' });
  };

  useEffect(() => {
    if (activeTab !== 'clone') return;
    setCloneSelectedLang(selectedLang);
    setCloneSelectedDemoIdx(selectedDemoIdx);
  }, [activeTab, selectedLang, selectedDemoIdx]);

  useEffect(() => {
    if (activeTab !== 'clone') return;
    setSelectedLang(cloneSelectedLang);
    setSelectedDemoIdx(cloneSelectedDemoIdx);
  }, [activeTab, cloneSelectedLang, cloneSelectedDemoIdx]);



  useEffect(() => {
    let isActive = true;
    const loadCheckpoints = async () => {
      try {
        setCheckpointError(null);
        const items = await fetchCheckpoints();
        if (!isActive) return;
        setCheckpoints(items);
        const preferred = items.find((checkpoint) => checkpoint.is_default) || items[0];
        if (preferred) {
          setSelectedCheckpointId((current) => current || preferred.id);
        }
      } catch (err: any) {
        if (!isActive) return;
        setCheckpointError(err?.message || 'Failed to load checkpoints');
      }
    };
    loadCheckpoints();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const loadVoices = async () => {
      try {
        setBharatgenError(null);
        const response = await fetch(resolveAssetUrl('/api/tts/voices'));
        if (!response.ok) {
          throw new Error(`Failed to load voices (${response.status})`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('Invalid voices data');
        }
        if (!isActive) return;
        const voices = data as BharatGenVoice[];
        setBharatgenVoices(voices);
        if (!bharatgenSelectedId && voices.length > 0) {
          const preferred = voices.find((voice) => voice.id === 'hi') || voices[0];
          setBharatgenSelectedId(preferred.id);
        }
      } catch (err: any) {
        if (!isActive) return;
        setBharatgenError(err?.message || 'Failed to load BharatGen voices');
      }
    };
    loadVoices();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!bharatgenSelectedId) return;
    const selected = bharatgenVoices.find((voice) => voice.id === bharatgenSelectedId);
    if (!selected) return;

    let isActive = true;
    const loadVoice = async () => {
      try {
        setBharatgenError(null);
        setBharatgenRefText(selected.refText || '');
        const file = await loadAudioAsFile(selected.audioUrl, `${selected.id}.wav`);
        if (!isActive) return;
        setBharatgenRefFile(file);
      } catch (err: any) {
        if (!isActive) return;
        setBharatgenError(err?.message || 'Failed to load voice');
      }
    };
    loadVoice();

    if (activeTab === 'bharatgen') {
      const matchingLang = LANGUAGE_DEMOS.find((lang) => lang.id === selected.languageId);
      if (matchingLang) {
        setSelectedLang(matchingLang);
        setSelectedDemoIdx(0);
      }
    }

    return () => {
      isActive = false;
    };
  }, [bharatgenSelectedId, bharatgenVoices, activeTab]);

  // Auto-play when audio is generated
  useEffect(() => {
    if (generatedAudioUrl && audioRef.current) {
        audioRef.current.play().catch(() => {
            // Auto-play might be blocked by browser
        });
        setIsPlaying(true);
    }
  }, [generatedAudioUrl]);

  useEffect(() => {
    if (!activeRefFile) {
      setRefPreviewUrl(null);
      setIsRefPlaying(false);
      return;
    }
    const url = URL.createObjectURL(activeRefFile);
    setRefPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [activeRefFile]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const start = generateStartRef.current ?? performance.now();
    generateStartRef.current = start;
    const tick = () => setGenerationMs(performance.now() - start);
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [isLoading]);

  const handleReferenceFile = (file: File) => {
    setActiveTab('clone');
    setCloneRefFile(file);
    setCloneUploadFile(file);
    setRecordingError(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleReferenceFile(e.target.files[0]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Audio recording is not supported in this browser');
      return;
    }

    try {
      setRecordingError(null);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingError('Recording failed');
        setIsRecording(false);
      };

      recorder.onstop = () => {
        setIsRecording(false);
        const mimeType = recorder.mimeType || 'audio/webm';
        const extension = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const recordedBlob = new Blob(recordingChunksRef.current, { type: mimeType });
        recordingChunksRef.current = [];

        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((track) => track.stop());
          recordingStreamRef.current = null;
        }

        if (!recordedBlob.size) {
          setRecordingError('No audio was captured');
          return;
        }

        const recordedFile = new File([recordedBlob], `recorded-reference.${extension}`, { type: mimeType });
        handleReferenceFile(recordedFile);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setRecordingError(err?.message || 'Microphone access was denied');
      setIsRecording(false);
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      }
    }
  };

  const pickRandomDemo = () => {
    const nextLang = activeTab === 'bharatgen'
      ? selectedLang
      : LANGUAGE_DEMOS[Math.floor(Math.random() * LANGUAGE_DEMOS.length)];
    const nextIdx = Math.floor(Math.random() * nextLang.demos.length);
    setSelectedLang(nextLang);
    setSelectedDemoIdx(nextIdx);
    setGenText(nextLang.demos[nextIdx].actual_text);
  };

  const handleGenerate = async () => {
    if (!activeRefFile) {
        setError(activeTab === 'bharatgen' ? "Select a BharatGen voice first" : "Upload a voice sample first");
        return;
    }
    if (!activeRefText.trim()) {
        setError("Reference text is required");
        return;
    }
    const isUsingIpa = activeTab === 'bharatgen' && useIpaInput;
    const requestText = isUsingIpa ? ipaText : genText;

    if (!requestText.trim()) {
        setError(isUsingIpa ? "Enter IPA tokens to generate" : "Enter text to generate");
        return;
    }

    setError(null);
    setIsLoading(true);
    setGenerationMs(0);
    generateStartRef.current = performance.now();
    // Stop current audio if playing
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
    setGeneratedAudioUrl(null);
    setInferenceRtf(null);

    try {
      const result = await generateSpeech({
        refAudio: activeRefFile,
        refText: activeRefText,
        text: requestText,
        language: selectedLang.id,
        genTextIsIpa: isUsingIpa,
        checkpointId: selectedCheckpointId
      });
      setGeneratedAudioUrl(result.audioUrl);
      setInferenceRtf(result.rtf);
      if (generateStartRef.current) {
        setGenerationMs(performance.now() - generateStartRef.current);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate speech.");
      setInferenceRtf(null);
      setIsLoading(false);
    } finally {
        if (!generatedAudioUrl) setIsLoading(false); // Only set loading false here if error, otherwise wait for audio load
    }
  };

  const onAudioLoadStart = () => setIsLoading(true);
  const onAudioLoadedData = () => setIsLoading(false);

  const togglePlay = () => {
    if (!audioRef.current || !generatedAudioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const toggleRefPlay = () => {
    if (!refPreviewRef.current || !refPreviewUrl) return;
    if (isRefPlaying) {
      refPreviewRef.current.pause();
    } else {
      refPreviewRef.current.play();
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (refPreviewRef.current) {
      refPreviewRef.current.pause();
      refPreviewRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsRefPlaying(false);
  };

  const handleTabChange = (tab: 'clone' | 'bharatgen') => {
    if (tab === activeTab) return;
    stopPlayback();
    setActiveTab(tab);
    setError(null);
    setIsLangOpen(false);
    setIsBharatgenOpen(false);
    setInferenceRtf(null);
    setRecordingError(null);
    if (tab !== 'clone' && isRecording) {
      stopRecording();
    }
  };

  const isGenerateDisabled =
    isLoading || !activeRefFile;

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[600px] bg-white">
        
      {/* --- LEFT COLUMN: INPUT CANVAS --- */}
      <div className="flex-1 flex flex-col p-6 md:p-10 relative">
        
        {/* Top Tabs */}
        <div className="flex items-center gap-2 mb-6">
            <button
                onClick={() => handleTabChange('clone')}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${
                  activeTab === 'clone'
                    ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))] shadow-sm'
                    : 'bg-slate-50 text-slate-500 hover:text-[color:rgb(var(--brand-blue))]'
                }`}
            >
                <Zap size={14} className="text-[color:rgb(var(--brand-orange))] fill-[color:rgb(var(--brand-orange))]" />
                Voice Cloning
            </button>
            <button
                onClick={() => handleTabChange('bharatgen')}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  activeTab === 'bharatgen'
                    ? 'bg-[color:rgb(var(--brand-orange)/0.12)] text-[color:rgb(var(--brand-orange))] shadow-sm'
                    : 'bg-slate-50 text-slate-500 hover:text-[color:rgb(var(--brand-orange))]'
                }`}
            >
                BharatGen Voices
            </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Experiment</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">{activeLanguageName}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>{activeVoiceName}</span>
                    <span className="rounded-full bg-[color:rgb(var(--brand-blue)/0.08)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:rgb(var(--brand-blue))]">
                        {activeTab === 'bharatgen' && useIpaInput ? 'IPA' : activeTab === 'bharatgen' ? 'Preset' : 'Clone'}
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                    <button
                        type="button"
                        onClick={() => setIsCheckpointOpen((prev) => !prev)}
                        disabled={checkpoints.length === 0}
                        className="flex h-9 w-full items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-[color:rgb(var(--brand-blue)/0.45)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <Cpu size={13} className="shrink-0 text-[color:rgb(var(--brand-blue))]" />
                            <span className="truncate">{selectedCheckpoint?.file || 'Checkpoint'}</span>
                        </span>
                        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${isCheckpointOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isCheckpointOpen && checkpoints.length > 0 && (
                        <div className="absolute right-0 top-full z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-100 bg-white p-1 shadow-xl">
                            {checkpoints.map((checkpoint) => (
                                <button
                                    key={checkpoint.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCheckpointId(checkpoint.id);
                                        setIsCheckpointOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs ${selectedCheckpointId === checkpoint.id ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))]' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate font-semibold">{checkpoint.file}</span>
                                        <span className="block truncate text-[10px] text-slate-400">{checkpoint.tokenizer} · {checkpoint.config}</span>
                                    </span>
                                    {selectedCheckpointId === checkpoint.id && <Check size={14} className="shrink-0" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={pickRandomDemo}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-[color:rgb(var(--brand-orange)/0.45)] hover:text-[color:rgb(var(--brand-orange))]"
                >
                    <Shuffle size={13} />
                    Sample Text
                </button>
            </div>
        </div>

        {/* Text Input Area */}
        <div className="relative group">
            <textarea
                value={genText}
                onChange={(e) => setGenText(e.target.value)}
                placeholder="Type something here to generate speech..."
                className="w-full h-[120px] md:h-[140px] lg:h-[150px] resize-none text-base md:text-lg font-light text-slate-800 placeholder:text-slate-300 outline-none bg-transparent leading-relaxed"
                maxLength={300}
                spellCheck={false}
            />
            {/* Character Count */}
            <div className="absolute bottom-0 right-0 text-xs text-slate-300 font-medium">
                {genText.length}/300
            </div>
        </div>

        {/* Visualizer */}
        <div className="mt-12 mb-10 flex flex-col items-center justify-center gap-4">
            <div className="relative flex items-center justify-center px-2 py-1 rounded-full">
                <div
                    className="absolute inset-0 rounded-full blur-3xl opacity-70 pointer-events-none"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(var(--brand-orange), 0.35) 0%, rgba(var(--brand-blue), 0.28) 45%, rgba(255,255,255,0) 72%)'
                    }}
                />
            <div className="relative">
                <LogoVisualizer audioElementRef={audioRef} isPlaying={isLoading || isPlaying} />
            </div>
        </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                <div className="flex flex-col gap-2">
                    {(error || checkpointError) ? (
                        <div className="text-red-500 text-sm font-medium px-4 py-2 bg-red-50 rounded-lg animate-fade-in">
                            {error || checkpointError}
                        </div>
                    ) : (
                        <div className="text-slate-400 text-sm flex items-center gap-2">
                           {generatedAudioUrl && <Check size={16} className="text-green-500" />}
                           {isLoading
                             ? "Generating audio..."
                             : generatedAudioUrl
                               ? "Audio generated successfully"
                               : "Ready to generate"}
                           {(isLoading || generatedAudioUrl) && generationMs !== null && (
                             <span className="text-[11px] text-slate-400">
                               {(generationMs / 1000).toFixed(2)}s
                             </span>
                           )}
                           {generatedAudioUrl && inferenceRtf !== null && (
                             <span className="text-[11px] text-slate-400">
                               RTF {inferenceRtf.toFixed(3)}x
                             </span>
                           )}
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        {generatedAudioUrl && (
                            <button 
                                onClick={togglePlay}
                                className="px-5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors flex items-center gap-2"
                            >
                                {isPlaying ? "Pause" : "Replay"}
                            </button>
                        )}
                        {!generatedAudioUrl && !isLoading && (
                             <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                Waiting for input
                             </p>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isGenerateDisabled}
                    className={`
                        group relative px-8 py-4 rounded-full font-bold text-white shadow-lg transition-all duration-300
                        flex items-center gap-3 overflow-hidden
                        ${isGenerateDisabled 
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                            : 'bg-gradient-to-r from-[color:rgb(var(--brand-orange))] to-[color:rgb(var(--brand-blue))] hover:scale-105 hover:shadow-[0_20px_40px_-20px_rgb(var(--brand-orange)/0.6)]'}
                    `}
                >
                    {/* Gradient animation overlay */}
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    
                    {isLoading ? (
                        <Loader2 className="animate-spin w-5 h-5" />
                    ) : (
                        <div className="bg-white rounded-full p-1">
                             <Play size={12} className="text-[color:rgb(var(--brand-orange))] fill-[color:rgb(var(--brand-orange))] translate-x-0.5" />
                        </div>
                    )}
                    <span>Generate Speech</span>
                </button>
            </div>

            <audio 
                ref={audioRef}
                src={generatedAudioUrl || undefined}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onLoadStart={onAudioLoadStart}
                onLoadedData={onAudioLoadedData}
                onError={() => {
                    setIsLoading(false);
                    setError('Failed to load generated audio');
                }}
            />
            <audio
                ref={refPreviewRef}
                src={refPreviewUrl || undefined}
                onPlay={() => setIsRefPlaying(true)}
                onPause={() => setIsRefPlaying(false)}
                onEnded={() => setIsRefPlaying(false)}
            />
        </div>
      </div>


      {/* --- RIGHT COLUMN: SETTINGS SIDEBAR --- */}
      <div className="w-full lg:w-[400px] bg-slate-50/50 border-l border-slate-100 p-6 md:p-8 flex flex-col gap-8">

        {/* Settings Form */}
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {activeTab === 'clone' ? 'Reference Voice' : 'BharatGen Voices'}
                </label>
            </div>

            {activeTab === 'clone' ? (
                <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custom Upload</label>
                        {!cloneUploadFile ? (
                            <div className="space-y-3">
                                <div className="relative group">
                                    <input 
                                        type="file" 
                                        accept=".wav,audio/*"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="h-20 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 group-hover:bg-[color:rgb(var(--brand-orange)/0.12)] group-hover:border-[color:rgb(var(--brand-orange)/0.4)] transition-all flex flex-col items-center justify-center gap-1">
                                        <Upload className="text-slate-400 group-hover:text-[color:rgb(var(--brand-orange))] transition-colors" size={20} />
                                        <span className="text-xs font-medium text-slate-500 group-hover:text-[color:rgb(var(--brand-orange))]">Upload Reference Voice</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`w-full h-11 rounded-xl border text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                                      isRecording
                                        ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                                        : 'border-[color:rgb(var(--brand-blue)/0.2)] bg-[color:rgb(var(--brand-blue)/0.08)] text-[color:rgb(var(--brand-blue))] hover:bg-[color:rgb(var(--brand-blue)/0.14)]'
                                    }`}
                                >
                                    {isRecording ? <Square size={16} /> : <Mic size={16} />}
                                    <span>{isRecording ? 'Stop Recording' : 'Record Audio'}</span>
                                </button>
                                {recordingError && (
                                    <div className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                                        {recordingError}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-3 bg-white border border-[color:rgb(var(--brand-orange)/0.4)] rounded-xl shadow-sm flex items-center justify-between gap-3">
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-full bg-[color:rgb(var(--brand-orange)/0.16)] flex items-center justify-center text-[color:rgb(var(--brand-orange))]">
                                         <FileAudio size={20} />
                                     </div>
                                     <div className="flex flex-col">
                                         <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">
                                            {cloneUploadFile.name}
                                         </span>
                                         <span className="text-[10px] text-slate-400">
                                            Custom Voice
                                         </span>
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    {refPreviewUrl && (
                                        <button
                                            onClick={toggleRefPlay}
                                            className="h-7 w-7 rounded-full bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))] flex items-center justify-center hover:bg-[color:rgb(var(--brand-blue)/0.2)] transition-colors"
                                            title={isRefPlaying ? 'Pause reference' : 'Play reference'}
                                        >
                                            {isRefPlaying ? <Pause size={12} /> : <Play size={12} className="translate-x-[1px]" />}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                          setCloneUploadFile(null);
                                          setCloneRefFile(null);
                                          setCloneRefText('');
                                          setRecordingError(null);
                                        }}
                                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                         <X size={16} />
                                    </button>
                                 </div>
                            </div>
                        )}
                </div>
            ) : (
                <div className="space-y-3">
                    {bharatgenError && (
                        <div className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                            {bharatgenError}
                        </div>
                    )}
                    <div className="relative">
                        <div className="mb-2 flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm">
                            <Search size={15} />
                            <input
                                value={voiceSearch}
                                onChange={(e) => setVoiceSearch(e.target.value)}
                                placeholder="Search language or voice"
                                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                            />
                            {voiceSearch && (
                                <button
                                    type="button"
                                    onClick={() => setVoiceSearch('')}
                                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                    title="Clear search"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setIsBharatgenOpen((prev) => !prev)}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between hover:border-[color:rgb(var(--brand-blue))] transition-colors"
                        >
                            <div className="text-left">
                                <div className="text-sm font-bold text-slate-700">
                                    {selectedBharatgenVoice?.name || 'Select a voice'}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {selectedBharatgenVoice?.languageName || 'Select language'}
                                </div>
                            </div>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isBharatgenOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isBharatgenOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto p-1">
                                {visibleBharatgenVoices.map((voice) => {
                                    const isSelected = voice.id === bharatgenSelectedId;
                                    return (
                                        <button
                                            key={voice.id}
                                            onClick={() => {
                                                setBharatgenSelectedId(voice.id);
                                                setIsBharatgenOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                                                isSelected
                                                  ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))]'
                                                  : 'hover:bg-slate-50 text-slate-600'
                                            }`}
                                        >
                                            <span className="font-semibold">{voice.name}</span>
                                            <span className="text-[10px] text-slate-400">{voice.languageName}</span>
                                        </button>
                                    );
                                })}
                                {visibleBharatgenVoices.length === 0 && (
                                    <div className="px-3 py-4 text-center text-xs text-slate-400">
                                        No matching voices
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {activeRefSource === 'bharatgen' && refPreviewUrl && (
                        <button
                            onClick={toggleRefPlay}
                            className="mt-1 inline-flex items-center gap-2 text-[11px] text-[color:rgb(var(--brand-blue))] hover:text-[color:rgb(var(--brand-orange))] transition-colors"
                        >
                            {isRefPlaying ? <Pause size={12} /> : <Play size={12} />}
                            Preview selected voice
                        </button>
                    )}
                </div>
            )}

            {/* Transcript Input */}
            <div className="pt-2">
                <input 
                    type="text"
                    value={activeRefText}
                    onChange={(e) => {
                        if (activeTab === 'clone') {
                            setCloneRefText(e.target.value);
                        } else {
                            setBharatgenRefText(e.target.value);
                        }
                    }}
                    placeholder={activeTab === 'clone' ? 'Enter reference text manually...' : 'Reference transcript'}
                    className="w-full text-xs bg-slate-100 border-none rounded-lg px-3 py-2 text-slate-600 focus:ring-1 focus:ring-[color:rgb(var(--brand-orange))] placeholder-slate-400"
                />
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 pl-1">
                    <span>*Required for accurate cloning style matching. Add the spoken reference text manually.</span>
                    {activeTab === 'bharatgen' && (
                        <span>Preset transcript</span>
                    )}
                </div>
            </div>

            {/* 2. Language Selector */}
            {activeTab === 'clone' ? (
                <div className="space-y-2 relative">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Output Language</label>
                    
                    <div className="relative">
                        <button 
                            onClick={() => setIsLangOpen(!isLangOpen)}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between hover:border-[color:rgb(var(--brand-blue))] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))] flex items-center justify-center">
                                    <Globe size={16} />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-slate-700">{selectedLang.name}</div>
                                    <div className="text-[10px] text-slate-400">{selectedLang.scriptLabel}</div>
                                </div>
                            </div>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown */}
                        {isLangOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto p-1">
                                {LANGUAGE_DEMOS.map((lang) => (
                                    <button
                                        key={lang.id}
                                        onClick={() => {
                                            setSelectedLang(lang);
                                            setSelectedDemoIdx(0);
                                            setIsLangOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${selectedLang.id === lang.id ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))]' : 'hover:bg-slate-50 text-slate-600'}`}
                                    >
                                        <span>{lang.name}</span>
                                        {selectedLang.id === lang.id && <Check size={14} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Preset Chips */}
                    <div className="flex flex-wrap gap-2 pt-1">
                        {selectedLang.demos.map((demo, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedDemoIdx(idx)}
                                className={`
                                    text-[10px] font-medium px-2 py-1 rounded-md border transition-all flex items-center gap-1
                                    ${selectedDemoIdx === idx 
                                        ? 'bg-[color:rgb(var(--brand-orange)/0.12)] border-[color:rgb(var(--brand-orange)/0.35)] text-[color:rgb(var(--brand-orange))]' 
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}
                                `}
                            >
                                {demo.type === 'Code-Mix' && <RefreshCw size={8} />}
                                {demo.title}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-500">
                        <div className="font-semibold text-slate-700">{selectedLang.name}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">Output language follows the selected preset voice.</div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {selectedLang.demos.map((demo, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedDemoIdx(idx)}
                                className={`
                                    text-[10px] font-medium px-2 py-1 rounded-md border transition-all flex items-center gap-1
                                    ${selectedDemoIdx === idx
                                        ? 'bg-[color:rgb(var(--brand-orange)/0.12)] border-[color:rgb(var(--brand-orange)/0.35)] text-[color:rgb(var(--brand-orange))]'
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}
                                `}
                            >
                                {demo.type === 'Code-Mix' && <RefreshCw size={8} />}
                                {demo.title}
                            </button>
                        ))}
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white">
                        <button
                            type="button"
                            onClick={() => setIsAdvancedOpen((prev) => !prev)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-400"
                        >
                            <span className="inline-flex items-center gap-2">
                                <SlidersHorizontal size={13} />
                                Advanced
                            </span>
                            <ChevronDown size={14} className={`transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isAdvancedOpen && (
                            <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-2">
                                <label className="flex items-center justify-between gap-3 text-xs text-slate-600">
                                    <span className="font-semibold">Use IPA tokens</span>
                                    <input
                                        type="checkbox"
                                        checked={useIpaInput}
                                        onChange={(e) => setUseIpaInput(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-[color:rgb(var(--brand-blue))] focus:ring-[color:rgb(var(--brand-blue))]"
                                    />
                                </label>
                                {useIpaInput && (
                                    <textarea
                                        value={ipaText}
                                        onChange={(e) => setIpaText(e.target.value)}
                                        placeholder="b oː l iː <l_hi>"
                                        className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-[color:rgb(var(--brand-orange)/0.55)] focus:bg-white"
                                        spellCheck={false}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>

      </div>
    </div>
  );
};

export default DemoWidget;
