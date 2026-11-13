# Arena 2P

A two-player same-keyboard browser game built in short sessions with a
10-year-old, who decides what the game should do. Keep it fun to change.

- Plain TypeScript + Canvas 2D + Vite. No game framework, no other runtime dependencies.
- One feature per request. Keep the game playable after every change.
- Tunable values (speeds, sizes, colors, emojis, keys) go in `src/config.ts`.
- Graphics are emojis or simple canvas shapes unless asked otherwise.
- Game logic works in world units (`ARENA`). Only `camera.ts` (world → screen), `render.ts`
  (players, HUD), `firstperson.ts` and `floors/` know about the screen. Use `project()` for anything
  drawn on the floor in the views from above.
- Everything must look right in every view of the view menu (`VIEWS` in `config.ts`): 2D and 3D
  from above (`CAMERAS`), split or on one shared screen, and first person. Don't hard-code a tilted
  look; take view-specific values from `currentCamera()`. Anything new in the world also needs a
  picture in `firstperson.ts`.
- Each floor has its own painter file in `src/floors/`, listed in `FLOORS` (`config.ts`) and
  `FLOOR_LOOKS` (`floors/index.ts`). Shapes shared by floors live in `floors/shapes.ts`.
- Keys are `KeyboardEvent.code` values. Keep the two players' controls apart
  (P1 left side of the keyboard, P2 arrows/right side).
- Both players must stay equally strong unless the kids ask for an asymmetric game.
- Run `npm run typecheck` after changes.
