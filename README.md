# The Cabin: walkable 3D model

**Live:** https://dimichgh.github.io/cabin-walkthrough/

This is a walkable 3D model of a lakefront cabin, rebuilt from its published construction drawings. You can:
- walk through it in first person, stairs included, from the basement up to the second floor and the apartment suite;
- switch between **real materials**, **X-ray** and a **hologram** view at any time, inside or outside;
- cut away the roof or upper floors, or slice the house at any height.

The whole site is one self-contained HTML file, `docs/index.html`. three.js, the app and the facts are inline, so it makes no network requests and also opens straight from disk.

## Controls
| | |
|---|---|
| `1` `2` `3` | Real · X-ray · Holo |
| `V` | walk / orbit |
| `W A S D`, mouse | walk and look (click to lock the pointer, or drag) · `Shift` runs |
| double-click a floor | start walking from that spot |
| phone | drag the left side to move, the right side to look |

## How it was built
- Footprints, basement rooms and the stair come from the foundation plan (A201).
- Heights and the 8:12 gables come from the elevations and sections (A401, A501).
- The massing was checked against the published perspectives and the cut-away building section.
- The first- and second-floor plans were never published. On those floors, only the rooms that a section cut fixes in place are walled. The rest is left open and labelled as not published.
- The info cards cite facts read from the sheets. The source text is in `data/cabin.js`.
- On orientation, the plan's north arrow and the elevation titles disagree. The model follows the north arrow, which the site plan and the section also support: the terrace faces north, the lake is to the west, and the garage door faces east.

## Build
```bash
npm install
npm run build      # → docs/index.html
npm test           # headless Chrome: walking routes, input, info cards, zero external requests
```

## Credits
This is an independent study model, not affiliated with the architects. The design and the construction drawings belong to their authors; the drawing set was published by Bob Borson on *Life of an Architect* as "The Cabin Project". No drawing images are included in this repository.
