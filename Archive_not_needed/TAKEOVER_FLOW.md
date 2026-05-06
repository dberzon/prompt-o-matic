# Prompt-o-matic — Generate / Polish Flow

## Main Flow

1. User configures prompt components in the React UI:
   - scene
   - scenario
   - chips
   - characters
   - director

2. `App.jsx` assembles the base prompt using:

   `assemblePrompt({ scene, scenario, chips, characters })`

3. Core prompt assembly happens in:

   `src/utils/assembler.js`

   Responsibilities:
   - rewrite scene
   - order fragments
   - add shot/lens/scenario/environment/light/color/film/qualifier fragments
   - deduplicate fragments

4. User clicks **Polish with AI** in:

   `PromptOutput.jsx`

5. `PromptOutput.jsx` calls `usePolish()`

6. `usePolish.js` sends POST request to:

   `/api/polish`

   Payload includes:
   - fragments
   - directorName
   - directorNote
   - scene
   - scenario
   - frontPrefix
   - narrativeBeat
   - engine
   - localOnly
   - embedded connection details

7. Backend API handler:

   `api/polish.js`

   delegates to:

   `runPolish()`

8. Core backend polish logic:

   `api/lib/polish/polishCore.js`

   Responsibilities:
   - validate fragments
   - build LLM user message
   - resolve AI provider
   - call selected provider
   - normalize polished text

9. Provider resolution decides between:
   - embedded local provider
   - LM Studio
   - Ollama
   - mock provider
   - Claude/cloud fallback

10. Ollama provider lives in:

   `api/lib/llm/providers/ollamaProvider.js`

11. Final result returns to frontend.

12. `usePolish.js` updates React state:

   `setPolished(data.polished)`
   `setState('polished')`

13. `PromptOutput.jsx` chooses display text in priority order:
   - restored text
   - selected variant
   - polished AI result
   - assembled fallback text

14. Prompt quality score is calculated in:

   `qualityScore.js`

15. Optional features:
   - prompt variants from `variants.js`
   - export `.txt` from `PromptOutput.jsx`