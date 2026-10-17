export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface RepairRegions { readonly inset: Rect; readonly dock: Rect; readonly scene: Rect; readonly drawer: Rect }

// PLAN revision 2 bounds; shared by render/HUD rather than encoded in domain.
export function repairRegions(width: number, height: number): RepairRegions {
  if (width >= 1000) {
    const sx = width / 1920, sy = height / 1080;
    const rect = (x: number, y: number, w: number, h: number): Rect => ({ x: x * sx, y: y * sy, width: w * sx, height: h * sy });
    return { inset: rect(1392, 612, 504, 444), dock: rect(24, 888, 1344, 168), scene: rect(560, 140, 820, 720), drawer: rect(24, 624, 504, 432) };
  }
  const wide = width >= 800, top = wide ? 64 : 60, paneHeight = wide ? 240 : 235;
  return { inset: { x: 8, y: top, width: 196, height: paneHeight }, dock: { x: 8, y: height - 72, width: width - 16, height: 64 },
    scene: { x: wide ? 220 : 216, y: top, width: wide ? 460 : 390, height: paneHeight }, drawer: { x: 8, y: top, width: 196, height: paneHeight } };
}
