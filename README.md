# Arena 2P

A starting point for a two-player, same-keyboard game: two characters moving
around a rectangular arena, seen from above with a slight tilt.

```bash
npm install
npm run dev        # opens http://localhost:5173
```

| | Move | Hop | ⚡ Lightning | 🔥 Fire | ❄️ Ice |
|---|---|---|---|---|---|
| Player 1 | W A S D | Space | Q | E | R |
| Player 2 | Arrow keys | Enter | , | . | - (`/` on US keyboards) |

Lightning stuns the nearest monster in sight, fire shoots a fireball that burns a monster
away for a while, ice freezes the monsters around you (`POWERS` in `config.ts`).

Press the key left of `1` (`§` on Swiss keyboards, `` ` `` on US ones) to show which
keys are held. Use it to check that your keyboard registers both players at once:
many laptop keyboards drop keys when several are held.

Out of ideas? See [IDEAS.md](IDEAS.md) for themes, twists and example prompts ([IDEEN.md](IDEEN.md) in German).

## Where things are

- `src/config.ts` – players, emojis, colors, speed, keys, camera views, floors. Start here.
- `src/player.ts` – movement, hop, bumping into each other.
- `src/maze.ts` – the labyrinth: builds it, stops things at its walls, finds the way through it.
- `src/monster.ts` – the monsters: placed at random, wander through the labyrinth, chase a player their eyes see.
- `src/powers.ts` – the players' powers: lightning, fireballs, ice.
- `src/sound.ts` – sound effects, made by the browser on the spot (no sound files). The 🔊 button turns them off.
- `src/trails.ts` – spots monsters leave on some floors (spores, ice, fire) and what they do to players.
- `src/camera.ts` – the views from above (2D, 3D) on a split or shared screen, and the cameras following the players. `project()` turns world positions into screen positions.
- `src/firstperson.ts` – first person: walls, monsters and the other player seen through a player's eyes.
- `src/render.ts` – characters and HUD.
- `src/floors/` – one file per floor, plus `index.ts` with the list of floors.
- `src/input.ts` – keyboard state: `isDown()` for holding, `wasPressed()` for single taps.
- `src/main.ts` – canvas setup, the controls on the left and the game loop.

The top button on the left opens the view menu (`VIEWS` in `config.ts`, `VIEW_START` for the
view the game starts in):

- **3D ½ / 2D ½** – tilted or straight-down camera, split screen: each player has a half that follows them.
- **3D / 2D** – the same cameras on one shared screen that follows both players and zooms out when
  they run apart. Past the farthest zoom, the player running away pulls the other one along.
- **👁️** – first person, split screen. Up/down walk forward and back, left/right turn.

The 👹 button under the floor button picks how many monsters there are (`MONSTER_COUNTS` and
`MONSTER_COUNT` in `config.ts`).

The arena is bigger than the screen (`ARENA` in `config.ts`). `PIXELS_PER_UNIT` sets the zoom,
`CAMERA_FOLLOW` how the cameras follow the players, `FIRST_PERSON` how first person looks.

`npm run build` type-checks and writes a static site to `dist/`, which you can open
from any web server or zip up and share.
