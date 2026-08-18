import React, { useEffect, useState } from 'react';
import { Play, Pause, ChevronDown } from 'lucide-react';
import { LANGUAGE_DEMOS } from '../../constants';
import { BharatGenVoice } from '../../types';
import { DEFAULT_GEN_TEXT, RefPreview, TabController, fetchVoices, useVoiceHydration, useVoiceSession } from './shared';

const UNAVAILABLE = 'Could not load BharatGen voices right now. Please refresh the page.';
const UNREACHABLE = "Couldn't reach the server to load BharatGen voices. Check your connection and refresh the page.";

export interface BharatGenController extends TabController {
  voices: BharatGenVoice[];
  selectedVoice: BharatGenVoice | null;
  selectVoice: (id: string) => void;
  isPickerOpen: boolean;
  togglePicker: () => void;
}

/** BharatGen Voices tab: pick a catalog speaker; the output language follows it. */
export const useBharatGenTab = (): BharatGenController => {
  const session = useVoiceSession(DEFAULT_GEN_TEXT);
  const [voices, setVoices] = useState<BharatGenVoice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const data = await fetchVoices('/bharatgen-voices.json', UNAVAILABLE, UNREACHABLE);
        if (!isActive) return;
        setVoices(data);
        if (data.length > 0) setSelectedId((prev) => prev ?? data[0].id);
      } catch (err: any) {
        if (isActive) setCatalogError(err?.message || UNAVAILABLE);
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, []);

  const selectedVoice = voices.find((voice) => voice.id === selectedId) || null;

  // Catalog voices ship a sample text, but where the language has curated demos those
  // read better as a starting point.
  const loadError = useVoiceHydration(selectedVoice, session, (voice) => {
    const lang = LANGUAGE_DEMOS.find((entry) => entry.id === voice.languageId);
    return lang ? lang.demos[0].actual_text : voice.sampleGenText || '';
  });

  return {
    session,
    language: selectedVoice?.languageId || '',
    genLanguage: undefined,
    error: catalogError || loadError,
    emptyRefHint: 'Select a voice to continue',
    missingRefError: 'Select a BharatGen voice first.',
    closeMenus: () => setIsPickerOpen(false),
    voices,
    selectedVoice,
    selectVoice: (id: string) => {
      setSelectedId(id);
      setIsPickerOpen(false);
    },
    isPickerOpen,
    togglePicker: () => setIsPickerOpen((prev) => !prev),
  };
};

interface BharatGenSidebarProps {
  bharatgen: BharatGenController;
  refPreview: RefPreview;
}

export const BharatGenSidebar: React.FC<BharatGenSidebarProps> = ({ bharatgen, refPreview }) => {
  const { voices, selectedVoice } = bharatgen;

  return (
    <div className="order-1 lg:order-2 w-full lg:w-[330px] 2xl:w-[370px] bg-slate-50/50 border-l border-slate-100 p-4 md:p-5 2xl:p-6 flex flex-col gap-4 2xl:gap-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">BharatGen Voices</label>
        </div>
        <div className="space-y-3">
          {bharatgen.error && (
            <div className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
              {bharatgen.error}
            </div>
          )}
          <div className="relative">
            <button
              onClick={bharatgen.togglePicker}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between hover:border-[color:rgb(var(--brand-blue))] transition-colors"
            >
              <div className="text-left">
                <div className="text-sm font-bold text-slate-700">{selectedVoice?.name || 'Select a voice'}</div>
                <div className="text-[10px] text-slate-400">{selectedVoice?.languageName || 'Select language'}</div>
              </div>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform ${bharatgen.isPickerOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {bharatgen.isPickerOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto p-1">
                {voices.map((voice) => {
                  const isSelected = voice.id === selectedVoice?.id;
                  return (
                    <button
                      key={voice.id}
                      onClick={() => bharatgen.selectVoice(voice.id)}
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
              </div>
            )}
          </div>
          {refPreview.url && (
            <button
              onClick={refPreview.toggle}
              className="mt-1 inline-flex items-center gap-2 text-[11px] text-[color:rgb(var(--brand-blue))] hover:text-[color:rgb(var(--brand-orange))] transition-colors"
            >
              {refPreview.isPlaying ? <Pause size={12} /> : <Play size={12} />}
              Preview selected voice
            </button>
          )}
          <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-[10px] text-slate-400">
            Output language is locked to the selected speaker.
          </div>
        </div>
      </div>
    </div>
  );
};
