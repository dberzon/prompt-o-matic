[plugin:vite:react-babel] C:\Users\user\Documents\qwen-prompt-builder\src\components\CastingPipelinePanel.jsx: Missing catch or finally clause. (594:6)
  597 |         setSavedCharacters((prev) => {
C:/Users/user/Documents/qwen-prompt-builder/src/components/CastingPipelinePanel.jsx:594:6
602|          for (const charId of newSuccessCharIds) backgroundCompilePromptPacks(charId)
603|    async function handleApproveAndQueuePortfolio(auditionId, characterId) {
604|      setAuditionItemActions((prev) => ({ ...prev, [auditionId]: { busy: true, error: null } }))
   |                            ^
605|      try {
606|        await approveActorAudition(auditionId)