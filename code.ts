// ---- color math (0–255 space) ----

type RGB255 = { r: number; g: number; b: number };
type Lab = { L: number; a: number; b: number };

function hexToRgb(hex: string): RGB255 {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function rgbToXyz({ r, g, b }: RGB255) {
  const R = linearize(r),
    G = linearize(g),
    B = linearize(b);
  return {
    x: R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    y: R * 0.2126729 + G * 0.7151522 + B * 0.072175,
    z: R * 0.0193339 + G * 0.119192 + B * 0.9503041,
  };
}

const WHITE = { x: 0.95047, y: 1.0, z: 1.08883 };

function rgbToLab(rgb: RGB255): Lab {
  const { x, y, z } = rgbToXyz(rgb);
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : (903.3 * t + 16) / 116;
  const fx = f(x / WHITE.x),
    fy = f(y / WHITE.y),
    fz = f(z / WHITE.z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

function hexDistance(h1: string, h2: string): number {
  return deltaE(rgbToLab(hexToRgb(h1)), rgbToLab(hexToRgb(h2)));
}

// ---- tokens ----

let TOKENS: Record<string, string> = {
  primary: "#0D6EFD",
  success: "#198754",
  danger: "#DC3545",
  "neutral-900": "#212529",
};

const DRIFT_THRESHOLD = 3;

function flatten(obj: any, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) {
      out[key] = v.toUpperCase();
    } else if (v && typeof v === "object") {
      Object.assign(out, flatten(v, key));
    }
  }
  return out;
}

type Verdict =
  | { kind: "ok"; token: string }
  | { kind: "drift"; token: string; expected: string; distance: number }
  | { kind: "unknown" };

function classify(hex: string): Verdict {
  let best: { name: string; d: number } | null = null;
  for (const [name, value] of Object.entries(TOKENS)) {
    const d = hexDistance(hex, value);
    if (!best || d < best.d) best = { name, d };
  }
  if (!best) return { kind: "unknown" };
  if (best.d === 0) return { kind: "ok", token: best.name };
  if (best.d < DRIFT_THRESHOLD)
    return {
      kind: "drift",
      token: best.name,
      expected: TOKENS[best.name],
      distance: best.d,
    };
  return { kind: "unknown" };
}

// ---- helpers ----

function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

function toHex(c: { r: number; g: number; b: number }): string {
  const h = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function hexToFigmaRgb(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return { r: r / 255, g: g / 255, b: b / 255 };
}

// ---- scan ----

figma.showUI(__html__, { width: 420, height: 520 });

async function scan() {
  await figma.loadAllPagesAsync();
  const nodes = figma.currentPage.findAll(
    (n) => "fills" in n && Array.isArray((n as GeometryMixin).fills)
  );

  const found: { id: string; name: string; hex: string; verdict: Verdict }[] =
    [];
  for (const n of nodes) {
    const fills = (n as GeometryMixin).fills as Paint[];
    for (const f of fills) {
      if (f.type === "SOLID" && f.visible !== false) {
        const hex = toHex(f.color);
        found.push({ id: n.id, name: n.name, hex, verdict: classify(hex) });
      }
    }
  }
  figma.ui.postMessage({
    type: "scan",
    found,
    tokenCount: Object.keys(TOKENS).length,
  });
}

scan();

figma.ui.onmessage = async (msg) => {
  if (msg.type === "select") {
    const node = await figma.getNodeByIdAsync(msg.id);
    if (node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
      figma.currentPage.selection = [node as SceneNode];
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
    }
  }

  if (msg.type === "fix") {
    const node = await figma.getNodeByIdAsync(msg.id);
    if (!node || !("fills" in node)) return;

    const fills = clone((node as GeometryMixin).fills) as Paint[];
    const i = fills.findIndex((f) => f.type === "SOLID");
    if (i === -1) return;

    fills[i] = { ...(fills[i] as SolidPaint), color: hexToFigmaRgb(msg.hex) };
    (node as GeometryMixin).fills = fills;
    scan();
  }

  if (msg.type === "tokens") {
    try {
      const parsed = flatten(JSON.parse(msg.raw));
      if (Object.keys(parsed).length === 0) {
        figma.notify("No hex color values found in that file");
        return;
      }
      TOKENS = parsed;
      scan();
    } catch {
      figma.notify("Could not parse that file as JSON");
    }
  }
};
