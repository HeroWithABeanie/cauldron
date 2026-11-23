// VERBATIM copies of the functions that lived in src/app.js before step 1b-1 (v76). Only used by tests, to check that
// viewtext.ts and chips.ts behave exactly like the old code. The names the old code took from app.js's closure
// (sortMode, listAzDir, rsort, rAzDir, rIDir, rPDir, chips, rchips) are variables of the factory; set() changes them.
// @ts-nocheck
import { isMulti } from '../../src/sorting';
import { shortTitle } from '../../src/names';

export function makeOld(init) {
  var sortMode, listAzDir, rsort, rAzDir, rIDir, rPDir, chips, rchips;
  function set(o) { ({ sortMode, listAzDir, rsort, rAzDir, rIDir, rPDir, chips, rchips } = Object.assign({ sortMode, listAzDir, rsort, rAzDir, rIDir, rPDir, chips, rchips }, o)); }
  set(init);
  function syncChips(){
    chips.forEach(function(c){
      var k=c.dataset.sort,on=k==='a'?(sortMode==='az'||sortMode==='za'):k===sortMode;
      c.classList.toggle('on',on);c.setAttribute('aria-pressed',on);
      if(k==='a'){
        c.classList.toggle('rev',listAzDir==='za');
        c.setAttribute('aria-label','Alphabetical, '+(listAzDir==='za'?'Z to A':'A to Z')+(on?', tap to reverse':', tap to apply'));
      }
    });
  }
  function slideLists(old,top,dir,list){
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce||!list.animate)return;
    old.removeAttribute('id');
    old.setAttribute('aria-hidden','true');
    old.inert=true;
    old.style.cssText='position:absolute;left:0;right:0;top:'+top+'px';
    list.parentNode.insertBefore(old,list);
    var dist=list.offsetWidth,ease='cubic-bezier(.2,.7,.2,1)';
    var oa=old.animate([{transform:'translateX(0)',opacity:1},{transform:'translateX('+(-dir*dist)+'px)',opacity:0}],{duration:320,easing:ease,fill:'forwards'});
    var na=list.animate([{transform:'translateX('+(dir*dist)+'px)',opacity:0},{transform:'translateX(0)',opacity:1}],{duration:320,easing:ease});
    na.onfinish=na.oncancel=function(){oa.cancel();if(old.parentNode)old.parentNode.removeChild(old);};
  }
  function topLine(it){
    if(sortMode==='recipe'){
      if(isMulti(it))return 'Multiple recipes';
      return it.from&&it.from.length===1?shortTitle(it.from[0].name):'';
    }
    if(sortMode==='cat')return it.cat||'';
    return null;
  }
  function ingText(r){var n=(r.items||[]).length;return n+(n===1?' ingredient':' ingredients');}
  function portionsText(n){return 'up to '+n+(n===1?' portion':' portions');}
  function infoLine(r){
    var a=portionsText(r.portions),b=ingText(r);
    return (rsort==='iu'||rsort==='id')?b+' \u00b7 '+a:a+' \u00b7 '+b;
  }
  function syncRChips(){
    rchips.forEach(function(c){
      var k=c.dataset.rsort,on=k==='p'?(rsort==='pu'||rsort==='pd'):k==='i'?(rsort==='iu'||rsort==='id'):k==='a'?(rsort==='az'||rsort==='za'):k===rsort;
      c.classList.toggle('on',on);c.setAttribute('aria-pressed',on);
      if(k==='a'){
        c.classList.toggle('rev',rAzDir==='za');
        c.setAttribute('aria-label','Alphabetical, '+(rAzDir==='za'?'Z to A':'A to Z')+(on?', tap to reverse':', tap to apply'));
      }
      if(k==='i'){
        c.classList.toggle('desc',rIDir==='id');
        c.setAttribute('aria-label','Ingredients, '+(rIDir==='id'?'descending':'ascending')+(on?', tap to reverse':', tap to apply'));
      }
      if(k==='p'){
        c.classList.toggle('desc',rPDir==='pd');
        c.setAttribute('aria-label','Portions, '+(rPDir==='pd'?'descending':'ascending')+(on?', tap to reverse':', tap to apply'));
      }
    });
  }
  return { set, syncChips, slideLists, topLine, ingText, portionsText, infoLine, syncRChips };
}
