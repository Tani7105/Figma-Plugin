figma.showUI(__html__, { width: 380, height: 520 });

function toHex({ r, g, b }: RGB): string {
  const h = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}

async function scan() {
  await figma.loadAllPagesAsync();
  const nodes = figma.currentPage.findAll(
    (n) => "fills" in n && Array.isArray(n.fills)
  );

  const found: { id: string; name: string; hex: string }[] = [];
  for (const n of nodes) {
    const fills = (n as GeometryMixin).fills as Paint[];
    for (const f of fills) {
      if (f.type === "SOLID" && f.visible !== false) {
        found.push({ id: n.id, name: n.name, hex: toHex(f.color) });
      }
    }
  }
  figma.ui.postMessage({ type: "scan", found });
}

scan();
