// Tracks which keys are currently held down.

const held = new Set<string>();
const pressedThisFrame = new Set<string>();

export function initInput(gameKeys: string[]): void {
  const blocked = new Set(gameKeys);

  window.addEventListener('keydown', (e) => {
    // Stop arrows/space from scrolling the page.
    if (blocked.has(e.code)) e.preventDefault();
    if (!held.has(e.code)) pressedThisFrame.add(e.code);
    held.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
  });

  // Releasing keys while the window is unfocused would leave them "stuck".
  window.addEventListener('blur', () => held.clear());
}

export function isDown(code: string): boolean {
  return held.has(code);
}

// True only on the first frame a key goes down (good for jump/shoot).
export function wasPressed(code: string): boolean {
  return pressedThisFrame.has(code);
}

export function heldKeys(): string[] {
  return [...held];
}

// Call once at the end of every update step.
export function endFrame(): void {
  pressedThisFrame.clear();
}
