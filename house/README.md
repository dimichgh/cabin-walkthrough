# The Cabin: walkable model

`dist/cabin-house.html` is one self-contained file. three.js, the app and the facts are all inline, so it makes no network requests. Open it straight from disk, or publish it to any static host.

## What it does
- **Photo** (key `P`): path-traced, photorealistic frames that converge while the camera is still. Choose **Day / Dusk / Night**: at dusk and night the interior and exterior lights and the outdoor fire come on. Use the Exposure and Sun sliders, then Save image.
- **Furniture** (key `F`) and **Car** (key `C`): illustrative furniture, lamps and an SUV on the drive, each switchable. Their walk colliders switch with them.
- **Real / X-ray / Holo** (keys `1 2 3`): switch between real materials and two see-through views. The real materials are procedural Ipe rain screen, standing-seam metal, glass, concrete, flagstone and white oak.
- **Orbit / Walk** (key `V`):
  - Walk with `WASD`, look with the mouse (click to lock the pointer, or drag), and run with `Shift`.
  - Stairs work.
  - Double-click any floor in orbit view to start walking from that spot.
  - On a phone, drag the left side of the screen to move and the right side to look.
- **Cutaways**: Whole, Roof off, Ground floor and Basement. A horizontal **Cut** slider gives plan sections.
- **Labels and info cards**: each place cites the verified sheet facts from `../data/cabin.js`. A green badge means the position comes from the drawings. Amber means the room is named on the sheets but its plan was not published, so the area is left open.

## Sources and orientation
- Footprints, basement rooms and the stair come from the A201 foundation plan (18R / 17T, 10'-4 1/4").
- Heights come from A401 and A501: second floor at 10'-4 1/4", box at 20'-5 3/8", 8:12 gables.
- The cut-away building section and the five perspectives supplied the rest.
- North is the terrace end, the lake is to the west, and the garage door faces east. Three sources agree on this: the plan's north arrow, the site plan and the building section.
- The A401 elevation titles disagree with the A201 north arrow. The model follows the arrow, so the sheet titled EXTERIOR ELEVATION – EAST is read as the west (lake) face, and the info cards say so.
- The first- and second-floor plans were withheld. On those floors, only the rooms that a section cut fixes in place are walled.

## Build and verify
```bash
node build.mjs          # → dist/cabin-house.html (+ copy in ../dist/)
node test.mjs           # headless Chrome check (see below)
node test.mjs --file    # the same check, loading the file from disk (file://)
```
`test.mjs` does the following:
- fails on any external request;
- walks six routes with the real movement code (entry, stair, gallery, suite, basement rooms, garage, terrace and around the site);
- checks that every walk-to spot is clear;
- opens every info card;
- writes screenshots to `.shots/`.

Source files are in `src/`:
- `house.js`: geometry, colliders and walk surfaces;
- `materials.js`: procedural textures;
- `site.js`: terrain, lake and drive;
- `trees.js`: procedural spruces, pines, birches and shrubs with bark and needle/leaf textures drawn in code, with lighter variants for distant trees;
- `walk.js`: first-person physics;
- `places.js`: labels and views;
- `photo.js`: photo mode (path tracer setup, day / dusk / night skies, night lights, glass, paint and lamp materials, denoise and despeckle);
- `furniture.js`: illustrative furniture, light fittings and the night lighting plan;
- `car.js`: the procedural SUV;
- `kit.js`: the small modelling kit both use (rounded boxes, lathes, colliders, merging);
- `main.js`: the app.
