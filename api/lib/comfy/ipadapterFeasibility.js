export const IPADAPTER_QWEN_RESEARCH = {
  verifiedAt: '2026-05-11',
  claim: 'Section 7 assumed ComfyUI Qwen-Image templates already expose IPAdapter.',
  finding: 'Current qwen-image-2512 templates are DiT-family text-to-image graphs without an IPAdapter node chain.',
  implication: 'Mainline IPAdapter targets SDXL UNet pipelines; Qwen-Image needs a dedicated adapter path or alternate continuity strategy.',
  references: [
    'api/lib/comfy/workflows/qwen-image-2512-default.json',
    'api/lib/comfy/workflows/qwen-image-2512-comfyui-00010.json',
  ],
}

export const IPADAPTER_QWEN_DECISION = {
  decision: 'continue_reference_image_path',
  rationale: 'MVP keeps option (a) continuity via reference portrait generation plus workflow mapping hooks; full DiT IPAdapter graph remains a follow-up spike, not a release blocker once reference-image injection is wired.',
  followUps: [
    'Evaluate Qwen-specific IPAdapter weights when available in ComfyUI model registry.',
    'Revisit per-character LoRA (Section 7 option b) if reference-image identity scores miss the 4/5 threshold.',
  ],
}

export function buildMinimalQwenIpAdapterWorkflowSpec() {
  return {
    workflowId: 'qwen-image-ipadapter-spike',
    requiredNodes: ['LoadImage', 'IPAdapterModelLoader', 'IPAdapterApply', 'QwenImageDiTLoader', 'KSampler'],
    status: 'spec_only',
    note: 'No checked-in graph yet; use reference portrait conditioning via existing workflow mapping until a validated DiT IPAdapter chain exists.',
  }
}
