/**
 * Scene scaffold → concrete environment paragraph + suggested chips.
 * Chip strings must match src/data/chips.js (promptRules / validators).
 */

import { getCharDesc } from './assembler.js'

export const SCAFFOLD_BASE_ACTIONS = [
  { id: 'bed', label: 'Lying / resting on a bed', snippet: 'simple bed with rumpled linens, figures passive and still on mattress, held moment' },
  { id: 'tea', label: 'Tea / table ritual', snippet: 'small table, ceramic cups, steam barely visible, hands resting on surface' },
  { id: 'walk', label: 'Corridor / walk (frozen)', snippet: 'interior corridor, worn floorboards, figures mid-stride frozen as still photograph' },
  { id: 'wait', label: 'Waiting', snippet: 'figures seated or standing in stillness, asymmetric framing, empty wall or window behind' },
  { id: 'table', label: 'Across a table', snippet: 'plain table edge visible, two figures separated by wood surface, held tension' },
  { id: 'window', label: 'Standing at window', snippet: 'figure at window frame, hands low at sill, exterior light on glass, held still' },
  { id: 'stairs', label: 'Stairs / landing', snippet: 'interior stair landing, worn treads, banister wood, figures paused on steps' },
  { id: 'bath', label: 'Bath / basin (still)', snippet: 'basin or tub edge, tile grout visible, still water surface, figures motionless' },
  { id: 'threshold', label: 'Doorway threshold', snippet: 'open doorway, threshold line between two rooms, figures on either side of jamb' },
  { id: 'bench', label: 'Bench / pew seated', snippet: 'wood bench or pew, figures seated apart, hands on knees, no contact' },
  { id: 'raindoor', label: 'Exterior door / rain', snippet: 'open exterior door, rain visible in strip beyond, wet mat, figures just inside sill' },
]

export const SCAFFOLD_ENGINES = [
  { id: 'longing', label: 'Longing', snippet: 'unspoken distance, neither figure acknowledging the other fully' },
  { id: 'guilt', label: 'Guilt', snippet: 'downward gazes, hands clasped or flat on knees, weight in posture' },
  { id: 'resentment', label: 'Resentment', snippet: 'angled bodies, space kept deliberate between them' },
  { id: 'dependency', label: 'Dependency', snippet: 'one figure smaller in frame, the other occupying stable anchor position' },
  { id: 'seduction', label: 'Seduction', snippet: 'proximity without contact, faces in profile or three-quarter' },
  { id: 'fear', label: 'Fear', snippet: 'domestic surfaces ordinary, figure tension in neck and shoulders' },
  { id: 'grief', label: 'Grief', snippet: 'slumped shoulders, empty space between hands and lap, faces averted' },
  { id: 'jealousy', label: 'Jealousy', snippet: 'one figure watching the other obliquely, rigid jaw, space weaponized' },
  { id: 'tenderness', label: 'Tenderness held back', snippet: 'almost-touching hands frozen short of contact, restraint in posture' },
  { id: 'numb', label: 'Routine numbness', snippet: 'neutral poses, eyes unfocused middle distance, domestic routine frozen' },
  { id: 'professional', label: 'Professional mask', snippet: 'upright posture, formal distance, clothing neat, no informal lean' },
  { id: 'shame', label: 'Shame', snippet: 'one figure turned away, shoulders forward, shrinking from the room' },
]

export const SCAFFOLD_SPACES = [
  { id: 'hotel', label: 'Hotel / anonymous room', snippet: 'anonymous hotel interior, neutral walls, thin carpet, single curtained window', env: null },
  { id: 'corridor', label: 'Corridor / institutional', snippet: 'long institutional corridor, scuffed baseboards, overhead fixtures off-frame', env: 'symmetrical corridor, one-point perspective, institutional' },
  { id: 'kitchen', label: 'Kitchen / domestic', snippet: 'domestic kitchen, laminate counter, practical light from single window', env: 'Danish farmhouse interior, plain wood and daylight' },
  { id: 'ruin', label: 'Ruin / decay', snippet: 'peeling plaster, water stains, debris at floor edge', env: 'flooded concrete ruins, shallow standing water', texture: 'peeling paint, water-stained plaster' },
  { id: 'forest', label: 'Forest edge', snippet: 'bare trees at frame edge, gray sky, mud at feet', env: 'Russian birch forest, pale vertical trunks' },
  { id: 'car', label: 'Parked car interior', snippet: 'parked car interior at night, dashboard faint readout, windshield black with city bokeh', env: 'night city, glass and steel reflections', texture: 'city lights reflected in wet asphalt' },
  { id: 'diner', label: 'Diner / café', snippet: 'Formica counter, empty stools, chrome and vinyl', env: 'roadside diner, off-hours, no customers' },
  { id: 'train', label: 'Train / platform', snippet: 'empty platform edge, rails gleaming, timetable board out of focus', env: 'modernist concrete piazza, empty, strong shadows' },
  { id: 'church', label: 'Church / chapel', snippet: 'stone nave, narrow windows, worn floor stones between pews', env: 'gothic stone architecture, vaulted interior' },
  { id: 'bathroom', label: 'Bathroom tiled', snippet: 'white tile grout, mirror edge, towel hook, clinical domestic', env: 'sparse Soviet-era interior, single window' },
  { id: 'basement', label: 'Basement concrete', snippet: 'poured concrete walls, exposed conduit, single bare bulb off-frame', env: 'sparse Soviet-era interior, single window' },
  { id: 'office', label: 'Office after hours', snippet: 'empty desks, blinds half-down, carpet tiles and partition edge', env: 'sparse Soviet-era interior, single window' },
  { id: 'beach', label: 'Shore / open coast', snippet: 'flat horizon, damp sand, wind-flattened distance', env: 'Greek island whitewashed alley, sea glare' },
  { id: 'tavern', label: 'Tavern / bar', snippet: 'dark wood bar, empty glasses, varnish worn at elbow height', env: 'Finnish coastal tavern, peeling wood' },
  { id: 'tatami', label: 'Tatami room', snippet: 'woven mat texture, low table edge, sliding door paper glow', env: 'Japanese tatami room, sliding paper doors' },
  { id: 'neon_alley', label: 'Neon alley', snippet: 'narrow wet alley, signage bloom, figures small in depth', env: 'Tokyo neon alley, narrow and wet', texture: 'rain-soaked surfaces, reflections of sky in wet ground' },
  { id: 'piazza', label: 'Modernist plaza', snippet: 'empty concrete plaza, long shadows, no crowd', env: 'modernist concrete piazza, empty, strong shadows' },
  { id: 'mansion', label: 'Mansion interior', snippet: 'dark wood paneling, tall window, carpet runner', env: 'sprawling Edwardian mansion, dark wood and tall windows' },
]

export const SCAFFOLD_VISUAL = [
  { id: 'static', label: 'Static / locked-off', shot: 'locked-off tripod, observational distance', lens: '50mm standard lens', light: 'flat overcast light, uniform gray sky, no cast shadows', color: 'muted desaturated palette, faded olive and slate gray' },
  { id: 'symmetry', label: 'Symmetrical', shot: 'centered one-point perspective, symmetrical', lens: '35mm natural lens', light: 'single overhead institutional light, hard downward shadows', color: 'cool blue-gray, low contrast midtones' },
  { id: 'neon', label: 'Neon / night', shot: 'static medium shot', lens: '35mm natural lens', light: 'neon and available light, night exterior', color: 'night-city cyan and orange, neon palette' },
  { id: 'candle', label: 'Candle / practical', shot: 'static medium shot', lens: '50mm standard lens', light: 'candlelight or fire, unstable warm pool', color: 'warm amber interior light against cold blue exterior' },
  { id: 'handheld', label: 'Handheld intimacy', shot: 'handheld follow, slight float', lens: '35mm natural lens', light: 'single practical lamp, warm pool in dark room', color: 'near-monochrome, color barely present' },
  { id: 'wide', label: 'Wide / environmental', shot: 'wide establishing shot', lens: 'deep focus, everything sharp', light: 'late afternoon fading light, sky brighter than ground', color: 'drained earth tones, brown and pale beige, very low saturation' },
  { id: 'contrejour', label: 'Contre-jour / silhouette', shot: 'static medium shot', lens: '35mm natural lens', light: 'contre-jour backlight, figures silhouetted, rim light on edges', color: 'near-monochrome, color barely present' },
  { id: 'fog', label: 'Fog-filtered', shot: 'wide establishing shot', lens: '35mm natural lens', light: 'fog-filtered diffused light, no direct source visible', color: 'cool blue-gray, low contrast midtones' },
  { id: 'midday', label: 'Harsh midday', shot: 'low angle wide shot', lens: '28mm slightly wide lens', light: 'harsh midday overhead sun, high contrast', color: 'sun-bleached pastel, coastal blues and whites' },
  { id: 'stained', label: 'Stained glass', shot: 'static medium shot', lens: '35mm natural lens', light: 'chapel stained glass, colored patches on floor', color: 'deep saturated jewel tones, intentional color architecture' },
  { id: 'bw', label: 'High-contrast B&W', shot: 'locked-off tripod, observational distance', lens: '50mm standard lens', light: 'flat overcast light, uniform gray sky, no cast shadows', color: 'high contrast black and white, crushed whites' },
  { id: 'dappled', label: 'Dappled exterior', shot: 'wide establishing shot', lens: 'deep focus, everything sharp', light: 'dappled sunlight through leaves, broken patches', color: 'drained earth tones, brown and pale beige, very low saturation' },
]

export const SCAFFOLD_SILENCE = [
  { id: 'mute', label: 'Almost mute', qual: ['every surface dwelt on, patient attention', 'documentary register, observational, unstaged'], snippet: 'minimal gesture, faces averted or downcast' },
  { id: 'realism', label: 'Polite realism', qual: ['documentary register, observational, unstaged'], snippet: 'neutral domestic poses, routine held still' },
  { id: 'confession', label: 'Confession-heavy (faces)', shot: 'medium close-up', lens: '85mm portrait compression', snippet: 'faces dominant, shallow space behind' },
  { id: 'ironic', label: 'Dry / ironic distance', color: 'drained earth tones, brown and pale beige, very low saturation', snippet: 'compositional deadpan, no sentimental staging' },
  { id: 'ritual', label: 'Ritualistic', qual: ['ritualized pacing, liturgical cadence'], snippet: 'repeated small gestures, hands and objects foreground' },
  { id: 'fragment', label: 'Fragmented (implied)', qual: ['choreographed long take, minimal cuts'], snippet: 'mid-gesture freeze, mouths half-open, interrupted rhythm held still' },
  { id: 'operatic', label: 'Operatic stillness', qual: ['operatic staging, choreographed tableau'], snippet: 'poses slightly larger than life, held tableau' },
  { id: 'longtake', label: 'Long-take observational', qual: ['every surface dwelt on, patient attention', 'choreographed long take, minimal cuts'], snippet: 'camera distance respectful, room breathes around figures' },
]

const DEFAULT_FILM = 'shot on 35mm film, grain visible in flat areas'
const DEFAULT_QUAL = ['photorealistic, not CGI, not illustrated', 'real worn surfaces, imperfect textures, no AI smoothing']

/**
 * @param {{ baseId: string, engineId: string, spaceId: string, visualId: string, silenceId: string }} sel
 * @param {[{ g: string, a: string }, { g: string, a: string }] | null | undefined} figures - two character slots; omit for no figure line
 * @returns {{ paragraph: string, chips: Record<string, string[]> }}
 */
export function buildSceneScaffold(sel, figures) {
  const base = SCAFFOLD_BASE_ACTIONS.find((o) => o.id === sel.baseId) ?? SCAFFOLD_BASE_ACTIONS[0]
  const engine = SCAFFOLD_ENGINES.find((o) => o.id === sel.engineId) ?? SCAFFOLD_ENGINES[0]
  const space = SCAFFOLD_SPACES.find((o) => o.id === sel.spaceId) ?? SCAFFOLD_SPACES[0]
  const visual = SCAFFOLD_VISUAL.find((o) => o.id === sel.visualId) ?? SCAFFOLD_VISUAL[0]
  const silence = SCAFFOLD_SILENCE.find((o) => o.id === sel.silenceId) ?? SCAFFOLD_SILENCE[0]

  let figureLead = ''
  if (Array.isArray(figures) && figures.length >= 2 && figures[0] && figures[1]) {
    const g0 = figures[0].g ?? 'person'
    const a0 = figures[0].a ?? '30s'
    const g1 = figures[1].g ?? 'person'
    const a1 = figures[1].a ?? '30s'
    figureLead = `${getCharDesc(g0, a0)} and ${getCharDesc(g1, a1)}, `
  }

  const parts = [
    figureLead,
    space.snippet,
    base.snippet,
    engine.snippet,
    silence.snippet,
    'single frozen film-still instant, no motion blur on faces, figures passive',
  ]

  const chips = {
    shot: [silence.shot ?? visual.shot],
    lens: [visual.lens],
    light: [visual.light],
    color: [silence.color ?? visual.color],
    film: [DEFAULT_FILM],
    qual: [...DEFAULT_QUAL, ...(silence.qual ?? [])],
  }

  if (space.env) chips.env = [space.env]
  if (space.texture) chips.texture = [space.texture]

  return {
    paragraph: parts.filter(Boolean).join(', '),
    chips,
  }
}
