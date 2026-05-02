export function buildBatchCandidateGenerationPrompt({ request, totalCandidates }) {
  const diversityList = request.diversityRequirements.length
    ? request.diversityRequirements.map((item) => `- ${item}`).join('\n')
    : '- Keep all candidates visually distinct'

  return [
    'Generate fictional character profiles for cinematic casting.',
    `Return exactly ${totalCandidates} candidates.`,
    'Output must be valid JSON array only. No markdown, no comments, no extra text.',
    'Each item must include these fields:',
    [
      'name, age, apparentAgeRange {min,max}, genderPresentation, ethnicityOrRegionalLook,',
      'faceShape, eyes, eyebrows, nose, lips, jawline, cheekbones, skinTone, skinTexture,',
      'hairColor, hairLength, hairTexture, hairstyle, bodyType, heightImpression, posture,',
      'distinctiveFeatures[], wardrobeBase, cinematicArchetype, personalityEnergy, visualKeywords[]',
    ].join(' '),
    `Age range constraint: ${request.ageMin}-${request.ageMax}`,
    request.genderPresentation ? `Gender presentation: ${request.genderPresentation}` : 'Gender presentation: mixed allowed',
    request.projectTone ? `Project tone: ${request.projectTone}` : 'Project tone: cinematic audition casting',
    'Diversity requirements:',
    diversityList,
    `Output views context: ${request.outputViews.join(', ')}`,
  ].join('\n')
}

export function buildMutationPrompt({ candidate, nearestMatches }) {
  return [
    'The following character candidate is too similar to existing records.',
    'Mutate the candidate while preserving age suitability and cinematic casting quality.',
    'Change facial structure, hair, posture, archetype, and distinctive features.',
    'Do not only change wardrobe.',
    'Return valid JSON object only with the same schema fields.',
    `Candidate JSON:\n${JSON.stringify(candidate)}`,
    `Nearest similar records:\n${JSON.stringify(nearestMatches)}`,
  ].join('\n\n')
}
