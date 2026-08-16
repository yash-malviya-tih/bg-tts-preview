import React, { useState } from 'react';
import { Upload, Play, Pause, FileAudio, Mic, Square, Globe, ChevronDown, Check, X, RefreshCw } from 'lucide-react';
import { LANGUAGE_DEMOS } from '../../constants';
import { LanguageDemo } from '../../types';
import { useVoiceRecorder } from '../common/useVoiceRecorder';
import { DEFAULT_GEN_TEXT, RefPreview, TabController, useVoiceSession } from './shared';

const MAX_UPLOAD_MB = 20;
const ALLOWED_EXTENSIONS = ['.wav', '.mp3'];

export interface CloneController extends TabController {
  selectedLang: LanguageDemo;
  selectLang: (lang: LanguageDemo) => void;
  selectedDemoIdx: number;
  selectDemo: (idx: number) => void;
  /** The file shown in the sidebar card — same file as `session.refFile`, kept
      separately so clearing the card is distinct from clearing the session. */
  uploadFile: File | null;
  clearUpload: () => void;
  onUploadChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isLangOpen: boolean;
  toggleLangMenu: () => void;
  isRecording: boolean;
  recordingError: string | null;
  toggleRecording: () => void;
}

/**
 * Voice Cloning tab: user-supplied reference audio (upload or recording), its
 * transcript, and a freely chosen output language.
 */
export const useCloneTab = ({ onError }: { onError: (message: string | null) => void }): CloneController => {
  const session = useVoiceSession(DEFAULT_GEN_TEXT);
  const [selectedLang, setSelectedLang] = useState(LANGUAGE_DEMOS[0]);
  const [selectedDemoIdx, setSelectedDemoIdx] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const acceptFile = (file: File) => {
    setUploadFile(file);
    session.setRefFile(file);
    session.setRefText('');
    onError(null);
  };

  const { isRecording, recordingError, clearRecordingError, handleRecordToggle } = useVoiceRecorder({
    onRecorded: acceptFile,
  });

  const onUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reject = (message: string) => {
      onError(message);
      event.target.value = '';
    };

    if (!ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      return reject('Please upload a .wav or .mp3 audio file.');
    }
    if (file.size === 0) {
      return reject('That file appears to be empty. Please choose a different audio file.');
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return reject(`That file is too large. Please upload a sample under ${MAX_UPLOAD_MB}MB.`);
    }
    acceptFile(file);
  };

  // Language and preset chips drive the gen text directly — no effect needed.
  const selectLang = (lang: LanguageDemo) => {
    setSelectedLang(lang);
    setSelectedDemoIdx(0);
    setIsLangOpen(false);
    session.setGenText(lang.demos[0].actual_text);
  };

  const selectDemo = (idx: number) => {
    setSelectedDemoIdx(idx);
    session.setGenText(selectedLang.demos[idx].actual_text);
  };

  return {
    session,
    language: selectedLang.id,
    error: null,
    emptyRefHint: 'Upload a voice sample to continue',
    missingRefError: 'Upload a voice sample to clone first.',
    closeMenus: () => setIsLangOpen(false),
    selectedLang,
    selectLang,
    selectedDemoIdx,
    selectDemo,
    uploadFile,
    clearUpload: () => {
      setUploadFile(null);
      session.clearRef();
    },
    onUploadChange,
    isLangOpen,
    toggleLangMenu: () => setIsLangOpen((prev) => !prev),
    isRecording,
    recordingError,
    toggleRecording: () => {
      clearRecordingError();
      handleRecordToggle();
    },
  };
};

interface CloneSidebarProps {
  clone: CloneController;
  refPreview: RefPreview;
}

export const CloneSidebar: React.FC<CloneSidebarProps> = ({ clone, refPreview }) => {
  const { session, selectedLang, selectedDemoIdx, uploadFile } = clone;

  return (
    <div className="order-1 lg:order-3 w-full lg:w-[330px] 2xl:w-[370px] bg-slate-50/50 border-l border-slate-100 p-4 md:p-5 2xl:p-6 flex flex-col gap-4 2xl:gap-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reference Voice</label>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custom Upload</label>
          {!uploadFile && (
            <>
              <div className="relative group">
                <input
                  type="file"
                  accept=".wav,.mp3,audio/wav,audio/mpeg"
                  onChange={clone.onUploadChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="h-14 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 group-hover:bg-[color:rgb(var(--brand-orange)/0.12)] group-hover:border-[color:rgb(var(--brand-orange)/0.4)] transition-all flex flex-col items-center justify-center gap-1">
                  <Upload
                    className="text-slate-400 group-hover:text-[color:rgb(var(--brand-orange))] transition-colors"
                    size={20}
                  />
                  <span className="text-xs font-medium text-slate-500 group-hover:text-[color:rgb(var(--brand-orange))]">
                    Upload Reference Voice (.wav, .mp3)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={clone.toggleRecording}
                className={
                  clone.isRecording
                    ? 'w-full h-12 rounded-xl bg-red-50 text-red-600 border border-red-200 font-semibold text-sm flex items-center justify-center gap-2'
                    : 'w-full h-12 rounded-xl bg-white text-slate-700 border border-slate-200 font-semibold text-sm flex items-center justify-center gap-2 hover:border-[color:rgb(var(--brand-blue))]'
                }
              >
                {clone.isRecording ? <Square size={14} /> : <Mic size={14} />}
                {clone.isRecording ? 'Stop Recording' : 'Record Reference Voice'}
              </button>
              {clone.recordingError && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                  {clone.recordingError}
                </div>
              )}
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Best results: 10–30s of clear, single-speaker audio. .wav or .mp3 only.
                <br />
                Used only to generate this preview — not stored.
              </p>
            </>
          )}
          {uploadFile && (
            <div className="p-3 bg-white border border-[color:rgb(var(--brand-orange)/0.4)] rounded-xl shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[color:rgb(var(--brand-orange)/0.16)] flex items-center justify-center text-[color:rgb(var(--brand-orange))]">
                  <FileAudio size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{uploadFile.name}</span>
                  <span className="text-[10px] text-slate-400">Custom Voice</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {refPreview.url && (
                  <button
                    onClick={refPreview.toggle}
                    className="h-7 w-7 rounded-full bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))] flex items-center justify-center hover:bg-[color:rgb(var(--brand-blue)/0.2)] transition-colors"
                    title={refPreview.isPlaying ? 'Pause reference' : 'Play reference'}
                  >
                    {refPreview.isPlaying ? <Pause size={12} /> : <Play size={12} className="translate-x-[1px]" />}
                  </button>
                )}
                <button
                  onClick={clone.clearUpload}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Transcript of the uploaded audio — catalog voices carry their own. */}
        <div className="pt-2">
          <input
            type="text"
            value={session.refText}
            onChange={(e) => session.setRefText(e.target.value)}
            placeholder="Type the reference audio's transcript here..."
            className="w-full text-xs bg-slate-100 border-none rounded-lg px-3 py-2 text-slate-600 focus:ring-1 focus:ring-[color:rgb(var(--brand-orange))] placeholder-slate-400"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 pl-1">
            <span>*Required for accurate cloning style matching</span>
          </div>
        </div>

        <div className="space-y-2 relative">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Output Language</label>

          <div className="relative">
            <button
              onClick={clone.toggleLangMenu}
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
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform ${clone.isLangOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {clone.isLangOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto p-1">
                {LANGUAGE_DEMOS.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => clone.selectLang(lang)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                      selectedLang.id === lang.id
                        ? 'bg-[color:rgb(var(--brand-blue)/0.12)] text-[color:rgb(var(--brand-blue))]'
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span>{lang.name}</span>
                    {selectedLang.id === lang.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preset text chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {selectedLang.demos.map((demo, idx) => (
              <button
                key={idx}
                onClick={() => clone.selectDemo(idx)}
                className={`
                    text-[10px] font-medium px-2 py-1 rounded-md border transition-all flex items-center gap-1
                    ${
                      selectedDemoIdx === idx
                        ? 'bg-[color:rgb(var(--brand-orange)/0.12)] border-[color:rgb(var(--brand-orange)/0.35)] text-[color:rgb(var(--brand-orange))]'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }
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
  );
};
