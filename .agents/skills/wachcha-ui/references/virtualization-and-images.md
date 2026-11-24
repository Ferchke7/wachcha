# `VirtualGrid`, `ChoiceTabs` & `CachedImage`

## `VirtualGrid` (`src/ui/VirtualGrid.tsx`)

- Lists with `items.length <= 60` render directly without virtualization overhead.
- Lists over 60 items calculate column count and row pitch from CSS Grid metrics inside `.media-scroll`, rendering visible rows plus **3 overscan rows** above and below.
- Tracks focused item index and **pins** it in DOM even if scrolled temporarily outside the overscan window so keyboard and TV D-pad focus never resets to `document.body`.

## `ChoiceTabs` (`src/ui/ChoiceTabs.tsx`)

- Uses standard `onClick` (never fires actions on `pointerdown`; CSS `:active` handles press visual state).
- Immediately updates local selected highlight before parent URL/API fetches settle, preventing perceived lag when switching categories, seasons, or dubs.
- Re-clicking the already active value is a no-op.

## `CachedImage` (`src/ui/CachedImage.tsx`)

- Defers loading until within `160px` of the scroll viewport (`IntersectionObserver`).
- Consults synchronous RAM cache first (`peekImage`), then IndexedDB `ArrayBuffer` store, then FIFO queue (max 6 concurrent fetches, max 2 background revalidations).
- Renders a subtle obsidian shimmer placeholder while loading and never shifts card aspect ratio (`aspect-ratio: 2 / 3` for posters, `16 / 9` for backdrops).
