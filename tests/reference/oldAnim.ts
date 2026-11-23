// VERBATIM copy of the animation block that lived in src/app.js before step 1b-2 (v76). Only used by tests, to check that
// anim.ts behaves exactly like the old code. The names the old code took from app.js's closure (list, recipesEl, sliding,
// query, currentView, layoutMode, recipeLayout) are variables of the factory; set() changes them.
// @ts-nocheck
import { EASE, noMotion, lockUI } from '../../src/ui';

export function makeOldAnim(init) {
  var list, recipesEl, sliding, query, currentView, layoutMode, recipeLayout;
  function set(o) { ({ list, recipesEl, sliding, query, currentView, layoutMode, recipeLayout } = Object.assign({ list, recipesEl, sliding, query, currentView, layoutMode, recipeLayout }, o)); }
  set(init);
  var SPRING='cubic-bezier(.34,1.56,.64,1)',ANIM_MAX=6;
  function rcOf(e){return e.getBoundingClientRect();}
  function animCtx(kind){
    if(noMotion()||sliding||query.trim())return null;
    if(kind==='list'){
      if(currentView!=='list'||!list.animate)return null;
      return {root:list,sel:'li[data-key]',attr:'key',mode:layoutMode==='grid'?'grid':'rows'};
    }
    if(currentView!=='recipes'||!recipesEl.animate)return null;
    return {root:recipesEl,sel:'.recipe[data-rid],.rtile[data-rid]',attr:'rid',mode:recipeLayout==='tile'?'grid':'cards'};
  }
  function snapAnim(c){
    var o={keys:[],nodes:{},rects:{},h:{},box:c.root.firstElementChild,boxH:0};
    Array.prototype.forEach.call(c.root.querySelectorAll(c.sel),function(e){
      var k=e.dataset[c.attr],r=rcOf(e);
      o.keys.push(k);o.nodes[k]=e;o.rects[k]=r;o.h[k]=r.height;
    });
    if(o.box)o.boxH=rcOf(o.box).height;
    return o;
  }
  // Takes a picture of the list, runs the change (which redraws it) and then plays the difference.
  function withAnim(kind,fn,lock){
    var c=null,o=null,ms=0;
    try{c=animCtx(kind);if(c)o=snapAnim(c);}catch(e){o=null;}
    fn();
    if(o)try{ms=playAnim(c,o)||0;}catch(e){}
    if(lock&&ms)lockUI(ms);
  }
  function flashEl(e,c0,c1){if(e&&e.animate)e.animate([{backgroundColor:c0},{backgroundColor:c1}],{duration:1500,delay:250,easing:'ease-out'});}
  function flashNew(c,e){
    if(c.attr==='rid')flashEl(e,'rgba(92,191,134,.45)',getComputedStyle(e).backgroundColor);
    else flashEl(e.querySelector('.swfg')||e.querySelector('.tile'),'#fff3b0','#ffffff');
  }
  function playAnim(c,o){
    var els=Array.prototype.slice.call(c.root.querySelectorAll(c.sel)),nk={};
    els.forEach(function(e){nk[e.dataset[c.attr]]=e;});
    var added=els.filter(function(e){return !(e.dataset[c.attr] in o.nodes);});
    var gone=o.keys.filter(function(k){return !(k in nk);});
    var n=added.length+gone.length;
    if(!n||n>ANIM_MAX)return 0;   // nothing changed, or too much at once (e.g. a first sync): just show it
    if(!o.keys.length||!els.length)edgeAnim(c,o,els,added);
    else if(c.mode==='grid')gridAnim(c,o,els,added,gone);
    else stackAnim(c,o,els,nk,added,gone);
    return 700;
  }
  // First item in an empty list / last item removed: nothing to slide from or behind, so the old content fades out
  // while the new content fades in (and the list box resizes).
  function edgeAnim(c,o,els,added){
    var root=c.root,ghost=o.box,tgt=root.firstElementChild;
    if(!ghost||!tgt||ghost===tgt)return;
    var pos=root.style.position;
    root.style.position='relative';
    ghost.style.cssText='position:absolute;left:0;right:0;top:0;z-index:2;pointer-events:none;margin:0';
    ghost.setAttribute('aria-hidden','true');
    root.appendChild(ghost);
    ghost.animate([{opacity:1},{opacity:0}],{duration:240,easing:'ease-out',fill:'forwards'}).onfinish=function(){ghost.remove();root.style.position=pos;};
    if(tgt.tagName==='UL'&&!tgt.classList.contains('grid')&&o.boxH){
      var h1=rcOf(tgt).height;
      if(Math.abs(h1-o.boxH)>1)tgt.animate([{height:o.boxH+'px'},{height:h1+'px'}],{duration:380,easing:EASE});
    }
    tgt.animate([{opacity:0},{opacity:0,offset:.35},{opacity:1}],{duration:480,easing:EASE});
    added.forEach(function(e){flashNew(c,e);});
  }
  // Tiles: the others glide to their new places, a new tile pops in, a removed tile shrinks away.
  function gridAnim(c,o,els,added,gone){
    var ul=els[0].parentNode,pos=ul.style.position;
    els.forEach(function(e){
      var r0=o.rects[e.dataset[c.attr]];if(!r0)return;
      var r=rcOf(e),dx=r0.left-r.left,dy=r0.top-r.top;
      if(dx||dy)e.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{duration:520,easing:EASE});
    });
    added.forEach(function(e){
      e.animate([{opacity:0,transform:'scale(.6)'},{opacity:1,transform:'scale(1)'}],{duration:460,delay:140,easing:SPRING,fill:'backwards'});
      flashNew(c,e);
    });
    if(gone.length){
      ul.style.position='relative';
      var ur=rcOf(ul),left=gone.length;
      gone.forEach(function(k){
        var g=o.nodes[k],r0=o.rects[k];
        g.style.cssText='position:absolute;pointer-events:none;margin:0;left:'+(r0.left-ur.left)+'px;top:'+(r0.top-ur.top)+'px;width:'+r0.width+'px;height:'+r0.height+'px';
        g.setAttribute('aria-hidden','true');
        ul.appendChild(g);
        g.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.6)'}],{duration:320,easing:'ease-in',fill:'forwards'}).onfinish=function(){g.remove();if(!--left)ul.style.position=pos;};
      });
    }
  }
  // Rows and cards: a new one slides out from behind the one above while the rest make room; a removed one slides
  // back behind the one above while the rest close up.
  function stackAnim(c,o,els,nk,added,gone){
    var rows=c.mode==='rows',root=c.root,opt={duration:520,easing:EASE};
    added.forEach(function(e){
      if(rows){
        var u=e.parentNode,sole=u.children.length===1,tg=sole?u:e,fg=e.querySelector('.swfg')||e.firstElementChild;
        var th=rcOf(tg).height,tcs=getComputedStyle(tg),a0={height:'0px',opacity:0},a1={height:th+'px',opacity:1};
        if(sole){a0.marginTop='0px';a1.marginTop=tcs.marginTop;}
        else{a0.borderBottomWidth='0px';a1.borderBottomWidth=tcs.borderBottomWidth;}
        tg.style.overflow='hidden';
        tg.animate([a0,a1],opt).onfinish=function(){tg.style.overflow='';};
        fg.animate([{transform:'translateY(-100%)',opacity:0},{transform:'translateY(0)',opacity:1}],opt);
      }else{
        var h=rcOf(e).height,mb=getComputedStyle(e).marginBottom;
        e.style.overflow='hidden';
        e.animate([{height:'0px',marginBottom:'0px',opacity:0},{height:h+'px',marginBottom:mb,opacity:1}],opt).onfinish=function(){e.style.overflow='';};
      }
      flashNew(c,e);
    });
    gone.slice().reverse().forEach(function(k){
      var g=o.nodes[k],idx=o.keys.indexOf(k),prev=null,j,h=o.h[k];
      for(j=idx-1;j>=0;j--){if(nk[o.keys[j]]){prev=nk[o.keys[j]];break;}}
      g.style.pointerEvents='none';g.setAttribute('aria-hidden','true');
      if(prev)prev.parentNode.insertBefore(g,prev.nextSibling);
      else if(rows){var fu=root.querySelector('ul');fu.insertBefore(g,fu.firstChild);}
      else root.insertBefore(g,root.firstChild);
      g.style.height=h+'px';g.style.overflow='hidden';
      var done=function(){g.remove();};
      if(rows){
        g.animate([{height:h+'px',borderBottomWidth:'2px'},{height:'0px',borderBottomWidth:'0px'}],{duration:420,easing:EASE,fill:'forwards'}).onfinish=done;
        var gf=g.querySelector('.swfg');
        if(gf)gf.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-100%)',opacity:0}],{duration:420,easing:EASE,fill:'forwards'});
      }else{
        var mb=getComputedStyle(g).marginBottom;
        g.animate([{height:h+'px',marginBottom:mb,opacity:1},{height:'0px',marginBottom:'0px',opacity:0}],{duration:420,easing:EASE,fill:'forwards'}).onfinish=done;
      }
    });
  }
  return { set, withAnim };
}
