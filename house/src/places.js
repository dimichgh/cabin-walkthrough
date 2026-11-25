// Labelled places: where the tag sits, what it is, which verified facts (data/cabin.js node) back it,
// and where "walk here" puts you (feet position + facing). yaw: 0 = north, +90° = west, −90° = east, 180° = south.
import { LV } from './house.js';
const { FFB, FF1, FF2, FFG, TERR, GRADE } = LV;
const D = Math.PI / 180;

// placement: 'drawn' = position fixed by the published sheets; 'schematic' = named on the sheets/article but
// the plan that would place it was not published, so it is shown open/indicative.
export const PLACES = [
  // site
  { id: 'approach', level: 'site', title: 'Approach & drive', pos: [70, 4, 18], node: 'forest', placement: 'drawn',
    note: 'Gravel drive to garage door 111A; the entry court sits between the garage block and the main bar.', walk: { x: 74, z: -10, y: GRADE, yaw: 108 * D } },
  { id: 'lakeside', level: 'site', title: 'Lake side', pos: [-30, 4, 8], node: 'lake', placement: 'drawn',
    note: 'The lake lies west of the cabin on the site plan. This is the face with the long ribbon window, drawn on 3/A401, which is titled EXTERIOR ELEVATION – EAST. The A201 north arrow and the A401 titles disagree; this model follows the north arrow, which the site plan and the building section also support.', walk: { x: -42, z: 6, y: GRADE, yaw: -90 * D } },

  // basement (1/A201)
  { id: 'gathering', level: 'B', title: 'Gathering 001', pos: [18, FFB + 4.5, 25], node: 'gathering', placement: 'drawn', walk: { x: 18, z: 27, y: FFB, yaw: 85 * D } },
  { id: 'laundry', level: 'B', title: 'Laundry 002', pos: [23, FFB + 4.5, 5], node: 'laundry', placement: 'drawn', walk: { x: 23.5, z: 7.0, y: FFB, yaw: 0 } },
  { id: 'mech', level: 'B', title: 'Mechanical 003', pos: [4, FFB + 4.5, 6], node: 'mech', placement: 'drawn', walk: { x: 4.6, z: 14.5, y: FFB, yaw: 0 } },
  { id: 'egress', level: 'B', title: 'Egress window 0.1', pos: [3.6, FFB + 6.5, 24.4], node: 'lightwells', placement: 'drawn' },

  // first floor
  { id: 'entry', level: '1', title: 'Entry 105', pos: [27.2, 5, 6.5], node: 'entry', placement: 'drawn', walk: { x: 31.5, z: 5.8, y: TERR, yaw: 90 * D } },
  { id: 'hallway', level: '1', title: 'First-floor hallway', pos: [31, 5, 21], node: 'entry', placement: 'drawn',
    note: 'The single-storey link between the main bar and the garage block (1/A501 cut).', walk: { x: 31, z: 12.5, y: FF1, yaw: 180 * D } },
  { id: 'stair', level: '1', title: 'Stair · steel plate wall', pos: [15, 6, 11], node: 'stair', placement: 'drawn',
    note: 'Two stacked straight flights, 18 risers each, both rising west, beside the two-storey ST-1 steel plate wall (A201 stair note, building section).', walk: { x: 25.5, z: 11, y: FF1, yaw: 90 * D } },
  { id: 'guest', level: '1', title: 'Ground-floor rooms', pos: [14, 5, 24], node: 'guest', placement: 'schematic',
    note: 'The first-floor plan was not published. The article places guest bedrooms here; this model leaves the floor open rather than invent walls. The bed and lamps (Furniture, F) are illustrative only.', walk: { x: 14, z: 23, y: FF1, yaw: 90 * D } },
  { id: 'terrace', level: '1', title: 'Covered terrace', pos: [16, 4, -8], node: 'terrace', placement: 'drawn', walk: { x: 18, z: -3, y: TERR, yaw: 0 } },
  { id: 'fireplace', level: '1', title: 'Outdoor fireplace', pos: [7, 6.5, -15.2], node: 'fireplace', placement: 'drawn' },
  { id: 'garage', level: '1', title: 'Garage · door 111A', pos: [47, 4, 20], node: 'garage', placement: 'drawn', walk: { x: 42, z: 21, y: FFG, yaw: -90 * D } },
  { id: 'ipe', level: '1', title: 'Ipe rain screen', pos: [-1.2, 3.5, 12], node: 'lower_wall', placement: 'drawn' },

  // second floor
  { id: 'living', level: '2', title: 'Living & kitchen', pos: [13, FF2 + 4.5, 1], node: 'living', placement: 'schematic',
    note: 'Lifted over the terrace behind the ribbon window. Kitchen and furniture positions are indicative; the second-floor plan was not published.', walk: { x: 12.5, z: 6.8, y: FF2, yaw: 100 * D } },
  { id: 'patio', level: '2', title: 'Screened patio', pos: [6, FF2 + 4.5, -11], node: 'windows', placement: 'drawn',
    note: 'North-west corner of the box, over the terrace: screen opening 2.18 on the lake face and a screened opening in the north gable (2/A501 cut, A401).', walk: { x: 11, z: -9, y: FF2, yaw: 68 * D } },
  { id: 'upmech', level: '2', title: 'Mechanical · pantry', pos: [19.5, FF2 + 4.5, -11], node: 'mech', placement: 'drawn',
    note: 'The 2/A501 cut shows mechanical in the middle and the pantry on the east side, between the screened patio and the garage side.' },
  { id: 'powder', level: '2', title: 'Upper powder', pos: [21.6, FF2 + 4.5, 11], node: 'stair', placement: 'drawn', note: 'An upper powder room sits beside the stair (1/A501).' },
  { id: 'rooms2', level: '2', title: 'Rooms 201 · 203', pos: [12, FF2 + 4.5, 24], placement: 'schematic',
    note: 'Doors 201 and 203 are tagged on the sheets, but the second-floor plan was not published, so this end is left open. The bedroom and study furniture (Furniture, F) is illustrative only.', walk: { x: 12, z: 20, y: FF2, yaw: 180 * D } },
  { id: 'gallery', level: '2', title: 'Gallery', pos: [31, FF2 + 4.5, 19], node: 'gallery', placement: 'drawn', walk: { x: 31, z: 13.5, y: FF2, yaw: 180 * D } },
  { id: 'suite', level: '2', title: 'Apartment suite', pos: [47, FF2 + 4.5, 21], node: 'suite', placement: 'schematic',
    note: 'Over the garage. The kitchenette wall sits under the big north window (building section); bath, shower and closets are on the sheets but their plan positions were not published. The furniture is illustrative.', walk: { x: 45, z: 25, y: FF2, yaw: 0 } },
  { id: 'ribbon', level: '2', title: 'Ribbon window', pos: [-2.5, 16.5, 6], node: 'windows', placement: 'drawn' },
  { id: 'metal', level: '2', title: 'Metal panel walls', pos: [29.2, 13, -9], node: 'upper_wall', placement: 'drawn' },

  // roof
  { id: 'roof', level: 'R', title: '8:12 standing-seam roof', pos: [14, 31.5, 16], node: 'roof', placement: 'drawn' },
  { id: 'chimney', level: 'R', title: 'Aluminum flues', pos: [7.05, 35.6, -16.35], node: 'chimney', placement: 'drawn' },
];

// fixed camera views (orbit mode); 'p01'…'p05' approximate the published perspectives
export const VIEWS = {
  aerial: { pos: [-62, 52, 92], target: [24, 6, 8] },
  p01: { pos: [64, 11, -42], target: [22, 9, 6] },
  p02: { pos: [112, 6, -10], target: [30, 11, 14] },
  p03: { pos: [-62, 44, -58], target: [14, 8, 4] },
  p04: { pos: [-58, 16, 86], target: [16, 9, 10] },
  p05: { pos: [-30, 78, 104], target: [24, 4, 12] },
  plan: { pos: [27, 260, 9.001], target: [27, 0, 9], up: [0, 0, -1], fov: 18 },
  elevLake: { pos: [-420, 12, 9], target: [14, 12, 9], fov: 7.5 },
  lakeOut: { pos: [-40, 34, 30], target: [-420, -14, -10], fov: 55 }, // over the terrace edge toward the lake (no button; used by tests)
  elevEast: { pos: [460, 12, 9], target: [30, 12, 9], fov: 7.5 },
  section: { pos: [27, 10, 260], target: [27, 10, 10], fov: 14 },
};
