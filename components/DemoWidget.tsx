import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, Mic, Users, Check, Wand2, MapPin } from 'lucide-react';
import { generateSpeech } from '../services/ttsService';
import LogoVisualizer from './LogoVisualizer';
import { RefPreview, TabController, TabId } from './demo/shared';
import { CloneSidebar, useCloneTab } from './demo/CloneTab';
import { BharatGenSidebar, useBharatGenTab } from './demo/BharatGenTab';
import { AccentsControls, AccentsMapPanel, useAccentsTab } from './demo/AccentsTab';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'bharatgen', label: 'BharatGen Voices', icon: Users },
  { id: 'accents', label: 'Indian Accents', icon: MapPin },
  { id: 'clone', label: 'Voice Cloning', icon: Mic },
];

/**
 * Shell around the three tabs: it owns the text box, the Generate action and audio
 * playback. Each tab (see ./demo) owns its own reference audio, transcript and gen
 * text, and exposes them through a TabController.
 */
const DemoWidget: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('bharatgen');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isRefPlaying, setIsRefPlaying] = useState(false);
  const [generationMs, setGenerationMs] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const refPreviewRef = useRef<HTMLAudioElement>(null);
  const generateStartRef = useRef<number | null>(null);

  const clone = useCloneTab({ onError: setError });
  const bharatgen = useBharatGenTab();
  const accents = useAccentsTab();

  const active: TabController = activeTab === 'clone' ? clone : activeTab === 'accents' ? accents : bharatgen;
  const session = active.session;

  const toggleRefPlay = () => {
    if (!refPreviewRef.current || !session.refPreviewUrl) return;
    if (isRefPlaying) {
      refPreviewRef.current.pause();
    } else {
      refPreviewRef.current.play();
    }
  };

  const refPreview: RefPreview = { url: session.refPreviewUrl, isPlaying: isRefPlaying, toggle: toggleRefPlay };

  // Auto-play once audio is generated.
  useEffect(() => {
    if (generatedAudioUrl && audioRef.current) {
      setAutoplayBlocked(false);
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setAutoplayBlocked(true));
    }
  }, [generatedAudioUrl]);

  // A new reference audio (tab switch, new upload, new voice) invalidates whatever
  // the preview element was playing.
  useEffect(() => {
    const element = refPreviewRef.current;
    if (element) {
      element.pause();
      element.currentTime = 0;
    }
    setIsRefPlaying(false);
  }, [session.refPreviewUrl]);

  // Live "⚡ 1.23s" counter while generating.
  useEffect(() => {
    if (!isLoading) return;
    const start = generateStartRef.current ?? performance.now();
    generateStartRef.current = start;
    const tick = () => setGenerationMs(performance.now() - start);
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [isLoading]);

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

  const handleTabChange = (tab: TabId) => {
    if (tab === activeTab) return;
    stopPlayback();
    setActiveTab(tab);
    setError(null);
    clone.closeMenus();
    bharatgen.closeMenus();
    accents.closeMenus();
  };

  const handleGenerate = async () => {
    if (!session.refFile) {
      setError(active.missingRefError);
      return;
    }
    if (!session.refText.trim()) {
      setError("Add reference text so we can match the voice's style.");
      return;
    }
    if (!session.genText.trim()) {
      setError('Type something in the text box to generate speech.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setGenerationMs(0);
    generateStartRef.current = performance.now();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setGeneratedAudioUrl(null);

    try {
      const url = await generateSpeech({
        refAudio: session.refFile,
        refText: session.refText,
        text: session.genText,
        language: active.language,
      });
      setGeneratedAudioUrl(url);
      if (generateStartRef.current) {
        setGenerationMs(performance.now() - generateStartRef.current);
      }
      // Loading stays on until the <audio> element reports the clip is ready.
    } catch (err: any) {
      setError(err.message || 'Something went wrong while generating speech. Please try again.');
      setIsLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !generatedAudioUrl) return;
    setAutoplayBlocked(false);
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const isGenerateDisabled = isLoading || !session.refFile;

  const generateHint = (() => {
    if (isLoading) return null;
    if (!session.refFile) return active.emptyRefHint;
    if (!session.refText.trim()) return 'Reference text is required';
    if (!session.genText.trim()) return 'Enter text to generate';
    return null;
  })();

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[420px] lg:min-h-[640px] 2xl:min-h-[720px] bg-white">
      {/* --- CANVAS: TEXT INPUT + GENERATE --- */}
      <div className="order-3 lg:order-1 flex-1 min-w-0 flex flex-col p-4 md:p-5 lg:p-6 2xl:p-7 relative">
        {/* Top Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`px-4 py-2.5 sm:py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${
                activeTab === id
                  ? 'bg-[color:rgb(var(--brand-orange)/0.12)] text-[color:rgb(var(--brand-orange))] shadow-sm'
                  : 'bg-slate-50 text-slate-500 hover:text-[color:rgb(var(--brand-orange))]'
              }`}
            >
              <Icon size={14} className="text-[color:rgb(var(--brand-orange))]" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'accents' && <AccentsControls accents={accents} refPreview={refPreview} />}

        {/* Text Input Area */}
        <div className="relative group border border-slate-200 rounded-xl bg-slate-50/60 px-4 pt-3 pb-7 transition-colors focus-within:border-[color:rgb(var(--brand-blue)/0.5)] focus-within:ring-2 focus-within:ring-[color:rgb(var(--brand-blue)/0.15)]">
          <textarea
            value={session.genText}
            onChange={(e) => session.setGenText(e.target.value)}
            placeholder="Type something here to generate speech..."
            className="w-full h-[86px] md:h-[120px] lg:h-[108px] 2xl:h-[126px] resize-none text-base font-light text-slate-800 placeholder:text-slate-300 outline-none bg-transparent leading-relaxed"
            maxLength={300}
            spellCheck={false}
          />
          <div className="absolute bottom-2 right-4 text-xs text-slate-300 font-medium">{session.genText.length}/300</div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
          {isGenerateDisabled && generateHint ? (
            <p className="text-[11px] text-slate-400 font-medium">{generateHint}</p>
          ) : (
            <span />
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerateDisabled}
            className={`
                    group relative px-3.5 py-1.5 rounded-full font-semibold text-sm text-white shadow-md transition-all duration-300
                    flex items-center justify-center gap-2 overflow-hidden shrink-0
                    ${
                      isGenerateDisabled
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-[color:rgb(var(--brand-orange))] to-[color:rgb(var(--brand-blue))] hover:scale-105 hover:shadow-[0_12px_24px_-12px_rgb(var(--brand-orange)/0.6)]'
                    }
                `}
          >
            {/* Gradient animation overlay */}
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

            {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Wand2 size={14} />}
            <span>Generate Speech</span>
          </button>
        </div>

        {/* Visualizer (Voice Cloning + BharatGen Voices tabs) */}
        {activeTab !== 'accents' && (
          <div className="mt-4 mb-3 2xl:mt-6 2xl:mb-4 hidden sm:flex flex-col items-center justify-center gap-3">
            <div className="relative flex items-center justify-center px-2 py-1 rounded-full">
              <div
                className="absolute inset-0 rounded-full blur-3xl opacity-70 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, rgba(var(--brand-orange), 0.35) 0%, rgba(var(--brand-blue), 0.28) 45%, rgba(255,255,255,0) 72%)',
                }}
              />
              <div className="relative">
                <LogoVisualizer audioElementRef={audioRef} isPlaying={isLoading || isPlaying} />
              </div>
            </div>
          </div>
        )}

        {/* Status / Playback Bar — pinned to the bottom so the column reads as intentional
            rather than leaving a floating gap under the Generate button. */}
        <div className="mt-auto pt-3 border-t border-slate-100">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            {error ? (
              <div className="text-red-500 text-sm font-medium px-4 py-2 bg-red-50 rounded-lg animate-fade-in">{error}</div>
            ) : (
              <div className="text-slate-400 text-sm flex items-center gap-2">
                {generatedAudioUrl && <Check size={16} className="text-green-500" />}
                {isLoading
                  ? 'Generating audio...'
                  : generatedAudioUrl
                    ? autoplayBlocked
                      ? 'Audio ready — tap Replay to listen'
                      : 'Audio generated successfully'
                    : 'Ready to generate'}
                {(isLoading || generatedAudioUrl) && generationMs !== null && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    ⚡ {(generationMs / 1000).toFixed(2)}s
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
                  {isPlaying ? 'Pause' : 'Replay'}
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
            onLoadStart={() => setIsLoading(true)}
            onLoadedData={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError('The generated audio could not be played. Please try generating again.');
            }}
          />
          <audio
            ref={refPreviewRef}
            src={session.refPreviewUrl || undefined}
            onPlay={() => setIsRefPlaying(true)}
            onPause={() => setIsRefPlaying(false)}
            onEnded={() => setIsRefPlaying(false)}
          />
        </div>
      </div>

      {activeTab === 'accents' && <AccentsMapPanel accents={accents} />}
      {activeTab === 'bharatgen' && <BharatGenSidebar bharatgen={bharatgen} refPreview={refPreview} />}
      {activeTab === 'clone' && <CloneSidebar clone={clone} refPreview={refPreview} />}
    </div>
  );
};

export default DemoWidget;
