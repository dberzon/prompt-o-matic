/**
 * Director scene bank: style keys + 2-character ideation seeds (narrative beats).
 * Keys must match DIRECTORS in directors.js. Used for reference / polish context,
 * not pasted verbatim into assembled T2I prompts.
 */

export const SCENE_BANK = {
  tarkovsky: {
    styleKey: 'sacred slowness, water, fire, wind, memory, ruins, spiritual fatigue',
    compact: 'lie in ruined room, walk through abandoned space, ritual washing, speak in water, wait by candle',
    seeds2: [
      'Two people lie on a bed fully dressed in a decaying room, not touching, while rainwater drips somewhere off-screen and neither says what they really came to say.',
      'One leads the other through an abandoned house, showing them rooms that seem to contain memories more than objects.',
      'Two characters stand in shallow water, speaking quietly about guilt, faith, or a lost child, as if the landscape is listening.',
      'One washes the other’s hair or face in silence, not as romance but as a ritual of forgiveness.',
      'Two people sit at a table beside a candle, talking about leaving, yet neither moves.',
    ],
  },
  jarmusch: {
    styleKey: 'deadpan cool, minimal dialogue, outsider drift, cigarettes, dry wit, emotional understatement',
    compact: 'sit on bed smoking, wander city, drink coffee, deadpan confession, awkward visit',
    seeds2: [
      'Two people sit on a bed in a cheap room, smoking and discussing something absurdly small as if it matters more than love.',
      'Two characters walk through the city at night, talking in fragments, jokes, and half-failed confessions.',
      'One lies awake while the other talks from the floor, both acting casual though the relationship is ending.',
      'Two people share coffee in silence at 3 a.m., each pretending they are too cool to be lonely.',
      'One arrives unexpectedly at the other’s apartment, and they spend the whole scene deciding whether to let the moment become meaningful.',
    ],
  },
  haneke: {
    styleKey: 'cold precision, emotional cruelty, static observation, repression, moral discomfort',
    compact: 'breakfast after betrayal, static apology, bed with emotional gap, polite cruelty, interrogation',
    seeds2: [
      'Two people sit at a kitchen table after an act of betrayal, speaking with unbearable politeness.',
      'One calmly interrogates the other in a living room, never raising their voice, never letting them escape.',
      'Two characters lie in the same bed with a visible gap between them, the silence harsher than any fight.',
      'One enters the room to apologize, but the other refuses the ritual and forces them to remain exposed.',
      'Two people eat breakfast after something unforgivable happened the night before, and the scene plays as if routine itself is violence.',
    ],
  },
  kubrick: {
    styleKey: 'geometry, symmetry, distance, controlled movement, emotional chill, visual authority',
    compact: 'symmetrical duel, corridor walk, controlled bedroom tableau, command scene, immaculate argument',
    seeds2: [
      'Two people sit opposite each other at the exact center of a perfectly ordered room, their conversation becoming a duel.',
      'One character stands at the foot of a bed while the other lies rigidly still, like figures in an experiment.',
      'Two people walk down a long corridor together, their emotional imbalance expressed through spacing and posture.',
      'One gives instructions while the other listens from a chair, the room making their power difference feel architectural.',
      'A couple argues in an immaculate interior, but the real subject is not emotion — it is control.',
    ],
  },
  wongkarwai: {
    styleKey: 'longing, neon, intimacy without resolution, time fragments, sensual loneliness',
    compact: 'corridor longing, neon bed scene, late-night snack intimacy, returned object, repeated near-encounters',
    seeds2: [
      'Two people stand in a narrow hallway at night, almost touching, speaking softly about something practical while desire fills the air.',
      'One lies on a bed in colored light while the other sits beside them smoking, both aware they are already becoming memory.',
      'Two people share noodles, cigarettes, or late-night tea, talking around what they feel instead of naming it.',
      'One returns an object — a dress, a tie, a key, a thermos — and the exchange feels more intimate than a kiss.',
      'Two people pass each other in slow emotional rhythm, repeatedly meeting in stairwells, corridors, or rain, never quite arriving at love.',
    ],
  },
  lynch: {
    styleKey: 'dream logic, uncanny intimacy, erotic unease, dread beneath normality',
    compact: 'uncanny bed scene, repeated dialogue, diner fear talk, watching sleep, ritualized romance',
    seeds2: [
      'Two people lie on a bed in semi-darkness, speaking in tender voices while something in the sound design makes the moment feel wrong.',
      'One visits the other late at night, and the conversation seems normal until it begins repeating itself in strange variations.',
      'Two people sit in a diner or kitchen, discussing a private fear that may or may not be real.',
      'One character watches the other sleep, but the stillness becomes eerie, as if they are observing a double or a ghost.',
      'A romantic encounter turns subtly ritualistic, with gestures that feel symbolic rather than natural.',
    ],
  },
  bergman: {
    styleKey: 'faces, confession, emotional nakedness, spiritual pain, intimacy as warfare',
    compact: 'post-sex confession, face-to-face emotional dissection, illness-care accusation, spiritual emptiness talk',
    seeds2: [
      'Two people lie in bed after sex and begin talking honestly for the first time, each sentence making the room smaller.',
      'One asks the other if they have ever truly loved them, and the answer becomes a wound.',
      'Two characters sit face to face in lamplight, stripping each other bare through conversation rather than action.',
      'One nurses the other during illness, and caretaking slowly becomes accusation.',
      'A reunion between former lovers turns into a confession of spiritual emptiness, carried almost entirely by faces and pauses.',
    ],
  },
  antonioni: {
    styleKey: 'alienation, modern architecture, emotional vacancy, distance, empty space',
    compact: 'modern-space detachment, wandering room, reflection conversation, dissolved reunion, empty landscape walk',
    seeds2: [
      'Two people stand on a balcony or in a large modern room, unable to bridge the emptiness between them.',
      'One lies on a bed while the other wanders the room, touching objects but not the person.',
      'Two lovers meet after time apart, but the setting overwhelms the reunion and makes it feel abstract.',
      'A conversation unfolds through windows, hallways, or reflections, as though direct connection is impossible.',
      'Two people walk through an unfinished urban landscape, speaking without conviction, as if the relationship has already dissolved.',
    ],
  },
  malick: {
    styleKey: 'nature, breath, movement, touch, grace, light, emotional lyricism',
    compact: 'bed by open window, running through fields, gentle washing, dusk reconciliation, doorway memorizing',
    seeds2: [
      'Two people lie in grass or on a bed near open windows, speaking in fragments while light and air carry more meaning than the dialogue.',
      'One runs ahead and the other follows through fields or trees, their emotional bond expressed through motion rather than confrontation.',
      'Two characters wash, dress, or touch each other gently, as if rediscovering innocence after grief.',
      'A couple reconciles while walking at dusk, their words half lost to wind, insects, and golden light.',
      'One watches the other from a doorway, not possessively but with fragile gratitude, as though trying to memorize them before losing them.',
    ],
  },
  belatarr: {
    styleKey: 'duration, black-and-white despair, mud, repetition, exhaustion, cosmic melancholy',
    compact: 'drinking in despair, rain walk, window fatalism, long monologue by bed, empty tavern drift',
    seeds2: [
      'Two people sit in a room for a very long time, drinking, smoking, and talking as if both know life has already failed them.',
      'One helps the other walk through rain and mud, the journey feeling heavier than the conversation.',
      'Two figures stand at a window watching a desolate landscape, speaking with slow fatalism.',
      'A bedridden character listens while the other delivers a long monologue, and the scene feels like a final reckoning with time itself.',
      'Two people move through an empty tavern or corridor, their emotional collapse mirrored by the weight of the camera’s patience.',
    ],
  },
  ozu: {
    styleKey: 'domestic stillness, low camera, family tension, restraint, small gestures',
    compact: 'tea scene, family meal, low-angle duty talk, side-by-side conversation, quiet visit',
    seeds2: [
      'Two family members sit on the floor in a quiet room, discussing marriage, duty, or departure in almost neutral tones.',
      'One makes tea while the other watches, and what is unsaid becomes the entire scene.',
      'Two people sit side by side rather than face to face, speaking gently about a life change neither wants.',
      'A parent and adult child share an evening meal, smiling politely while each feels the impending separation.',
      'One visits the other after a long silence, and the emotional event is contained in posture, cups, and pauses.',
    ],
  },
  kaurismaki: {
    styleKey: 'deadpan sadness, retro simplicity, stillness, cigarette melancholy, dry tenderness',
    compact: 'bare-room smoking, shy coffee romance, empty bar dance, blunt confession, plain offer of shelter',
    seeds2: [
      'Two people sit on a bed in a bare room, smoking without speaking, yet the stillness feels affectionate.',
      'A shy romantic conversation happens over cheap coffee or beer, both characters emotionally awkward but sincere.',
      'One offers the other a place to stay, phrasing it so plainly that the tenderness almost disappears.',
      'Two people dance slowly in a nearly empty bar, as if embarrassed by feeling anything at all.',
      'One confesses love in the bluntest possible terms, and the scene becomes moving precisely because it refuses theatricality.',
    ],
  },
  parkchanwook: {
    styleKey: 'elegance, erotic tension, visual exactness, cruelty, beauty, manipulation',
    compact: 'ceremonial undressing, elegant power tea scene, wound-care intimacy, lavish secret meeting, tender betrayal',
    seeds2: [
      'Two people dress or undress each other with ceremonial care, and the moment hovers between tenderness and strategy.',
      'A conversation over tea or dinner becomes a power game, each line both seduction and attack.',
      'One tends to the other’s wound, but the intimacy feels dangerous, even perverse.',
      'Two lovers meet in a lavish room, their closeness intensified by secrecy, guilt, and design.',
      'One reveals a hidden motive while touching the other gently, making affection inseparable from betrayal.',
    ],
  },
  fincher: {
    styleKey: 'precision, tension, procedural intelligence, darkness, obsession, hidden control',
    compact: 'dim-room truth game, analytical breakup, bed suspicion, controlled questioning, identity as performance',
    seeds2: [
      'Two people talk in a dim apartment or office, every pause suggesting that one of them knows more than they admit.',
      'A couple lies in bed discussing an apparently mundane issue, but the scene gradually reveals surveillance, distrust, or strategy.',
      'One calmly questions the other in a car or kitchen, the framing making it feel like an interrogation.',
      'Two former lovers meet to reconstruct what happened, not emotionally but analytically, which makes it colder.',
      'One discovers the other has been performing a role, and the confrontation plays like a forensic examination of intimacy.',
    ],
  },
  michaelmann: {
    styleKey: 'nocturnal city light, professionalism, masculine solitude, urban melancholy',
    compact: 'parked-car honesty, dangerous-life breakup, airport/diner meeting, urgent reunion, urban-light farewell',
    seeds2: [
      'Two people sit in a parked car at night, talking with unusual honesty because the city outside feels anonymous.',
      'A lover asks the other to leave their dangerous life, and the refusal comes wrapped in professional fatalism.',
      'Two characters meet in a diner, club, or airport-like space, both aware they belong more to motion than to each other.',
      'One visits the other after a long absence, but their reunion is shaped by urgency, schedule, and danger.',
      'A breakup happens under sodium-vapor or blue urban light, with emotional restraint stronger than open grief.',
    ],
  },
  clairedenis: {
    styleKey: 'bodies, heat, intimacy, fragmentation, tactile feeling, emotional ambiguity',
    compact: 'skin-and-breath aftermath, tactile care, close dance, dressing scene, explanation-free reunion',
    seeds2: [
      'Two people lie on a bed or floor in the aftermath of intimacy, the scene focused less on speech than on breath, skin, and distance.',
      'One washes or touches the other slowly, but the care is mixed with tension, memory, and uncertainty.',
      'Two characters dance or sway together, the physical closeness saying more than dialogue ever could.',
      'One watches the other getting dressed, and the act feels more revealing than nudity.',
      'A reunion scene avoids explanations, instead building meaning through hesitation, glances, and tactile detail.',
    ],
  },
  almodovar: {
    styleKey: 'color, melodrama, emotional candor, theatrical interiors, desire and confession',
    compact: 'colorful confession, operatic caregiving, heightened argument, return after years, love and identity talk',
    seeds2: [
      'Two people sit on a vividly colored bed or sofa, exchanging a confession that is painful but liberating.',
      'A caregiver and patient scene becomes emotionally operatic, full of suppressed history and strong visual design.',
      'One character returns after years and is received with a flood of feeling rather than restraint.',
      'Two people argue in a beautiful kitchen or bedroom, their emotions heightened by color, costume, and decor.',
      'A love scene turns into a conversation about identity, betrayal, or motherhood, with no fear of emotional extremity.',
    ],
  },
  eggers: {
    styleKey: 'historical texture, ritual dread, archaic speech, candlelight, folklore, repression',
    compact: 'candlelit dread, archaic confession, ritual touch, cottage argument, forbidden desire',
    seeds2: [
      'Two people lie in a bed or on straw in near darkness, speaking in hushed tones as if afraid of being overheard by God or something older.',
      'One performs a small ritual on the other — washing, marking, blessing, binding — while fear quietly grows.',
      'Two characters argue in a cottage or isolated room, their speech formal, their emotions primitive and dangerous.',
      'One confesses a forbidden desire or sin, and the other responds as if the world itself may punish them.',
      'A nighttime conversation by candlelight becomes a struggle between intimacy and superstition.',
    ],
  },
  apichatpong: {
    styleKey: 'dream-stillness, jungle atmosphere, soft mystery, tenderness, sleep, the supernatural as ordinary',
    compact: 'whispered lying side by side, night walk, long pauses, calm care, dreamlike reunion',
    seeds2: [
      'Two people lie side by side in quiet darkness, speaking so softly the scene feels like half-dream rather than dialogue.',
      'One guides the other through a forest or open night space, their intimacy becoming porous with the environment.',
      'Two people sit and talk with long pauses, as if listening to sounds beyond the conversation.',
      'A caring scene — feeding, touching, resting — unfolds with such calm that it begins to feel spiritual.',
      'One person returns, but the reunion feels less like drama than like a dream continuing from years earlier.',
    ],
  },
  fellini: {
    styleKey: 'spectacle, memory, theatricality, grotesque beauty, longing mixed with performance',
    compact: 'theatrical bed scene, carnival reunion, performed seduction, night spectacle walk, comic-tragic confession',
    seeds2: [
      'Two people lie on a bed in an exaggeratedly elegant or decaying room, talking as if inside a memory of romance rather than romance itself.',
      'A reunion plays out amid noise, music, extras, costumes, or absurdity, making the private moment strangely public.',
      'One seduces the other through theatrical performance, with sincerity and self-invention tangled together.',
      'Two people walk through a nighttime carnival, street, or hotel corridor, their emotional truth emerging through spectacle.',
      'A confession scene becomes half-comic, half-tragic, as if the characters are simultaneously living and remembering their own melodrama.',
    ],
  },
  leone: {
    styleKey: 'ritual timing, mythic confrontation, silence, faces, waiting, masculine drama',
    compact: 'silent table duel, delayed answer, ritual reunion, drink before departure, mythic goodbye',
    seeds2: [
      'Two people sit opposite each other in near silence, the tension created entirely by waiting, glances, and tiny gestures.',
      'A reunion after betrayal plays like a duel, even if no weapon is drawn.',
      'One comes to ask for help, the other delays the answer, forcing the scene into ritual time.',
      'Two characters share a drink or cigarette before departure, both knowing one of them may not return.',
      'A farewell scene stretches through pauses and close looks, turning emotion into myth rather than confession.',
    ],
  },
  ceylan: {
    styleKey: 'seasonal melancholy, psychological realism, stillness, landscapes, unresolved emotional fatigue',
    compact: 'winter room disappointment, bed/window distance, late-night truth, intelligent failed reunion, landscape walk',
    seeds2: [
      'Two people sit indoors during cold weather, having a conversation that starts mundane and slowly reveals deep disappointment.',
      'One lies on a bed while the other stands near the window, both trapped by weather, routine, and shared history.',
      'A couple speaks late at night after guests have gone, the real conflict surfacing only gradually.',
      'One revisits the other after a long time, but both have become too self-aware to behave simply.',
      'Two characters take a walk outdoors in silence, and the landscape carries the emotional weight of the scene.',
    ],
  },
  refn: {
    styleKey: 'neon ritual, silence, stylized violence, erotic distance, sculptural cool',
    compact: 'neon bed stillness, slow entrance, silent seduction, icon-like intimacy, dangerous caress',
    seeds2: [
      'Two people lie on a bed under colored light, silent for so long that the scene becomes ceremonial rather than naturalistic.',
      'One enters the other’s room slowly, and every glance feels like a coded act of desire or threat.',
      'A seduction scene unfolds with minimal dialogue, all meaning transferred to posture, color, and stillness.',
      'Two lovers share a moment before violence erupts elsewhere, their intimacy framed like an icon.',
      'One touches the other’s face with disturbing calm, turning affection into something hypnotic and dangerous.',
    ],
  },
  coppola: {
    styleKey: 'soft isolation, privilege and emptiness, quiet longing, dreamy surfaces, emotional drift',
    compact: 'hotel-bed loneliness, soft late-night bond, luxurious emptiness, temporary intimacy, understated farewell',
    seeds2: [
      'Two people lie on a hotel bed or in a beautiful room, talking quietly because neither knows what to do with their loneliness.',
      'A nighttime conversation between two emotionally adrift people becomes intimate precisely because it stays light.',
      'One visits the other in a private, luxurious but empty environment, and the scene plays as elegant sadness.',
      'Two people sit by a window, balcony, pool, or bed, sharing a temporary bond they know will not become a future.',
      'A parting scene is understated, almost casual, yet filled with the ache of missed timing.',
    ],
  },
}

export function getSceneBankEntry(dirKey) {
  if (!dirKey || typeof dirKey !== 'string') return null
  return SCENE_BANK[dirKey] ?? null
}
