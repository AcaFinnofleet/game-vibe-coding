import {
  FLOOR,
  FLOORS,
  type FloorName,
  MONSTER,
  MONSTER_COUNT,
  MONSTER_COUNTS,
  PLAYER_LOOKS,
  PLAYERS,
  SOUND,
  VIEW,
  VIEW_START,
  type ViewName,
  VIEWS,
} from './config';
import { endFrame, heldKeys, initInput, wasPressed } from './input';
import { buildMaze, cellCenter, cellOf, openNeighbors, updateBlocks } from './maze';
import { type Monster, spawnMonsters } from './monster';
import { keepTogether, Player, separate } from './player';
import { fitToScreen, followPlayers, isFirstPerson, isSplit, maxApart, setView } from './camera';
import { currentFloor, setFloor } from './floors';
import { clearPowers, updatePowers, usePowers } from './powers';
import { applyTrails, clearTrails, updateTrails } from './trails';
import { render } from './render';
import { initSound, isMuted, playSound, setMuted } from './sound';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;

// Fill the whole window, sharp on HiDPI screens.
function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  fitToScreen(window.innerWidth, window.innerHeight, PLAYERS.length);
  canvas.style.width = `${VIEW.width}px`;
  canvas.style.height = `${VIEW.height}px`;
  canvas.width = Math.round(VIEW.width * dpr);
  canvas.height = Math.round(VIEW.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// A button on the left that opens a row of choices next to it (the .picker-control with this id
// in index.html). Picking a choice calls onPick and closes the row. Clicking anywhere else or
// pressing Escape closes the row without a change. Returns a function that marks a choice as
// picked without calling onPick, for the starting value.
interface PickerOption<T> {
  value: T;
  label: string; // shown in the row
  buttonLabel: string; // shown on the button while this choice is picked
  title: string;
}
function makePicker<T>(id: string, options: PickerOption<T>[], onPick: (value: T) => void): (value: T) => void {
  const control = document.querySelector<HTMLDivElement>(`#${id}`)!;
  const button = control.querySelector<HTMLButtonElement>('button')!;
  const picker = control.querySelector<HTMLDivElement>('.picker')!;
  const choices = options.map((option) => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = button.className;
    choice.textContent = option.label;
    choice.title = option.title;
    choice.addEventListener('click', () => {
      show(option.value);
      onPick(option.value);
      picker.hidden = true;
      // Let go of focus, or Space (a player's action key) would click it again.
      choice.blur();
    });
    picker.append(choice);
    return { option, choice };
  });

  function show(value: T): void {
    for (const { option, choice } of choices) {
      choice.classList.toggle('chosen', option.value === value);
      if (option.value !== value) continue;
      button.textContent = option.buttonLabel;
      button.title = `${option.title} (click to pick another)`;
    }
  }

  button.addEventListener('click', () => {
    picker.hidden = !picker.hidden;
    button.blur();
  });
  window.addEventListener('pointerdown', (e) => {
    if (!control.contains(e.target as Node)) picker.hidden = true;
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') picker.hidden = true;
  });
  return show;
}

// View menu: the top button on the left.
const showView = makePicker(
  'view-control',
  (Object.keys(VIEWS) as ViewName[]).map((name) => ({
    value: name,
    label: VIEWS[name].label,
    buttonLabel: VIEWS[name].label,
    title: 'View: ' + VIEWS[name].name,
  })),
  setView,
);
setView(VIEW_START);
showView(VIEW_START);

// Floor button under the view button.
const showFloor = makePicker(
  'floor-control',
  (Object.keys(FLOORS) as FloorName[]).map((name) => ({
    value: name,
    label: FLOORS[name].emoji,
    buttonLabel: FLOORS[name].emoji,
    title: `Floor: ${FLOORS[name].name}`,
  })),
  setFloor,
);
setFloor(FLOOR);
showFloor(FLOOR);

const DEBUG_KEY = 'Backquote'; // the key left of 1 (§ on Swiss keyboards)
initInput([...PLAYERS.flatMap((p) => Object.values(p.controls)), DEBUG_KEY]);
initSound();

// Sound button under the monster button: turns the sound effects off and on.
const soundButton = document.querySelector<HTMLButtonElement>('#sound')!;
function showSound(): void {
  soundButton.textContent = isMuted() ? '🔇' : '🔊';
  soundButton.title = isMuted() ? 'Sound off (click to turn on)' : 'Sound on (click to turn off)';
}
soundButton.addEventListener('click', () => {
  setMuted(!isMuted());
  showSound();
  // Let go of focus, or Space (a player's action key) would click it again.
  soundButton.blur();
});
setMuted(SOUND.startMuted);
showSound();

let players: Player[] = [];
let monsters: Monster[] = [];
let gameOverFor: number | null = null; // seconds since both players were out at once, or null while playing
const RESTART_DELAY = 1; // seconds before the action keys restart, so buttons mashed while dying don't skip the screen
let showKeys = false;
let monsterCount = MONSTER_COUNT;

// A new labyrinth, players back at their start, new monsters.
function newGame(): void {
  buildMaze();
  clearTrails();
  clearPowers();
  // A new look for every player each round, all different.
  const looks = [...PLAYER_LOOKS].sort(() => Math.random() - 0.5);
  players = PLAYERS.map((cfg, i) => new Player(cfg, looks[i % looks.length]));
  // Start the players in the middle of a path, not inside a wall.
  for (const p of players) {
    const start = cellCenter(cellOf(p.x, p.y));
    p.x = start.x;
    p.y = start.y;
  }
  monsters = spawnMonsters(players, monsterCount);
  gameOverFor = null;
  followPlayers(players, 0, true);
  playSound('newGame');
}
newGame();

// Monster button under the floor button. Picking a number puts that many new monsters in the
// labyrinth right away; the players keep their places and lives.
const showMonsterCount = makePicker(
  'monster-control',
  MONSTER_COUNTS.map((n) => ({ value: n, label: String(n), buttonLabel: `👹${n}`, title: `Monsters: ${n}` })),
  (n) => {
    monsterCount = n;
    monsters = spawnMonsters(players, monsterCount);
  },
);
showMonsterCount(monsterCount);

// A player comes back right next to the other player.
// The other player is never out at the same time: that ends the game instead.
function respawnSpot(p: Player): { x: number; y: number } {
  const buddy = players.find((o) => o !== p)!;
  const here = cellOf(buddy.x, buddy.y);
  const next = openNeighbors(here);
  return cellCenter(next.length > 0 ? next[Math.floor(Math.random() * next.length)] : here);
}

function update(dt: number): void {
  if (wasPressed(DEBUG_KEY)) showKeys = !showKeys;
  if (gameOverFor !== null) {
    gameOverFor += dt;
    if (gameOverFor >= RESTART_DELAY && players.some((p) => wasPressed(p.config.controls.action))) newGame();
    endFrame();
    return;
  }
  updateTrails(dt);
  updateBlocks(dt);
  // Trails set how a player moves this step, so they go before moving.
  for (const p of players) if (!p.isDead()) applyTrails(p);
  for (const p of players) p.update(dt, isFirstPerson());
  for (const p of players) {
    if (p.isDead() && p.respawnIn === 0) {
      const spot = respawnSpot(p);
      p.respawn(spot.x, spot.y);
    }
  }
  // A player with 0 lives is out of the game until it comes back: nothing can touch or chase it.
  const alive = players.filter((p) => !p.isDead());
  for (const p of alive) usePowers(p, monsters, wasPressed);
  updatePowers(dt, monsters);
  for (const m of monsters) m.update(dt, alive, currentFloor());
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) separate(alive[i], alive[j]);
  }
  // Players bump into monsters. Monsters walk through each other, or two of them meeting
  // in a narrow path would push against each other forever. Burned-up monsters aren't there.
  const present = monsters.filter((m) => !m.isGone());
  for (const p of alive) for (const m of present) separate(p, m);
  // Touching means standing right against it. Hopping over a monster doesn't count.
  for (const p of alive) {
    for (const m of present) {
      const touching = Math.hypot(p.x - m.x, p.y - m.y) <= p.radius + m.radius + 1;
      if (touching && p.z <= p.radius && m.canHurt()) p.hurt(Math.min(m.kind.damage, MONSTER.maxDamage));
    }
  }
  if (players.every((p) => p.isDead())) {
    gameOverFor = 0;
    playSound('gameOver');
  }
  if (!isSplit() && alive.length === 2) keepTogether(alive[0], alive[1], maxApart());
  followPlayers(players, dt);
  endFrame();
}

// Fixed-step updates keep movement identical on 60 Hz and 144 Hz screens.
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now: number): void {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  render(ctx, players, monsters, gameOverFor !== null && gameOverFor >= RESTART_DELAY, gameOverFor !== null, showKeys ? heldKeys() : null);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
