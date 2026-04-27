# Cursor Implementation Brief: Local-First AI Casting & Prompt Engineering System

**Audience:** AI software developer working inside Cursor IDE  
**Preferred planning model:** Opus  
**Preferred coding mode:** Cursor Automatic mode  
**Project owner:** Dima  
**Project type:** React/Vite application for cinematic prompt engineering, character generation, ComfyUI automation, and long-term visual consistency

---

## 1. Executive Summary

We are building a custom application that helps generate high-quality, well-structured prompts for **Qwen Image 2512** inside **ComfyUI**, with the long-term goal of creating a reusable database of fictional characters, cinematic scenes, prompt templates, and visual references.

The current system uses calls to **Anthropic Claude API** for prompt refinement. This works well creatively, but it is too expensive for repeated prompt-building, batch character generation, and iterative refinement.

The proposed solution is a **local-first hybrid AI architecture**:

- Use the **Windows PC with RTX 3060** mainly for **ComfyUI / Qwen Image 2512 image generation**.
- Use the **Mac mini M4 Pro with 24 GB RAM** as the local LLM server via **LM Studio** and/or **Ollama**.
- Use **Chroma** as the semantic vector memory/search layer.
- Use a normal structured database, initially **SQLite**, later optionally **Postgres/Supabase**, as the canonical source of truth.
- Keep **Claude** only as a premium fallback for difficult creative/planning tasks.
- Optionally use the **Raspberry Pi 5** later for orchestration, queue management, dashboards, or n8n/OpenClaw-style automation, but not for main LLM inference.

The most important architectural decision:

> **Chroma should not be the only database.**  
> Use Chroma for semantic similarity and retrieval.  
> Use SQLite/Postgres/Supabase for canonical structured records.

---

## 2. Current Environment

### 2.1 Hardware

#### Windows PC

- 32 GB RAM
- NVIDIA GeForce RTX 3060
- Runs ComfyUI
- Runs Qwen Image 2512 model
- Should remain focused on image generation

#### Mac mini M4 Pro

- 24 GB RAM
- Can run local LLMs through:
  - LM Studio
  - Ollama
  - possibly llama.cpp or other local inference backends later
- Best machine for local prompt refinement and structured character generation

#### Raspberry Pi 5

- Not suitable for serious LLM inference
- Can later be used for:
  - automation
  - queue management
  - triggering jobs
  - simple dashboard
  - OpenClaw/n8n-style orchestration
  - watchdog scripts

---

## 3. Current Application Context

The app is a custom prompt-building application.

Known stack:

- Frontend: React
- Build tool: Vite
- Hosted on Vercel
- Also run locally during development, likely via:

```bash
npm run dev
```

The app currently calls Anthropic Claude API during prompt refinement.

The goal is to add support for local and cheaper models without destroying the existing Claude-based workflow.

---

## 4. Strategic Goal

The long-term goal is not only “generate better prompts.”

The goal is to build an **AI-assisted cinematic casting and visual production system**.

Example ideal workflow:

> User asks: “Create 30 unique female characters, age 20–28, for casting/audition for an upcoming movie. Each character should have a unique appearance and should be different from all characters already in the database.”

The system should:

1. Generate more candidates than needed.
2. Structure each character as JSON.
3. Compare each new character against the existing character database.
4. Reject or mutate characters that are too similar.
5. Compile accepted characters into Qwen Image 2512 prompt packs.
6. Send prompts to ComfyUI.
7. Generate multiple views/variants per character.
8. Store approved images, prompts, seeds, metadata, and embeddings.
9. Build a reusable “actor bank” for future scenes and videos.

---

## 5. Core Architecture

Recommended architecture:

```text
React / Vite Prompt App
        |
        v
Local Backend API
Node/Express or FastAPI
        |
        +--> LLM Provider Adapter
        |       +--> Claude API
        |       +--> LM Studio local API
        |       +--> Ollama local API
        |       +--> optional OpenRouter / Mistral / Qwen API
        |
        +--> Structured DB
        |       +--> SQLite for local MVP
        |       +--> optional Postgres/Supabase later
        |
        +--> Chroma
        |       +--> character embeddings
        |       +--> prompt memory
        |       +--> style references
        |       +--> semantic similarity search
        |
        +--> ComfyUI API
                +--> Qwen Image 2512 generation
```

Important split:

```text
Windows PC / RTX 3060:
- ComfyUI
- Qwen Image 2512
- Image generation

Mac mini:
- LM Studio / Ollama
- Local LLM prompt server
- Chroma
- Optional backend API

React app:
- UI
- workflow control
- prompt editing
- review/approval
```

---

## 6. Important Local vs Hosted Mode Constraint

When the app is hosted on Vercel, it cannot directly call `localhost` on the user’s Mac or PC.

Therefore the app should support two operating modes:

### 6.1 Local Studio Mode

Used by Dima in the studio.

```text
Local React app
    -> local backend API
    -> local LM Studio/Ollama
    -> local Chroma/SQLite
    -> local ComfyUI
```

This is the main production workflow for now.

### 6.2 Hosted Cloud Mode

Used only when the app is deployed publicly or accessed remotely.

```text
Vercel frontend
    -> hosted backend
    -> cloud LLM provider
    -> hosted DB
```

In cloud mode, local services like LM Studio, Ollama, Chroma running on a Mac, or ComfyUI running on a local PC are not directly available unless a secure tunnel or remote backend is explicitly configured.

For now, prioritize **Local Studio Mode**.

---

## 7. Database Decision

We considered LanceDB and Chroma.

Final current decision:

```text
Use Chroma first.
Do not use LanceDB yet.
Do not use both at the beginning.
```

### 7.1 Why Chroma

Chroma is a good fit for:

- AI memory
- semantic retrieval
- prompt libraries
- character similarity search
- style reference retrieval
- long-term RAG-style workflows
- local-first development with possible cloud evolution

The project is expected to become an AI memory system, not only a multimodal asset table.

### 7.2 What Chroma Should Store

Chroma should store embeddings and metadata for semantic search.

Suggested collections:

```text
characters
prompt_examples
style_references
generation_reviews
scene_templates
```

### 7.3 What Chroma Should NOT Be

Chroma should not be the only source of truth.

Do not rely on Chroma alone for exact structured app data.

Do not store the entire application state only in Chroma.

### 7.4 Canonical Database

Use SQLite for MVP.

Later migration options:

- Postgres
- Supabase
- Railway Postgres
- local Postgres

The canonical database should store:

- character records
- project records
- image paths
- ComfyUI workflow metadata
- prompt versions
- generation status
- approval/rejection state
- seed history
- model/workflow version
- user edits

Chroma should be rebuildable from canonical DB records if needed.

---

## 8. Data Model

### 8.1 CharacterProfile

The LLM should first generate structured character profiles, not final image prompts.

Suggested TypeScript type:

```ts
export type CharacterProfile = {
  id: string;
  projectId?: string;

  name?: string;
  age: number;
  apparentAgeRange: "20-23" | "24-26" | "27-28";

  genderPresentation?: string;

  ethnicityOrRegionalLook?: string;
  faceShape: string;
  eyes: string;
  eyebrows: string;
  nose: string;
  lips: string;
  jawline: string;
  cheekbones?: string;
  skinTone: string;
  skinTexture?: string;

  hairColor: string;
  hairLength: string;
  hairTexture: string;
  hairstyle: string;

  bodyType: string;
  heightImpression: string;
  posture: string;

  distinctiveFeatures: string[];

  wardrobeBase: string;
  cinematicArchetype: string;
  personalityEnergy: string;

  visualKeywords: string[];
  forbiddenSimilarities?: string[];

  qwenPromptSeed?: string;

  createdAt: string;
  updatedAt: string;

  approved?: boolean;
};
```

### 8.2 QwenImagePromptPack

After a character is accepted, compile it into a Qwen Image prompt pack.

```ts
export type QwenImagePromptPack = {
  characterId: string;
  projectId?: string;

  positivePrompt: string;
  negativePrompt: string;

  camera: string;
  lens?: string;
  framing: string;
  lighting: string;
  colorPalette: string;
  background: string;
  wardrobe: string;
  pose: string;
  expression: string;

  aspectRatio: "2:3" | "3:4" | "16:9" | "1:1";

  consistencyTags: string[];

  seedHint?: number;
  comfyWorkflowId?: string;

  createdAt: string;
};
```

### 8.3 GeneratedImageRecord

```ts
export type GeneratedImageRecord = {
  id: string;
  characterId?: string;
  projectId?: string;

  imagePath: string;
  thumbnailPath?: string;

  promptPackId: string;
  positivePrompt: string;
  negativePrompt: string;

  seed?: number;
  modelName: string;
  workflowVersion?: string;

  viewType:
    | "front_portrait"
    | "three_quarter_portrait"
    | "profile_portrait"
    | "full_body"
    | "audition_still"
    | "cinematic_scene"
    | "other";

  approved: boolean;
  rejectedReason?: string;

  visualDescription?: string;
  embeddingStatus?: "pending" | "embedded" | "failed";

  createdAt: string;
};
```

---

## 9. Chroma Usage

### 9.1 Collections

Create at least these collections:

```text
characters
prompt_examples
style_references
```

Later optional collections:

```text
generated_images
generation_reviews
scene_templates
director_styles
```

### 9.2 Character Embedding Text

Each character should be converted into a stable text representation before embedding.

Example:

```ts
export function characterToEmbeddingText(character: CharacterProfile): string {
  return [
    `Age: ${character.age}`,
    `Apparent age range: ${character.apparentAgeRange}`,
    `Face shape: ${character.faceShape}`,
    `Eyes: ${character.eyes}`,
    `Eyebrows: ${character.eyebrows}`,
    `Nose: ${character.nose}`,
    `Lips: ${character.lips}`,
    `Jawline: ${character.jawline}`,
    `Skin tone: ${character.skinTone}`,
    `Hair: ${character.hairColor}, ${character.hairLength}, ${character.hairTexture}, ${character.hairstyle}`,
    `Body type: ${character.bodyType}`,
    `Height impression: ${character.heightImpression}`,
    `Posture: ${character.posture}`,
    `Distinctive features: ${character.distinctiveFeatures.join(", ")}`,
    `Wardrobe base: ${character.wardrobeBase}`,
    `Cinematic archetype: ${character.cinematicArchetype}`,
    `Personality energy: ${character.personalityEnergy}`,
    `Visual keywords: ${character.visualKeywords.join(", ")}`
  ].join("\n");
}
```

### 9.3 Similarity Workflow

For batch character generation:

```text
1. Generate 60 candidate profiles for a requested batch of 30.
2. Validate JSON schema.
3. Convert each profile to embedding text.
4. Query Chroma against existing approved characters.
5. Reject profiles above similarity threshold.
6. Ask LLM to mutate rejected profiles.
7. Repeat until enough distinct profiles are accepted.
8. Save accepted profiles to canonical DB.
9. Add accepted profile embeddings to Chroma.
```

### 9.4 Suggested Similarity Thresholds

Initial values:

```ts
export const SIMILARITY_CONFIG = {
  hardRejectDistance: 0.18,
  reviewDistance: 0.28,
  acceptDistance: 0.35
};
```

These values are placeholders. They must be calibrated empirically depending on the embedding model and Chroma distance metric.

Alternative approach:

- Return top 5 nearest existing characters.
- Let the LLM judge whether the new character is too similar.
- Store both numeric score and LLM explanation.

---

## 10. Embedding Strategy

Start with local embeddings through Ollama.

Suggested embedding models:

```bash
ollama pull nomic-embed-text
```

Alternative:

```bash
ollama pull mxbai-embed-large
```

The embedding layer should be abstracted behind an interface.

```ts
export interface EmbeddingProvider {
  embedText(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}
```

Suggested implementations:

```text
OllamaEmbeddingProvider
OpenAIEmbeddingProvider, optional later
LocalMockEmbeddingProvider for tests
```

Do not hardcode one embedding provider deeply into the app.

---

## 11. LLM Provider Architecture

Do not hardcode Claude.

Create a provider abstraction.

```ts
export type LLMProviderName =
  | "claude"
  | "lmstudio"
  | "ollama"
  | "openrouter"
  | "mistral"
  | "mock";

export type LLMRequest = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  model?: string;
};

export type LLMResponse = {
  text: string;
  provider: LLMProviderName;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  estimatedCostUsd?: number;
};
```

Suggested implementations:

```text
ClaudeProvider
LMStudioProvider
OllamaProvider
OpenRouterProvider
MockProvider
```

### 11.1 Provider Priority

Default local-first routing:

```text
1. Local LM Studio / Ollama
2. Cheap cloud fallback
3. Claude premium fallback
```

### 11.2 Suggested Model Roles

```text
Fast local draft:
- Qwen 7B/9B-class model

Best local structured generation:
- Qwen 24B/27B-class quantized model
- Mistral Small 24B-class model

More unrestricted brainstorming:
- Hermes/Dolphin-style model, only for raw creative ideation

Final structured compiler:
- Qwen or Mistral model with strong JSON behavior

Premium fallback:
- Claude
```

Important:

> Do not use an “uncensored” model as the final source of truth.  
> It may be useful for wild brainstorming, but final structured output should pass through a stricter schema validator and cleaner model.

---

## 12. Prompting Pipeline

Split prompt generation into multiple deterministic stages.

Do not ask one LLM call to do everything.

### 12.1 Stage A: User Intent Expansion

Input:

```text
Create 30 unique female characters age 20 to 28 for casting for an upcoming movie.
```

Output:

```json
{
  "taskType": "batch_character_generation",
  "count": 30,
  "ageRange": [20, 28],
  "genderPresentation": "female",
  "projectTone": "cinematic audition casting",
  "diversityRequirements": [
    "unique faces",
    "different hairstyles",
    "different body/posture energies",
    "different cinematic archetypes",
    "not similar to existing database"
  ],
  "outputViews": [
    "front_portrait",
    "three_quarter_portrait",
    "profile_portrait",
    "full_body",
    "audition_still"
  ]
}
```

### 12.2 Stage B: Candidate Character Generation

Generate more candidates than needed.

Example: request 30 final characters -> generate 60 candidates.

Require strict JSON array output.

### 12.3 Stage C: Schema Validation

Use a runtime validator such as Zod.

```ts
import { z } from "zod";
```

Invalid records should be repaired by another LLM call or rejected.

### 12.4 Stage D: Similarity Filtering

Use Chroma to find nearest existing characters.

Reject or mutate too-similar characters.

### 12.5 Stage E: Character Mutation

When a candidate is too similar, ask the LLM to change specific traits only.

Mutation prompt should say:

```text
This candidate is too similar to these existing characters.
Preserve the requested age range and cinematic suitability.
Change face structure, hair, posture, archetype, and distinctive features.
Do not simply change clothes.
Return the same JSON schema.
```

### 12.6 Stage F: Prompt Compilation

Convert approved CharacterProfile records into QwenImagePromptPack records.

### 12.7 Stage G: ComfyUI Batch Generation

Generate multiple standard views per character.

Recommended initial views:

```text
front_portrait
three_quarter_portrait
profile_portrait
full_body
audition_still
cinematic_scene_test
```

### 12.8 Stage H: Review and Approval

User reviews generated images.

Each image can be:

```text
approved
rejected
needs_regeneration
needs_prompt_edit
```

Approved images are saved back to the character record.

---

## 13. ComfyUI Integration

The backend should talk to ComfyUI via API.

The app should support:

- send prompt
- send negative prompt
- set seed
- set aspect ratio / dimensions
- select workflow
- queue generation
- poll job status
- retrieve output image path
- save generation metadata

Suggested backend service:

```ts
export interface ComfyUIService {
  queuePrompt(pack: QwenImagePromptPack, options: ComfyGenerationOptions): Promise<ComfyJob>;
  getJobStatus(jobId: string): Promise<ComfyJobStatus>;
  getOutputs(jobId: string): Promise<GeneratedImageRecord[]>;
}
```

### 13.1 Standard Character View Generation

For every accepted character, optionally generate:

```text
1. neutral front portrait
2. 3/4 portrait
3. side/profile portrait
4. full-body neutral pose
5. audition-camera still
6. one cinematic scene test
```

Later this can be extended with:

- OpenPose
- Depth
- Normal map
- IP-Adapter/reference image
- face/detail consistency workflows

---

## 14. UI Requirements

The UI should support at least these panels.

### 14.1 Provider Settings Panel

Fields:

```text
LLM provider:
- Claude
- LM Studio
- Ollama
- OpenRouter
- Mock

Model name:
- free text or dropdown

Temperature:
- slider

Response mode:
- text/json

Fallback enabled:
- yes/no
```

### 14.2 Character Batch Request Panel

Fields:

```text
Count
Age range
Gender presentation
Project tone
Style notes
Diversity requirements
Forbidden similarities
Output views
Generate candidates multiplier
```

### 14.3 Candidate Review Panel

Show generated JSON profiles in human-readable cards.

Each candidate card:

```text
Name/ID
Age
Face summary
Hair summary
Body/posture
Wardrobe base
Cinematic archetype
Distinctive features
Similarity warning
Nearest existing characters
Accept / Reject / Mutate
```

### 14.4 Prompt Pack Panel

Show:

```text
Positive prompt
Negative prompt
Camera
Lighting
Wardrobe
Pose
Expression
Consistency tags
```

Allow manual editing before sending to ComfyUI.

### 14.5 Image Review Panel

Show generated images with:

```text
Approve
Reject
Regenerate
Edit prompt
View metadata
Compare with nearest existing characters
```

---

## 15. Backend API Design

Suggested endpoints:

```text
GET /api/health

GET /api/providers
POST /api/llm/generate
POST /api/llm/generate-json

POST /api/characters/batch-plan
POST /api/characters/generate-candidates
POST /api/characters/validate
POST /api/characters/check-similarity
POST /api/characters/mutate
POST /api/characters/accept
GET /api/characters
GET /api/characters/:id

POST /api/prompts/compile-qwen
POST /api/prompts/refine

POST /api/comfy/queue
GET /api/comfy/jobs/:id
GET /api/comfy/jobs/:id/outputs

POST /api/chroma/reindex
GET /api/chroma/status
```

---

## 16. Suggested Project Structure

Adapt to the existing project layout, but aim for this separation:

```text
src/
  app/
  components/
    ProviderSettingsPanel.tsx
    CharacterBatchRequestPanel.tsx
    CandidateReviewPanel.tsx
    PromptPackPanel.tsx
    ImageReviewPanel.tsx

  lib/
    llm/
      types.ts
      LLMProvider.ts
      ClaudeProvider.ts
      LMStudioProvider.ts
      OllamaProvider.ts
      OpenRouterProvider.ts
      MockProvider.ts
      routeLLMRequest.ts

    embeddings/
      types.ts
      OllamaEmbeddingProvider.ts
      MockEmbeddingProvider.ts

    vector/
      types.ts
      ChromaVectorStore.ts
      MockVectorStore.ts

    characters/
      types.ts
      schemas.ts
      characterToEmbeddingText.ts
      similarity.ts
      mutation.ts

    prompts/
      qwenPromptCompiler.ts
      promptSchemas.ts
      negativePromptLibrary.ts

    comfy/
      ComfyUIService.ts
      comfyTypes.ts

server/
  index.ts
  routes/
    providers.ts
    llm.ts
    characters.ts
    comfy.ts
    chroma.ts

  db/
    sqlite.ts
    schema.sql
    repositories/
      CharacterRepository.ts
      PromptRepository.ts
      GenerationRepository.ts
```

If the current application is frontend-only on Vercel, add a local backend package or `/server` folder.

---

## 17. Safety and Robustness Requirements

### 17.1 JSON Validation

Every LLM-generated JSON response must be validated.

Use Zod or a similar schema validation library.

Do not trust raw LLM output.

### 17.2 Retry Strategy

If JSON parsing fails:

```text
1. Try extracting JSON from text.
2. Validate with schema.
3. If invalid, ask LLM to repair using validation error.
4. If still invalid, reject gracefully.
```

### 17.3 Cost Control

Track:

```text
provider
model
input tokens
output tokens
estimated cost
task type
timestamp
```

Even for local models, track approximate token usage if available.

### 17.4 Fallback Logic

Suggested routing:

```text
Local provider succeeds -> use result.
Local provider fails -> optional cheap cloud fallback.
Fallback fails -> optional Claude fallback.
Claude fallback disabled by default unless explicitly selected.
```

### 17.5 No Silent Data Loss

Any accepted character should exist in the canonical DB before its embedding is inserted into Chroma.

If Chroma indexing fails, mark the record:

```text
embeddingStatus = "failed"
```

and allow reindexing later.

---

## 18. Local Development Configuration

Use environment variables.

Example `.env.local`:

```bash
# LLM providers
CLAUDE_API_KEY=
OPENROUTER_API_KEY=

# Local LM Studio
LMSTUDIO_BASE_URL=http://mac-mini.local:1234/v1
LMSTUDIO_MODEL=qwen-local

# Ollama
OLLAMA_BASE_URL=http://mac-mini.local:11434
OLLAMA_CHAT_MODEL=qwen
OLLAMA_EMBED_MODEL=nomic-embed-text

# Chroma
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION_CHARACTERS=characters

# ComfyUI
COMFYUI_BASE_URL=http://windows-pc.local:8188

# App mode
APP_MODE=local-studio
```

Use actual LAN hostnames or IP addresses.

---

## 19. First Implementation Milestone

Cursor should implement this in small, testable phases.

### Milestone 1: Provider Abstraction

Goal:

- Current Claude calls should be wrapped behind an LLMProvider interface.
- Add LM Studio provider.
- Add Ollama provider.
- Add mock provider for tests.

Deliverables:

```text
LLMProvider interface
ClaudeProvider
LMStudioProvider
OllamaProvider
MockProvider
provider routing function
basic provider settings UI
```

Do not yet implement Chroma or ComfyUI automation in this milestone unless the existing app is already structured for it.

### Milestone 2: Character Schemas

Goal:

- Add CharacterProfile and QwenImagePromptPack types.
- Add Zod schemas.
- Add JSON validation.
- Add characterToEmbeddingText function.
- Add test fixtures.

Deliverables:

```text
types
schemas
validation helpers
sample generated character JSON
unit tests
```

### Milestone 3: Chroma Integration

Goal:

- Add Chroma client.
- Create `characters` collection.
- Add embedding provider.
- Add character indexing.
- Add similar-character search.

Deliverables:

```text
ChromaVectorStore
OllamaEmbeddingProvider
indexCharacter()
findSimilarCharacters()
reindex endpoint
status endpoint
```

### Milestone 4: Batch Character Generation

Goal:

- Generate candidate characters via selected LLM.
- Validate candidates.
- Check similarity.
- Accept/reject/mutate.
- Save accepted characters.

Deliverables:

```text
batch generation service
similarity filtering service
mutation service
candidate review UI
```

### Milestone 5: Qwen Prompt Compiler

Goal:

- Convert CharacterProfile records into QwenImagePromptPack records.
- Allow manual editing in UI.

Deliverables:

```text
qwenPromptCompiler
prompt pack schema
prompt pack UI
negative prompt library
```

### Milestone 6: ComfyUI Queue Integration

Goal:

- Send prompt packs to ComfyUI.
- Queue generations.
- Poll status.
- Save output metadata.

Deliverables:

```text
ComfyUIService
queue generation endpoint
job status endpoint
image output ingestion
image review UI
```

---

## 20. Cursor-Specific Instructions

Cursor should not immediately rewrite the whole app.

First inspect the existing repository.

### 20.1 First Cursor Task

Ask Cursor/Opus to do this:

```text
Inspect the current React/Vite project structure and identify where existing Claude/Anthropic API calls are made. Do not modify files yet. Produce an implementation map showing:
1. files that currently handle prompt refinement,
2. components that call those functions,
3. where environment variables are read,
4. whether there is already a backend/server layer,
5. the smallest safe place to insert an LLMProvider abstraction.
```

### 20.2 Second Cursor Task

After inspection, ask Cursor to implement Milestone 1 only.

```text
Implement an LLM provider abstraction without changing the UI behavior. Existing Claude behavior must continue to work. Add LM Studio and Ollama providers behind the same interface, but keep Claude as the default until manually changed.
```

### 20.3 Third Cursor Task

After Milestone 1 works, ask Cursor to add schema validation.

```text
Add CharacterProfile and QwenImagePromptPack types and Zod schemas. Add utilities for parsing and repairing JSON returned by LLM providers. Add sample fixtures and tests.
```

### 20.4 Coding Style

Cursor should:

- Prefer small patches.
- Avoid huge rewrites.
- Keep existing behavior working.
- Add types before features.
- Add tests for provider routing and schema validation.
- Use mock providers for tests.
- Avoid hardcoding local IP addresses.
- Use `.env.local` for local machine configuration.
- Keep secrets out of git.

---

## 21. Example Master Prompt for Cursor

Use this as the initial prompt inside Cursor with Opus:

```text
You are helping implement a local-first AI prompt engineering and cinematic character casting system inside an existing React/Vite application.

The app currently uses Anthropic Claude API for prompt refinement, but we need to reduce cost by adding local LLM support via LM Studio and Ollama. The app is used to create well-engineered prompts for Qwen Image 2512 in ComfyUI.

Important hardware split:
- Windows PC with RTX 3060 runs ComfyUI and Qwen Image 2512.
- Mac mini M4 Pro with 24 GB RAM runs local LLMs through LM Studio/Ollama.
- Raspberry Pi 5 may later orchestrate queues, but should not run main LLM inference.

Architectural decisions:
- Add an LLMProvider abstraction.
- Do not hardcode Claude.
- Add LM Studio and Ollama providers.
- Use Chroma for semantic memory and similarity search.
- Use SQLite/Postgres/Supabase as canonical structured data.
- Chroma is not the source of truth; it is a rebuildable semantic index.
- Start with local-studio mode.
- Keep Claude as optional premium fallback.
- Do not integrate LanceDB for now.

First task:
Inspect the repository and identify where Claude API calls are currently made. Do not modify files yet. Produce an implementation map showing the smallest safe refactor path toward an LLMProvider abstraction.

After inspection, propose a phased implementation plan:
1. Provider abstraction.
2. CharacterProfile and QwenImagePromptPack schemas.
3. Chroma integration.
4. Batch character generation with similarity filtering.
5. Qwen prompt compiler.
6. ComfyUI queue integration.

Constraints:
- Small safe patches only.
- Existing behavior must not break.
- Prefer TypeScript interfaces and Zod validation.
- Use mock providers for tests.
- Store local configuration in environment variables.
- Do not commit secrets.
```

---

## 22. Final Recommended Stack

```text
Frontend:
- React
- Vite
- existing UI retained and expanded

Local backend:
- Node/Express or FastAPI
- choose based on current app structure

LLM:
- Claude as premium fallback
- LM Studio as local OpenAI-compatible server
- Ollama as local model and embedding server

Vector memory:
- Chroma

Canonical DB:
- SQLite for MVP
- Postgres/Supabase later

Image generation:
- ComfyUI
- Qwen Image 2512

Optional orchestration:
- Raspberry Pi 5
- n8n/OpenClaw-style queue automation later
```

---

## 23. Most Important Implementation Principle

Do not build this as a one-shot prompt generator.

Build it as a staged production pipeline:

```text
user intent
 -> structured task plan
 -> candidate character JSON
 -> schema validation
 -> semantic similarity check
 -> mutation/retry
 -> accepted character profile
 -> Qwen prompt pack
 -> ComfyUI generation
 -> human review
 -> database save
 -> Chroma indexing
```

This makes the application much more powerful, cheaper to run, and suitable for long-term cinematic character consistency.
