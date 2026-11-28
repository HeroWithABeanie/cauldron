// VERBATIM copy of the font fitting code as it was in src/app.js before step 1c-8c (the file as it was after step 1c-8b): lines 86-95.
// Wrapped in a factory because in app.js it is a statement of the big closure; fitAll and fitRTiles are passed in.
// Generated with sed from the old file, see the test.
// @ts-nocheck
export function makeOldFontFit(env) {
  var fitAll=env.fitAll,fitRTiles=env.fitRTiles;
  if(document.fonts){
    document.fonts.addEventListener('loadingdone',function(){fitAll();fitRTiles();});
    // Load every weight we use (with accented sample text so the right subsets arrive) and re-fit once they are all in.
    var fitTiles=function(){fitAll();fitRTiles();};
    var sample='Skånemejerier crème fraîche Pågen Råg Æblegrød';
    var weights=['500','600','700'].map(function(w){return document.fonts.load(w+' 24px "Playpen Sans"',sample);});
    Promise.all(weights).then(fitTiles,fitTiles);
    document.fonts.ready.then(fitTiles);
    window.addEventListener('load',function(){fitTiles();setTimeout(fitTiles,300);setTimeout(fitTiles,1200);});
  }
}
