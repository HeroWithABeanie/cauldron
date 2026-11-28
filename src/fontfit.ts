// Keeps the tile names fitted while fonts arrive: the handwriting font loads after the first render, so the names are fitted again when
// the fonts finish loading and a few times after the page has loaded. The code is the code that used to be in app.js (step 1c-8c);
// only the typing is new.

/** What it needs from the app (both come from tiles.ts). */
export interface FontFitCtx {
  fitAll(): void;
  fitRTiles(): void;
}

export function watchFonts(ctx: FontFitCtx): void {
  const fitAll = ctx.fitAll, fitRTiles = ctx.fitRTiles;
  // Re-fit tile names every time a font finishes loading (the handwriting font arrives after the first render).
  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', function () { fitAll(); fitRTiles(); });
    // Load every weight we use (with accented sample text so the right subsets arrive) and re-fit once they are all in.
    const fitTiles = function (): void { fitAll(); fitRTiles(); };
    const sample = 'Skånemejerier crème fraîche Pågen Råg Æblegrød';
    const weights = ['500', '600', '700'].map(function (w) { return document.fonts.load(w + ' 24px "Playpen Sans"', sample); });
    Promise.all(weights).then(fitTiles, fitTiles);
    document.fonts.ready.then(fitTiles);
    window.addEventListener('load', function () { fitTiles(); setTimeout(fitTiles, 300); setTimeout(fitTiles, 1200); });
  }
}
