import os
import sys
import json
import re
import tempfile
import time
import gc
from pathlib import Path
from typing import Optional

# These must be set before importing torch / F5-TTS internals.
os.environ.setdefault("ESPEAK_MODE", "custom")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

F5_ROOT = Path(os.getenv("F5_TTS_ROOT", "/workspace/personal/team_folders/vansh.pundir/F5-TTS-22-lang/F5-TTS"))
F5_SRC = F5_ROOT / "src"
if str(F5_SRC) not in sys.path:
    sys.path.insert(0, str(F5_SRC))

CKPT_ROOT = Path(os.getenv("F5_TTS_CKPT_ROOT", str(F5_ROOT / "ckpts")))
CHECKPOINT_RUN_DIR = Path(os.getenv(
    "F5_TTS_CHECKPOINT_RUN_DIR",
    str(CKPT_ROOT / "F5TTS_v1_Base_vocos_cls_speech_db_only_TTS_22_langs_eval_v2_fixed_ipa_lid_char"),
))
DEFAULT_CKPT_FILE = Path(os.getenv(
    "F5_TTS_CKPT_FILE",
    str(CHECKPOINT_RUN_DIR / "model_1550000.pt"),
))
DEFAULT_VOCAB_FILE = Path(os.getenv(
    "F5_TTS_VOCAB_FILE",
    str(DEFAULT_CKPT_FILE.parent / "vocab.txt"),
))
DEFAULT_CONFIG_NAME = os.getenv("F5_TTS_CONFIG", "F5TTS_v1_Base_frame_22_lang_wer_and_tts_ipa_ipa_lid_char")
CONFIGS_DIR = F5_ROOT / "src/f5_tts/configs"
APP_ROOT = Path(__file__).resolve().parent.parent
VOICES_FILE = Path(os.getenv("BHARATGEN_VOICES_FILE", str(APP_ROOT / "voices.json")))

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from hydra.utils import get_class
from omegaconf import OmegaConf
import numpy as np
import soundfile as sf
import torch

import f5_tts.infer.utils_infer as utils_infer
from f5_tts.infer.infer_normalisation import normalize_and_transcribe
from f5_tts.model.utils import seed_everything

app = FastAPI(title="BharatGen F5-TTS API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-inference-rtf", "x-inference-seconds", "x-audio-duration"],
)

LANGUAGE_ALIASES = {
    "as": "as", "assamese": "as",
    "bn": "bn", "bengali": "bn",
    "brx": "brx", "bodo": "brx",
    "doi": "doi", "dogri": "doi",
    "en": "en", "english": "en", "indian_english": "en", "indian english": "en",
    "gu": "gu", "gujarati": "gu",
    "hi": "hi", "hindi": "hi",
    "kn": "kn", "kannada": "kn",
    "kok": "kok", "konkani": "kok",
    "ks": "ks", "kashmiri": "ks",
    "mai": "mai", "maithili": "mai",
    "ml": "ml", "malayalam": "ml",
    "mni": "mni", "manipuri": "mni", "meitei": "mni",
    "mr": "mr", "marathi": "mr",
    "ne": "ne", "nepali": "ne",
    "or": "or", "odia": "or", "oriya": "or",
    "pa": "pa", "punjabi": "pa", "panjabi": "pa",
    "sa": "sa", "sanskrit": "sa",
    "sat": "sat", "santali": "sat",
    "sd": "sd", "sindhi": "sd",
    "ta": "ta", "tamil": "ta",
    "te": "te", "telugu": "te",
    "ur": "ur", "urdu": "ur",
}

def load_voice_presets() -> list[dict]:
    if not VOICES_FILE.exists():
        raise RuntimeError(f"voices.json not found: {VOICES_FILE}")

    with VOICES_FILE.open("r", encoding="utf-8") as handle:
        voices = json.load(handle)

    if not isinstance(voices, list):
        raise RuntimeError(f"voices.json must contain a list: {VOICES_FILE}")

    normalized: list[dict] = []
    for voice in voices:
        if not isinstance(voice, dict):
            continue
        voice_id = str(voice.get("id") or voice.get("languageId") or "").strip()
        language = resolve_language(str(voice.get("languageId") or voice_id))
        if not voice_id or not language:
            continue

        item = dict(voice)
        item["id"] = voice_id
        item["languageId"] = language
        item["audioUrl"] = f"/api/tts/reference/{voice_id}"
        normalized.append(item)

    return normalized


def resolve_voice_preset(voice_id: str) -> dict | None:
    requested = (voice_id or "").strip().lower()
    language = resolve_language(requested)

    for voice in load_voice_presets():
        if str(voice.get("id", "")).lower() == requested:
            return voice
        if resolve_language(str(voice.get("languageId", ""))) == language:
            return voice
        if str(voice.get("name", "")).strip().lower() == requested:
            return voice
        if str(voice.get("languageName", "")).strip().lower() == requested:
            return voice

    return None

_model = None
_vocoder = None
_model_device = None
_mel_spec_type = "vocos"
_target_sample_rate = 24000
_loaded_checkpoint_id = None
_loaded_checkpoint = None
_checkpoint_cache = None


def _checkpoint_id(ckpt_file: Path) -> str:
    try:
        return ckpt_file.relative_to(CKPT_ROOT).as_posix()
    except ValueError:
        return f"{ckpt_file.parent.name}/{ckpt_file.name}"


def _display_name(ckpt_file: Path) -> str:
    folder = ckpt_file.parent.name
    stem = ckpt_file.stem
    if stem.startswith("model_"):
        stem = stem.replace("model_", "", 1)
    return f"{folder} · {stem}"


def _step_sort_value(filename: str) -> tuple[int, int | str]:
    stem = Path(filename).stem
    if stem == "model_last":
        return (2, 0)
    match = re.search(r"(\d+)", stem)
    if match:
        return (1, int(match.group(1)))
    return (0, stem)


def _config_for_checkpoint(folder: str) -> str:
    if folder == "F5TTS_Base":
        return "F5TTS_Base"
    if folder == "F5TTS_v1_Base" or folder == "F5TTS_v1_Base_no_zero_init":
        return "F5TTS_v1_Base"
    if folder == "F5TTS_v1_Base_replicate_first_11_epoch":
        return "F5TTS_v1_Base_replicate_first_11_epoch"
    if "12_lang" in folder and "char" in folder:
        return "F5TTS_v1_Base_frame_12_lang_wer_and_tts_char_scratch"
    if "12_lang" in folder and "cls" in folder:
        return "F5TTS_v1_Base_frame_12_lang_wer_and_tts_cls"
    if "22_lang" in folder and "ipa_lid_char" in folder:
        return "F5TTS_v1_Base_frame_22_lang_wer_and_tts_ipa_ipa_lid_char"
    if "22_lang" in folder and "ipa" in folder:
        return "F5TTS_v1_Base_frame_22_lang_wer_and_tts_ipa_scratch"
    if "cls" in folder:
        return "F5TTS_v1_Base_frame_12_lang_wer_and_tts_cls"
    if "char" in folder:
        return "F5TTS_v1_Base_frame_12_lang_wer_and_tts_char_scratch"
    return DEFAULT_CONFIG_NAME


def _tokenizer_for_checkpoint(folder: str) -> str:
    return "cls" if "cls" in folder or "ipa_lid_char" in folder else "custom"


def _modes_for_tokenizer(tokenizer_name: str) -> tuple[str, str, str]:
    if tokenizer_name == "cls":
        return "cls", "cls", "cls"
    return "auto", "auto", "auto"


def discover_checkpoints() -> list[dict]:
    global _checkpoint_cache
    if _checkpoint_cache is not None:
        return _checkpoint_cache

    checkpoints: list[dict] = []
    vocab_file = CHECKPOINT_RUN_DIR / "vocab.txt"
    if vocab_file.exists():
        folder = vocab_file.parent.name
        config_name = _config_for_checkpoint(folder)
        config_file = CONFIGS_DIR / f"{config_name}.yaml"
        tokenizer_name = _tokenizer_for_checkpoint(folder)
        model_files = sorted(vocab_file.parent.glob("*.pt"), key=lambda file: _step_sort_value(file.name)) if config_file.exists() else []
        for model_file in model_files:
            checkpoint_id = _checkpoint_id(model_file)
            checkpoints.append({
                "id": checkpoint_id,
                "name": _display_name(model_file),
                "run": folder,
                "file": model_file.name,
                "checkpoint": str(model_file),
                "vocab": str(vocab_file),
                "config": config_name,
                "tokenizer": tokenizer_name,
                "is_default": model_file.resolve() == DEFAULT_CKPT_FILE.resolve(),
            })

    checkpoints.sort(key=lambda item: (0 if item["is_default"] else 1, item["run"], _step_sort_value(item["file"])))
    _checkpoint_cache = checkpoints
    return checkpoints


def resolve_checkpoint(checkpoint_id: Optional[str] = None) -> dict:
    checkpoints = discover_checkpoints()
    if not checkpoints:
        default_config = DEFAULT_CONFIG_NAME
        return {
            "id": _checkpoint_id(DEFAULT_CKPT_FILE),
            "name": _display_name(DEFAULT_CKPT_FILE),
            "run": DEFAULT_CKPT_FILE.parent.name,
            "file": DEFAULT_CKPT_FILE.name,
            "checkpoint": str(DEFAULT_CKPT_FILE),
            "vocab": str(DEFAULT_VOCAB_FILE),
            "config": default_config,
            "tokenizer": _tokenizer_for_checkpoint(DEFAULT_CKPT_FILE.parent.name),
            "is_default": True,
        }

    if not checkpoint_id:
        default = next((item for item in checkpoints if item["is_default"]), None)
        return default or checkpoints[0]

    for item in checkpoints:
        if item["id"] == checkpoint_id:
            return item
    raise HTTPException(status_code=400, detail=f"Unknown checkpoint: {checkpoint_id}")


def resolve_language(language: Optional[str]) -> str:
    key = (language or "hi").strip().lower().replace("-", "_")
    return LANGUAGE_ALIASES.get(key, key or "hi")


def _parse_user_ipa_tokens(text: str) -> list[str]:
    stripped = (text or "").strip()
    if not stripped:
        return [" "]
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, list) and all(isinstance(token, str) for token in parsed):
            return parsed or [" "]
    except json.JSONDecodeError:
        pass
    return [token for token in re.split(r"\s+", stripped) if token] or [" "]


def _log_ipa_tokens(label: str, base_lang: str | None, text: str, tokens: list[str], user_supplied: bool = False):
    print(f"\n[{label}]", flush=True)
    print(f"  base_lang: {base_lang}", flush=True)
    print(f"  source   : {'user IPA' if user_supplied else 'normalised text'}", flush=True)
    print(f"  text     : {text}", flush=True)
    print(f"  ipa      : {' '.join(tokens)}", flush=True)
    print(f"  tokens   : {tokens}", flush=True)
    print(f"  n_tokens : {len(tokens)}", flush=True)


def prepare_normalized_cls_tokens(text_list: list[str], text_language: str | None = None) -> list[list[str]]:
    base_lang = resolve_language(text_language)
    token_batches = []
    for text in text_list:
        tokens = normalize_and_transcribe(text or "", base_lang=base_lang)
        final_tokens = tokens or list(text or " ")
        _log_ipa_tokens("IPA normalisation", base_lang, text, final_tokens)
        token_batches.append(final_tokens)
    return token_batches


_original_prepare_text_tokens = utils_infer._prepare_text_tokens


def prepare_text_tokens_with_user_ipa(
    text_list: list[str],
    tokenizer_name: str,
    text_language: str | None = None,
    text_is_ipa: bool = False,
    text_mode: str = "auto",
):
    resolved_mode = utils_infer._resolve_text_mode(tokenizer_name, text_mode, text_is_ipa=text_is_ipa)
    if resolved_mode == "cls" and text_is_ipa:
        base_lang = resolve_language(text_language)
        token_batches = []
        for text in text_list:
            tokens = _parse_user_ipa_tokens(text)
            _log_ipa_tokens("IPA passthrough", base_lang, text, tokens, user_supplied=True)
            token_batches.append(tokens)
        return token_batches
    if resolved_mode == "cls":
        return prepare_normalized_cls_tokens(text_list, text_language=text_language)
    return _original_prepare_text_tokens(
        text_list,
        tokenizer_name,
        text_language=text_language,
        text_is_ipa=text_is_ipa,
        text_mode=text_mode,
    )


# The 22-language checkpoint was trained with IPA + language-id tokens. Route F5's
# CLS token path through the requested normalization module before inference, with
# an advanced passthrough for user-supplied IPA token strings.
utils_infer._prepare_cls_tokens = prepare_normalized_cls_tokens
utils_infer._prepare_text_tokens = prepare_text_tokens_with_user_ipa


def load_runtime(checkpoint_id: Optional[str] = None):
    global _model, _vocoder, _model_device, _mel_spec_type, _target_sample_rate, _loaded_checkpoint_id, _loaded_checkpoint
    checkpoint = resolve_checkpoint(checkpoint_id)
    if _model is not None and _vocoder is not None and _loaded_checkpoint_id == checkpoint["id"]:
        return _model, _vocoder, _model_device, _mel_spec_type, _target_sample_rate, checkpoint

    ckpt_file = Path(checkpoint["checkpoint"])
    vocab_file = Path(checkpoint["vocab"])
    config_file = CONFIGS_DIR / f"{checkpoint['config']}.yaml"

    if not ckpt_file.exists():
        raise RuntimeError(f"Checkpoint not found: {ckpt_file}")
    if not vocab_file.exists():
        raise RuntimeError(f"Vocab not found: {vocab_file}")
    if not config_file.exists():
        raise RuntimeError(f"Config not found: {config_file}")

    if _model is not None or _vocoder is not None:
        print(f"Switching checkpoint: {_loaded_checkpoint_id} -> {checkpoint['id']}", flush=True)
        _model = None
        _vocoder = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    config = OmegaConf.load(config_file)
    model_cls = get_class(f"f5_tts.model.{config.model.backbone}")
    model_arc = config.model.arch
    _mel_spec_type = config.model.mel_spec.mel_spec_type
    _target_sample_rate = int(config.model.mel_spec.target_sample_rate)
    _model_device = (
        "cuda" if torch.cuda.is_available()
        else "xpu" if hasattr(torch, "xpu") and torch.xpu.is_available()
        else "mps" if torch.backends.mps.is_available()
        else "cpu"
    )

    vocoder_local_path = config.model.vocoder.local_path
    use_local_vocoder = bool(config.model.vocoder.is_local and vocoder_local_path)
    print(f"Loading checkpoint: {checkpoint['id']} ({checkpoint['config']}, tokenizer={checkpoint['tokenizer']})", flush=True)
    _vocoder = utils_infer.load_vocoder(
        _mel_spec_type,
        is_local=use_local_vocoder,
        local_path=vocoder_local_path,
        device=_model_device,
    )
    _model = utils_infer.load_model(
        model_cls,
        model_arc,
        str(ckpt_file),
        mel_spec_type=_mel_spec_type,
        vocab_file=str(vocab_file),
        tokenizer_name=checkpoint["tokenizer"],
        device=_model_device,
    )
    _loaded_checkpoint_id = checkpoint["id"]
    _loaded_checkpoint = checkpoint
    return _model, _vocoder, _model_device, _mel_spec_type, _target_sample_rate, checkpoint


@app.on_event("startup")
def startup_load_model():
    if os.getenv("F5_TTS_LAZY_LOAD", "0") != "1":
        load_runtime()


@app.get("/health")
def health():
    checkpoint = _loaded_checkpoint or resolve_checkpoint()
    return {
        "status": "ok",
        "checkpoint_id": checkpoint["id"],
        "checkpoint": checkpoint["checkpoint"],
        "vocab": checkpoint["vocab"],
        "config": checkpoint["config"],
        "tokenizer": checkpoint["tokenizer"],
        "loaded": _loaded_checkpoint_id == checkpoint["id"],
        "device": _model_device or ("cuda" if torch.cuda.is_available() else "cpu"),
        "cuda_visible_devices": os.getenv("CUDA_VISIBLE_DEVICES"),
        "espeak_mode": os.getenv("ESPEAK_MODE"),
    }


@app.get("/checkpoints")
def checkpoints():
    items = discover_checkpoints()
    return {
        "default_checkpoint_id": resolve_checkpoint()["id"],
        "loaded_checkpoint_id": _loaded_checkpoint_id,
        "run_dir": str(CHECKPOINT_RUN_DIR),
        "count": len(items),
        "checkpoints": items,
    }


@app.get("/voices")
def voices():
    try:
        return load_voice_presets()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/reference/{voice_id}")
def reference_audio(voice_id: str):
    try:
        voice = resolve_voice_preset(voice_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not voice:
        raise HTTPException(status_code=404, detail=f"Reference voice not found: {voice_id}")

    audio_path = Path(str(voice.get("audioPath") or ""))
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail=f"Reference audio not found for {voice_id}: {audio_path}")

    language = resolve_language(str(voice.get("languageId") or voice_id))
    return FileResponse(str(audio_path), media_type="audio/wav", filename=f"{language}.wav")


@app.post("/synthesize/upload")
async def synthesize_upload(
    text: str = Form(...),
    ref_text: str = Form(...),
    language: str = Form("hi"),
    nfe_step: int = Form(32),
    speed: float = Form(1.0),
    gen_text_is_ipa: bool = Form(False),
    checkpoint_id: str = Form(""),
    ref_audio: UploadFile = File(...),
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    if not ref_text.strip():
        raise HTTPException(status_code=400, detail="ref_text is required")

    model, vocoder, device, mel_spec_type, sample_rate, checkpoint = load_runtime(checkpoint_id or None)
    resolved_language = resolve_language(language)
    ref_text_mode, gen_text_mode, text_mode = _modes_for_tokenizer(checkpoint["tokenizer"])
    seed_everything(int(os.getenv("F5_TTS_SEED", "0")))

    suffix = Path(ref_audio.filename or "reference.wav").suffix or ".wav"
    tmp_in = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp_in_path = Path(tmp_in.name)
    try:
        tmp_in.write(await ref_audio.read())
        tmp_in.close()
        processed_ref_audio, processed_ref_text = utils_infer.preprocess_ref_audio_text(str(tmp_in_path), ref_text)

        started = time.perf_counter()
        wav, sr, _spec = utils_infer.infer_process(
            processed_ref_audio,
            processed_ref_text,
            text,
            model,
            vocoder,
            mel_spec_type=mel_spec_type,
            progress=None,
            nfe_step=nfe_step,
            speed=speed,
            text_language=resolved_language,
            ref_text_language=resolved_language,
            gen_text_language=resolved_language,
            text_mode=text_mode,
            ref_text_mode=ref_text_mode,
            gen_text_mode=gen_text_mode,
            gen_text_is_ipa=gen_text_is_ipa,
            device=device,
        )
        elapsed = max(time.perf_counter() - started, 1e-9)
        audio_duration = float(len(wav) / sr) if sr else 0.0
        rtf = elapsed / audio_duration if audio_duration else 0.0

        out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        out_path = Path(out.name)
        out.close()
        sf.write(str(out_path), np.asarray(wav), sample_rate)

        def stream_file():
            try:
                with open(out_path, "rb") as handle:
                    yield from handle
            finally:
                try:
                    out_path.unlink(missing_ok=True)
                except Exception:
                    pass

        return StreamingResponse(
            stream_file(),
            media_type="audio/wav",
            headers={
                "x-inference-rtf": f"{rtf:.6f}",
                "x-inference-seconds": f"{elapsed:.6f}",
                "x-audio-duration": f"{audio_duration:.6f}",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        try:
            tmp_in_path.unlink(missing_ok=True)
        except Exception:
            pass
