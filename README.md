# BharatGen TTS Preview

Local React preview for the BharatGen/F5-TTS multilingual voice demo.

## Run Locally

Prerequisites: Node.js, Python, CUDA, and the local F5-TTS checkout at `/workspace/personal/team_folders/vansh.pundir/F5-TTS-22-lang/F5-TTS`.

1. Install frontend dependencies:

   ```bash
   npm install
   ```

2. Install server dependencies:

   ```bash
   cd server
   pip install -r requirements.txt
   ```

3. Start the local F5-TTS API on this node:

   ```bash
   cd server
   ./run_tts_api.sh
   ```

   The script uses the node's last two GPUs via `CUDA_VISIBLE_DEVICES`, sets `ESPEAK_MODE=custom`, and loads:

   ```text
   /workspace/personal/team_folders/vansh.pundir/F5-TTS-22-lang/F5-TTS/ckpts/F5TTS_v1_Base_vocos_cls_speech_db_only_TTS_22_langs_eval_v2_fixed_ipa_lid_char/model_1550000.pt
   /workspace/personal/team_folders/vansh.pundir/F5-TTS-22-lang/F5-TTS/ckpts/F5TTS_v1_Base_vocos_cls_speech_db_only_TTS_22_langs_eval_v2_fixed_ipa_lid_char/vocab.txt
   ```

4. Start the UI:

   ```bash
   npm run dev
   ```

The Vite proxy sends `/sooktam/api/tts/*` to `http://127.0.0.1:8003` by default. Override with `TTS_API_TARGET` when needed.

## Optional Whisper API

```bash
cd server
pip install -r requirements.txt
WHISPER_MODEL=large-v3 WHISPER_DEVICE=cuda uvicorn whisper_api:app --host 0.0.0.0 --port 8001
```

Then add `VITE_WHISPER_API_URL=http://localhost:8001/transcribe` to your local environment.
