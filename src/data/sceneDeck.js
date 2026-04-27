/**
 * Scene-generator deck: 15 card categories for two-character cinematic scenes.
 * Based on the deck design: pick one from each category → full scene skeleton.
 */

// ── Card categories ──────────────────────────────────────────────────────────

export const DECK_CATEGORIES = {
  relationship: {
    id: 'relationship',
    label: 'Relationship',
    group: 'narrative',
    cards: [
      'Former lovers',
      'Lovers hiding something',
      'Married couple on the edge of separation',
      'Parent and adult child',
      'Siblings who have not spoken in years',
      'Old friends with unresolved tension',
      'Stranger and caretaker',
      'Mentor and student',
      'Two accomplices after a failed plan',
      'Patient and visitor',
      'Employer and employee with private history',
      'Artist and muse',
      'Priest and confessor',
      'Interrogator and suspect',
      'Host and unexpected guest',
      'Two people who once betrayed each other',
      'One person in love, the other uncertain',
      'Two people pretending to be calmer than they are',
      'A person and the one who abandoned them',
      'Two people bound by a secret',
    ],
  },

  action: {
    id: 'action',
    label: 'Action',
    group: 'narrative',
    cards: [
      'Talking together',
      'Sitting in silence',
      'Lying on a bed',
      'Walking side by side',
      'One following the other',
      'Sharing a meal',
      'Drinking late at night',
      'Smoking together',
      'Waiting for someone',
      'Waiting for news',
      'Packing to leave',
      'Saying goodbye',
      'Reuniting after years',
      'Caring for an injury',
      'Washing the other person',
      'Dressing or undressing each other',
      'Looking through a window',
      'Riding in a car',
      'Riding a train or bus',
      'Standing in a doorway',
      'Searching a room together',
      'Hiding from something outside',
      'Reading aloud',
      'Listening to music',
      'Dancing slowly',
      'Digging or burying something',
      'Burning letters or photos',
      'Cleaning up after an incident',
      'Watching the other sleep',
      'Trying to confess something',
    ],
  },

  engine: {
    id: 'engine',
    label: 'Emotional engine',
    group: 'narrative',
    cards: [
      'Longing',
      'Guilt',
      'Jealousy',
      'Resentment',
      'Fear of abandonment',
      'Desire without permission',
      'Emotional exhaustion',
      'Tenderness after damage',
      'Shame',
      'Suspicion',
      'Quiet forgiveness',
      'Dependency',
      'Need for control',
      'Fear of truth',
      'Shared grief',
      'One-sided devotion',
      'Emotional numbness',
      'Nostalgia',
      'Unfinished anger',
      'Spiritual despair',
      'Mutual loneliness',
      'Forbidden intimacy',
      'Power reversal',
      'Moral disgust',
      'Relief mixed with sadness',
    ],
  },

  location: {
    id: 'location',
    label: 'Location',
    group: 'narrative',
    cards: [
      'Cheap motel room',
      'Elegant hotel room',
      'Cramped apartment kitchen',
      'Bedroom in a decaying house',
      'Hospital corridor',
      'Waiting room',
      'Empty bar after closing',
      'Diner at night',
      'Train compartment',
      'Parked car',
      'Underground car park',
      'Rooftop',
      'Stairwell',
      'Long corridor',
      'Bathroom with harsh light',
      'Laundry room',
      'Attic',
      'Basement',
      'Greenhouse',
      'Abandoned warehouse',
      'Seaside promenade',
      'Forest path',
      'Field at dusk',
      'Church interior',
      'Bus stop in rain',
      'Backyard with plastic chairs',
      'Empty classroom',
      'Artist studio',
      'Dressing room',
      'House doorway at night',
    ],
  },

  atmosphere: {
    id: 'atmosphere',
    label: 'Time / Atmosphere',
    group: 'narrative',
    cards: [
      'Early morning gray light',
      'Blue hour',
      'Heavy rain',
      'After the rain',
      'Summer heat',
      'Winter cold',
      'Thick fog',
      'Wind through open windows',
      'One lamp only',
      'Flickering fluorescent light',
      'Neon from outside',
      'Candlelight',
      'Golden hour',
      'Middle of the night',
      'Pre-dawn exhaustion',
      'After a storm',
      'During a power cut',
      'During distant traffic noise',
      'During a celebration elsewhere',
      'Total stillness',
    ],
  },

  prop: {
    id: 'prop',
    label: 'Object / Prop',
    group: 'staging',
    cards: [
      'Cigarette',
      'Thermos',
      'Half-finished glass of whiskey',
      'Tea cup',
      'Hotel keycard',
      'Old photograph',
      'Letter never sent',
      'Wedding ring',
      'Broken watch',
      'Tape recorder',
      'Cassette player',
      'Cheap radio',
      'Blood-stained shirt',
      'Wet towel',
      'Mirror',
      'Hairbrush',
      'Suitcase',
      'Plastic bag with groceries',
      'Medicine bottle',
      'Bandage roll',
      'Knife left on table',
      'Small religious icon',
      'Child\'s toy',
      'Umbrella',
      'Pair of shoes by the bed',
      'Lipstick mark on a glass',
      'Passport',
      'Food container',
      'Blanket',
      'Burned photograph',
    ],
  },

  blocking: {
    id: 'blocking',
    label: 'Blocking',
    group: 'staging',
    cards: [
      'Sit opposite each other at a table',
      'Sit side by side without looking',
      'One stands, the other remains seated',
      'One lies down, the other paces',
      'One leans in, the other pulls away',
      'Both stand at a window',
      'One stays in the doorway',
      'One follows through a corridor',
      'One speaks from off-screen',
      'Back-to-back on the floor',
      'One washes the other\'s face',
      'One dresses the other slowly',
      'One packs while the other watches',
      'One sits on the bed, the other on the floor',
      'One blocks the exit',
      'One touches the other only once',
      'Both avoid eye contact',
      'One crosses the room repeatedly',
      'One turns away mid-conversation',
      'Both freeze when a sound is heard',
      'One kneels while the other remains still',
      'One holds an object between them',
      'One lights the other\'s cigarette',
      'One sits in shadow, the other in light',
      'One leaves frame, the other stays motionless',
    ],
  },

  camera: {
    id: 'camera',
    label: 'Camera behavior',
    group: 'visual',
    cards: [
      'Locked wide shot',
      'Slow push-in',
      'Drifting lateral move',
      'Static symmetrical frame',
      'Handheld but restrained',
      'Over-the-shoulder with lots of empty space',
      'Tight close-ups on faces',
      'Pillow-level bed framing',
      'Shot through glass or reflection',
      'Doorway framing',
      'Long corridor one-point perspective',
      'Slow follow from behind',
      'Side profile two-shot',
      'Fragmented details: hands, neck, ash, fabric',
      'Frame holds after someone exits',
      'Observe from another room',
      'Long take with no coverage',
      'Distant telephoto isolation',
      'Overhead tableau',
      'Low domestic angle',
    ],
  },

  director: {
    id: 'director',
    label: 'Director filter',
    group: 'visual',
    cards: [
      'Tarkovsky',
      'Jarmusch',
      'Haneke',
      'Kubrick',
      'Wong Kar-wai',
      'Lynch',
      'Bergman',
      'Antonioni',
      'Malick',
      'Béla Tarr',
      'Ozu',
      'Park Chan-wook',
      'Fincher',
      'Michael Mann',
      'Sofia Coppola',
    ],
  },

  disturbance: {
    id: 'disturbance',
    label: 'Disturbance / Twist',
    group: 'drama',
    cards: [
      'The power goes out',
      'A phone rings and nobody answers',
      'A third person is expected but never arrives',
      'One character reveals they are leaving tonight',
      'One admits they lied about something central',
      'One begins to bleed',
      'A sound from outside interrupts everything',
      'The room next door is loud with celebration',
      'One finds an old object that changes the conversation',
      'Someone is listening at the door',
      'One sees a message on the other\'s phone',
      'A hidden wound is discovered',
      'One person falls asleep mid-scene',
      'The car will not start',
      'Rain starts suddenly',
      'One starts laughing at the wrong moment',
      'One person asks an unforgivable question',
      'A photograph is recognized differently by each person',
      'One admits they do not remember the event the same way',
      'A ritual or repeated gesture begins to feel disturbing',
      'One person locks the door',
      'A train or bus is about to depart',
      'One says, "I came to tell you something," but delays it',
      'An unseen person is mentioned and becomes the true subject',
      'One person simply refuses to speak anymore',
    ],
  },

  ending: {
    id: 'ending',
    label: 'Ending beat',
    group: 'drama',
    cards: [
      'One leaves without touching the other',
      'They almost kiss, but do not',
      'One watches from a window',
      'One sits down after the other leaves',
      'The conversation is unfinished',
      'One reveals the truth only after it is too late',
      'They share one small gesture of care',
      'One turns off the light',
      'One remains in frame alone',
      'They laugh, but it feels tragic',
      'They hold hands for the first time',
      'One lies down and turns away',
      'One opens the door but does not go',
      'The object between them is finally taken or returned',
      'They agree to nothing, yet something has changed',
      'One says the other\'s name quietly',
      'One starts crying after the scene should have ended',
      'A mundane action replaces the confession',
      'The scene ends on silence, not resolution',
      'The camera stays after both are gone',
    ],
  },

  color: {
    id: 'color',
    label: 'Color palette',
    group: 'visual',
    cards: [
      'Damp greens and browns',
      'Tobacco amber and dirty cream',
      'Pale blue and hospital white',
      'Neon red and green',
      'Candle gold and black',
      'Cold gray and steel blue',
      'Faded pink and beige',
      'Deep burgundy and shadow',
      'Washed-out yellow and nicotine stain',
      'Moss, rust, and water',
      'Cream, wood, and soft daylight',
      'Sodium-vapor orange and urban blue',
      'Velvet red and midnight black',
      'Dusty pastel hotel palette',
      'Monochrome gray-brown winter tones',
    ],
  },

  sound: {
    id: 'sound',
    label: 'Sound texture',
    group: 'visual',
    cards: [
      'Dripping water',
      'Distant traffic',
      'Hum of refrigerator or fluorescent light',
      'Wind through an open window',
      'A train passing',
      'Muffled party in another room',
      'Dog barking far away',
      'Slow ceiling fan',
      'Radio playing softly',
      'Shoes on corridor floor',
      'Rain on metal or glass',
      'Distant church bell',
      'Rustling sheets',
      'Breath and fabric only',
      'City siren in the distance',
      'Insects at night',
      'Floorboard creak',
      'Match striking',
      'Spoon in cup',
      'Silence so strong it becomes pressure',
    ],
  },

  lighting: {
    id: 'lighting',
    label: 'Lighting',
    group: 'visual',
    cards: [
      'Soft window side-light',
      'Overhead fluorescent flatness',
      'Practical lamp only',
      'Neon bleed from outside',
      'Candle and darkness',
      'Backlit curtain glow',
      'Morning light on sheets',
      'Sodium streetlight through blinds',
      'TV flicker',
      'Bathroom mirror light',
      'Cloudy outdoor gray',
      'Golden dusk',
      'Wet reflective street light',
      'Patchy half-shadow',
      'Moonlight suggestion, not realism',
    ],
  },

  gesture: {
    id: 'gesture',
    label: 'Gesture',
    group: 'staging',
    cards: [
      'Lighting the other\'s cigarette',
      'Hand hovering but not touching',
      'Adjusting a blanket',
      'Wiping blood or water from the face',
      'Buttoning a shirt',
      'Passing a cup',
      'Taking off shoes slowly',
      'Touching the back of the neck',
      'Returning a ring',
      'Holding a sleeve instead of a hand',
      'Smoothing hair',
      'Closing a curtain',
      'Cleaning a wound',
      'Taking an object from the other gently',
      'Standing too close without speaking',
      'Turning away before finishing the sentence',
      'Resting forehead on glass',
      'Touching the bed after the other stands up',
      'Picking lint or dust from clothing',
      'Looking at the other through a mirror',
    ],
  },
}

// ── Director key map ─────────────────────────────────────────────────────────

/** Maps deck director names → app dirKey strings */
export const DIRECTOR_DECK_MAP = {
  'Tarkovsky': 'tarkovsky',
  'Jarmusch': 'jarmusch',
  'Haneke': 'haneke',
  'Kubrick': 'kubrick',
  'Wong Kar-wai': 'wongkarwai',
  'Lynch': 'lynch',
  'Bergman': 'bergman',
  'Antonioni': 'antonioni',
  'Malick': 'malick',
  'Béla Tarr': 'belatarr',
  'Ozu': 'ozu',
  'Park Chan-wook': 'parkchanwook',
  'Fincher': 'fincher',
  'Michael Mann': 'michaelmann',
  'Sofia Coppola': 'coppola',
}

// ── Camera → shot chip map ───────────────────────────────────────────────────

export const CAMERA_TO_SHOT = {
  'Locked wide shot': 'wide establishing shot',
  'Slow push-in': 'slow dolly-in, imperceptible push',
  'Drifting lateral move': 'tracking lateral steadicam follow',
  'Static symmetrical frame': 'centered one-point perspective, symmetrical',
  'Handheld but restrained': 'handheld follow, slight float',
  'Over-the-shoulder with lots of empty space': 'over-the-shoulder shot',
  'Tight close-ups on faces': 'medium close-up',
  'Pillow-level bed framing': 'locked-off tripod, observational distance',
  'Long corridor one-point perspective': 'centered one-point perspective, symmetrical',
  'Slow follow from behind': 'tracking lateral steadicam follow',
  'Side profile two-shot': 'static medium shot',
  'Fragmented details: hands, neck, ash, fabric': 'extreme close-up, face only',
  'Frame holds after someone exits': 'locked-off tripod, observational distance',
  'Observe from another room': 'locked-off tripod, observational distance',
  'Long take with no coverage': 'long take single shot, no cuts',
  'Distant telephoto isolation': 'long telephoto compression, 200mm',
  'Overhead tableau': "overhead bird's eye view",
  'Low domestic angle': 'locked-off tripod, observational distance',
}

// ── Lighting → light chip map ────────────────────────────────────────────────

export const LIGHTING_TO_CHIP = {
  'Soft window side-light': 'flat overcast light, uniform gray sky, no cast shadows',
  'Overhead fluorescent flatness': 'single overhead institutional light, hard downward shadows',
  'Practical lamp only': 'single practical lamp, warm pool in dark room',
  'Neon bleed from outside': 'neon and available light, night exterior',
  'Candle and darkness': 'candlelight or fire, unstable warm pool',
  'Backlit curtain glow': 'contre-jour backlight, figures silhouetted, rim light on edges',
  'Morning light on sheets': 'late afternoon fading light, sky brighter than ground',
  'Sodium streetlight through blinds': 'neon and available light, night exterior',
  'Bathroom mirror light': 'single overhead institutional light, hard downward shadows',
  'Cloudy outdoor gray': 'flat overcast light, uniform gray sky, no cast shadows',
  'Golden dusk': 'late afternoon fading light, sky brighter than ground',
  'Wet reflective street light': 'neon and available light, night exterior',
  'Patchy half-shadow': 'single practical lamp, warm pool in dark room',
  'Moonlight suggestion, not realism': 'contre-jour backlight, figures silhouetted, rim light on edges',
}

// ── Color palette → color chip map ──────────────────────────────────────────

export const COLOR_TO_CHIP = {
  'Damp greens and browns': 'muted desaturated palette, faded olive and slate gray',
  'Tobacco amber and dirty cream': 'warm amber interior light against cold blue exterior',
  'Pale blue and hospital white': 'cool blue-gray, low contrast midtones',
  'Neon red and green': 'night-city cyan and orange, neon palette',
  'Candle gold and black': 'warm amber interior light against cold blue exterior',
  'Cold gray and steel blue': 'cool blue-gray, low contrast midtones',
  'Faded pink and beige': 'drained earth tones, brown and pale beige, very low saturation',
  'Deep burgundy and shadow': 'near-monochrome, color barely present',
  'Washed-out yellow and nicotine stain': 'drained earth tones, brown and pale beige, very low saturation',
  'Moss, rust, and water': 'muted desaturated palette, faded olive and slate gray',
  'Cream, wood, and soft daylight': 'drained earth tones, brown and pale beige, very low saturation',
  'Sodium-vapor orange and urban blue': 'night-city cyan and orange, neon palette',
  'Velvet red and midnight black': 'near-monochrome, color barely present',
  'Dusty pastel hotel palette': 'drained earth tones, brown and pale beige, very low saturation',
  'Monochrome gray-brown winter tones': 'cool blue-gray, low contrast midtones',
}

// ── Location → env chip map ──────────────────────────────────────────────────

export const LOCATION_TO_ENV = {
  'Bedroom in a decaying house': 'flooded concrete ruins, shallow standing water',
  'Hospital corridor': 'symmetrical corridor, one-point perspective, institutional',
  'Waiting room': 'symmetrical corridor, one-point perspective, institutional',
  'Empty bar after closing': 'roadside diner, off-hours, no customers',
  'Diner at night': 'roadside diner, off-hours, no customers',
  'Parked car': 'night city, glass and steel reflections',
  'Stairwell': 'Hong Kong stairwell, claustrophobic, green-lit',
  'Long corridor': 'symmetrical corridor, one-point perspective, institutional',
  'Abandoned warehouse': 'flooded concrete ruins, shallow standing water',
  'Forest path': 'Russian birch forest, pale vertical trunks',
  'Church interior': 'gothic stone architecture, vaulted interior',
}

// ── Ready-made assembled draws ───────────────────────────────────────────────

/** 10 pre-assembled scene draws from the deck (index into each category's cards array). */
export const PRESET_DRAWS = [
  {
    label: 'Tarkovsky draw',
    draw: {
      relationship: 0,    // Former lovers
      action: 2,          // Lying on a bed
      engine: 1,          // Guilt
      location: 3,        // Bedroom in a decaying house
      atmosphere: 3,      // After the rain
      prop: 5,            // Old photograph
      blocking: 3,        // One lies down, the other paces
      camera: 2,          // Drifting lateral move
      director: 0,        // Tarkovsky
      disturbance: 18,    // One admits they do not remember the event the same way
      ending: 8,          // One remains in frame alone
      color: 9,           // Moss, rust, and water
      sound: 0,           // Dripping water
      lighting: 6,        // Morning light on sheets (→ after rain soft light)
      gesture: 1,         // Hand hovering but not touching
    },
  },
  {
    label: 'Jarmusch draw',
    draw: {
      relationship: 5,    // Old friends with unresolved tension
      action: 6,          // Drinking late at night
      engine: 20,         // Mutual loneliness
      location: 6,        // Empty bar after closing
      atmosphere: 19,     // Total stillness
      prop: 0,            // Cigarette
      blocking: 1,        // Sit side by side without looking
      camera: 0,          // Locked wide shot
      director: 1,        // Jarmusch
      disturbance: 3,     // One character reveals they are leaving tonight
      ending: 9,          // They laugh, but it feels tragic
      color: 8,           // Washed-out yellow and nicotine stain
      sound: 1,           // Distant traffic
      lighting: 2,        // Practical lamp only
      gesture: 0,         // Lighting the other's cigarette
    },
  },
  {
    label: 'Haneke draw',
    draw: {
      relationship: 2,    // Married couple on the edge of separation
      action: 5,          // Sharing a meal
      engine: 3,          // Resentment
      location: 2,        // Cramped apartment kitchen
      atmosphere: 0,      // Early morning gray light
      prop: 3,            // Tea cup
      blocking: 0,        // Sit opposite each other at a table
      camera: 0,          // Locked wide shot
      director: 2,        // Haneke
      disturbance: 16,    // One person asks an unforgivable question
      ending: 4,          // The conversation is unfinished
      color: 2,           // Pale blue and hospital white
      sound: 2,           // Hum of refrigerator or fluorescent light
      lighting: 1,        // Overhead fluorescent flatness
      gesture: 15,        // Turning away before finishing the sentence
    },
  },
  {
    label: 'Kubrick draw',
    draw: {
      relationship: 13,   // Interrogator and suspect
      action: 0,          // Talking together
      engine: 12,         // Need for control
      location: 13,       // Long corridor
      atmosphere: 8,      // One lamp only
      prop: 2,            // Half-finished glass of whiskey
      blocking: 2,        // One stands, the other remains seated
      camera: 3,          // Static symmetrical frame
      director: 3,        // Kubrick
      disturbance: 20,    // One person locks the door
      ending: 12,         // One opens the door but does not go
      color: 5,           // Cold gray and steel blue
      sound: 19,          // Silence so strong it becomes pressure
      lighting: 1,        // Overhead fluorescent flatness
      gesture: 14,        // Standing too close without speaking
    },
  },
  {
    label: 'Wong Kar-wai draw',
    draw: {
      relationship: 16,   // One person in love, the other uncertain
      action: 5,          // Sharing a meal
      engine: 5,          // Desire without permission
      location: 12,       // Stairwell
      atmosphere: 10,     // Neon from outside
      prop: 1,            // Thermos
      blocking: 22,       // One lights the other's cigarette
      camera: 12,         // Side profile two-shot
      director: 4,        // Wong Kar-wai
      disturbance: 21,    // A train or bus is about to depart
      ending: 1,          // They almost kiss, but do not
      color: 3,           // Neon red and green
      sound: 4,           // A train passing
      lighting: 3,        // Neon bleed from outside
      gesture: 0,         // Lighting the other's cigarette
    },
  },
  {
    label: 'Bergman draw',
    draw: {
      relationship: 0,    // Former lovers
      action: 29,         // Trying to confess something
      engine: 13,         // Fear of truth
      location: 3,        // Bedroom in a decaying house
      atmosphere: 11,     // Candlelight
      prop: 3,            // Tea cup (glass of water in original)
      blocking: 13,       // One sits on the bed, the other on the floor
      camera: 6,          // Tight close-ups on faces
      director: 6,        // Bergman
      disturbance: 4,     // One admits they lied about something central
      ending: 15,         // One says the other's name quietly
      color: 4,           // Candle gold and black
      sound: 13,          // Breath and fabric only
      lighting: 4,        // Candle and darkness
      gesture: 15,        // Turning away before finishing the sentence
    },
  },
  {
    label: 'Antonioni draw',
    draw: {
      relationship: 1,    // Lovers hiding something
      action: 16,         // Looking through a window
      engine: 16,         // Emotional numbness
      location: 1,        // Elegant hotel room
      atmosphere: 1,      // Blue hour
      prop: 3,            // Tea cup (untouched drink)
      blocking: 5,        // Both stand at a window
      camera: 0,          // Locked wide shot
      director: 7,        // Antonioni
      disturbance: 3,     // One character reveals they are leaving tonight
      ending: 2,          // One watches from a window
      color: 2,           // Pale blue and hospital white
      sound: 1,           // Distant traffic
      lighting: 0,        // Soft window side-light
      gesture: 16,        // Resting forehead on glass
    },
  },
  {
    label: 'Fincher draw',
    draw: {
      relationship: 19,   // Two people bound by a secret
      action: 27,         // Cleaning up after an incident
      engine: 9,          // Suspicion
      location: 14,       // Bathroom with harsh light
      atmosphere: 9,      // Flickering fluorescent light
      prop: 12,           // Blood-stained shirt
      blocking: 20,       // One kneels while the other remains still
      camera: 1,          // Slow push-in
      director: 12,       // Fincher
      disturbance: 10,    // One sees a message on the other's phone
      ending: 13,         // The object between them is finally taken or returned
      color: 7,           // Deep burgundy and shadow
      sound: 17,          // Match striking
      lighting: 1,        // Overhead fluorescent flatness
      gesture: 3,         // Wiping blood or water from the face
    },
  },
  {
    label: 'Sofia Coppola draw',
    draw: {
      relationship: 6,    // Stranger and caretaker
      action: 6,          // Drinking late at night
      engine: 20,         // Mutual loneliness
      location: 1,        // Elegant hotel room
      atmosphere: 13,     // Middle of the night
      prop: 27,           // Food container
      blocking: 1,        // Sit side by side without looking
      camera: 12,         // Side profile two-shot
      director: 14,       // Sofia Coppola
      disturbance: 3,     // One character reveals they are leaving tonight
      ending: 7,          // One turns off the light
      color: 13,          // Dusty pastel hotel palette
      sound: 12,          // Rustling sheets
      lighting: 14,       // Moonlight suggestion, not realism
      gesture: 1,         // Hand hovering but not touching
    },
  },
  {
    label: 'Lynch draw',
    draw: {
      relationship: 14,   // Host and unexpected guest
      action: 0,          // Talking together
      engine: 9,          // Suspicion
      location: 29,       // House doorway at night
      atmosphere: 8,      // One lamp only
      prop: 3,            // Tea cup (coffee in original)
      blocking: 6,        // One stays in the doorway
      camera: 14,         // Frame holds after someone exits
      director: 5,        // Lynch
      disturbance: 19,    // A ritual or repeated gesture begins to feel disturbing
      ending: 19,         // The camera stays after both are gone
      color: 4,           // Candle gold and black
      sound: 16,          // Floorboard creak
      lighting: 2,        // Practical lamp only
      gesture: 19,        // Looking at the other through a mirror
    },
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a random draw (one index per category). */
export function randomDraw() {
  const draw = {}
  for (const [id, cat] of Object.entries(DECK_CATEGORIES)) {
    draw[id] = Math.floor(Math.random() * cat.cards.length)
  }
  return draw
}

/** Returns the card text for a given category + index. */
export function getCard(categoryId, index) {
  return DECK_CATEGORIES[categoryId]?.cards[index] ?? ''
}

/** Ordered list of category IDs per group, for rendering. */
export const GROUP_ORDER = {
  narrative: ['relationship', 'action', 'engine', 'location', 'atmosphere'],
  visual: ['director', 'camera', 'lighting', 'color', 'sound'],
  staging: ['prop', 'blocking', 'gesture', 'disturbance', 'ending'],
}

export const GROUP_LABELS = {
  narrative: 'Narrative',
  visual: 'Visual',
  staging: 'Staging + Drama',
}
