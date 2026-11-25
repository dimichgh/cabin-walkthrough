# The Cabin: walkable 3D model

**Live:** https://dimichgh.github.io/cabin-walkthrough/

This is a walkable 3D model of a lakefront cabin, rebuilt from its published construction drawings. You can:
- walk through it in first person, stairs included, from the basement up to the second floor and the apartment suite;
- switch between **real materials**, **X-ray** and a **hologram** view at any time, inside or outside;
- switch to **Photo**, a path-traced photorealistic mode with sunlight and sky light bouncing through the rooms, soft shadows, glass that reflects as well as transmits, and reflective water. You can also set the time of day and save the image;
- cut away the roof or upper floors, or slice the house at any height.

The whole site is one self-contained HTML file, `docs/index.html`. three.js, the app and the facts are inline, so it makes no network requests and also opens straight from disk.

## Controls
| | |
|---|---|
| `1` `2` `3` | Real · X-ray · Holo |
| `P` | Photo (path traced): hold the camera still and the frame refines over a few seconds to a minute. Exposure, Sun (time of day) and Save image are in the photo bar |
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

## Photo mode
Photo mode uses progressive path tracing via [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer), bundled into the page. Here is what it does:
- It draws the sky procedurally as an HDR sky with a physically sized sun, so sunlight and skylight enter through the real window openings and bounce indoors.
- Glass is modelled as thin panes, painted metal as paint, and the lake as water.
- While the camera moves you see a fast preview. When it stops, the frame converges, and a denoise filter smooths the first samples.
- Exposure is automatic, like a camera: it is set for outdoors or indoors and then adapts to how bright the frame is, so the basement opens up and sunny views don't blow out. The Exposure slider adds compensation in stops.

Photo mode needs a reasonably modern GPU. Entering it takes a few seconds while the scene is prepared, and so does each cutaway change.

## Build
```bash
npm install
npm run build      # → docs/index.html
npm test           # headless Chrome: walking routes, input, info cards, zero external requests
node house/test.mjs --gpu --only photo   # photo mode on the real GPU (macOS Metal)
```

## Credits
This is an independent study model, not affiliated with the architects. The design and the construction drawings belong to their authors; the drawing set was published by Bob Borson on *Life of an Architect* as "The Cabin Project". No drawing images are included in this repository.
