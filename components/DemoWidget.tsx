import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Loader2, FileAudio, Mic, Users, Globe, ChevronDown, Check, X, RefreshCw, Wand2, MapPin } from 'lucide-react';
import { generateSpeech } from '../services/ttsService';
import { LANGUAGE_DEMOS } from '../constants';
import { BharatGenVoice, LanguageDemo, getAccentDisplayName } from '../types';
import IndiaAccentMap from './IndiaAccentMap';


const DemoWidget: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<'clone' | 'bharatgen'>('bharatgen');
  const [cloneSelectedLang, setCloneSelectedLang] = useState(LANGUAGE_DEMOS[0]);
  const [cloneSelectedDemoIdx, setCloneSelectedDemoIdx] = useState(0);
  const [cloneRefFile, setCloneRefFile] = useState<File | null>(null);
  const [cloneRefText, setCloneRefText] = useState('');
  const [cloneUploadFile, setCloneUploadFile] = useState<File | null>(null);
  // null = no language filter chosen yet -> every accent's pin is shown on the map
  const [bharatgenSelectedLang, setBharatgenSelectedLang] = useState<LanguageDemo | null>(null);
  const [bharatgenVoices, setBharatgenVoices] = useState<BharatGenVoice[]>([]);
  const [bharatgenError, setBharatgenError] = useState<string | null>(null);
  const [bharatgenSelectedId, setBharatgenSelectedId] = useState<string | null>(null);
  const [bharatgenRefFile, setBharatgenRefFile] = useState<File | null>(null);
  const [bharatgenRefText, setBharatgenRefText] = useState('');
  const [hoveredAccentId, setHoveredAccentId] = useState<string | null>(null);
  const [genText, setGenText] = useState(LANGUAGE_DEMOS[0].demos[0].actual_text);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);
  const [isRefPlaying, setIsRefPlaying] = useState(false);
  const [generationMs, setGenerationMs] = useState<number | null>(null);
  const generateStartRef = useRef<number | null>(null);

  // UI State
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isBharatgenLangOpen, setIsBharatgenLangOpen] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const refPreviewRef = useRef<HTMLAudioElement>(null);
  const activeRefFile = activeTab === 'clone' ? cloneRefFile : bharatgenRefFile;
  const activeRefText = activeTab === 'clone' ? cloneRefText : bharatgenRefText;
  const selectedBharatgenAccent = bharatgenVoices.find((voice) => voice.id === bharatgenSelectedId) || null;
  // No language chosen yet -> show every accent; otherwise filter down to that language's accents.
  const bharatgenAccentsForLang = bharatgenSelectedLang
    ? bharatgenVoices.filter((voice) => voice.languageId === bharatgenSelectedLang.id)
    : bharatgenVoices;
  const bharatgenActiveStateIds = new Set(bharatgenAccentsForLang.map((voice) => voice.stateId));

  // Effects
  useEffect(() => {
    if (activeTab !== 'clone') return;
    setGenText(cloneSelectedLang.demos[cloneSelectedDemoIdx].actual_text);
  }, [cloneSelectedLang, cloneSelectedDemoIdx, activeTab]);

  const resolveAssetUrl = (url: string) => {
    if (/^https?:\/\//.test(url)) return url;
    const base = (import.meta as any).env?.BASE_URL || '/';
    return `${base}${url.replace(/^\//, '')}`;
  };

  const loadAudioAsFile = async (url: string, filename: string) => {
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

  useEffect(() => {
    let isActive = true;
    const loadVoices = async () => {
      try {
        setBharatgenError(null);
        let response: Response;
        try {
          response = await fetch(resolveAssetUrl('/bharatgen-voices.json'));
        } catch {
          throw new Error("Couldn't reach the server to load BharatGen voices. Check your connection and refresh the page.");
        }
        if (!response.ok) {
          throw new Error('Could not load BharatGen voices right now. Please refresh the page.');
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('BharatGen voices are temporarily unavailable. Please refresh the page.');
        }
        if (!isActive) return;
        setBharatgenVoices(data as BharatGenVoice[]);
        if (!bharatgenSelectedId && data.length > 0) {
          setBharatgenSelectedId(data[0].id);
        }
      } catch (err: any) {
        if (!isActive) return;
        setBharatgenError(err?.message || 'Could not load BharatGen voices right now. Please refresh the page.');
      }
    };
    loadVoices();
    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The language dropdown is a view filter, not a requirement — only force the selected
  // accent to match once a specific language has actually been chosen (not on "All languages").
  useEffect(() => {
    if (!bharatgenSelectedLang || bharatgenVoices.length === 0) return;
    const matching = bharatgenVoices.filter((voice) => voice.languageId === bharatgenSelectedLang.id);
    const stillValid = matching.some((voice) => voice.id === bharatgenSelectedId);
    if (!stillValid && matching.length > 0) {
      setBharatgenSelectedId(matching[0].id);
    }
  }, [bharatgenSelectedLang, bharatgenVoices, bharatgenSelectedId]);

  useEffect(() => {
    if (!bharatgenSelectedId) return;
    const selected = bharatgenVoices.find((voice) => voice.id === bharatgenSelectedId);
    if (!selected) return;

    let isActive = true;
    const loadVoice = async () => {
      try {
        setBharatgenError(null);
        setBharatgenRefText(selected.refText || '');
        if (activeTab === 'bharatgen') {
          setGenText(selected.sampleGenText || '');
        }
        const file = await loadAudioAsFile(selected.audioUrl, `${selected.id}.wav`);
        if (!isActive) return;
        setBharatgenRefFile(file);
      } catch (err: any) {
        if (!isActive) return;
        setBharatgenError(err?.message || "Couldn't load this voice. Try selecting a different one.");
      }
    };
    loadVoice();

    return () => {
      isActive = false;
    };
  }, [bharatgenSelectedId, bharatgenVoices, activeTab]);

  // Auto-play when audio is generated
  useEffect(() => {
    if (generatedAudioUrl && audioRef.current) {
        setAutoplayBlocked(false);
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => setAutoplayBlocked(true));
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
    if (!isLoading) return;
    const start = generateStartRef.current ?? performance.now();
    generateStartRef.current = start;
    const tick = () => setGenerationMs(performance.now() - start);
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [isLoading]);

  const MAX_UPLOAD_MB = 20;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (!['.wav', '.mp3'].some((ext) => file.name.toLowerCase().endsWith(ext))) {
        setError('Please upload a .wav or .mp3 audio file.');
        e.target.value = '';
        return;
      }
      if (file.size === 0) {
        setError('That file appears to be empty. Please choose a different audio file.');
        e.target.value = '';
        return;
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setError(`That file is too large. Please upload a sample under ${MAX_UPLOAD_MB}MB.`);
        e.target.value = '';
        return;
      }

      setActiveTab('clone');
      setCloneRefFile(file);
      setCloneUploadFile(file);
      setCloneRefText('');
      setError(null);
    }
  };

  const handleGenerate = async () => {
    if (!activeRefFile) {
        setError(activeTab === 'bharatgen' ? "Select a BharatGen voice first." : "Upload a voice sample to clone first.");
        return;
    }
    if (!activeRefText.trim()) {
        setError("Add reference text so we can match the voice's style.");
        return;
    }
    if (!genText.trim()) {
        setError("Type something in the text box to generate speech.");
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

    try {
      const url = await generateSpeech({
        refAudio: activeRefFile,
        refText: activeRefText,
        text: genText,
        language: activeTab === 'clone' ? cloneSelectedLang.id : (selectedBharatgenAccent?.languageId || '')
      });
      setGeneratedAudioUrl(url);
      if (generateStartRef.current) {
        setGenerationMs(performance.now() - generateStartRef.current);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong while generating speech. Please try again.");
      setIsLoading(false);
    } finally {
        if (!generatedAudioUrl) setIsLoading(false); // Only set loading false here if error, otherwise wait for audio load
    }
  };

  const onAudioLoadStart = () => setIsLoading(true);
  const onAudioLoadedData = () => setIsLoading(false);

  const togglePlay = () => {
    if (!audioRef.current || !generatedAudioUrl) return;
    setAutoplayBlocked(false);
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
    setIsBharatgenLangOpen(false);
  };

  const isGenerateDisabled = isLoading || !activeRefFile;

  const generateHint = (() => {
    if (isLoading) return null;
    if (!activeRefFile) return activeTab === 'bharatgen' ? 'Select an accent to continue' : 'Upload a voice sample to continue';
    if (!activeRefText.trim()) return 'Reference text is required';
    if (!genText.trim()) return 'Enter text to generate';
    return null;
  })();

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[420px] lg:min-h-[640px] 2xl:min-h-[720px] bg-white">

      {/* --- CANVAS: TEXT INPUT + GENERATE --- */}
      <div className="order-3 lg:order-1 flex-1 min-w-0 flex flex-col p-4 md:p-5 lg:p-6 2xl:p-7 relative">

        {/* Top Tabs */}
        <div className="flex items-center gap-2 mb-3">
            <button
                onClick={() => handleTabChange('clone')}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${
                  activeTab === 'clone'
                    ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))] shadow-sm'
                    : 'bg-slate-50 text-slate-500 hover:text-[color:rgb(var(--brand-blue))]'
                }`}
            >
                <Mic size={14} className="text-[color:rgb(var(--brand-orange))]" />
                Voice Cloning
            </button>
            <button
                onClick={() => handleTabChange('bharatgen')}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${
                  activeTab === 'bharatgen'
                    ? 'bg-[color:rgb(var(--brand-orange)/0.12)] text-[color:rgb(var(--brand-orange))] shadow-sm'
                    : 'bg-slate-50 text-slate-500 hover:text-[color:rgb(var(--brand-orange))]'
                }`}
            >
                <Users size={14} className="text-[color:rgb(var(--brand-blue))]" />
                BharatGen Voices
            </button>
        </div>

        {/* Language filter + selected accent (BharatGen tab). Lives here rather than in the
            map column so the map itself gets that column's full height. */}
        {activeTab === 'bharatgen' && (
            <div className="flex flex-wrap items-stretch gap-3 mb-3">
                {bharatgenError && (
                    <div className="w-full text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                        {bharatgenError}
                    </div>
                )}

                <div className="relative flex-1 min-w-[200px]">
                    <button
                        onClick={() => setIsBharatgenLangOpen((prev) => !prev)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-3 hover:border-[color:rgb(var(--brand-blue))] transition-colors"
                    >
                        <div className="w-9 h-9 rounded-lg bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))] flex items-center justify-center shrink-0">
                            <Globe size={18} />
                        </div>
                        <div className="text-left min-w-0">
                            <div className="text-base font-bold text-slate-700 truncate">{bharatgenSelectedLang ? bharatgenSelectedLang.name : 'All languages'}</div>
                            <div className="text-xs text-slate-400 truncate">{bharatgenSelectedLang ? bharatgenSelectedLang.scriptLabel : 'Every accent shown'}</div>
                        </div>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform shrink-0 ml-auto ${isBharatgenLangOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isBharatgenLangOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto p-1">
                            <button
                                onClick={() => {
                                    setBharatgenSelectedLang(null);
                                    setIsBharatgenLangOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${!bharatgenSelectedLang ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))]' : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                                <span>All languages</span>
                                {!bharatgenSelectedLang && <Check size={14} />}
                            </button>
                            {LANGUAGE_DEMOS.map((lang) => (
                                <button
                                    key={lang.id}
                                    onClick={() => {
                                        setBharatgenSelectedLang(lang);
                                        setIsBharatgenLangOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${bharatgenSelectedLang?.id === lang.id ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))]' : 'hover:bg-slate-50 text-slate-600'}`}
                                >
                                    <span>{lang.name}</span>
                                    {bharatgenSelectedLang?.id === lang.id && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-[200px] flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="w-9 h-9 rounded-lg bg-[color:rgb(var(--brand-orange)/0.12)] text-[color:rgb(var(--brand-orange))] flex items-center justify-center shrink-0">
                        <MapPin size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-slate-700 truncate">
                            {selectedBharatgenAccent ? getAccentDisplayName(selectedBharatgenAccent) : 'No accent selected'}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                            {selectedBharatgenAccent ? `${selectedBharatgenAccent.district}, ${selectedBharatgenAccent.state}` : 'Click a pin on the map'}
                        </div>
                    </div>
                    {refPreviewUrl && (
                        <button
                            onClick={toggleRefPlay}
                            className="h-7 w-7 rounded-full bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))] flex items-center justify-center hover:bg-[color:rgb(var(--brand-blue)/0.2)] transition-colors shrink-0"
                            title={isRefPlaying ? 'Pause reference' : 'Preview selected accent'}
                        >
                            {isRefPlaying ? <Pause size={12} /> : <Play size={12} className="translate-x-[1px]" />}
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* Text Input Area */}
        <div className="relative group border border-slate-200 rounded-xl bg-slate-50/60 px-4 pt-3 pb-7 transition-colors focus-within:border-[color:rgb(var(--brand-blue)/0.5)] focus-within:ring-2 focus-within:ring-[color:rgb(var(--brand-blue)/0.15)]">
            <textarea
                value={genText}
                onChange={(e) => setGenText(e.target.value)}
                placeholder="Type something here to generate speech..."
                className="w-full h-[86px] md:h-[96px] lg:h-[220px] 2xl:h-[260px] resize-none text-base font-light text-slate-800 placeholder:text-slate-300 outline-none bg-transparent leading-relaxed"
                maxLength={300}
                spellCheck={false}
            />
            {/* Character Count */}
            <div className="absolute bottom-2 right-4 text-xs text-slate-300 font-medium">
                {genText.length}/300
            </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-3">
            {isGenerateDisabled && generateHint ? (
                <p className="text-[11px] text-slate-400 font-medium">{generateHint}</p>
            ) : <span />}
            <button
                onClick={handleGenerate}
                disabled={isGenerateDisabled}
                className={`
                    group relative px-3.5 py-1.5 rounded-full font-semibold text-sm text-white shadow-md transition-all duration-300
                    flex items-center justify-center gap-2 overflow-hidden shrink-0
                    ${isGenerateDisabled
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-[color:rgb(var(--brand-orange))] to-[color:rgb(var(--brand-blue))] hover:scale-105 hover:shadow-[0_12px_24px_-12px_rgb(var(--brand-orange)/0.6)]'}
                `}
            >
                {/* Gradient animation overlay */}
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

                {isLoading ? (
                    <Loader2 className="animate-spin w-4 h-4" />
                ) : (
                    <Wand2 size={14} />
                )}
                <span>Generate Speech</span>
            </button>
        </div>

        {/* Status / Playback Bar — pinned to the bottom so the column reads as intentional
            rather than leaving a floating gap under the Generate button. */}
        <div className="mt-auto pt-3 border-t border-slate-100">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                {error ? (
                    <div className="text-red-500 text-sm font-medium px-4 py-2 bg-red-50 rounded-lg animate-fade-in">
                        {error}
                    </div>
                ) : (
                    <div className="text-slate-400 text-sm flex items-center gap-2">
                       {generatedAudioUrl && <Check size={16} className="text-green-500" />}
                       {isLoading
                         ? "Generating audio..."
                         : generatedAudioUrl
                           ? (autoplayBlocked ? "Audio ready — tap Replay to listen" : "Audio generated successfully")
                           : "Ready to generate"}
                       {(isLoading || generatedAudioUrl) && generationMs !== null && (
                         <span className="text-[11px] text-slate-400 flex items-center gap-1">
                           ⚡ { (generationMs / 1000).toFixed(2) }s
                         </span>
                       )}
                    </div>
                )}
                {generatedAudioUrl && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={togglePlay}
                            className="px-5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors flex items-center gap-2"
                        >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            {isPlaying ? "Pause" : "Replay"}
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerateDisabled}
                            className="px-5 py-2 rounded-full border border-slate-200 hover:border-[color:rgb(var(--brand-orange))] text-slate-600 hover:text-[color:rgb(var(--brand-orange))] font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Wand2 size={14} />
                            Generate again
                        </button>
                    </div>
                )}
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
                    setError('The generated audio could not be played. Please try generating again.');
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

      {/* --- ACCENT MAP (BharatGen tab only) --- */}
      {activeTab === 'bharatgen' && (
        <div className="order-2 lg:order-2 w-full lg:w-[560px] 2xl:w-[640px] shrink-0 bg-gradient-to-b from-slate-50/80 to-white border-t lg:border-t-0 lg:border-l border-slate-100 px-4 py-4 md:px-5 2xl:px-6 flex flex-col">
            <div className="flex items-baseline justify-between gap-2 shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accent map</span>
                <span className="text-[11px] text-slate-400">
                    {bharatgenAccentsForLang.length} {bharatgenAccentsForLang.length === 1 ? 'voice' : 'voices'}
                    {bharatgenSelectedLang ? ` · ${bharatgenSelectedLang.name}` : ' · all languages'}
                </span>
            </div>

            {/* Explicit height — the map measures its own box to fit the projection, so a
                flex-sized parent here would make sizing circular and unpredictable. */}
            <div className="h-[340px] lg:h-[560px] 2xl:h-[640px] shrink-0">
                <IndiaAccentMap
                    accents={bharatgenAccentsForLang}
                    activeStateIds={bharatgenActiveStateIds}
                    selectedAccentId={bharatgenSelectedId}
                    hoveredAccentId={hoveredAccentId}
                    onAccentHover={setHoveredAccentId}
                    onAccentClick={setBharatgenSelectedId}
                />
            </div>

            <p className="text-[11px] text-slate-400 text-center shrink-0 mt-auto pt-2">
                {bharatgenSelectedLang
                  ? `Click a pin to pick a ${bharatgenSelectedLang.name} accent.`
                  : 'Click any pin, or filter by language on the left.'}
            </p>
        </div>
      )}

      {/* --- SETTINGS SIDEBAR (Voice Cloning tab only) --- */}
      {activeTab === 'clone' && (
        <div className="order-1 lg:order-3 w-full lg:w-[330px] 2xl:w-[370px] bg-slate-50/50 border-l border-slate-100 p-4 md:p-5 2xl:p-6 flex flex-col gap-4 2xl:gap-5">

          {/* Settings Form */}
          <div className="space-y-3">
              <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reference Voice</label>
              </div>

              <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custom Upload</label>
                      {!cloneUploadFile ? (
                          <div className="relative group">
                              <input
                                  type="file"
                                  accept=".wav,.mp3,audio/wav,audio/mpeg"
                                  onChange={handleFileChange}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div className="h-14 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 group-hover:bg-[color:rgb(var(--brand-orange)/0.12)] group-hover:border-[color:rgb(var(--brand-orange)/0.4)] transition-all flex flex-col items-center justify-center gap-1">
                                  <Upload className="text-slate-400 group-hover:text-[color:rgb(var(--brand-orange))] transition-colors" size={20} />
                                  <span className="text-xs font-medium text-slate-500 group-hover:text-[color:rgb(var(--brand-orange))]">Upload Reference Voice (.wav, .mp3)</span>
                              </div>
                          </div>
                      ) : null}
                      {!cloneUploadFile && (
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                              Best results: 10–30s of clear, single-speaker audio. .wav or .mp3 only.
                              <br />
                              Used only to generate this preview — not stored.
                          </p>
                      )}
                      {cloneUploadFile && (
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
                                      }}
                                      className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                  >
                                       <X size={16} />
                                  </button>
                               </div>
                          </div>
                      )}
              </div>

              {/* Transcript Input — BharatGen presets carry their own transcript internally */}
              <div className="pt-2">
                  <input
                      type="text"
                      value={activeRefText}
                      onChange={(e) => setCloneRefText(e.target.value)}
                      placeholder="Type the reference audio's transcript here..."
                      className="w-full text-xs bg-slate-100 border-none rounded-lg px-3 py-2 text-slate-600 focus:ring-1 focus:ring-[color:rgb(var(--brand-orange))] placeholder-slate-400"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 pl-1">
                      <span>*Required for accurate cloning style matching</span>
                  </div>
              </div>

              {/* Output Language */}
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
                                  <div className="text-sm font-bold text-slate-700">{cloneSelectedLang.name}</div>
                                  <div className="text-[10px] text-slate-400">{cloneSelectedLang.scriptLabel}</div>
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
                                          setCloneSelectedLang(lang);
                                          setCloneSelectedDemoIdx(0);
                                          setIsLangOpen(false);
                                      }}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${cloneSelectedLang.id === lang.id ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))]' : 'hover:bg-slate-50 text-slate-600'}`}
                                  >
                                      <span>{lang.name}</span>
                                      {cloneSelectedLang.id === lang.id && <Check size={14} />}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>

                  {/* Preset Chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                      {cloneSelectedLang.demos.map((demo, idx) => (
                          <button
                              key={idx}
                              onClick={() => setCloneSelectedDemoIdx(idx)}
                              className={`
                                  text-[10px] font-medium px-2 py-1 rounded-md border transition-all flex items-center gap-1
                                  ${cloneSelectedDemoIdx === idx
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

          </div>

        </div>
      )}
    </div>
  );
};

export default DemoWidget;
