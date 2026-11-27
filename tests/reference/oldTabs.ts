// VERBATIM copy of the code that was in src/app.js before step 1c-6c (after 1c-6b, 548 lines): switchView and the tab buttons (lines 187-214).
// Wrapped in a factory because in app.js these are variables of the big closure; what they use comes in through env. The lines that are not a
// copy are the header and the return: currentView and sliding are plain variables in app.js that other code reads, so the test reads them through get().
// @ts-nocheck

export function makeOldTabs(env) {
  var syncClear=env.syncClear,updateRow=env.updateRow,closeSearch=env.closeSearch,closeOpenSwipe=env.closeOpenSwipe,setSwapAll=env.setSwapAll,fitAll=env.fitAll,fitRTiles=env.fitRTiles,animateTabIcon=env.animateTabIcon;
  var currentView=env.currentView,sliding=env.sliding;
  function switchView(v){
    closeOpenSwipe();
    var from=views[currentView],to=views[v],dir=v==='recipes'?1:-1;
    currentView=v;
    syncClear();
    updateRow(v);
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    to.hidden=false;
    setSwapAll();fitAll();fitRTiles();
    if(reduce||!to.animate){from.hidden=true;return;}
    sliding=true;
    from.style.cssText='position:absolute;top:0;left:0;right:0;bottom:0';
    var ease='cubic-bezier(.2,.7,.2,1)';
    var fa=from.animate([{transform:'translateX(0)',opacity:1},{transform:'translateX('+(-dir*100)+'%)',opacity:0}],{duration:320,easing:ease,fill:'forwards'});
    var ta=to.animate([{transform:'translateX('+(dir*100)+'%)',opacity:0},{transform:'translateX(0)',opacity:1}],{duration:320,easing:ease});
    ta.onfinish=ta.oncancel=function(){from.hidden=true;from.style.cssText='';fa.cancel();sliding=false;};
  }

  var tabs=document.querySelectorAll('.tab'),
      views={list:document.getElementById('view-list'),recipes:document.getElementById('view-recipes')};
  tabs.forEach(function(tb){tb.addEventListener('click',function(){
    var v=tb.dataset.view;
    if(v===currentView||sliding)return;
    closeSearch(false);
    animateTabIcon(v);
    tabs.forEach(function(x){var on=x===tb;x.setAttribute('aria-selected',on);x.classList.toggle('on',on);});
    switchView(v);
  });});
  return {switchView:switchView,get:function(){return {currentView:currentView,sliding:sliding};}};
}
