figma.showUI(__html__, { width: 320, height: 480 });

async function run() {
  await figma.loadAllPagesAsync();
  const texts = figma.currentPage.findAllWithCriteria({ types: ["TEXT"] });
  figma.ui.postMessage({ type: "count", n: texts.length });
}

run();
