import React, { useEffect, useMemo, useState } from 'react';
import { Play, Pause, Globe, ChevronDown, Check, MapPin } from 'lucide-react';
import { LANGUAGE_DEMOS } from '../../constants';
import { BharatGenVoice, LanguageDemo, getAccentDisplayName } from '../../types';
import IndiaAccentMap from '../common/IndiaAccentMap';
import { DEFAULT_GEN_TEXT, RefPreview, TabController, fetchVoices, useVoiceHydration, useVoiceSession } from './shared';

export interface AccentsController extends TabController {
  /** null = no language filter chosen yet, so every accent's pin is shown. */
  langFilter: LanguageDemo | null;
  setLangFilter: (lang: LanguageDemo | null) => void;
  visibleAccents: BharatGenVoice[];
  activeStateIds: Set<string>;
  availableLanguages: LanguageDemo[];
  selectedVoice: BharatGenVoice | null;
  selectedId: string | null;
  selectAccent: (id: string) => void;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  isLangOpen: boolean;
  toggleLangMenu: () => void;
}

/** Indian Accents tab: pick a district accent off the map, optionally filtered by language. */
export const useAccentsTab = (): AccentsController => {
  const session = useVoiceSession(DEFAULT_GEN_TEXT);
  const [accents, setAccents] = useState<BharatGenVoice[]>([]);
  const [langFilter, setLangFilter] = useState<LanguageDemo | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isLangOpen, setIsLangOpen] = useState(false);

  // An empty accent map is a degraded extra tab, not a broken app — so a failed
  // catalog fetch stays silent rather than putting an error in front of everyone.
  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const data = await fetchVoices('/indian-accents.json', '', '');
        if (!isActive) return;
        setAccents(data);
        if (data.length > 0) setSelectedId((prev) => prev ?? data[0].id);
      } catch {
        /* ignored on purpose */
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, []);

  const visibleAccents = useMemo(
    () => (langFilter ? accents.filter((voice) => voice.genLanguageId === langFilter.id) : accents),
    [accents, langFilter]
  );
  // const activeStateIds = useMemo(() => new Set(visibleAccents.map((voice) => voice.stateId)), [visibleAccents]);
  const activeStateIds = new Set<string>();
  const availableLanguages = useMemo(() => {
    const ids = new Set(accents.map((v) => v.genLanguageId!));
    return LANGUAGE_DEMOS.filter((l) => ids.has(l.id));
  }, [accents]);

  useEffect(() => {
    if (langFilter && !availableLanguages.some((l) => l.id === langFilter.id)) setLangFilter(null);
  }, [availableLanguages, langFilter]);

  // The language dropdown is a view filter, not a requirement — only force the
  // selection to match once a specific language has actually been chosen.
  useEffect(() => {
    if (!langFilter || visibleAccents.length === 0) return;
    if (!visibleAccents.some((voice) => voice.id === selectedId)) {
      setSelectedId(visibleAccents[0].id);
    }
  }, [langFilter, visibleAccents, selectedId]);

  const selectedVoice = accents.find((voice) => voice.id === selectedId) || null;
  const loadError = useVoiceHydration(selectedVoice, session, (voice) => voice.sampleGenText || '');

  return {
    session,
    language: selectedVoice?.refLanguageId || selectedVoice?.languageId || '',
    genLanguage: selectedVoice?.genLanguageId || undefined,
    error: loadError,
    emptyRefHint: 'Select an accent to continue',
    missingRefError: 'Pick an accent on the map first.',
    closeMenus: () => setIsLangOpen(false),
    langFilter,
    setLangFilter: (lang) => {
      setLangFilter(lang);
      setIsLangOpen(false);
    },
    visibleAccents,
    activeStateIds,
    availableLanguages,
    selectedVoice,
    selectedId,
    selectAccent: setSelectedId,
    hoveredId,
    setHoveredId,
    isLangOpen,
    toggleLangMenu: () => setIsLangOpen((prev) => !prev),
  };
};

interface AccentsProps {
  accents: AccentsController;
  refPreview: RefPreview;
}

/**
 * Language filter + selected-accent summary. Lives in the text column rather than the
 * map column so the map itself gets that column's full height.
 */
export const AccentsControls: React.FC<AccentsProps> = ({ accents, refPreview }) => {
  const { langFilter, selectedVoice } = accents;

  return (
    <div className="flex flex-wrap items-stretch gap-3 mb-3">
      {accents.error && (
        <div className="w-full text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {accents.error}
        </div>
      )}

      <div className="relative flex-1 min-w-[200px]">
        <button
          onClick={accents.toggleLangMenu}
          className="w-full p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-3 hover:border-[color:rgb(var(--brand-blue))] transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))] flex items-center justify-center shrink-0">
            <Globe size={18} />
          </div>
          <div className="text-left min-w-0">
            <div className="text-base font-bold text-slate-700 truncate">{langFilter ? langFilter.name : 'All languages'}</div>
            <div className="text-xs text-slate-400 truncate">
              {langFilter ? langFilter.scriptLabel : 'Every accent shown'}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform shrink-0 ml-auto ${accents.isLangOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {accents.isLangOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto p-1">
            <button
              onClick={() => accents.setLangFilter(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                !langFilter
                  ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))]'
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span>All languages</span>
              {!langFilter && <Check size={14} />}
            </button>
            {accents.availableLanguages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => accents.setLangFilter(lang)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                  langFilter?.id === lang.id
                    ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))]'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span>{lang.name}</span>
                {langFilter?.id === lang.id && <Check size={14} />}
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
            {selectedVoice ? getAccentDisplayName(selectedVoice) : 'No accent selected'}
          </div>
          <div className="text-xs text-slate-400 truncate">
            {selectedVoice ? `${selectedVoice.district}, ${selectedVoice.state}` : 'Click a pin on the map'}
          </div>
        </div>
        {refPreview.url && (
          <button
            onClick={refPreview.toggle}
            className="h-7 w-7 rounded-full bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))] flex items-center justify-center hover:bg-[color:rgb(var(--brand-blue)/0.2)] transition-colors shrink-0"
            title={refPreview.isPlaying ? 'Pause reference' : 'Preview selected accent'}
          >
            {refPreview.isPlaying ? <Pause size={12} /> : <Play size={12} className="translate-x-[1px]" />}
          </button>
        )}
      </div>
    </div>
  );
};

export const AccentsMapPanel: React.FC<{ accents: AccentsController }> = ({ accents }) => {
  const { visibleAccents, langFilter } = accents;

  return (
    <div className="order-2 lg:order-2 w-full lg:w-[560px] 2xl:w-[640px] shrink-0 bg-gradient-to-b from-slate-50/80 to-white border-t lg:border-t-0 lg:border-l border-slate-100 px-4 py-4 md:px-5 2xl:px-6 flex flex-col">
      <div className="flex items-baseline justify-between gap-2 shrink-0">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accent map</span>
        <span className="text-[11px] text-slate-400">
          {visibleAccents.length} {visibleAccents.length === 1 ? 'voice' : 'voices'}
          {langFilter ? ` · ${langFilter.name}` : ' · all languages'}
        </span>
      </div>

      {/* Explicit height — the map measures its own box to fit the projection, so a
          flex-sized parent here would make sizing circular and unpredictable. */}
      <div className="h-[340px] lg:h-[560px] 2xl:h-[640px] shrink-0">
        <IndiaAccentMap
          accents={visibleAccents}
          activeStateIds={accents.activeStateIds}
          selectedAccentId={accents.selectedId}
          hoveredAccentId={accents.hoveredId}
          onAccentHover={accents.setHoveredId}
          onAccentClick={accents.selectAccent}
        />
      </div>

      <p className="text-[11px] text-slate-400 text-center shrink-0 mt-auto pt-2">
        {langFilter ? `Click a pin to pick a ${langFilter.name} accent.` : 'Click any pin, or filter by language on the left.'}
      </p>
    </div>
  );
};
