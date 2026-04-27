# CURSOR PROMPT — Full Director Expansion
## Replace `src/data/directors.js` with the complete expanded version below.
## Do not modify any other file. After replacing, verify the app builds with `npm run build`.

The current file has 25 directors. This replacement adds ~55 more, bringing the
total to ~80. The data structure is identical to the existing file — only the
content grows. The `DIRECTOR_LIST` export at the bottom auto-generates from
`Object.keys(DIRECTORS)` so no other change is needed.

Replace the entire contents of `src/data/directors.js` with the following:

---

```js
export const DIRECTORS = {

  // ── POETIC / SPIRITUAL / CONTEMPLATIVE ──────────────────────────────────

  tarkovsky: {
    name: 'Andrei Tarkovsky',
    short: 'Tarkovsky',
    note: 'Figures as objects in space. Silence is the subject. The environment acts on them, not the reverse. Water, fire, wind, ruin.',
    s: {
      1: c => [
        `${c[0]}, back to camera, standing at the edge of the frame, figure small against an open sky, not moving`,
        `${c[0]} seen from behind, walking away from camera at slow unhurried pace, becoming smaller in the landscape`,
        `${c[0]} at the threshold of a ruined doorway, neither entering nor leaving, hand resting on the frame`,
        `${c[0]} standing in shallow water, looking at something off-frame, face not visible`,
      ],
      2: c => [
        `${c[0]} and ${c[1]}, three feet of silence between them, facing the same direction, neither speaking`,
        `${c[0]} standing still, ${c[1]} a few steps ahead, both unaware of being watched`,
        `${c[1]} has turned away from ${c[0]}, who remains facing where ${c[1]} was — a separation held without drama`,
        `${c[0]} and ${c[1]} seen from behind walking the same direction, one slightly behind, not touching`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} arranged without symmetry, none looking at the others, three separate silences`,
        `${c[0]} and ${c[1]} in foreground, ${c[2]} a small figure deep in background — separate worlds in one frame`,
        `${c[0]} standing, ${c[1]} seated nearby, ${c[2]} moving slowly at the frame edge, no shared purpose`,
      ],
    },
  },

  malick: {
    name: 'Terrence Malick',
    short: 'Malick',
    note: 'Figures reaching upward in natural light. Magic hour. Bodies in grass and water. The camera looking up from the ground.',
    s: {
      1: c => [
        `${c[0]} in an open field, arms slightly away from body, face turned toward the sky, magic hour light from below the cloud line`,
        `${c[0]} lying in tall grass, barely visible above the stems, the grass moving in wind, figure absorbed into the landscape`,
        `${c[0]} running through a field filmed from the ground looking up — no apparent destination, the movement itself the content`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a sun-drenched field, not quite touching, hands near each other in the grass, golden light on their faces`,
        `${c[0]} filmed from behind reaching toward ${c[1]} who is already turning away — the gesture lost in golden light`,
        `${c[0]} and ${c[1]} lying in shallow water, sky above them, barely moving, the horizon dissolved into light`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} moving through a landscape separately, each in private experience, converging without intention`,
        `${c[0]} and ${c[1]} in foreground, ${c[2]} in the near background, all three in golden light, unaware of the camera below`,
      ],
    },
  },

  angelopoulos: {
    name: 'Theo Angelopoulos',
    short: 'Angelopoulos',
    note: 'Monumental long takes. Mist, processions, distance. Historical melancholy choreographed into slow tableaux. Greece as time-wound.',
    s: {
      1: c => [
        `${c[0]} tiny against a mist-covered landscape — a border crossing, a shoreline, an empty road — the distance the subject`,
        `${c[0]} in a procession that has stopped, the figure at the edge of the group, mist reducing the background to pale shapes`,
        `${c[0]} at a ferry railing or platform edge, looking across water obscured by fog, history present in the stillness`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a long slow walk through a mist-covered landscape, the camera tracking wide, neither speaking`,
        `${c[0]} and ${c[1]} on opposite sides of a border or threshold, the space between them a historical fact not a personal one`,
        `${c[0]} and ${c[1]} as part of a larger procession, the group moving slowly through fog, both absorbed into the collective movement`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a staged tableau — part of a procession or ceremony — the choreography historical not personal`,
        `${c[0]}, ${c[1]}, and ${c[2]} at a misty waterfront or border, the three figures small in an enormous melancholy landscape`,
      ],
    },
  },

  belatarr: {
    name: 'Béla Tarr',
    short: 'Béla Tarr',
    note: 'Endurance as form. Black and white. The camera follows figures through mud and wind for minutes without cutting. Existence under duress.',
    s: {
      1: c => [
        `${c[0]} walking through mud or rain away from camera, the camera following at walking pace — the journey without destination`,
        `${c[0]} seated at a bar or table, the camera circling slowly, the face registering nothing except the passage of time`,
        `${c[0]} standing in strong wind in an open flat landscape, everything moving around them, their resolve to remain the only stillness`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} walking side by side through a desolate landscape, the camera tracking alongside, no destination implied`,
        `${c[0]} and ${c[1]} in a bar or shelter, the camera watching from across the room without moving — time accumulating`,
        `${c[0]} walking, ${c[1]} behind, the distance neither closing nor widening — a procession of two through an indifferent world`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a slow procession through difficult terrain — mud, wind — the camera moving with them`,
        `${c[0]}, ${c[1]}, and ${c[2]} in a single long take through a bar or street, the camera reluctant to stop watching`,
      ],
    },
  },

  ceylan: {
    name: 'Nuri Bilge Ceylan',
    short: 'Ceylan',
    note: 'Turkish winters and Chekhovian interiors. Long conversations that circle what cannot be said. Faces at windows. The landscape as psychological condition.',
    s: {
      1: c => [
        `${c[0]} at a window looking out at a winter Anatolian landscape — snow, bare trees, distant village — face partly reflected in glass`,
        `${c[0]} seated in a sparse room, hands visible in foreground, face in three-quarter profile, listening to something not in frame`,
        `${c[0]} small against snow-covered hills, the scale expressing an interior state more precisely than any dialogue`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a car at night driving through a winter landscape — the conversation circling something neither will name`,
        `${c[0]} and ${c[1]} in a sparse room, one speaking, the other looking away, the unsaid dominant`,
        `${c[0]} facing ${c[1]} across a table, winter light flat and equal on both faces, a long pause that is the conversation`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a car or small room, the confined space amplifying the unspoken distances between them`,
        `${c[0]} and ${c[1]} in conversation, ${c[2]} at the far end of the space — not quite included, the geometry of exclusion made spatial`,
      ],
    },
  },

  parajanov: {
    name: 'Sergei Parajanov',
    short: 'Parajanov',
    note: 'The tableau vivant. No narrative, only image. Figures arranged as in medieval painting or folk art. Symbolic objects. Allegory without psychology.',
    s: {
      1: c => [
        `${c[0]} arranged frontally as in an icon or folk painting, facing camera, the background a flat decorative plane of textile or natural material`,
        `${c[0]} in traditional or ceremonial dress, holding a symbolic object — fruit, water vessel, bird — the meaning allegorical not personal`,
        `${c[0]} in a static composition against a patterned backdrop, part of a visual grammar of color and form`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} arranged as a diptych — side by side, frontal, equally weighted — each holding a symbolic object`,
        `${c[0]} offering something to ${c[1]} — water, bread, flowers — the gesture ritualistic, the object carrying the meaning`,
        `${c[0]} and ${c[1]} in a composition where the lines of their bodies form a visual pattern, the landscape completing the geometry`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a ceremonial arrangement — frontal, each a distinct color — the whole a polyphony of folk visual language`,
        `${c[0]} at center with ${c[1]} and ${c[2]} flanking, all three facing camera, a sentence in a visual language that precedes cinema`,
      ],
    },
  },

  apichatpong: {
    name: 'Apichatpong Weerasethakul',
    short: 'Weeraseth.',
    note: 'The body at rest in tropical heat. Dream-time and waking-time in the same frame. Spirits as unremarkable presences. The jungle as threshold.',
    s: {
      1: c => [
        `${c[0]} lying on a cot in a jungle setting, the heat visible, the body completely at rest, time without urgency`,
        `${c[0]} seated at the edge of a jungle, facing into the trees — a threshold between the known and the spirit world`,
        `${c[0]} in a Thai village or clinic, the institutional and the natural equally present, neither dominant`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} lying on adjacent cots in jungle heat — slow breathing, the boundary between sleep and waking permeable`,
        `${c[0]} speaking to ${c[1]}, but ${c[1]} may be a memory or a spirit — the film does not distinguish, both equally present`,
        `${c[0]} and ${c[1]} at the edge of a jungle pool, their reflections as real as their figures, past and present coexisting`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a forest clearing, loose and unposed, communal ease in the heat — no drama, just presence`,
        `${c[0]} awake, ${c[1]} asleep, ${c[2]} possibly neither — the jungle surrounding all three, the boundary between states permeable`,
      ],
    },
  },

  bigan: {
    name: 'Bi Gan',
    short: 'Bi Gan',
    note: 'Hypnotic long takes, dream logic, neon-poetry. Fluid temporal shifts. Memory as spatial experience. The past accessible as a physical place.',
    s: {
      1: c => [
        `${c[0]} moving through a neon-lit space in an extended unbroken take — the camera gliding with them through memory and present at once`,
        `${c[0]} in a Guizhou alley or interior, the light a mix of neon and bare bulb, time uncertain — could be any hour or decade`,
        `${c[0]} paused at a threshold between two spaces, the camera holding on their face as the world around them slowly changes`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a dreamlike space where the past and present overlap — both present but from different times`,
        `${c[0]} following ${c[1]} through a series of spaces in an unbroken take, the pursuit more lyrical than urgent`,
        `${c[0]} speaking to ${c[1]} in a dimly lit interior, the camera slowly circling, time dilating around the conversation`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a space that exists between memory and reality — the neon light treating all three as equally present`,
        `${c[0]} watching ${c[1]} and ${c[2]} through a window or from a distance, the long take holding the observation without cutting`,
      ],
    },
  },

  tsaiming: {
    name: 'Tsai Ming-liang',
    short: 'Tsai',
    note: 'Static frames. Urban loneliness. Architecture as emotional prison. Minimal dialogue. Durational sadness. Water and bodies in slow decay.',
    s: {
      1: c => [
        `${c[0]} in a cramped Taipei apartment, the camera static and far, the figure performing a routine alone — cooking, bathing, lying still`,
        `${c[0]} on a deserted urban street or walkway, the architectural space dwarfing them, the duration of the shot the content`,
        `${c[0]} at a cinema, movie theater, or escalator — a public space rendered achingly private by isolation`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in the same apartment but in different rooms — the wall between them the subject of the shot`,
        `${c[0]} and ${c[1]} in proximity but not contact — in the same bed, the same corridor, the same frame — the distance absolute`,
        `${c[0]} watching ${c[1]} perform a mundane action — eating, sleeping — from a doorway, the observation both tender and unbearable`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a large urban space — a mall, a corridor, a street — each alone within the same frame`,
        `${c[0]} and ${c[1]} in an interior, ${c[2]} visible through a window or doorway — three isolated worlds sharing one static frame`,
      ],
    },
  },

  hou: {
    name: 'Hou Hsiao-hsien',
    short: 'Hou H-H',
    note: 'Restrained camera, elegant distance. Historical texture. Delicate interior blocking. Figures observed through frames within frames. Luminous stillness.',
    s: {
      1: c => [
        `${c[0]} seen through a doorway or window, the camera positioned in the space beyond — a frame within the frame, the figure partially obscured`,
        `${c[0]} in a historically textured interior — tatami, wooden screens, old furniture — the figure absorbed into the period`,
        `${c[0]} at a distance in a courtyard or street, the camera refusing to move closer, the stillness respectful and absolute`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a room, the camera stationed outside looking in — their interaction glimpsed through architecture`,
        `${c[0]} and ${c[1]} in conversation at a table or in a garden, the camera holding at a respectful distance, no close-ups`,
        `${c[0]} moving, ${c[1]} still — the camera holding its position as figures pass through the frame without following`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a domestic interior or courtyard, the camera at a fixed respectful distance, the ensemble moving within the frame`,
        `${c[0]} and ${c[1]} in foreground, ${c[2]} beyond — the layered depth of the shot the visual logic, no one prioritized`,
      ],
    },
  },

  // ── PRECISION / CONTROL / FORMAL RIGOR ──────────────────────────────────

  kubrick: {
    name: 'Stanley Kubrick',
    short: 'Kubrick',
    note: 'Symmetry as control. One-point perspective. Characters as elements in the composition. The frame always slightly too formal for its content.',
    s: {
      1: c => [
        `${c[0]} centered in a symmetrical corridor, facing camera, the geometry of the architecture more important than the figure`,
        `${c[0]} seen from behind, walking toward a vanishing point, perfectly centered in the symmetrical space`,
        `${c[0]} seated at a table or desk, lit from above by institutional light, the architecture completing a frame within the frame`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} on opposite sides of a symmetrical composition, facing each other, equal visual weight, no warmth`,
        `${c[0]} standing, ${c[1]} seated, both in clinically lit space — a power geometry without drama`,
        `${c[0]} and ${c[1]} walking toward camera side by side down a long corridor, the architecture framing them like a diagram`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} arranged symmetrically — one central, two flanking — in a formal institutional space`,
        `${c[0]} at center foreground, ${c[1]} and ${c[2]} equidistant behind, all facing camera — a hierarchy stated without commentary`,
      ],
    },
  },

  haneke: {
    name: 'Michael Haneke',
    short: 'Haneke',
    note: 'The camera watches from too far and holds too long. Violence implied through domestic stillness. Nothing announced. The frame itself the instrument of dread.',
    s: {
      1: c => [
        `${c[0]} in a wide shot performing a mundane action — washing hands, closing a door — the camera watching from across the room, not cutting`,
        `${c[0]} seen from behind through a corridor or doorframe, the camera at clinical distance, not moving closer`,
        `${c[0]} at a window with their back to the room, the room behind them in sharp focus, their face unknowable`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a kitchen or hallway, a domestic routine that has stopped midway, both holding still`,
        `${c[0]} at a table, ${c[1]} in the background out of focus, both present but in different parts of the same silence`,
        `${c[0]} and ${c[1]} shot from outside through a window, the glass between the viewer and what is happening inside`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a living room, the television off — an interrupted evening — the camera holds on the scene`,
        `${c[0]} in foreground, ${c[1]} and ${c[2]} behind in conversation that ${c[0]} has been excluded from`,
      ],
    },
  },

  ozu: {
    name: 'Yasujirō Ozu',
    short: 'Ozu',
    note: 'Tatami-level camera, static framing. Pillow shots of objects and spaces. Domestic architecture observed with serene emotional compression.',
    s: {
      1: c => [
        `${c[0]} seated on tatami or a low chair, the camera at floor level looking up at them — the domestic space as sacred geometry`,
        `${c[0]} framed in a doorway or corridor, the camera static, the figure composed in stillness`,
        `${c[0]} performing a domestic ritual — pouring tea, folding cloth — the camera fixed, the action sufficient in itself`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} seated facing each other or side by side, the camera low and static, the space between them the subject`,
        `${c[0]} speaking, ${c[1]} listening — the camera cutting between frontal close-ups of each, each shot composed as a portrait`,
        `${c[0]} and ${c[1]} in a domestic interior, both facing the camera in adjacent positions — not each other — the screen the shared object of attention`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} seated at a low table, the camera at tatami level, the scene composed as a family portrait that refuses sentimentality`,
        `${c[0]} at center, ${c[1]} and ${c[2]} flanking — the family unit arranged in the domestic space with formal but tender geometry`,
      ],
    },
  },

  bresson: {
    name: 'Robert Bresson',
    short: 'Bresson',
    note: 'Reduction. Non-expression. Spare framing. Hands, objects, and details over faces. Spiritual minimalism. Models not actors — no performance.',
    s: {
      1: c => [
        `${c[0]}'s hands visible in the foreground — handling a key, a letter, a coin — the face not important, the hands everything`,
        `${c[0]} in profile, expression withheld, performing a precise physical action — the spiritual weight in the economy of movement`,
        `${c[0]} walking through a spare interior or corridor, the camera following at the level of their body — no reaction shots, no emphasis`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in the same frame but not making eye contact — the space between their bodies the only communication`,
        `${c[0]}'s hands passing an object to ${c[1]}'s hands — the exchange filmed in close detail, the faces implied not shown`,
        `${c[0]} and ${c[1]} in a spare room, the camera refusing to dramatize — both figures equally unrevealing, equally present`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a space — a cell, a courtyard, a simple room — each figure reduced to their physical presence, no emotional display`,
        `${c[0]} among ${c[1]} and ${c[2]}, the group filmed as a series of details — hands, feet, the movement of cloth — the faces last`,
      ],
    },
  },

  akerman: {
    name: 'Chantal Akerman',
    short: 'Akerman',
    note: 'Structural framing. Duration. Domestic repetition. Fixed-camera rigor. The feminist spatial intelligence of the kitchen, the corridor, the clock.',
    s: {
      1: c => [
        `${c[0]} performing a domestic task — washing dishes, cooking, making a bed — the camera fixed and static, the full duration of the action preserved`,
        `${c[0]} walking through a domestic space, the camera following at a consistent distance — a corridor, a kitchen, a series of rooms`,
        `${c[0]} standing at a window looking out at a street or courtyard, the camera holding for much longer than comfort requires`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a kitchen or living room — one working, one watching — the division of labor visible in the fixed static frame`,
        `${c[0]} on the phone with ${c[1]} — only ${c[0]} visible, the camera static, the duration of the conversation preserved without editing`,
        `${c[0]} and ${c[1]} passing each other in a corridor or domestic space, the exchange brief, the frame holding long after they separate`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a domestic space performing separate tasks — the fixed camera making the division of labor spatial and explicit`,
        `${c[0]} and ${c[1]} at a table, ${c[2]} standing at the counter — the static frame holds all three in their different domestic positions`,
      ],
    },
  },

  dreyer: {
    name: 'Carl Theodor Dreyer',
    short: 'Dreyer',
    note: 'Sculptural faces. Spiritual severity. Stark interiors. Transcendent close-ups. The face as the site of the soul under extreme pressure.',
    s: {
      1: c => [
        `${c[0]} in extreme close-up, the face filling the frame — not emotion performed but spiritual state endured, the expression restrained to the point of transcendence`,
        `${c[0]} in a spare white or stone interior, the light from one source modeling the face with severe precision`,
        `${c[0]} in profile against a blank wall, the composition stripped of everything except the face and the light falling on it`,
      ],
      2: c => [
        `${c[0]} facing ${c[1]}, both in close-up alternating — the camera treating each face as an icon, the exchange a spiritual negotiation`,
        `${c[0]} standing over ${c[1]} who is seated or prostrate — the power imbalance expressed through vertical space and the quality of the light`,
        `${c[0]} and ${c[1]} in a stark interior, both faces in three-quarter view — spiritual severity in the architecture, the faces its human equivalent`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a spare interior — an interrogation, a trial, a spiritual test — the faces the only landscape that matters`,
        `${c[0]} at center with ${c[1]} and ${c[2]} flanking — a triptych of faces under pressure, the light the only element of warmth`,
      ],
    },
  },

  mungiu: {
    name: 'Cristian Mungiu',
    short: 'Mungiu',
    note: 'Observational realism. Carefully sustained takes. Moral and bureaucratic claustrophobia. The system visible in every space and face.',
    s: {
      1: c => [
        `${c[0]} in a waiting room, a hospital corridor, or an office — the institutional space framing them as a body inside a system`,
        `${c[0]} navigating a bureaucratic space — filling a form, waiting at a desk — the camera holding in a sustained observational take`,
        `${c[0]} on a staircase or in a doorway, the architecture of the building expressing the architecture of the moral problem`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a car or small room, the tension between them sustained without melodrama, the camera close and still`,
        `${c[0]} asking ${c[1]} for something — a favor, a decision — the camera holding on the exchange with uncomfortable patience`,
        `${c[0]} and ${c[1]} in a corridor or waiting area, the institutional space making their private negotiation visible as a social fact`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a cramped apartment or office, the camera observing the group's attempt to solve a problem that the system has made unsolvable`,
        `${c[0]} at a table with ${c[1]} and ${c[2]}, the conversation circling a decision no one wants to make — the camera holding without relief`,
      ],
    },
  },

  kiarostami: {
    name: 'Abbas Kiarostami',
    short: 'Kiarostami',
    note: 'Stripped-down framing. Landscape-road imagery. The windshield as cinema screen. Ambiguity between documentary and fiction. Philosophical simplicity.',
    s: {
      1: c => [
        `${c[0]} in a car, the road visible through the windshield, the camera positioned in the passenger seat — the journey and the face in the same frame`,
        `${c[0]} on a dirt road in a spare Iranian landscape, the figure small in an enormous geography, the destination unclear`,
        `${c[0]} at the threshold of a village or building, the camera at a distance, the figure's decision to enter or not the subject`,
      ],
      2: c => [
        `${c[0]} driving, ${c[1]} in the passenger seat — the windshield the screen within the screen, the road the subject they share`,
        `${c[0]} and ${c[1]} in a landscape that feels both documentary and staged — the camera's position ambiguous about which it is`,
        `${c[0]} and ${c[1]} on a hillside or road, both looking outward — the conversation between them less important than what they're looking at`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in or around a car in a landscape — the vehicle as the only domestic space available, the road the only story`,
        `${c[0]} at a distance, ${c[1]} and ${c[2]} closer — the camera uncertain which is real and which is performance, both equally persuasive`,
      ],
    },
  },

  kaurismaki: {
    name: 'Aki Kaurismäki',
    short: 'Kaurismäki',
    note: 'Deadpan compositions. Frontal staging. Retro color blocking. Melancholy minimalism. Laconic cool. Working-class interiors of impossible dignity.',
    s: {
      1: c => [
        `${c[0]} in a sparse Finnish interior — a bar, a bedsit, a factory — the color blocking deliberate, the expression perfectly withheld`,
        `${c[0]} sitting at a table with a beer and a cigarette, a jukebox or record player visible, the frame a retro still life with a person in it`,
        `${c[0]} standing at a bar or counter, facing camera with the deadpan composure of someone who has accepted everything without complaint`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} sitting side by side in a bar or kitchen, both facing forward, a shared silence of complete dignity`,
        `${c[0]} and ${c[1]} in a retro-colored interior, their exchange economical to the point of haiku — the environment says more than they do`,
        `${c[0]} handing something to ${c[1]} — food, a letter, a small object — the gesture carrying enormous weight through its economy`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a bar or social club, each with a drink, the color blocking of their clothes a composition in itself`,
        `${c[0]} at center, ${c[1]} and ${c[2]} flanking — a group portrait of the working class rendered with the gravity of a Renaissance painting`,
      ],
    },
  },

  // ── URBAN COOL / ALIENATION / MODERN ENNUI ──────────────────────────────

  jarmusch: {
    name: 'Jim Jarmusch',
    short: 'Jarmusch',
    note: 'Deadpan stillness. Characters waiting, stalling, or coexisting without urgency. Humor through inaction. The stranger in the wrong place.',
    s: {
      1: c => [
        `${c[0]} waiting at a roadside, bag at their feet, no vehicle arriving, expression unreadable`,
        `${c[0]} leaning against a wall, unlit cigarette in hand, looking at nothing in particular, not bored enough to move`,
        `${c[0]} sitting alone at a diner counter, coffee going cold, looking at their own reflection in the dark window`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} sitting side by side, not talking, both looking slightly off-frame in different directions`,
        `${c[0]} speaking to ${c[1]} who is half-listening, a conversation going nowhere, both lit by flat ambient light`,
        `${c[0]} and ${c[1]} parked in a car, engine off, both staring ahead, neither moving to get out`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} near each other without forming a group, a coincidence of proximity, each in their own inaction`,
        `${c[0]} and ${c[1]} in conversation, ${c[2]} nearby pretending not to listen, all three waiting for something`,
      ],
    },
  },

  wenders: {
    name: 'Wim Wenders',
    short: 'Wenders',
    note: 'Roads, cities, windows, loneliness. Lyrical observation. Photographic attention to place. The traveler who cannot arrive. American mythology in European eyes.',
    s: {
      1: c => [
        `${c[0]} at a motel window or gas station, the American or European landscape visible behind the glass, the figure caught between transit and stillness`,
        `${c[0]} on a road or highway, the camera behind them at windshield distance, the landscape scrolling past, no destination evident`,
        `${c[0]} in a city paying attention to something — a building, a street musician, a sign — the city itself the story`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a car moving through a landscape, neither talking, the road the third presence in the frame`,
        `${c[0]} and ${c[1]} in a city — one local, one visitor — the difference in how they see the same space the subject`,
        `${c[0]} and ${c[1]} at a roadside diner or motel, the American vernacular architecture more present than either of them`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} at a crossroads or junction — each going somewhere different, the meeting coincidental and brief`,
        `${c[0]} and ${c[1]} observing ${c[2]} from a distance without being seen — the act of looking at the city the shared experience`,
      ],
    },
  },

  antonioni: {
    name: 'Michelangelo Antonioni',
    short: 'Antonioni',
    note: 'Alienation in beautiful locations. Emotional distance more present than surroundings. Figures who cannot reach each other even standing side by side.',
    s: {
      1: c => [
        `${c[0]} at the edge of a modernist building or empty piazza, the architecture vast behind them, the figure geometrically isolated`,
        `${c[0]} at a window looking at an empty industrial landscape, back to the room, face in the glass`,
        `${c[0]} walking along a long wall or through an empty urban space, the architecture a maze with no visible exit`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a beautiful location — empty terrace, modern interior, beach — their emotional distance more present than the place`,
        `${c[0]} has turned away from ${c[1]}, who stands in the middle distance uncertain — the space between them is the subject`,
        `${c[0]} and ${c[1]} in conversation but both looking past the frame, the connection they cannot make visible in where their eyes go`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} at a gathering that has quietly fragmented — each at a different wall or window, the social form dissolved`,
        `${c[0]} and ${c[1]} searching a space for ${c[2]} who is not visible, the search defining the location more than any presence would`,
      ],
    },
  },

  coppola: {
    name: 'Sofia Coppola',
    short: 'S. Coppola',
    note: 'Soft isolation, luxury ennui, pastel melancholy. Intimate surfaces. Emotional distance within beauty. The alienated young woman in an ornate trap.',
    s: {
      1: c => [
        `${c[0]} in a hotel room or palace interior, the luxury of the space making their stillness sadder — the ornate surroundings indifferent to them`,
        `${c[0]} at a window of a high floor, the city or landscape below soft and unreachable, the figure surrounded by beautiful irrelevance`,
        `${c[0]} in a pastel-toned interior, lying on a bed or sitting on a floor, the softness of the palette making the isolation more complete`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a hotel corridor or luxury space, the conversation between them intimate but the surroundings refusing to acknowledge it`,
        `${c[0]} and ${c[1]} at breakfast or in a pool — the setting aspirational, the connection between them more real than the setting can hold`,
        `${c[0]} watching ${c[1]} from across a room, the space beautiful and between them — both present, neither quite there`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a large ornate space — a ballroom, a garden, a pool — each absorbed in their own private ennui`,
        `${c[0]} and ${c[1]} at the edge of a party where ${c[2]} is the host — the glamour and the discomfort equally present`,
      ],
    },
  },

  wongkarwai: {
    name: 'Wong Kar-wai',
    short: 'Wong K-W',
    note: 'Saturated color, neon, step-printing. Sensual motion blur. Longing materialized as color. Time fragmented. Proximity without contact.',
    s: {
      1: c => [
        `${c[0]} in motion through a neon-lit corridor, blurred by long exposure, the color of the light absorbed into their clothes`,
        `${c[0]} at a rain-streaked window, neon reflections displacing their face, somewhere between two times`,
        `${c[0]} eating alone at a small counter, the surrounding space blurred, isolated in stillness inside the motion of the city`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in the same narrow space — a corridor, a stairwell — nearly touching, the proximity carrying years of weight`,
        `${c[0]} in sharp focus, ${c[1]} blurred and passing behind — a missed moment preserved in the frame`,
        `${c[0]} reaching toward the space where ${c[1]} was a moment ago, the delay between presence and loss made visible`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a cramped apartment, each absorbed in their own temporal displacement — same room, different moments`,
        `${c[0]} and ${c[1]} at a table, ${c[2]} moving through the background blurred, all three present but not in the same time`,
      ],
    },
  },

  yangedward: {
    name: 'Edward Yang',
    short: 'E. Yang',
    note: 'Urban modernity observed with precision. Reflective surfaces. Layered depth. Emotional precision in city spaces. Taipei as emotional architecture.',
    s: {
      1: c => [
        `${c[0]} in a modern Taipei interior, the city visible through glass behind them — the urban and domestic space in dialogue`,
        `${c[0]} reflected in a window or glass surface, the city superimposed on their face — inside and outside the same`,
        `${c[0]} in a crowd on a city street or bus, the modernity of the city making their individual stillness strange`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a modern apartment, the city beyond the windows making the domestic space feel both sheltered and exposed`,
        `${c[0]} and ${c[1]} in a restaurant or café — the social ritual of the meal barely containing what is unspoken between them`,
        `${c[0]} and ${c[1]} in a city space — both moving through it, their paths crossing briefly before the city absorbs them again`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a social gathering — a party, a dinner — the relationships between them complex and exactly observed`,
        `${c[0]} and ${c[1]} in conversation, ${c[2]} arriving or departing — the change in the social geometry precisely registered`,
      ],
    },
  },

  fincher: {
    name: 'David Fincher',
    short: 'Fincher',
    note: 'Forensic control. Institutional and corporate space. Teal and amber. Characters inside systems. The overhead shot as surveillance. Everything pre-determined.',
    s: {
      1: c => [
        `${c[0]} in an office or institutional space, overhead light making precise shadows — the environment as controlled as the figure`,
        `${c[0]} seen from directly above, camera looking straight down — the figure isolated on floor, desk, or street`,
        `${c[0]} from behind, walking through rain-soaked urban space, city in teal and amber, back to camera`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in an interrogation dynamic — one seated, one standing or circling — the power shifting through position alone`,
        `${c[0]} and ${c[1]} in a corporate or institutional interior, the precision of the design making their humanity strange against it`,
        `${c[0]} and ${c[1]} at screens in a dark room, faces lit by monitor light — the investigation distributed, the darkness controlled`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} processing the same information in separate institutional spaces — systematic, the overhead camera above each`,
        `${c[0]} at a screen, ${c[1]} watching from behind, ${c[2]} at a second terminal — a distributed investigation in a darkened room`,
      ],
    },
  },

  ramsay: {
    name: 'Lynne Ramsay',
    short: 'Ramsay',
    note: 'Tactile fragments, sensory memory, subjective violence. Lyrical grit. Visual psychology. The trauma embedded in ordinary objects and textures.',
    s: {
      1: c => [
        `${c[0]} in extreme close-up on skin, hair, or a material surface — the camera refusing to pull back to the conventional framing`,
        `${c[0]} in a state between memory and present — the space around them unstable, the image fragmenting into texture`,
        `${c[0]} handling an ordinary object — a piece of food, a fabric, a tool — the close-up making the texture psychologically loaded`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in the same frame but the camera focused on fragments — hands, a shoulder, a doorframe — the whole figure withheld`,
        `${c[0]} watching ${c[1]} from nearby, the observation subjective and close — what ${c[0]} sees is filtered through their state`,
        `${c[0]} and ${c[1]} in a space where an event has recently occurred — the aftermath visible in the texture of the environment`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a space where the past is present — the camera moving between faces and objects with equal weight`,
        `${c[0]} among ${c[1]} and ${c[2]}, the group filmed in close sensory fragments — the social situation inferred from texture not dialogue`,
      ],
    },
  },

  // ── DREAM / NIGHTMARE / SURREALISM ──────────────────────────────────────

  lynch: {
    name: 'David Lynch',
    short: 'Lynch',
    note: 'The uncanny just below the ordinary surface. Something is wrong but cannot be named. Dread before its cause. Light from sources that should not exist.',
    s: {
      1: c => [
        `${c[0]} standing in an ordinary domestic space — hallway, roadside, parking lot — that feels fundamentally wrong, face neutral`,
        `${c[0]} lit from below by a source that should not be there, otherwise in near-darkness, expression unreadable`,
        `${c[0]} seen from behind in a long corridor at night, not moving, the darkness behind them too complete`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in the same frame, one of them somehow wrong — too still, the smile one beat too late`,
        `${c[0]} speaking to ${c[1]} who responds correctly but with a half-second delay, everything normal, something deeply wrong`,
        `${c[0]} and ${c[1]} reflected in a dark window, the reflections behaving slightly differently from the figures`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a brightly lit domestic space, the cheerfulness in exact opposition to what is about to happen`,
        `${c[0]} facing ${c[1]} and ${c[2]}, who are identical in some hard-to-name way — a doubling that should not exist`,
      ],
    },
  },

  fellini: {
    name: 'Federico Fellini',
    short: 'Fellini',
    note: 'The procession as form. Characters in costume or role even in ordinary life. The camera as fond witness to human excess. Longing declared without shame.',
    s: {
      1: c => [
        `${c[0]} in striking clothing moving through an ordinary location, other figures briefly visible as a chorus in background`,
        `${c[0]} facing camera with a knowing, slightly theatrical expression — aware of being looked at and performing for that look`,
        `${c[0]} in a crowd but isolated — the faces around them blurred into chorus, their face the still center of a procession`,
      ],
      2: c => [
        `${c[0]} gesturing elaborately to ${c[1]} who watches with fond exasperation — the performance is the relationship`,
        `${c[0]} looking toward ${c[1]} who stands further in the frame — a longing openly declared, not ashamed`,
        `${c[0]} and ${c[1]} in a piazza or ballroom, the setting more theatrical than real, both in character rather than themselves`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a procession or gathering, each performing a distinct role — the ensemble the subject`,
        `${c[0]} at the center with ${c[1]} and ${c[2]} orbiting — the energy flowing outward, the others drawn to it`,
      ],
    },
  },

  bunuel: {
    name: 'Luis Buñuel',
    short: 'Buñuel',
    note: 'Surreal disruption of bourgeois ritual. Dream-image logic in realistic settings. Elegant cruelty. The absurd made procedurally inevitable.',
    s: {
      1: c => [
        `${c[0]} in a formal or bourgeois setting performing an action that is slightly, inexplicably wrong — the setting impeccable, the action impossible`,
        `${c[0]} at a dinner table or formal interior, their behavior ceremonially correct but the situation surreally displaced`,
        `${c[0]} observed doing something entirely ordinary in a context that makes it profoundly strange — the camera equally indifferent to both`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a formal setting where a social ritual has become inexplicably impossible to complete — both proceeding politely`,
        `${c[0]} and ${c[1]} in an encounter that keeps repeating with small variations — neither acknowledging the repetition`,
        `${c[0]} and ${c[1]} in a bourgeois interior where an absurd social constraint is being observed with perfect decorum`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} at a formal dinner or gathering that has become impossible to leave, the social performance continuing regardless`,
        `${c[0]}, ${c[1]}, and ${c[2]} in a drawing room or public space, each imprisoned by a different surreal logic, each unaware of the others' prison`,
      ],
    },
  },

  jodorowsky: {
    name: 'Alejandro Jodorowsky',
    short: 'Jodorowsky',
    note: 'Occult symbolism, flamboyant imagery, spiritual provocation. Mystical excess. The body as alchemical site. Sacred and profane in the same frame.',
    s: {
      1: c => [
        `${c[0]} in symbolic costume or paint, standing in a landscape that is simultaneously real and allegorical — desert, ruin, or sacred space`,
        `${c[0]} surrounded by symbolic objects or figures — animals, religious icons, found objects — arranged as a tableau of personal mythology`,
        `${c[0]} in an extreme physical posture that crosses the boundary between performance and ritual, the landscape endorsing the excess`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a ritualized encounter — one with power, one without — the exchange conducted as spiritual theater`,
        `${c[0]} and ${c[1]} in a space of symbolic geography — a crossroads, a pit, a mountain — their positions in it allegorically loaded`,
        `${c[0]} performing a ritual on or for ${c[1]}, the action excessive, the setting fusing the sacred and the grotesque`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a processional formation through a mythic landscape, each representing a principle not a person`,
        `${c[0]} at center in a symbolic space, ${c[1]} and ${c[2]} as acolytes or antagonists — the arrangement a living emblem`,
      ],
    },
  },

  argento: {
    name: 'Dario Argento',
    short: 'Argento',
    note: 'Expressionist color. Stylized murder choreography. Operatic horror. Baroque lighting from impossible colored sources. Beauty and dread inseparable.',
    s: {
      1: c => [
        `${c[0]} in a corridor or staircase lit by a deep red or blue source — the color physically present, the architecture threatening`,
        `${c[0]} standing in an ornate interior — a theater, a conservatory, a grand staircase — the beauty of the space its own danger`,
        `${c[0]} seen through glass or a doorway, the color of the light changing the nature of what they are — both present and endangered`,
      ],
      2: c => [
        `${c[0]} watching ${c[1]} through a window or mirror — the act of observation rendered dangerous by the expressionist color of the light`,
        `${c[0]} and ${c[1]} in a baroque interior, one aware of danger, one not — the color of the lighting marking the difference`,
        `${c[0]} and ${c[1]} in a staged encounter in an ornate space, the choreography of their positions as deliberate as a dance`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a grand interior — a theatre, a museum, a palazzo — the beauty of the space concealing what will happen`,
        `${c[0]} separated from ${c[1]} and ${c[2]} by a corridor or staircase, the architecture making the distance lethal`,
      ],
    },
  },

  maddin: {
    name: 'Guy Maddin',
    short: 'Maddin',
    note: 'Silent-era phantasmagoria. Degraded textures, iris effects, melodramatic intertitles. Fever-dream nostalgia. The cinema of a century ago hallucinated.',
    s: {
      1: c => [
        `${c[0]} in a heavily degraded, scratched, and vignetted image — silent-era visual grammar, the figure performing with theatrical expressiveness`,
        `${c[0]} in a dreamlike interior that could be 1920 or a memory of 1920 — the texture of the image as present as the subject`,
        `${c[0]} in extreme emotional posture — hands raised, face upturned — the melodrama of the silent era fully inhabited`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a passionate or anguished encounter rendered in heavily degraded film stock — the emotion operatic, the image deteriorating`,
        `${c[0]} reaching toward ${c[1]} across a space that keeps changing — dream logic making the distance elastic`,
        `${c[0]} and ${c[1]} in a theatrical interior from an indeterminate past, the image degraded, the emotion enormous`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a phantasmagoric domestic or institutional space — the image layered with double exposures, the scene from a century ago`,
        `${c[0]} pursued by or pursuing ${c[1]} and ${c[2]} through a labyrinthine space, the silent-era image grammar fully activated`,
      ],
    },
  },

  // ── SENSUAL COLOR / SPECTACLE / VISUAL INTOXICATION ─────────────────────

  almodovar: {
    name: 'Pedro Almodóvar',
    short: 'Almodóvar',
    note: 'Bold primary color fields. Melodramatic interiors. Graphic design sensibility. Emotional theatricality with perfect surface composure.',
    s: {
      1: c => [
        `${c[0]} in a kitchen or hallway, dressed in a strong primary color against a complementary wall, caught in a private moment`,
        `${c[0]} at a phone or doorway, face carrying contained emotion — not breaking, held — the gesture everything`,
        `${c[0]} seen through a domestic interior designed with bold deliberate color, the space itself a character`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a colorful kitchen, one standing one seated, a domestic crisis played with theatrical composure`,
        `${c[0]} holding ${c[1]} — physical comfort inside an interior of saturated primary color`,
        `${c[0]} and ${c[1]} facing each other across a domestic space, both in strong colors, the argument visible in posture before dialogue`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a kitchen — movement between stove, table, and doorway — domestic choreography as emotional choreography`,
        `${c[0]} at the center, ${c[1]} and ${c[2]} flanking — a tableau in a colorful interior, a family in crisis but holding its form`,
      ],
    },
  },

  zhangyimou: {
    name: 'Zhang Yimou',
    short: 'Zhang Yimou',
    note: 'Choreographed color symbolism. Monumental compositions. Operatic visual storytelling. Landscapes as moral and political statements.',
    s: {
      1: c => [
        `${c[0]} in a landscape of overwhelming color — red fields, white snow, yellow earth — the figure small against the saturated expanse`,
        `${c[0]} in a period interior of intense color and precise craft — the production design making the figure both subject and emblem`,
        `${c[0]} in motion through a landscape, the color of their clothing a deliberate contrast to the environment — the choice meaningful`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} against a monumental natural or architectural backdrop, their scale making the visual statement political`,
        `${c[0]} and ${c[1]} in a color-saturated setting — one in red, one in white or black — the colors as character as much as the figures`,
        `${c[0]} and ${c[1]} in a choreographed tableau — the space between them deliberate, the colors of their positions symbolic`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a monumental composition — a landscape, a ceremonial space — each a distinct color in the palette`,
        `${c[0]} at center in a richly colored landscape, ${c[1]} and ${c[2]} flanking — the composition operatic, the color a declaration`,
      ],
    },
  },

  jeunet: {
    name: 'Jean-Pierre Jeunet',
    short: 'Jeunet',
    note: 'Whimsical production design. Amber-green palettes. Mechanical charm. Storybook surrealism. Paris as a fantasy city of coincidences and devices.',
    s: {
      1: c => [
        `${c[0]} in a Paris street or apartment, the production design amber-toned and obsessively detailed — every object a clockwork presence`,
        `${c[0]} at a moment of shy observation — watching, noticing, absorbing — the world around them more charming than threatening`,
        `${c[0]} among the mechanical objects and whimsical details of their environment — the world designed to delight rather than threaten`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in an amber-lit Parisian interior, the set design so dense with detail that the characters are part of the clockwork`,
        `${c[0]} watching ${c[1]} without being seen, the observation charming not sinister — the city full of this kind of tender surveillance`,
        `${c[0]} and ${c[1]} in a coincidence — both in the same place for different reasons — the city having arranged the meeting`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a space of elaborate whimsical production design — each embedded in their own mechanical environment`,
        `${c[0]} and ${c[1]} in a café or apartment, ${c[2]} visible through a window or doorway — all three in the amber world of the city`,
      ],
    },
  },

  deltoro: {
    name: 'Guillermo del Toro',
    short: 'del Toro',
    note: 'Fairy tale geometry. Gothic architecture as shelter for the innocent. Warm amber against cold stone. Creatures at thresholds. Wonder confronting the monstrous.',
    s: {
      1: c => [
        `${c[0]}, small against ornate gothic architecture — a grand staircase, a carved stone hall — the scale making them vulnerable and chosen`,
        `${c[0]} at a threshold — a doorway, a mirror, the entrance to a labyrinth — about to enter something that cannot be unentered`,
        `${c[0]} in warm amber light inside cold stone space, the comfort of the light in exact contrast to the architecture enclosing it`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} — one human, one creature or spirit — facing each other in a grand space, the encounter gentle or terrible but never mundane`,
        `${c[0]} sheltered behind ${c[1]}, the protector-innocent geometry — the threat visible in the background darkness`,
        `${c[0]} and ${c[1]} in an ornate room, the decoration excessive for comfort — both figures small against the visual weight of the space`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a gothic interior — ${c[0]} the innocent at center, ${c[1]} the guide, ${c[2]} the unresolved threat`,
        `${c[0]} and ${c[1]} discovered by ${c[2]}, a tableau in amber light — who is safe and who is not suspended in the composition`,
      ],
    },
  },

  parkchanwook: {
    name: 'Park Chan-wook',
    short: 'Park C-W',
    note: 'Chess-piece precision. Every frame pre-meditated. Violence implied in the geometry of stillness. Figures arranged as if the composition itself is the weapon.',
    s: {
      1: c => [
        `${c[0]} centered in a geometrically exact setting, the symmetry deliberate — the figure too still for the space to be safe`,
        `${c[0]} seen from directly above, camera looking straight down — the figure isolated in a floor pattern`,
        `${c[0]} in profile, face completely controlled, the restraint itself the subject — what is suppressed defines the image`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in exactly calibrated positions — one seated, one standing, measured distance — confrontation without movement`,
        `${c[0]} in close foreground, face sharp; ${c[1]} in deep focus at exact center behind — two planes of the same tension`,
        `${c[0]} looking at ${c[1]} who does not look back — the imbalance of attention a form of power`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a triangle of exactly calculated distance — the geometry of the composition carrying the threat`,
        `${c[0]} standing, ${c[1]} and ${c[2]} seated below — the hierarchy expressed by what no dialogue has yet said`,
      ],
    },
  },

  refn: {
    name: 'Nicolas Winding Refn',
    short: 'N.W. Refn',
    note: 'Neon minimalism. Synth mood. Ritualized violence. Sculptural slowness. The masculine body as icon. Silence as testosterone.',
    s: {
      1: c => [
        `${c[0]} in a neon-lit parking garage or corridor, the light magenta or blue, the figure perfectly still in the electric color`,
        `${c[0]} behind a wheel or at a counter, face unreadable, the neon environment the emotional interior they refuse to show`,
        `${c[0]} in a slow walk through a night exterior, the camera tracking at their pace, neon and silence the only accompaniment`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} facing each other in a neon-lit space, the silence between them ritualized — a standoff conducted in light`,
        `${c[0]} and ${c[1]} in a car at night, the city lights moving across their faces, neither speaking, the destination understood`,
        `${c[0]} watching ${c[1]} from across a neon-lit space, the observation slow and deliberate — dominance expressed as patience`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a neon interior — each occupying a different color zone, the triangle of their positions a social map`,
        `${c[0]} at center, ${c[1]} and ${c[2]} on either side — the neon symmetry making the power geometry explicit`,
      ],
    },
  },

  // ── KINETIC STYLISTS / CAMERA-DRIVEN ────────────────────────────────────

  scorsese: {
    name: 'Martin Scorsese',
    short: 'Scorsese',
    note: 'Energy as identity. Characters who own a room through how they move. Street intelligence made visible in posture. Urban velocity even in stillness.',
    s: {
      1: c => [
        `${c[0]} moving through a crowded space — bar, restaurant, street — the environment parting around them, ownership in their pace`,
        `${c[0]} standing at a bar or doorway, scanning a room, reading everyone in it before deciding to enter`,
        `${c[0]} in sharp urban clothes in a city environment, the clothes and the street equally expressive of who they are`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} walking side by side through an urban exterior, negotiation or threat expressed in pace and proximity`,
        `${c[0]} talking to ${c[1]}, the exchange fast and close, both reading each other's loyalty in the sub-language below the words`,
        `${c[0]} and ${c[1]} at a table, the surface a territory for negotiation, both completely present and completely guarded`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a bar or social space — ${c[0]} the center of gravity, the others orienting around ${c[0]}`,
        `${c[0]} and ${c[1]} facing ${c[2]} — the moment before allegiance is declared, the social geometry not yet resolved`,
      ],
    },
  },

  depalma: {
    name: 'Brian De Palma',
    short: 'De Palma',
    note: 'The voyeur as formal principle. Split diopter. Someone is always watching someone who does not know. The staircase, the mirror, the hidden camera.',
    s: {
      1: c => [
        `${c[0]} unaware of being observed, performing a routine — crossing a lobby, descending stairs — the camera marking the watcher's distance`,
        `${c[0]} in a split-focus composition — sharp in the near foreground and sharp in deep background simultaneously`,
        `${c[0]} at the top of a spiral staircase looking down, or at the bottom looking up — the architecture a diagram of suspense`,
      ],
      2: c => [
        `${c[0]} watching ${c[1]} from distance — across a room, through glass, from above — ${c[1]} unaware, the observation itself the subject`,
        `${c[0]} and ${c[1]} both sharp through split diopter — one close, one far — each in a different plane of the same moment`,
        `${c[0]} and ${c[1]} in a mirror or dark glass, one of their reflections doing something the figure is not`,
      ],
      3: c => [
        `${c[0]} watching ${c[1]} and ${c[2]} from concealment — a doorway, a balcony, a parked car — the observed pair unaware`,
        `${c[0]}, ${c[1]}, and ${c[2]} in a scene that will later be understood as surveillance — the frame itself the hidden camera`,
      ],
    },
  },

  pta: {
    name: 'Paul Thomas Anderson',
    short: 'P.T. Anderson',
    note: 'Fluid tracking shots. Choreographed ensembles. Expressive wides. Formal ambition with emotional intensity. The tracking shot as empathy engine.',
    s: {
      1: c => [
        `${c[0]} in a long tracking shot through a period or working-class space — the camera moving alongside, the environment giving them context`,
        `${c[0]} in a wide shot in a large domestic or industrial interior, the space generous with detail around them`,
        `${c[0]} at a moment of private emotional intensity in an ordinary space — the camera close but not intrusive`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a long fluid take, the camera moving between and around them — the choreography of the shot expressing the choreography of the relationship`,
        `${c[0]} and ${c[1]} in a complex social space — a party, a workplace, a family home — the tracking shot connecting their separate paths`,
        `${c[0]} and ${c[1]} in a confrontation that the camera circles — the movement making the emotional intensity spatial`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in an ensemble choreography — a dinner, a gathering, a workplace — the tracking shot moving through all three`,
        `${c[0]} at center with ${c[1]} and ${c[2]} moving around them, the fluid camera mapping the social orbit`,
      ],
    },
  },

  noe: {
    name: 'Gaspar Noé',
    short: 'Gaspar Noé',
    note: 'Aggressive subjectivity. Swirling camera. Strobing color. Altered-state immersion. The body in extremis as cinematic experience.',
    s: {
      1: c => [
        `${c[0]} in a club or corridor under strobing light, the camera rotating around them — the disorientation physical and total`,
        `${c[0]} moving through a neon-saturated space in an altered state, the camera's relationship to vertical and horizontal uncertain`,
        `${c[0]} in a long overhead shot looking straight down — the figure horizontal, the world reduced to a flat plane below`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a space where the lighting is aggressive — strobe, neon, bare bulb — the camera circling`,
        `${c[0]} and ${c[1]} in an extended take that refuses to cut — the camera holding through discomfort, intimacy, and extremity`,
        `${c[0]} and ${c[1]} in a space that is physically overwhelming — the sound, the light, the motion — both figures inside the assault`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a club or social space, the camera moving through them — the crowd and the light equally the subject`,
        `${c[0]} among ${c[1]} and ${c[2]} in a space of overwhelming sensory intensity, the figures barely distinguishable from the environment`,
      ],
    },
  },

  // ── SILENCE / RITUAL / ATMOSPHERE ───────────────────────────────────────

  bergman: {
    name: 'Ingmar Bergman',
    short: 'Bergman',
    note: 'Faces as landscape. Close, confrontational, interior. Two people in a room is a war conducted in silence. Spiritual anguish elevated by light and shadow.',
    s: {
      1: c => [
        `${c[0]} in near close-up, face filling half the frame, looking slightly past camera, expression carefully withheld`,
        `${c[0]} seated with hands visible in the foreground, face slightly out of focus, attention turned inward`,
        `${c[0]} in profile against a pale window, the outside bleached to white, features in shadow`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in profile facing each other, the silence between their faces the subject of the image`,
        `${c[0]} speaking to ${c[1]} whose face is in three-quarter view turned away — something being said that cannot be unsaid`,
        `${c[0]}'s face large in foreground, out of focus, ${c[1]}'s face sharp behind — two planes of the same unbearable conversation`,
      ],
      3: c => [
        `${c[0]} seated, ${c[1]} standing over them, ${c[2]} at the far edge of the frame watching — a geometry of power`,
        `${c[0]} and ${c[1]} facing each other, ${c[2]} between them but slightly apart — an unwilling mediator`,
      ],
    },
  },

  melville: {
    name: 'Jean-Pierre Melville',
    short: 'Melville',
    note: 'Trench coats and silence. Procedural cool. Minimalist criminal geometry. The existentialist gangster. Blue-grey Paris as moral landscape.',
    s: {
      1: c => [
        `${c[0]} in a trench coat and hat in a blue-grey Parisian exterior — the figure reduced to silhouette and posture, the city their element`,
        `${c[0]} in a sparse apartment or office performing a professional preparation — loading, dressing, waiting — the ritual more important than the goal`,
        `${c[0]} at a café table or bar, untouched drink before them, watching an entrance — the stillness of absolute professional patience`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a brief exchange in a public space — both professionals, the transaction coded and wordless`,
        `${c[0]} and ${c[1]} in a car in a blue-grey Paris dawn, the operation ahead of them, the silence between them procedural not personal`,
        `${c[0]} and ${c[1]} at a distance in a street or location, neither acknowledging the other — the recognition coded in posture alone`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a planning exchange in a sparse interior — the trench coats, the maps, the silence of professionals`,
        `${c[0]} observed by ${c[1]} and ${c[2]} from a distance — the surveillance conducted with the same cool as everything else in this world`,
      ],
    },
  },

  kitano: {
    name: 'Takeshi Kitano',
    short: 'Kitano',
    note: 'Deadpan stillness interrupted by bursts of sudden violence. Marine blues. Stark poetic humor. The yakuza as melancholy philosopher.',
    s: {
      1: c => [
        `${c[0]} seated on a beach or pier, looking at the sea — the stillness absolute, the figure simplified to posture and the blue of the water`,
        `${c[0]} in a tatami room or yakuza office, the stillness before something happens — the figure composed in the blue-grey light`,
        `${c[0]} playing a children's game alone or with others — the game absurdly simple, the figure completely absorbed in it`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} at the seaside, both looking outward at the water, the marine blue making the silence between them absolute`,
        `${c[0]} and ${c[1]} in a deadpan exchange — the humor and the threat so close as to be indistinguishable`,
        `${c[0]} and ${c[1]} in a moment between violence — the stillness after or before, the blue light, the absence of explanation`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} at the ocean or in a sparse exterior — the hierarchy clear from who speaks and who does not`,
        `${c[0]} with ${c[1]} and ${c[2]} in a deadpan social arrangement — the comedy and the danger equally present, equally unexplained`,
      ],
    },
  },

  glazer: {
    name: 'Jonathan Glazer',
    short: 'Glazer',
    note: 'Severe formalism. Sensory abstraction. Cold beauty. Disturbing conceptual imagery. The body and the system. Absolute visual control in the service of dread.',
    s: {
      1: c => [
        `${c[0]} in a clinical or domestic space of severe visual control — the composition so precise it feels like a trap`,
        `${c[0]} in a natural landscape — beach, forest, field — that the camera renders strange through extreme formal control`,
        `${c[0]} performing a routine in a space that the camera makes uncanny — the ordinary action in a frame that refuses to be ordinary`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a space of radical visual simplicity — the formal control of the image making their coexistence strange`,
        `${c[0]} and ${c[1]} in an encounter rendered strange by the camera's refusal of conventional coverage — the angles wrong, the distance wrong`,
        `${c[0]} observing ${c[1]} in a space that the camera treats as both familiar and conceptually alarming`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a severely composed exterior or industrial space — the formal control of the image treating them as elements not people`,
        `${c[0]} at a distance from ${c[1]} and ${c[2]}, the separation rendered as a conceptual fact by the precision of the framing`,
      ],
    },
  },

  reichardt: {
    name: 'Kelly Reichardt',
    short: 'Reichardt',
    note: 'Understated naturalism. Tactile environments. Quiet framing. Moral and physical economy. The American West as ethical landscape. Less as more.',
    s: {
      1: c => [
        `${c[0]} in a natural or small-town exterior, the camera at a respectful distance — the figure doing something practical, the doing itself enough`,
        `${c[0]} in a vehicle or on foot moving through an Oregon or Western landscape — the journey modest, the scale human not epic`,
        `${c[0]} in a quiet domestic or outdoor space, the camera observing without commentary — the ordinary given the weight of attention`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a practical situation together — setting up camp, working, driving — the action more important than conversation`,
        `${c[0]} and ${c[1]} in a quiet moment in a natural setting, the camera not pressing for meaning — the moment sufficient`,
        `${c[0]} and ${c[1]} navigating a moral situation without drama — the difficulty in the facts, not in the framing`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} on a trail, in a camp, or at a modest domestic space — the natural environment the fourth presence`,
        `${c[0]} making a decision that affects ${c[1]} and ${c[2]}, the camera holding without emphasis — the weight in the fact not the style`,
      ],
    },
  },

  // ── VIOLENCE / CRIME / COOL FORMALISM ───────────────────────────────────

  kurosawa: {
    name: 'Akira Kurosawa',
    short: 'Kurosawa',
    note: 'Weather as moral force. Figures braced against wind and rain. Landscape as character. Decisive stillness before movement. Hierarchy visible in posture alone.',
    s: {
      1: c => [
        `${c[0]} standing against a strong wind, clothing moving, holding position with effort, the weather the antagonist`,
        `${c[0]} in heavy rain, not sheltering, face up or face down, the rain more present than any other element`,
        `${c[0]} at the top of a ridge against an overcast sky, silhouetted, posture carrying the weight of a decision`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} facing each other in a space cleared by weather — mud underfoot, wind overhead — a geometry of confrontation`,
        `${c[0]} slightly ahead of ${c[1]}, both walking into strong weather, the hierarchy stated without explanation`,
        `${c[0]} seated in a position of authority, ${c[1]} standing and slightly inclined — power differential expressed entirely through posture`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} moving through a landscape in single file, the leader clear from position and bearing alone`,
        `${c[0]} facing ${c[1]} and ${c[2]} who stand together — a negotiation with weather as the only witness`,
      ],
    },
  },

  leone: {
    name: 'Sergio Leone',
    short: 'Leone',
    note: 'The extreme close-up as landscape. Eyes and hands before bodies. Vast space between opponents. Time stretched to breaking before action resolves it.',
    s: {
      1: c => [
        `${c[0]} in extreme close-up, eyes only filling the frame — the landscape implied by what the eyes are reading across it`,
        `${c[0]} a tiny figure in a vast flat landscape — desert, scrubland, rail track — the scale relationship reversed`,
        `${c[0]} hand resting near a weapon, the hand as expressive as a face — the stillness before the draw`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} at extreme distance from each other in a vast landscape, the camera alternating between close and impossibly far`,
        `${c[0]} and ${c[1]} in standoff geometry — facing each other, equidistant from camera — the space between them the subject`,
        `${c[0]} watching ${c[1]} across a wide open space, neither moving, the tension of postponed action filling the frame`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a triangular standoff, each equidistant, hands ready — the decision not yet made, the composition the suspense`,
        `${c[0]} facing ${c[1]} and ${c[2]} — two-against-one geometry — the landscape as large and impassive as the confrontation`,
      ],
    },
  },

  michaelmann: {
    name: 'Michael Mann',
    short: 'M. Mann',
    note: 'Professionals in the night city. Steel, glass, water reflections. Characters defined by competence and its cost. Los Angeles 2am as moral landscape.',
    s: {
      1: c => [
        `${c[0]} moving through a night city with purposeful professional pace, lights reflected in glass and wet pavement around them`,
        `${c[0]} in a glass-and-steel interior at night, the city visible through floor-to-ceiling windows — the figure between two worlds`,
        `${c[0]} studying something — a map, a screen, a sight-line — the concentration absolute, competence visible in the stillness`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} meeting briefly at a night-city location — waterfront, parking structure, roadside — both professionals, both fully present`,
        `${c[0]} and ${c[1]} at a table in a high-end or industrial space, both utterly focused — equals who are also opponents`,
        `${c[0]} and ${c[1]} moving through a night exterior, city lights their only illumination, the pace of people with somewhere exact to be`,
      ],
      3: c => [
        `${c[0]} giving instructions to ${c[1]} and ${c[2]} in an industrial or urban night space, the team assembled around a plan`,
        `${c[0]}, ${c[1]}, and ${c[2]} moving through a nighttime operation, each competent, each in their defined role`,
      ],
    },
  },

  // ── WORLD-BUILDING / TOTAL VISUAL UNIVERSES ──────────────────────────────

  villeneuve: {
    name: 'Denis Villeneuve',
    short: 'Villeneuve',
    note: 'Epic scale revealing human smallness. Obscured horizons. The slow revelation of what something is. Figures confronting the incomprehensible with professional composure.',
    s: {
      1: c => [
        `${c[0]} revealed slowly as tiny against a massive structure — dam, canyon wall, alien geometry — the scale established before the figure`,
        `${c[0]} in protective gear, moving through an environment that cannot support unprotected life`,
        `${c[0]} standing at the edge of an enormous space — desert, flooded plain, vast hangar — body as reference point for incomprehensible scale`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} dwarfed by an enormous structure behind them, the scale making their conversation seem improbable but necessary`,
        `${c[0]} and ${c[1]} in a stark institutional interior — concrete, glass, high ceilings — precision of design making human presence strange`,
        `${c[0]} facing something vast that ${c[1]} cannot yet see — the position of their bodies establishing what is known and what remains unknown`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in an enormous empty space — desert, hangar, alien landscape — three figures a cluster of warmth against the scale`,
        `${c[0]} and ${c[1]} facing ${c[2]}, who stands before something vast and unknowable — the encounter between human scale and the incomprehensible`,
      ],
    },
  },

  ridleyscott: {
    name: 'Ridley Scott',
    short: 'R. Scott',
    note: 'Dense atmosphere. Production-design authority. Textured worlds. Sculpted light. Smoke, rain, and backlight. Total environmental immersion.',
    s: {
      1: c => [
        `${c[0]} in a smoke and backlit environment — a city street, an industrial interior, a historical space — the light source visible and dramatic`,
        `${c[0]} in a richly textured production-designed world — the costume, the props, the architecture all part of the same authoritative statement`,
        `${c[0]} moving through rain or smoke, the atmosphere dense enough to be a physical presence in the frame`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a dramatically lit environment — smoke, backlight, a narrow intense source — the world built around them`,
        `${c[0]} and ${c[1]} in a period or speculative space of total production-design authority, the world more present than any dialogue`,
        `${c[0]} and ${c[1]} in a rain-soaked or smoke-filled exterior, the atmospheric density making their encounter feel consequential`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in an immersive designed environment — historical, futuristic, or mythic — the world complete around them`,
        `${c[0]} at the head of ${c[1]} and ${c[2]}, the backlit atmospheric interior giving the grouping the weight of a statement`,
      ],
    },
  },

  greenaway: {
    name: 'Peter Greenaway',
    short: 'Greenaway',
    note: 'Painterly excess. Architectural composition. Cataloguing imagery. Intellectual baroque. Figures arranged in a visual argument about knowledge and death.',
    s: {
      1: c => [
        `${c[0]} in a space of extreme visual density — objects, numbers, architectural elements — arranged as an inventory of a world`,
        `${c[0]} posed in a painterly composition — lit as in a Dutch or Flemish master, the figure part of a visual argument`,
        `${c[0]} in a space of competing visual languages — a library, a garden, a formal room — the cataloguing instinct made spatial`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a formally composed space, each holding or positioned near symbolic objects — the composition an argument`,
        `${c[0]} and ${c[1]} in a space of architectural and intellectual excess — the environment's logic more coherent than any human logic within it`,
        `${c[0]} and ${c[1]} posed as in a painting — the light, the costume, the composition all from a different century`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} arranged in a painterly group — a formal portrait of people inside a visual system they cannot step outside`,
        `${c[0]} at center, ${c[1]} and ${c[2]} flanking — the composition a triptych, the figures elements in an intellectual architecture`,
      ],
    },
  },

  // ── CONTEMPORARY ────────────────────────────────────────────────────────

  lanthimos: {
    name: 'Yorgos Lanthimos',
    short: 'Lanthimos',
    note: 'Wide-angle estrangement. Formal absurdity. Deadpan cruelty. Spatial discomfort. The social contract presented as clearly arbitrary.',
    s: {
      1: c => [
        `${c[0]} in a wide-angle shot in a domestic or institutional space, the lens distortion making the space slightly wrong — the furniture too close, the ceiling too low`,
        `${c[0]} performing an action correctly according to rules that are clearly arbitrary — the face withholding the question`,
        `${c[0]} in a space of imposed order — a uniform, a designated route, a prescribed posture — the body conforming without complaint`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a wide-angle two-shot, the distortion of the lens making their proximity strange — too close, the space between them compressed`,
        `${c[0]} and ${c[1]} in a social ritual that is being performed with perfect sincerity despite being entirely absurd`,
        `${c[0]} and ${c[1]} in a relationship of prescribed power — the power visible in the space each body is permitted to occupy`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a wide-angle group composition, the lens making the social arrangement look like a diagram of absurdity`,
        `${c[0]} at the center of a social ritual that ${c[1]} and ${c[2]} are enforcing — the absurdity of the rule invisible to all three`,
      ],
    },
  },

  aster: {
    name: 'Ari Aster',
    short: 'Ari Aster',
    note: 'Symmetrical unease. Folk-horror brightness. Ritualized dread in daylight. The composed psychological terror. Grief as supernatural event.',
    s: {
      1: c => [
        `${c[0]} in a bright daylit setting — a meadow, a village square, a decorated interior — the brightness making the dread more present`,
        `${c[0]} centered in a symmetrical composition that is almost a Tarkovsky image but slightly, wrongly brighter`,
        `${c[0]} surrounded by flowers, folk art, or ritual objects in broad daylight, the cheer of the setting its own threat`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a folk-ritual setting — bright, decorated, symmetrical — the ceremony between them either wedding or sacrifice`,
        `${c[0]} and ${c[1]} in a domestic space where grief has become architectural — the house itself in mourning`,
        `${c[0]} and ${c[1]} in a symmetrically composed exterior that is too beautiful, too still, too arranged`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a ritual arrangement in a bright decorated setting — the symmetry total, the purpose unclear`,
        `${c[0]} at center with ${c[1]} and ${c[2]} flanking — the group composition a triptych of grief or ceremony in perfect daylight`,
      ],
    },
  },

  eggers: {
    name: 'Robert Eggers',
    short: 'Eggers',
    note: 'Period-authentic materials. Extreme weather as moral condition. Small enclosed spaces holding enormous dread. The supernatural visible in the landscape.',
    s: {
      1: c => [
        `${c[0]} in period-accurate rough clothing — wool, linen, leather worn for survival — standing in extreme weather: sea wind, snow, or fog`,
        `${c[0]} inside a low stone or timber structure, the single light a candle or fire, the darkness beyond it absolute`,
        `${c[0]} at the threshold of a forest or the sea — the boundary between the known and the supernatural made spatial`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a small enclosed period space — a ship cabin, a lighthouse room, a farmhouse — confinement amplifying the tension`,
        `${c[0]} and ${c[1]} in period dress at labor — pulling rope, carrying load — the bodies defined by effort, the work authentic`,
        `${c[0]} facing ${c[1]} in a clearing, the forest or sea behind them ominous — a confrontation with the landscape as witness`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a period domestic space — cooking, praying, sleeping — the routine containing the dread`,
        `${c[0]} and ${c[1]} watching ${c[2]} from a distance, the observed figure unaware — the watching expressing suspicion or devotion`,
      ],
    },
  },

  guadagnino: {
    name: 'Luca Guadagnino',
    short: 'Guadagnino',
    note: 'Sensual surfaces. Lush tactility. Emotional heat. Architecture and bodies in dialogue. Desire made material. The skin of things.',
    s: {
      1: c => [
        `${c[0]} in a warm interior or garden, the camera close to fabric, skin, and architectural surface — the tactile more present than the narrative`,
        `${c[0]} in an Italian or European setting of aesthetic density — the light, the food, the architecture all part of the desire`,
        `${c[0]} in a slow movement — swimming, eating, lying in the sun — the body the subject, the sensory experience the content`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a summer space — a pool, a terrace, a garden — the architecture and heat a third presence in their encounter`,
        `${c[0]} and ${c[1]} in close proximity, the camera attending to the space between their bodies — not contact, but the fact of proximity`,
        `${c[0]} and ${c[1]} at a meal or in a domestic ritual, the textures of food and fabric and light equally present with the human exchange`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a summer gathering — a house, a garden, a pool — the bodies and the architecture in sensual dialogue`,
        `${c[0]} and ${c[1]} at the center of a social space, ${c[2]} at the edge — the desire and the observation equally present in the warm light`,
      ],
    },
  },

  clairedenis: {
    name: 'Claire Denis',
    short: 'Denis',
    note: 'Bodies as knowledge. Skin and fabric and proximity. Parts before wholes. Colonial and post-colonial space. Night and heat and fragmented geography.',
    s: {
      1: c => [
        `${c[0]} filmed in close fragments — shoulder, nape of neck, forearm — the body assembled from parts, the face last or not at all`,
        `${c[0]} in a night exterior, the heat physically present in the image, the body in slow movement or complete rest`,
        `${c[0]} in an interior carrying historical weight — a former colony, a barracks, a shared apartment — the space as memory`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in close physical proximity, the camera close to fabric and skin — not romantically, just the fact of bodies near each other`,
        `${c[0]} and ${c[1]} in a night scene, the darkness fragmenting them, each face appearing and disappearing in available light`,
        `${c[0]} touching ${c[1]} — a hand on an arm, a head against a shoulder — the camera registering texture at close range`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a communal space — kitchen, barracks room, nightclub — the bodies defining the space by their proximity`,
        `${c[0]} and ${c[1]} together, ${c[2]} entering or leaving the frame — the group never fully assembled, always in flux`,
      ],
    },
  },

  barry_jenkins: {
    name: 'Barry Jenkins',
    short: 'B. Jenkins',
    note: 'Intimate lensing. Lyrical movement. Rich skin-tone rendering. Tenderness and ache. The face regarded with love. Memory as physical space.',
    s: {
      1: c => [
        `${c[0]} in close-up, the lens close and warm, the face lit with tenderness — the camera regarding the person with the attention love requires`,
        `${c[0]} in a memory space — a beach, a corridor, a childhood room — the image slightly luminous, slightly out of reach`,
        `${c[0]} in an urban or domestic interior, the light warm and specific to their skin, the camera attending to what makes them particular`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a close exchange, the camera moving between them with lyrical patience — each face regarded with the same tenderness`,
        `${c[0]} and ${c[1]} in a memory or near-memory space, the image beautiful and aching in equal measure`,
        `${c[0]} and ${c[1]} at a moment of quiet recognition — not dramatic, just seen — the camera holding their faces with care`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a domestic or community space, the camera moving through them with warmth — each face given the fullness of attention`,
        `${c[0]} between ${c[1]} and ${c[2]}, the tender camera refusing to privilege one face over another`,
      ],
    },
  },

  carax: {
    name: 'Leos Carax',
    short: 'Carax',
    note: 'Ecstatic theatricality. Romantic ruin. Musical absurdity. Feverish image-making. The lover as holy fool. Paris as stage for impossible feeling.',
    s: {
      1: c => [
        `${c[0]} in a Paris street or bridge at night, the feeling too large for the space — the figure at the edge of what the frame can hold`,
        `${c[0]} in a theatrical or absurd posture — running, falling, dancing — the emotion neither explained nor contained`,
        `${c[0]} in a space of romantic ruin — an abandoned building, a flooded street, a broken interior — the beauty and the damage inseparable`,
      ],
      2: c => [
        `${c[0]} and ${c[1]} in a night encounter, the feeling between them operatic — the city the only adequate witness`,
        `${c[0]} moving toward ${c[1]} across an impossible distance — a bridge, a road, a broken space — the journey toward them the film`,
        `${c[0]} and ${c[1]} in a theatrical setting — a stage, a public space, a costume — the love as performance and as absolute sincerity at once`,
      ],
      3: c => [
        `${c[0]}, ${c[1]}, and ${c[2]} in a feverish ensemble — musical, theatrical, surreal — the emotion too large for any realistic container`,
        `${c[0]} at the center of a scene where ${c[1]} and ${c[2]} are both audience and participants — the performance and the feeling the same thing`,
      ],
    },
  },

}

export const DIRECTOR_LIST = Object.keys(DIRECTORS)
```
