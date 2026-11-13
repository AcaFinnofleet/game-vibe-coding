// Everything a kid might want to tweak lives here.

export interface Controls {
  up: string;
  down: string;
  left: string;
  right: string;
  action: string;
  lightning: string; // the three powers, see POWERS
  fire: string;
  ice: string;
}

export interface PlayerConfig {
  name: string;
  color: string;
  start: { x: number; y: number }; // fraction of the arena: 0 = left/far edge, 1 = right/near edge
  controls: Controls;
}

// Screen size in CSS pixels. Updated to the window size whenever it changes.
export const VIEW = { width: 960, height: 600 };

// The playing field, in world units. (0,0) is the far-left corner.
// It is bigger than the screen: the cameras follow the players around it (see VIEWS).
export const ARENA = { width: 4800, height: 2700 };
// Zoom: screen pixels per world unit. Bigger = bigger players, less of the labyrinth in view.
// On one shared screen this is the zoom while the players are close together.
export const PIXELS_PER_UNIT = 0.8;
// How the cameras follow the players.
export const CAMERA_FOLLOW = {
  smoothing: 6, // how quickly they glide after the players (bigger = snappier)
  // One shared screen only:
  margin: 250, // room kept around the players, in world units
  minZoom: 0.45, // it zooms out no further than this when the players run apart.
  // Past that, the player running away pulls the other one along.
};

// The views in the view menu (the top button on the left), in the order it shows them.
// camera: one of CAMERAS (seen from above) or 'first-person' (seen through the player's eyes).
// split: true = one half of the screen per player, false = both players on one screen.
// First person is always split, since each player looks through their own eyes.
export const VIEWS = {
  '3d-split': { label: '3D ½', name: '3D, split screen', camera: '3d', split: true },
  '2d-split': { label: '2D ½', name: '2D, split screen', camera: '2d', split: true },
  '3d-shared': { label: '3D', name: '3D, one screen', camera: '3d', split: false },
  '2d-shared': { label: '2D', name: '2D, one screen', camera: '2d', split: false },
  'first-person': { label: '👁️', name: 'First person, split screen', camera: 'first-person', split: true },
} as const;
export type ViewName = keyof typeof VIEWS;
export const VIEW_START: ViewName = '3d-split'; // the view the game starts in

// First person: the walls stand up around you, and left/right turn you instead of moving you.
export const FIRST_PERSON = {
  fov: 70, // how wide you see, in degrees
  turnSpeed: 3, // how fast left/right turn you, in radians per second
  eyeHeight: 50, // in world units
  wallHeight: 120,
  viewDistance: 1300, // things farther away disappear in the dark
  column: 2, // screen pixels per wall slice (bigger = blockier but faster)
  sky: '#141824',
};

// The camera views seen from above, used by VIEWS.
// perspective: 0 = straight top-down. 0.3 = far edge is 30% narrower, like a tilted camera.
// depthSquash: how much the floor is squashed vertically (1 = not at all).
// rings: height of the ring and shadow under each player, compared to their width (1 = round).
// wall: height in pixels of the wall along the front edge of the floor (0 = no wall).
// mazeWalls: height of the labyrinth walls in world units (0 = flat, seen from straight above).
export const CAMERAS = {
  '2d': { name: '2D', perspective: 0, depthSquash: 1, rings: 1, wall: 0, mazeWalls: 0 },
  '3d': { name: '3D', perspective: 0.3, depthSquash: 0.8, rings: 0.4, wall: 24, mazeWalls: 30 },
};
export type CameraName = keyof typeof CAMERAS;

export const PLAYER_RADIUS = 28;
export const PLAYER_SPEED = 320; // world units per second
export const PLAYER_GRIP = 12; // higher = snappier start/stop, lower = icy
export const HOP_SPEED = 520;
// The players' powers against monsters. Each has its own key (see PLAYERS) and must cool down
// for cooldown seconds before it works again.
export const POWERS = {
  // Zaps the nearest monster within range, even behind walls: it can't move or hurt for stun seconds.
  // With no monster in range it strikes the floor missLength ahead and needs no cooldown.
  lightning: { emoji: '⚡', cooldown: 4, range: 600, stun: 3, missLength: 160 },
  // A fireball flying the way the player last walked. A monster it hits loses one of its
  // MONSTER.lives. With none left it burns up and comes back somewhere far away after comeback
  // seconds, with all its lives. Walls stop the fireball.
  fire: { emoji: '🔥', cooldown: 2, speed: 650, range: 800, radius: 16, comeback: 10 },
  // Freezes every monster within radius around the player: it can't move or hurt for freeze seconds.
  ice: { emoji: '❄️', cooldown: 8, radius: 220, freeze: 4 },
};
export type PowerName = keyof typeof POWERS;

// Sound effects (sound.ts). The 🔊 button on the left turns them off and on.
export const SOUND = {
  volume: 0.25, // 0 = silent, 1 = loud
  minGap: 0.12, // the same effect plays at most once every this many seconds
  growlGap: 1.5, // except the monsters' growl when they spot you, which waits this long
  startMuted: false,
};

// Lives: a monster touching a player takes some away.
export const LIVES = {
  start: 9, // lives each player starts with
  bonusEvery: 30, // every this many seconds each player gets one life back, up to start
  safeTime: 2, // seconds after a touch or a comeback when monsters can't hurt you (the player blinks)
  respawnTime: 5, // seconds a player with 0 lives waits before coming back with full lives
};
export const GRAVITY = 1800;

export const COLORS = {
  background: '#1b1f2a',
  text: '#ffffff',
};

// Floors for the floor picker under the 2D/3D button, in the order it shows them.
// Floors are only paint: players can walk anywhere. Sizes are in world units.
// Each floor dresses the monsters in a costume: monsterColor is mixed into their body color
// (MONSTER.costumeStrength says how much), and monsterHat is an emoji on their head.
// ground: the floor color in first person, where the floor is one plain color.
export const FLOORS = {
  street: { name: 'Street', emoji: '🛣️', monsterColor: '#6b6f75', monsterHat: '🧢', ground: '#4f5359' },
  wood: { name: 'Wooden floor', emoji: '🪵', monsterColor: '#7a4a26', monsterHat: '🍄', ground: '#8f5e38' },
  arcade: { name: 'Arcade', emoji: '🕹️', monsterColor: '#ff4fd8', monsterHat: '👾', ground: '#2a1d4f' },
  chess: { name: 'Chess board', emoji: '♟️', monsterColor: '#1e1e1e', monsterHat: '👑', ground: '#769656' },
  ice: { name: 'Frozen lake', emoji: '🧊', monsterColor: '#9fd8ff', monsterHat: '❄️', ground: '#dcecf5' },
  moon: { name: 'Moon', emoji: '🌕', monsterColor: '#7ddc5a', monsterHat: '🛸', ground: '#bdbdb7' },
  map: { name: 'Treasure map', emoji: '🗺️', monsterColor: '#5a3a22', monsterHat: '🏴‍☠️', ground: '#ecd9a8' },
  bricks: { name: 'Brick baseplate', emoji: '🧱', monsterColor: '#e3342f', monsterHat: '🧱', ground: '#f4c430' },
  lava: { name: 'The floor is lava', emoji: '🌋', monsterColor: '#ff5a00', monsterHat: '🔥', ground: '#574a46' },
};
export type FloorName = keyof typeof FLOORS;
export const FLOOR: FloorName = 'street'; // the floor the game starts on

export const STREET = {
  sidewalk: 50, // depth of the sidewalks along the far and near edges
  line: 3, // thickness of the painted lines
  dash: 40, // length of each yellow dash
  dashGap: 30,
  crossingWidth: 80, // zebra crossing in the middle of the road
  stripe: 14, // thickness of each zebra stripe (the gaps are the same)
  manholeRadius: 20,
  colors: {
    asphalt: '#4f5359',
    sidewalk: '#b4b6b9',
    sidewalkLines: 'rgba(0,0,0,0.2)', // gaps between the paving slabs
    curb: '#d6d8da',
    roadLines: '#f1f1f1', // edge lines and zebra crossing
    centerLine: '#f2c230', // dashed line down the middle
    manhole: '#3a3d42',
    manholeRim: 'rgba(255,255,255,0.2)',
    wall: '#85888c', // front edge of the floor
  },
};

export const WOOD = {
  plankWidth: 30, // front to back
  plankLength: 160,
  knots: 0.25, // share of planks with a knot (0 = none, 1 = all)
  colors: {
    planks: ['#8f5e38', '#835431', '#9a6840'], // each plank picks one of these
    gaps: 'rgba(40,20,5,0.5)',
    knot: 'rgba(60,30,10,0.45)',
    wall: '#5a3a22',
  },
};

export const ARCADE = {
  tile: 50,
  litTiles: 0.15, // share of tiles that glow (0 = none, 1 = all)
  litBrightness: 0.45, // how strongly lit tiles are filled in (0 = only the glowing outline, 1 = solid)
  colors: {
    floor: '#2a1d4f',
    grid: 'rgba(179,107,255,0.6)',
    border: '#ff4fd8',
    lit: ['#ff4fd8', '#4de8ff', '#ffe14d'],
    wall: '#1a1033',
  },
};

export const CHESS = {
  square: 60, // roughly; it stretches a little so the board ends in whole squares
  frame: 18, // wooden frame around the board
  colors: {
    light: '#eeeed2',
    dark: '#769656',
    frame: '#5a3a22',
    frameLine: '#c9a35a', // thin line between the frame and the squares
    wall: '#3f2817',
  },
};

export const ICE = {
  cracks: 7,
  scratches: 12, // curvy lines left by skates
  colors: {
    ice: '#dcecf5',
    patches: 'rgba(150,195,220,0.35)',
    scratches: 'rgba(110,150,175,0.35)',
    cracks: 'rgba(60,110,140,0.6)',
    snow: '#ffffff',
    snowShade: 'rgba(120,160,190,0.45)',
    wall: '#9cc3d6',
  },
};

export const MOON = {
  craters: 14,
  rocks: 14,
  colors: {
    dust: '#bdbdb7',
    speckles: 'rgba(0,0,0,0.12)',
    craterRim: 'rgba(255,255,255,0.4)',
    craterFloor: 'rgba(0,0,0,0.15)',
    rock: '#7d7b75',
    wall: '#7a7a76',
  },
};

export const TREASURE_MAP = {
  colors: {
    table: '#5a3a22', // shows around the torn edges of the map
    paper: '#ecd9a8',
    paperEdge: '#b08850',
    lines: 'rgba(120,80,40,0.18)',
    stains: 'rgba(140,90,40,0.14)',
    ink: '#6b4a2b', // mountains and compass
    trail: '#8b2e1f',
    x: '#c0281e',
    wall: '#3f2817',
  },
};

export const BRICKS = {
  stud: 32, // distance between studs
  colors: {
    plate: '#f4c430',
    studTop: '#ffd75e',
    studSide: 'rgba(140,90,0,0.45)',
    shine: 'rgba(255,255,255,0.6)',
    wall: '#c2931a',
  },
};

export const LAVA = {
  cracks: 10,
  pulseSpeed: 2, // how fast the glow throbs (0 = still)
  colors: {
    rock: '#574a46',
    rockPatches: 'rgba(0,0,0,0.15)',
    glow: '#ff5a00',
    hot: '#ffd23f', // the bright middle of cracks and pools
    wall: '#2a2220',
  },
};

// The labyrinth. A new one is made every time the game starts.
export const MAZE = {
  cell: 150, // width of the paths, roughly; it stretches a little so the arena ends in whole cells
  wallThickness: 18,
  extraOpenings: 0.12, // share of walls knocked down to make loops (0 = only one way to go anywhere)
};

// The kinds of monsters. They walk through the labyrinth at random. If a player is inside the
// area a monster's eyes can see, it chases that player. Walls block its eyes. If it hasn't seen
// the player for a while, it gives up.
// share: how many of every 10 monsters are this kind. The monster button on the left picks how many there are in all.
// wanderSpeed, chaseSpeed: world units per second. Keep chaseSpeed below PLAYER_SPEED, or nobody can escape.
// wanderTurn, chaseTurn: how fast it turns (bigger = sharper turns).
// sightRange: how far its eyes see. sightAngle: how wide, in degrees.
// forgetAfter: seconds without seeing the player before it gives up the chase.
// damage: lives a touch takes away, at most MONSTER.maxDamage.
// throughWalls: true = a ghost. It floats through walls and sees through them.
export const MONSTER_KINDS = {
  grumbler: {
    name: 'Grumbler', // the ordinary one
    share: 4,
    radius: 34,
    body: '#4a1f5c',
    arms: '#3a1749',
    wanderSpeed: 110,
    chaseSpeed: 250,
    wanderTurn: 5,
    chaseTurn: 8,
    sightRange: 320,
    sightAngle: 70,
    forgetAfter: 3,
    damage: 2,
    throughWalls: false,
  },
  sprinter: {
    name: 'Sprinter', // small and fast, but short-sighted
    share: 2,
    radius: 24,
    body: '#b3261e',
    arms: '#8a1c16',
    wanderSpeed: 170,
    chaseSpeed: 295,
    wanderTurn: 7,
    chaseTurn: 11,
    sightRange: 220,
    sightAngle: 60,
    forgetAfter: 1.5,
    damage: 1,
    throughWalls: false,
  },
  giant: {
    name: 'Giant', // big and slow, sees far and wide
    share: 2,
    radius: 52,
    body: '#2f5d2a',
    arms: '#234620',
    wanderSpeed: 70,
    chaseSpeed: 190,
    wanderTurn: 3,
    chaseTurn: 5,
    sightRange: 420,
    sightAngle: 110,
    forgetAfter: 4,
    damage: 3,
    throughWalls: false,
  },
  stalker: {
    name: 'Stalker', // sees very far, but only straight ahead, and never gives up quickly
    share: 1,
    radius: 32,
    body: '#1f3f73',
    arms: '#172f57',
    wanderSpeed: 90,
    chaseSpeed: 240,
    wanderTurn: 4,
    chaseTurn: 7,
    sightRange: 600,
    sightAngle: 30,
    forgetAfter: 6,
    damage: 2,
    throughWalls: false,
  },
  ghost: {
    name: 'Ghost', // floats through walls and sees through them, but is slow
    share: 1,
    radius: 34,
    body: '#c9d3e6',
    arms: '#a9b4c9',
    wanderSpeed: 55,
    chaseSpeed: 120,
    wanderTurn: 3,
    chaseTurn: 5,
    sightRange: 280,
    sightAngle: 80,
    forgetAfter: 2,
    damage: 1,
    throughWalls: true,
  },
};
export type MonsterKindName = keyof typeof MONSTER_KINDS;
export type MonsterKind = (typeof MONSTER_KINDS)[MonsterKindName];

// Each floor gives all monsters a special ability. name is shown at the top of the screen.
// Trails are spots monsters leave behind them on the floor, every dropEvery seconds; each spot
// stays for lasts seconds and has the size TRAIL_RADIUS.
export const MONSTER_ABILITIES = {
  // While chasing, every `every` seconds it speeds up for `lasts` seconds.
  street: { name: '🧢 Turbo', every: 4, lasts: 1, speedUp: 1.4 },
  // Sticky mushroom spores: a player on them is slowed down to slowDown of the normal speed.
  wood: { name: '🍄 Sticky spores', dropEvery: 0.4, lasts: 6, slowDown: 0.5, color: 'rgba(150,90,200,0.55)' },
  // Every `every` seconds it glitches: it disappears and pops up again up to `cells` paths away.
  arcade: { name: '👾 Glitch', every: 6, cells: 2 },
  // While chasing, every `every` seconds it jumps over a wall toward the player, like a knight.
  chess: { name: '👑 Knight jump', every: 5, jumpTime: 0.45, jumpHeight: 90 },
  // A slippery ice trail: a player on it slides around, with grip instead of PLAYER_GRIP.
  ice: { name: '❄️ Ice trail', dropEvery: 0.4, lasts: 6, grip: 1.2, color: 'rgba(200,240,255,0.75)' },
  // While it sees the player it chases, a tractor beam pulls the player toward it.
  moon: { name: '🛸 Tractor beam', pull: 90, color: 'rgba(140,255,120,0.35)' },
  // Buried treasure hunters: while wandering they are almost invisible (visibility 0 = invisible).
  map: { name: '🏴‍☠️ Buried', visibility: 0.12 },
  // While chasing, every `every` seconds it puts a brick block behind it that stays for lasts seconds.
  bricks: { name: '🧱 Brick builder', every: 3, lasts: 6, size: 70 },
  // A fire trail: a player on it loses livesLost lives (then is safe for LIVES.safeTime).
  lava: { name: '🔥 Fire trail', dropEvery: 0.4, lasts: 4, livesLost: 1, color: 'rgba(255,110,0,0.7)' },
};
export const TRAIL_RADIUS = 26;

// The numbers of monsters the monster button on the left offers, and the number the game starts with.
export const MONSTER_COUNTS = [0, 1, 3, 5, 10, 15, 20, 30];
export const MONSTER_COUNT = 10;

// What all monsters share.
export const MONSTER = {
  startDistance: 900, // monsters start at least this far from every player
  maxDamage: 3, // no monster takes more lives than this with one touch
  lives: 2, // each 🔥 fireball hit takes one; with none left the monster burns up
  costumeStrength: 0.6, // how much of the floor's monsterColor goes into the body (0 = none, 1 = all)
  ghostOpacity: 0.55, // how see-through monsters with throughWalls are (1 = solid)
  shake: 2.5, // how many pixels it trembles with rage while chasing (0 = still)
  spikes: 14, // spikes of shaggy fur around its body
  spikeLength: 0.3, // how long the spikes are, compared to its radius
  colors: {
    claws: '#e8e2d0',
    horns: '#1c0d24',
    brows: '#12060f', // angry eyebrows
    eyes: '#fff27a',
    eyesChasing: '#ff2a2a', // the eyes glow red while it chases someone
    pupils: '#111111',
    mouth: '#1a0508',
    teeth: '#f4f1e6',
    sight: 'rgba(255,240,120,0.18)', // the area its eyes see while wandering
    sightChasing: 'rgba(255,60,60,0.28)', // the same area while it chases someone
  },
};

// Every round each player gets a different look from this list, picked at random.
// The two players never look the same; their colors (in PLAYERS) stay, so you can tell them apart.
export const PLAYER_LOOKS = ['🐱', '🐶', '🦊', '🐸', '🐵', '🐼', '🐯', '🐰', '🐨', '🦁', '🐷', '🐧', '🦄', '🐲', '🤖', '🦖'];

// Key names are KeyboardEvent.code values: they mean the physical key position,
// so WASD works the same on QWERTY, QWERTZ and AZERTY keyboards.
export const PLAYERS: PlayerConfig[] = [
  {
    name: 'Player 1',
    color: '#ff6b6b',
    start: { x: 0.4, y: 0.7 },
    controls: {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      action: 'Space',
      lightning: 'KeyQ',
      fire: 'KeyE',
      ice: 'KeyR',
    },
  },
  {
    name: 'Player 2',
    color: '#4dabf7',
    start: { x: 0.6, y: 0.7 },
    controls: {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      action: 'Enter',
      lightning: 'Comma',
      fire: 'Period',
      ice: 'Slash', // the key left of the right Shift (- on Swiss keyboards)
    },
  },
];
