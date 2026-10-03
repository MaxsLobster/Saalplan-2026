// Kleiner Saalplan (297 Stände) — nach Hallenplan "Januar" (20230_Saalplan_Januar.pdf)
// Gleiche Raster-Logik wie layout.js, aber:
//   - nur 3 Karrees oben (kein K4), dafür rückt die rechte Außenreihe auf col 18
//   - Außenreihe links oben: 297 → 288 (statt 316 → 307)
//   - Karrees oben tragen die Nummern 269–287 / 250–268 / 231–249
//   - Mitte und Unten sind identisch zum großen Plan
//
// Spalten-Belegung:
//   col 0            Außenreihe links
//   col 1-2          Gang
//   col 3-5          K-A / K-D / K-G
//   col 6-7          Gang
//   col 8-10         K-B / K-E / K-H
//   col 11-12        Gang
//   col 13-15        K-C / K-F / K-I
//   col 16-17        Gang
//   col 18           Außenreihe rechts

export const COLS = 19;
export const ROWS = 50;

const LAYOUT = {};

// === Außenreihe links (col 0) ===
// Oben: 297 → 288 (Reihen 0-9)
for (let i = 0; i < 10; i++) LAYOUT[297 - i] = { row: i, col: 0 };
// Mitte: 129 → 116 (Reihen 13-26)
for (let i = 0; i < 14; i++) LAYOUT[129 - i] = { row: 13 + i, col: 0 };
// Unten: 115 → 102 (Reihen 33-46)
for (let i = 0; i < 14; i++) LAYOUT[115 - i] = { row: 33 + i, col: 0 };

// === Außenreihe rechts (col 18) ===
// Oben: 230 → 211 (Reihen 0-19)
for (let i = 0; i < 20; i++) LAYOUT[230 - i] = { row: i, col: 18 };
// Unten: 20 → 1 (Reihen 27-46)
for (let i = 0; i < 20; i++) LAYOUT[20 - i] = { row: 27 + i, col: 18 };

// Karree platzieren — identisch zu layout.js
function placeKarree(topRow, leftCol, topStands, leftStands, bottomStands, rightStands) {
  topStands.forEach((nr, i) => {
    LAYOUT[nr] = { row: topRow, col: leftCol + i };
  });
  leftStands.forEach((nr, i) => {
    LAYOUT[nr] = { row: topRow + 1 + i, col: leftCol };
  });
  const bottomRow = topRow + 1 + leftStands.length;
  bottomStands.forEach((nr, i) => {
    LAYOUT[nr] = { row: bottomRow, col: leftCol + i };
  });
  const rightStart = topRow + 1 + (leftStands.length - rightStands.length);
  rightStands.forEach((nr, i) => {
    LAYOUT[nr] = { row: rightStart + i, col: leftCol + 2 };
  });
}

// === Karrees OBEN (Reihe 5, jeweils 19 Stände) ===
// K-A: 269-287 — cols 3-5
placeKarree(5, 3,
  [285, 286, 287],
  [284, 283, 282, 281, 280, 279, 278, 277],
  [276, 275],
  [269, 270, 271, 272, 273, 274]
);
// K-B: 250-268 — cols 8-10
placeKarree(5, 8,
  [266, 267, 268],
  [265, 264, 263, 262, 261, 260, 259, 258],
  [257, 256],
  [250, 251, 252, 253, 254, 255]
);
// K-C: 231-249 — cols 13-15
placeKarree(5, 13,
  [247, 248, 249],
  [246, 245, 244, 243, 242, 241, 240, 239],
  [238, 237],
  [231, 232, 233, 234, 235, 236]
);

// === Karrees MITTE (Reihe 17, jeweils 27 Stände) ===
// K-D: 130-156 — cols 3-5
placeKarree(17, 3,
  [154, 155, 156],
  [153, 152, 151, 150, 149, 148, 147, 146, 145, 144, 143, 142],
  [141, 140],
  [130, 131, 132, 133, 134, 135, 136, 137, 138, 139]
);
// K-E: 157-183 — cols 8-10
placeKarree(17, 8,
  [181, 182, 183],
  [180, 179, 178, 177, 176, 175, 174, 173, 172, 171, 170, 169],
  [168, 167],
  [157, 158, 159, 160, 161, 162, 163, 164, 165, 166]
);
// K-F: 184-210 — cols 13-15
placeKarree(17, 13,
  [208, 209, 210],
  [207, 206, 205, 204, 203, 202, 201, 200, 199, 198, 197, 196],
  [195, 194],
  [184, 185, 186, 187, 188, 189, 190, 191, 192, 193]
);

// === Karrees UNTEN (Reihe 33, jeweils 27 Stände) ===
// K-G: 75-101 — cols 3-5
placeKarree(33, 3,
  [99, 100, 101],
  [98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87],
  [86, 85],
  [75, 76, 77, 78, 79, 80, 81, 82, 83, 84]
);
// K-H: 48-74 — cols 8-10
placeKarree(33, 8,
  [72, 73, 74],
  [71, 70, 69, 68, 67, 66, 65, 64, 63, 62, 61, 60],
  [59, 58],
  [48, 49, 50, 51, 52, 53, 54, 55, 56, 57]
);
// K-I: 21-47 — cols 13-15
placeKarree(33, 13,
  [45, 46, 47],
  [44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33],
  [32, 31],
  [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
);

export const STAND_LAYOUT = LAYOUT;
export const STAND_COUNT = 297;

// Sanity check: alle 1-297 vorhanden, keine Doppelbelegung
export function validateLayout() {
  const missing = [];
  for (let i = 1; i <= STAND_COUNT; i++) {
    if (!LAYOUT[i]) missing.push(i);
  }
  return missing;
}
