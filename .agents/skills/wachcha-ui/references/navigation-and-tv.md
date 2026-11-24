# Navigation, View Transitions & TV Spatial Ergonomics

## Hash Router & History (`src/lib/navigation.ts`)

- Routes: `#/`, `#/catalog?category=...`, `#/search?q=...`, `#/title/<provider>/<id>`, `#/watch/<provider>/<id>?ep=...&voice=...`, `#/library`, `#/sources`, `#/settings`.
- Tags History API states with session ID & stack index in `sessionStorage` to enable native Back/Forward buttons, `Alt+Left`/`Alt+Right`, and `Cmd+[`/`Cmd+]`.
- `leavePlayback()` returns cleanly via `history.back()` when coming from the title's Detail screen.

## View Transitions & Scroll Restoration

- Only `main.media-scroll` scrolls inside the fixed viewport shell; `MediaNavigation` remains mounted and translates smoothly off-canvas during immersive playback without causing layout reflow.
- Uses `document.startViewTransition` when available and animations are enabled; degrades gracefully when `prefers-reduced-motion: reduce` is active.
- `page-scroll.ts` remembers scroll offsets per route and uses `ResizeObserver` to restore scroll once async shelf/grid content settles, stopping immediately upon user wheel/touch input.

## Keyboard & D-Pad Spatial Navigation (`src/lib/directional-navigation.ts`)

- Arrow keys move geometrically to the closest focusable `[data-nav-item]` in the requested direction.
- Global shortcuts (disabled inside `<input>`/`<textarea>`): `/` focuses Search, `Escape` closes drawers/sheets or navigates back, `Space`/`K` toggles play/pause, `J`/`L` seeks ±10s, `F` fullscreen, `M` mute, `S` skip intro.
