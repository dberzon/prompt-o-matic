/**
 * @typedef {Object} ApparentAgeRange
 * @property {number} min
 * @property {number} max
 */

/**
 * @typedef {Object} CharacterProfile
 * @property {string} id
 * @property {string} [projectId]
 * @property {string} [name]
 * @property {number} age
 * @property {ApparentAgeRange} apparentAgeRange
 * @property {string} [genderPresentation]
 * @property {string} [ethnicityOrRegionalLook]
 * @property {string} faceShape
 * @property {string} eyes
 * @property {string} eyebrows
 * @property {string} nose
 * @property {string} lips
 * @property {string} jawline
 * @property {string} [cheekbones]
 * @property {string} skinTone
 * @property {string} [skinTexture]
 * @property {string} hairColor
 * @property {string} hairLength
 * @property {string} hairTexture
 * @property {string} hairstyle
 * @property {string} bodyType
 * @property {string} heightImpression
 * @property {string} posture
 * @property {string[]} distinctiveFeatures
 * @property {string} wardrobeBase
 * @property {string} cinematicArchetype
 * @property {string} personalityEnergy
 * @property {string[]} visualKeywords
 * @property {string[]} [forbiddenSimilarities]
 * @property {string} [qwenPromptSeed]
 * @property {'pending'|'embedded'|'failed'|'not_indexed'} [embeddingStatus]
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} [approved]
 */

/**
 * @typedef {'front_portrait'|'three_quarter_portrait'|'profile_portrait'|'full_body'|'audition_still'|'cinematic_scene'|'other'} OutputView
 */

/**
 * @typedef {Object} CharacterGenerationRequest
 * @property {number} count
 * @property {number} ageMin
 * @property {number} ageMax
 * @property {string} [genderPresentation]
 * @property {string} [projectTone]
 * @property {string[]} diversityRequirements
 * @property {OutputView[]} outputViews
 * @property {number} candidateMultiplier
 */

/**
 * @typedef {'2:3'|'3:4'|'16:9'|'1:1'} AspectRatio
 */

/**
 * @typedef {Object} QwenImagePromptPack
 * @property {string} [id]
 * @property {string} characterId
 * @property {string} [projectId]
 * @property {string} positivePrompt
 * @property {string} negativePrompt
 * @property {string} camera
 * @property {string} [lens]
 * @property {string} framing
 * @property {string} lighting
 * @property {string} colorPalette
 * @property {string} background
 * @property {string} wardrobe
 * @property {string} pose
 * @property {string} expression
 * @property {AspectRatio} aspectRatio
 * @property {string[]} consistencyTags
 * @property {number} [seedHint]
 * @property {string} [comfyWorkflowId]
 * @property {string} createdAt
 */

/**
 * @typedef {OutputView} ViewType
 */

/**
 * @typedef {'pending'|'embedded'|'failed'} EmbeddingStatus
 */

/**
 * @typedef {Object} GeneratedImageRecord
 * @property {string} id
 * @property {string} [characterId]
 * @property {string} [projectId]
 * @property {string} imagePath
 * @property {string} [thumbnailPath]
 * @property {string} promptPackId
 * @property {string} positivePrompt
 * @property {string} negativePrompt
 * @property {number} [seed]
 * @property {string} modelName
 * @property {string} [workflowVersion]
 * @property {ViewType} viewType
 * @property {boolean} approved
 * @property {string} [rejectedReason]
 * @property {string} [visualDescription]
 * @property {EmbeddingStatus} [embeddingStatus]
 * @property {string} createdAt
 */

export {}
