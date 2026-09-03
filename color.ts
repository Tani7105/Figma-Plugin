export type RGB = { r: number; g: number; b: number }; // 0–255
export type Lab = { L: number; a: number; b: number };

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// sRGB -> linear: undo the gamma encoding
function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// linear RGB -> XYZ (sRGB primaries, D65 white point)
function rgbToXyz({ r, g, b }: RGB) {
  const R = linearize(r),
    G = linearize(g),
    B = linearize(b);
  return {
    x: R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    y: R * 0.2126729 + G * 0.7151522 + B * 0.072175,
    z: R * 0.0193339 + G * 0.119192 + B * 0.9503041,
  };
}

// D65 reference white
const WHITE = { x: 0.95047, y: 1.0, z: 1.08883 };

export function rgbToLab(rgb: RGB): Lab {
  const { x, y, z } = rgbToXyz(rgb);
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : (903.3 * t + 16) / 116;
  const fx = f(x / WHITE.x),
    fy = f(y / WHITE.y),
    fz = f(z / WHITE.z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// CIE76 Delta E: Euclidean distance in Lab
export function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt(
    Math.pow(a.L - b.L, 2) + Math.pow(a.a - b.a, 2) + Math.pow(a.b - b.b, 2)
  );
}

export function hexDistance(h1: string, h2: string): number {
  return deltaE(rgbToLab(hexToRgb(h1)), rgbToLab(hexToRgb(h2)));
}
