# Before You Start

This document lists what needs to be running before launching Qwen Prompt Builder (Prompt-o-matic). The app has several optional background services — the more you run, the more features work.

---

## Quick Checklist

| Service | Port | Required for | How to start |
|---|---|---|---|
| **The app itself** | 5173 | Everything | `npm run dev` |
| **LM Studio** | 1234 | Prompt polish, character generation | Start LM Studio → load model → Start server |
| **Ollama** | 11434 | Prompt polish (fallback to LM Studio) | `ollama serve` |
| **ComfyUI** | 8188 | Image generation | `python main.py` in ComfyUI folder |
| **Chroma** | 8000 | Character similarity search | `chroma run` |

---

## 1. The App

```bash
cd qwen-prompt-builder
npm install       # first time only
npm run dev
```

Opens at **http://localhost:5173**. The API server is embedded in Vite — no separate backend process needed in dev mode.

---

## 2. LM Studio (Primary Local LLM)

Used for: **Prompt Polish**, **Character Generation** (batch pipeline), and any other AI features.

**Steps:**
1. Download and open [LM Studio](https://lmstudio.ai)
2. Go to the **Models** tab and download a model. Recommended:
   - A Qwen2.5 instruct variant (7B or larger) for best results with cinematic prompts
   - `nomic-embed-text-v1.5` for character similarity search (embedding model)
3. Go to the **Local Server** tab (lightning bolt icon)
4. Select your downloaded model in the model dropdown
5. Click **Start Server**

The server starts on `http://localhost:1234/v1` by default. Confirm it shows a green "Running" status.

**Configured model** (from your `.env.local`):
- Chat model: `Gemma-4-E4B-Uncensored-HauhauCS-Aggressive` (or swap in any instruct model)
- Embedding model: `nomic-embed-text-v1.5`

> If you use a different model name, update `LMSTUDIO_MODEL` in your `.env.local`.

---

## 3. Ollama (Fallback Local LLM)

Used as a fallback if LM Studio is not running. You only need one of the two.

```bash
# Install from https://ollama.com, then:
ollama serve

# Pull the default model (first time):
ollama pull qwen2.5:7b-instruct
ollama pull nomic-embed-text
```

Runs on `http://localhost:11434`.

---

## 4. ComfyUI (Image Generation)

Used for: **queuing and running image generation workflows**.

```bash
cd /path/to/ComfyUI
python main.py
# Or with GPU: python main.py --gpu-only
```

Runs on `http://localhost:8188`. Open in a browser to confirm the UI loads.

**Required:** At least one checkpoint model installed in `ComfyUI/models/checkpoints/` and any LoRAs/VAEs your workflows reference.

> Without ComfyUI running, the Queue/Generate buttons in the app will show an error. All other features continue to work.

---

## 5. Chroma Vector Database (Character Similarity Search)

Used for: **"Find similar characters"** and semantic search features.

```bash
# Install: pip install chromadb
chroma run --path ./chroma_data
```

Runs on `http://localhost:8000`.

> This is the most optional service. Without it, you lose similarity search but all other features remain fully functional. The character index can be rebuilt anytime from the app's Vector Maintenance panel.

---

## 6. Anthropic API Key (Cloud LLM Fallback)

If no local LLM is running, the app can fall back to **Claude (cloud)** for prompt polish.

Add your key to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The app uses the cloud fallback automatically when local providers are unavailable (`engine=auto` mode). To disable cloud fallback and force local-only, set `LLM_PROVIDER=local` in your `.env.local`.

---

## Provider Fallback Order

When you use Prompt Polish or Character Generation, the app tries providers in this order:

```
Embedded (Tauri desktop only) → Local (LM Studio or Ollama) → Cloud (Anthropic)
```

If you're running the web dev build (`npm run dev`), embedded is skipped and it goes straight to local → cloud.

---

## Minimal Setup (Local LLM only, no image gen)

If you just want to build and polish prompts:

1. Start LM Studio with a model loaded and server running
2. `npm run dev`

That's it. Prompt assembly, polish, character builder, and the casting pipeline all work without ComfyUI or Chroma.

---

## Environment Variables Summary

Copy `.env.local.example` to `.env.local` and adjust as needed:

```bash
# Which local LLM to use: "lmstudio" or "ollama"
LLM_PROVIDER=lmstudio

# LM Studio
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
LMSTUDIO_MODEL=your-model-name-here
LMSTUDIO_EMBED_MODEL=nomic-embed-text-v1.5

# Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
OLLAMA_EMBED_MODEL=nomic-embed-text

# ComfyUI
COMFYUI_BASE_URL=http://127.0.0.1:8188

# Chroma
CHROMA_URL=http://127.0.0.1:8000

# Cloud fallback (optional)
ANTHROPIC_API_KEY=sk-ant-...
```
