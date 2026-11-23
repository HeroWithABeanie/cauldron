// VERBATIM copy of closeTips, brokenLink, tipButton and WARN_SVG as they were in src/app.js before step 1b-3 (v76). Only used by
// tests, to check that tips.ts and icons.ts behave exactly like the old code.
// @ts-nocheck
import { UNLINK_SVG } from '../../src/icons';

export var oldTips = (function () {
  function closeTips(){
    document.querySelectorAll('.unlinked.show').forEach(function(b){b.classList.remove('show');});
  }
  var WARN_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';
  function brokenLink(cls,fn,note){
    var b=document.createElement('button');b.type='button';b.className='unlinked hovtip'+(cls?' '+cls:'');
    var msg=note||'This item was unlinked from a recipe.';
    b.setAttribute('aria-label',fn?'This item was unlinked from a recipe. Tap to re-link it.':msg);
    b.innerHTML=UNLINK_SVG+'<span class="tip" role="tooltip">'+msg+'</span>';
    if(fn){
      b.classList.add('act');
      // a quick tap still shows the full press animation before the window opens
      b.addEventListener('click',function(ev){
        ev.stopPropagation();
        if(b.classList.contains('pressed'))return;
        b.classList.add('pressed');
        setTimeout(function(){b.classList.remove('pressed');fn();},250);
      });
    }else{
      b.style.cursor='default';
      // not clickable: a tap (or hover with a mouse) shows the tooltip for a few seconds
      b.addEventListener('click',function(ev){
        ev.stopPropagation();
        closeTips();clearTimeout(b._t);
        b.classList.add('show');
        b._t=setTimeout(function(){b.classList.remove('show');},3500);
      });
    }
    return b;
  }
  function tipButton(cls,svg,text){
    var b=document.createElement('button');b.type='button';b.className='unlinked '+cls;
    b.setAttribute('aria-label',text);
    b.innerHTML=svg+'<span class="tip" role="tooltip">'+text+'</span>';
    var show=function(ev){
      if(ev.type==='click')ev.stopPropagation();
      closeTips();clearTimeout(b._t);
      b.classList.add('show');
      b._t=setTimeout(function(){b.classList.remove('show');},3500);
    };
    b.addEventListener('click',show);
    b.addEventListener('mouseenter',show);
    return b;
  }
  return { closeTips, brokenLink, tipButton, WARN_SVG };
})();
