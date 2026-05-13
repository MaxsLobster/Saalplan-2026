// Mapping: Standnummer -> {row, col} im Raster
// 24 Spalten breit x 47 Zeilen hoch, mit Gängen zwischen Karrees und Außenreihen.
//
// Spalten-Belegung:
//   col 0            Außenreihe links
//   col 1-2          Gang (Walkway)
//   col 3-5          K1 / K5 / K8
//   col 6-7          Gang
//   col 8-10         K2 / K6 / K9
//   col 11-12        Gang
//   col 13-15        K3 / K7 / K10
//   col 16-17        Gang
//   col 18-20        K4 (nur oben)
//   col 21-22        Gang
//   col 23           Außenreihe rechts

export const COLS = 24;
// 47 Reihen für die Stände + 3 zusätzliche Reihen unten als Abstand zur
// EXIT/ENTRANCE-Beschriftung (wie im PDF deutlich abgesetzt unten am Rand).
export const ROWS = 50;

const LAYOUT = {};

// === Außenreihe links (col 0) ===
// Oben: 316 → 307 (Reihen 0-9)
for (let i = 0; i < 10; i++) LAYOUT[316 - i] = { row: i, col: 0 };
// Mitte: 129 → 116 (Reihen 13-26)
for (let i = 0; i < 14; i++) LAYOUT[129 - i] = { row: 13 + i, col: 0 };
// Unten: 115 → 102 (Reihen 33-46)
for (let i = 0; i < 14; i++) LAYOUT[115 - i] = { row: 33 + i, col: 0 };

// === Außenreihe rechts (col 23) ===
// Oben: 230 → 211 (Reihen 0-19)
for (let i = 0; i < 20; i++) LAYOUT[230 - i] = { row: i, col: 23 };
// Unten: 20 → 1 (Reihen 27-46)
for (let i = 0; i < 20; i++) LAYOUT[20 - i] = { row: 27 + i, col: 23 };

// Helfer: ein Karree platzieren (3 Spalten breit, Walkway in der Mitte).
// U-Form öffnet sich NACH UNTEN — wie im Original-PDF:
//   - Top:    3 Stände entlang der Oberkante (geschlossen)
//   - Left:   Stände an der linken Wand, beginnt direkt unter Top-Left
//   - Right:  Stände an der rechten Wand, ENDET gemeinsam mit der linken Wand
//             am Bottom (= unten bündig). Da Right weniger Stände hat als Left,
//             beginnt Right erst weiter unten → Eingangs-Lücke oben rechts.
//   - Bottom: 2 Stände unten — der 3. Spot bleibt offen (Öffnung nach unten).
//
// Numerierung läuft im PDF gegen den Uhrzeigersinn:
//   Right-down, Bottom-rechts→links, Left-up, Top-links→rechts.
function placeKarree(topRow, leftCol, topStands, leftStands, bottomStands, rightStands) {
  // Oberseite (geschlossen, 3 Stände)
  topStands.forEach((nr, i) => {
    LAYOUT[nr] = { row: topRow, col: leftCol + i };
  });
  // Linke Wand — direkt unter Top-Left, durchgehend runter
  leftStands.forEach((nr, i) => {
    LAYOUT[nr] = { row: topRow + 1 + i, col: leftCol };
  });
  // Bottom (2 Stände, höhere Zahl links — gegen Uhrzeigersinn)
  const bottomRow = topRow + 1 + leftStands.length;
  bottomStands.forEach((nr, i) => {
    LAYOUT[nr] = { row: bottomRow, col: leftCol + i };
  });
  // Rechte Wand — unten bündig mit linker Wand, oben Eingangs-Lücke
  const rightStart = topRow + 1 + (leftStands.length - rightStands.length);
  rightStands.forEach((nr, i) => {
    LAYOUT[nr] = { row: rightStart + i, col: leftCol + 2 };
  });
}

// === Karrees OBEN (Reihe 5, jeweils 19 Stände) ===
// 4 Karrees: K1 K2 K3 K4
// K1: 288-306 — cols 3-5
placeKarree(5, 3,
  [304, 305, 306],
  [303, 302, 301, 300, 299, 298, 297, 296],
  [295, 294],
  [288, 289, 290, 291, 292, 293]
);
// K2: 269-287 — cols 8-10
placeKarree(5, 8,
  [285, 286, 287],
  [284, 283, 282, 281, 280, 279, 278, 277],
  [276, 275],
  [269, 270, 271, 272, 273, 274]
);
// K3: 250-268 — cols 13-15
placeKarree(5, 13,
  [266, 267, 268],
  [265, 264, 263, 262, 261, 260, 259, 258],
  [257, 256],
  [250, 251, 252, 253, 254, 255]
);
// K4: 231-249 — cols 18-20
placeKarree(5, 18,
  [247, 248, 249],
  [246, 245, 244, 243, 242, 241, 240, 239],
  [238, 237],
  [231, 232, 233, 234, 235, 236]
);

// === Karrees MITTE (Reihe 17, jeweils 27 Stände) ===
// 3 Karrees: K5 K6 K7 — keine K4-Position
// K5: 130-156 — cols 3-5
placeKarree(17, 3,
  [154, 155, 156],
  [153, 152, 151, 150, 149, 148, 147, 146, 145, 144, 143, 142],
  [141, 140],
  [130, 131, 132, 133, 134, 135, 136, 137, 138, 139]
);
// K6: 157-183 — cols 8-10
placeKarree(17, 8,
  [181, 182, 183],
  [180, 179, 178, 177, 176, 175, 174, 173, 172, 171, 170, 169],
  [168, 167],
  [157, 158, 159, 160, 161, 162, 163, 164, 165, 166]
);
// K7: 184-210 — cols 13-15
placeKarree(17, 13,
  [208, 209, 210],
  [207, 206, 205, 204, 203, 202, 201, 200, 199, 198, 197, 196],
  [195, 194],
  [184, 185, 186, 187, 188, 189, 190, 191, 192, 193]
);

// === Karrees UNTEN (Reihe 33, jeweils 27 Stände) ===
// 3 Karrees: K8 K9 K10 — keine K4-Position
// K8: 75-101 — cols 3-5
placeKarree(33, 3,
  [99, 100, 101],
  [98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87],
  [86, 85],
  [75, 76, 77, 78, 79, 80, 81, 82, 83, 84]
);
// K9: 48-74 — cols 8-10
placeKarree(33, 8,
  [72, 73, 74],
  [71, 70, 69, 68, 67, 66, 65, 64, 63, 62, 61, 60],
  [59, 58],
  [48, 49, 50, 51, 52, 53, 54, 55, 56, 57]
);
// K10: 21-47 — cols 13-15
placeKarree(33, 13,
  [45, 46, 47],
  [44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33],
  [32, 31],
  [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
);

export const STAND_LAYOUT = LAYOUT;

// Sanity check beim Laden: alle 1-316 vorhanden
export function validateLayout() {
  const missing = [];
  for (let i = 1; i <= 316; i++) {
    if (!LAYOUT[i]) missing.push(i);
  }
  return missing;
}
