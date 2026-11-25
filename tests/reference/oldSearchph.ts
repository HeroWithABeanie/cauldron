// VERBATIM copy of the search hint code as it was in src/app.js before step 1c-1 (v76): the variables and stopPh and startPh (lines
// 767-781; the variables of line 766 other than the two elements are declared here), plus the two expressions that used phAnim and phW
// elsewhere (`if(phAnim)phAnim.pause();` when the search bar closes, and `searchPhEl.clientWidth!==phW` in the resize handler), wrapped
// as pause() and resized(). In app.js, searchOpen and searchInput are variables of the closure; here they are read from `state`
// (the only change to the copied lines: the name searchOpen became isOpen()).
// @ts-nocheck
import { noMotion } from '../../src/ui';

export function makeOldHint(searchPhEl, searchPhText, state) {
  var phAnim=null,phW=0,PH_HOLD=1200,PH_END=900,PH_SPEED=0.045;
  var searchInput={get value(){return state.value;}};
  function isOpen(){return state.open;}
  function stopPh(){if(phAnim){phAnim.cancel();phAnim=null;}}
  function startPh(){
    stopPh();
    if(!isOpen()||searchInput.value||noMotion()||!searchPhText.animate)return;
    phW=searchPhEl.clientWidth;
    var dist=searchPhText.scrollWidth-phW;
    if(dist<=2)return;
    var move=dist/PH_SPEED,total=PH_HOLD+move+PH_END,a='translateX(0)',b='translateX(-'+dist+'px)';
    phAnim=searchPhText.animate([
      {transform:a,offset:0},
      {transform:a,offset:PH_HOLD/total},
      {transform:b,offset:(PH_HOLD+move)/total},
      {transform:b,offset:1}
    ],{duration:total,iterations:Infinity,easing:'linear'});
  }
  function pause(){if(phAnim)phAnim.pause();}
  function resized(){return searchPhEl.clientWidth!==phW;}
  return { start: startPh, stop: stopPh, pause: pause, resized: resized };
}
