// VERBATIM copy of reorderSoon, moveAnim, renderGrid and render as they were in src/app.js before step 1b-5 (v76). Only used by
// tests, to check that listview.ts behaves exactly like the old code. The names the old code took from app.js's closure (list, items,
// recipes, layoutMode, sortMode, sliding, currentView) are variables of the factory (set() changes them); the app's own functions
// (sortedItems, topLine, save, syncClear, applyListFilter, checkedToast, openDesc, openRelink, deleteItem) come in as `fn`.
// @ts-nocheck
import { keyFor } from '../../src/rowfx';
import { fullName } from '../../src/names';
import { unitLabel } from '../../src/units';
import { qtyText, setTileName, fitAll } from '../../src/tiles';
import { swipeRow, tileSwipe } from '../../src/swipe';
import { nameFrag, isDesk, noMotion, uiLocked, EASE } from '../../src/ui';
import { brokenLink, tipButton } from '../../src/tips';
import { WARN_SVG, SW_TRASH, chkSvg, chkIn } from '../../src/icons';
import { isMulti } from '../../src/sorting';

export function makeOldList(init, fn) {
  var list, items, recipes, layoutMode, sortMode, sliding, currentView;
  var { sortedItems, topLine, save, syncClear, applyListFilter, checkedToast, openDesc, openRelink, deleteItem } = fn;
  function set(o) { ({ list, items, recipes, layoutMode, sortMode, sliding, currentView } = Object.assign({ list, items, recipes, layoutMode, sortMode, sliding, currentView }, o)); }
  set(init);
  var moveTimer=null,moveKeys={},moveDone=null,MOVE_MS=480;
  function reorderSoon(ms,its){
    (Array.isArray(its)?its:[its]).forEach(function(it){if(it)moveKeys[keyFor(it)]=1;});
    if(moveTimer)return;
    moveTimer=setTimeout(function(){
      moveTimer=null;
      var keys=moveKeys;moveKeys={};
      moveAnim(keys);
    },ms);
  }
  function moveAnim(keys){
    if(moveDone)moveDone();
    var grid=layoutMode==='grid'&&items.length>0;
    if(noMotion()||!list.animate||sliding||uiLocked||currentView!=='list'||Object.keys(keys).length>8){render();return;}
    var lr=list.getBoundingClientRect(),oh=lr.height;
    function rel(r,b){return{t:r.top-b.top,l:r.left-b.left,w:r.width,h:r.height};}
    var old={},olduls={};
    list.querySelectorAll('li[data-key]').forEach(function(li){
      var r=li.getBoundingClientRect();
      if(!r.height)return;
      var ul=li.parentNode,ur=ul.getBoundingClientRect(),cb=li.querySelector('input[type=checkbox]');
      old[li.dataset.key]={a:rel(r,lr),rt:r.top-ur.top,g:ul.dataset.g,el:li,chk:!!(cb&&cb.checked)};
    });
    if(!grid)list.querySelectorAll(':scope > ul').forEach(function(ul){
      var r=ul.getBoundingClientRect();
      if(r.height)olduls[ul.dataset.g]={el:ul,r:rel(r,lr)};
    });
    render();
    var lr2=list.getBoundingClientRect(),nh=lr2.height,opt={duration:420,easing:EASE};
    var undo=[],extra=[],pos=list.style.position;
    list.style.position='relative';
    undo.push(function(){list.style.position=pos;});
    // the row as it was stays behind for a moment and fades out; the real row fades in at its new place
    function fadeOutOld(o){
      var gu=document.createElement('ul'),gl=o.el.cloneNode(true),cb=gl.querySelector('input[type=checkbox]');
      if(cb)cb.checked=o.chk;
      gl.removeAttribute('data-key');
      gu.className='ghostrow'+(grid?' grid':'');gu.setAttribute('aria-hidden','true');
      gu.style.cssText='left:'+o.a.l+'px;top:'+o.a.t+'px;width:'+o.a.w+'px'+(grid?';grid-template-columns:1fr':'');
      gu.appendChild(gl);extra.push(gu);
      gu.animate([{opacity:1},{opacity:0}],{duration:200,easing:'ease-out',fill:'forwards'});
    }
    function fadeInNew(li){
      li.animate([{opacity:0},{opacity:0,offset:.35},{opacity:1}],{duration:460,easing:'ease-out'});
    }
    var uls=grid?[]:Array.prototype.slice.call(list.querySelectorAll(':scope > ul')),newGs={};
    uls.forEach(function(ul){
      var g=ul.dataset.g,o=olduls[g],n=rel(ul.getBoundingClientRect(),lr2);
      newGs[g]=1;
      if(!o){ul.animate([{height:'0px',opacity:0},{height:n.h+'px',opacity:1}],opt);return;}
      var dy=o.r.t-n.t;
      if(Math.abs(dy)>.5||Math.abs(o.r.h-n.h)>.5)ul.animate([{transform:'translateY('+dy+'px)',height:o.r.h+'px'},{transform:'translateY(0)',height:n.h+'px'}],opt);
    });
    list.querySelectorAll('li[data-key]').forEach(function(li){
      var k=li.dataset.key,o=old[k];if(!o)return;
      var r=li.getBoundingClientRect();if(!r.height)return;
      var n=rel(r,lr2),ul=li.parentNode;
      if(grid){
        // tiles simply glide to their new place; the moved tile travels above the others
        var dx=o.a.l-n.l,dy=o.a.t-n.t;
        if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
        if(keys[k]){li.style.zIndex='4';undo.push(function(){li.style.zIndex='';});}
        li.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],opt);
      }else if(keys[k]){
        if(Math.abs(o.a.t-n.t)<1&&Math.abs(o.a.l-n.l)<1)return;
        fadeOutOld(o);fadeInNew(li);
      }else if(ul.dataset.g===o.g){
        var ur=ul.getBoundingClientRect(),ry=o.rt-(r.top-ur.top);
        if(Math.abs(ry)>.5)li.animate([{transform:'translateY('+ry+'px)'},{transform:'none'}],opt);
      }
    });
    // a section that is gone fades out where it was
    Object.keys(olduls).forEach(function(g){
      if(newGs[g])return;
      var o=olduls[g],cl=o.el.cloneNode(true);
      cl.querySelectorAll('li').forEach(function(l){if(keys[l.dataset.key])l.style.visibility='hidden';});
      cl.setAttribute('aria-hidden','true');
      cl.style.cssText='position:absolute;margin:0;left:'+o.r.l+'px;top:'+o.r.t+'px;width:'+o.r.w+'px;z-index:1;pointer-events:none';
      extra.push(cl);
      cl.animate([{opacity:1},{opacity:0}],{duration:280,easing:'ease-out',fill:'forwards'});
    });
    // everything under the list (footer) follows the change in height
    var dh=nh-oh;
    if(Math.abs(dh)>1){
      var sib=list.nextElementSibling;
      while(sib){if(sib.animate)sib.animate([{transform:'translateY('+(-dh)+'px)'},{transform:'none'}],opt);sib=sib.nextElementSibling;}
    }
    extra.forEach(function(e){list.appendChild(e);});
    var tm=null;
    function finish(){
      clearTimeout(tm);
      extra.forEach(function(e){if(e.parentNode)e.parentNode.removeChild(e);});
      undo.forEach(function(fn){fn();});
      if(moveDone===finish)moveDone=null;
    }
    moveDone=finish;
    tm=setTimeout(finish,MOVE_MS+50);
  }
  function renderGrid(){
    var ul=document.createElement('ul');ul.className='grid';list.appendChild(ul);
    sortedItems().forEach(function(it){
      var li=document.createElement('li');
      li.dataset.key=keyFor(it);li.dataset.name=fullName(it).toLowerCase();
      var b=document.createElement('button');b.type='button';b.className='tile'+(it.done?' done':'');
      b.setAttribute('aria-label',fullName(it)+(it.qty?', '+qtyText(it):'')+(it.unlinked?' Unlinked from recipe.':'')+(it.done?' Checked off.':'')+(isDesk()?' Click to '+(it.done?'uncheck':'check off')+', right click to open details.':' Tap to open details, swipe right to '+(it.done?'uncheck':'check off')+', swipe left to delete.'));
      var tin=document.createElement('span');tin.className='tin';
      var tl=topLine(it);
      if(tl!==null){var c=document.createElement('span');c.className='tcat';c.textContent=tl;tin.appendChild(c);}
      var nw=document.createElement('span');nw.className='tnw';
      var nm=document.createElement('span');nm.className='tname';setTileName(nm,it.text,it.brand);
      nw.appendChild(nm);tin.appendChild(nw);
      var q=document.createElement('span');q.className='tqty';q.textContent=qtyText(it);tin.appendChild(q);
      b.appendChild(tin);
      var act=document.createElement('button');act.type='button';act.className='tact';act.tabIndex=-1;
      act.setAttribute('aria-label','Delete '+it.text);act.innerHTML=SW_TRASH;
      // swipe right: green button on the left edge that checks the item off (or unchecks it)
      var lact=document.createElement('button');lact.type='button';lact.className='tact chk';lact.tabIndex=-1;
      lact.innerHTML=chkSvg();
      function syncChk(){
        lact.setAttribute('aria-label',(it.done?'Uncheck ':'Check off ')+it.text);
        lact.firstChild.innerHTML=chkIn(it.done);
      }
      syncChk();
      function toggleDone(){
        it.done=!it.done;save();
        b.classList.toggle('done',it.done);
        syncClear();reorderSoon(500,it);
        setTimeout(syncChk,330);
        if(it.done)checkedToast(it);
      }
      var sw=tileSwipe(li,act,tin,function(){deleteItem(it,true);},function(){},{leftAct:lact,onLeft:toggleDone,lock:.3,commit:.75});
      // phones: tap opens the Edit item window. Computers: left click checks off, right click edits (keyboard activation still edits).
      function tap(mouse){
        if(sw.open){sw.close();return;}
        if(mouse&&isDesk())toggleDone();else openDesc(it);
      }
      b.addEventListener('click',function(e){tap(e.detail>0);});
      li.addEventListener('contextmenu',function(e){e.preventDefault();if(isDesk())openDesc(it);});
      // mouse and trackpad: the Delete button shows when the pointer is in the top-right corner; a click elsewhere in the corner still checks off the tile
      var zone=document.createElement('div');zone.className='tzone';
      var del=document.createElement('button');del.type='button';del.className='tdel';
      del.setAttribute('aria-label','Delete '+it.text);del.innerHTML=SW_TRASH;
      del.addEventListener('click',function(e){e.stopPropagation();deleteItem(it,true);});
      zone.addEventListener('click',function(e){if(e.target===zone)tap(true);});
      zone.appendChild(del);
      li.appendChild(b);li.appendChild(act);li.appendChild(lact);li.appendChild(zone);
      if(it.unlinked)li.appendChild(brokenLink('tbrk',(it.orig&&it.from&&it.from.length===1&&!isMulti(it))?function(){openRelink(it);}:null,isMulti(it)?'Re-linking not possible':null));
      ul.appendChild(li);
    });
    fitAll();
  }
  function render(){
    list.innerHTML="";
    if(layoutMode==='grid'&&items.length){renderGrid();syncClear();applyListFilter(false);return;}
    var groups={};
    function groupUl(it){
      var key=it.done?"done":sortMode==="cat"?(it.cat?"cat":"nocat"):sortMode!=="recipe"?"all":(isMulti(it)?"multi":(it.from&&it.from.length===1?"recipe":"manual"));
      if(!groups[key]){groups[key]=document.createElement("ul");if(key==="done")groups[key].className="donegrp";groups[key].dataset.g=key;list.appendChild(groups[key]);}
      return groups[key];
    }
    if(!items.length){
      var e=document.createElement("li");
      e.className="empty";
      e.textContent="Your list is empty. Tap \u201cAdd item\u201d to get started.";
      var eu=document.createElement("ul");eu.appendChild(e);list.appendChild(eu);
    }
    sortedItems().forEach(function(it){
      var li=document.createElement("li");
      li.dataset.key=keyFor(it);
      li.dataset.name=fullName(it).toLowerCase();
      if(it.done)li.className="done";
      var fg=swipeRow(li,function(){deleteItem(it);},it.text);
      var label=document.createElement("label");
      var cb=document.createElement("input");
      cb.type="checkbox";cb.checked=it.done;cb.setAttribute("aria-label","Mark "+it.text+" as bought");
      cb.addEventListener("change",function(){
        it.done=cb.checked;save();
        li.classList.toggle("done",cb.checked);
        syncClear();reorderSoon(500,it);
        if(it.done)checkedToast(it);
      });
      var span=document.createElement("span");
      span.className="name";
      if(it.qty){var q=document.createElement("strong");q.className="qty";q.textContent=it.qty+"\u00a0"+unitLabel(it.qty,it.unit)+" ";span.appendChild(q);}
      span.appendChild(nameFrag(it));
      label.appendChild(cb);
      var txt=document.createElement("span");txt.className="txt";
      if(sortMode==="recipe"&&it.from&&it.from.length){
        var tag=document.createElement("span");tag.className="from";
        var f0=it.from[0];
        tag.textContent=isMulti(it)?"Multiple recipes":f0.name+(f0.sp?", "+f0.sp+(f0.sp===1?" portion":" portions"):"");
        txt.appendChild(tag);
      }else if(sortMode==="cat"&&it.cat){
        var ctag=document.createElement("span");ctag.className="from";ctag.textContent=it.cat;
        txt.appendChild(ctag);
      }
      txt.appendChild(span);
      var edit=document.createElement("button");edit.type="button";edit.className="itembtn";
      edit.setAttribute("aria-label","Open "+it.text);
      edit.addEventListener("click",function(e){if(e.detail>0&&isDesk())return;openDesc(it);});
      li.addEventListener("contextmenu",function(e){if(isDesk()){e.preventDefault();openDesc(it);}});
      edit.appendChild(txt);
      fg.appendChild(label);fg.appendChild(edit);
      if(it.unlinked)fg.appendChild(brokenLink('',(it.orig&&it.from&&it.from.length===1&&!isMulti(it))?function(){openRelink(it);}:null,isMulti(it)?'Re-linking not possible':null));
      var changed=(it.from||[]).some(function(f){
        var rc=recipes.find(function(x){return x.id===f.id;});
        return rc&&f.rp!==undefined&&rc.portions!==f.rp;
      });
      if(changed)fg.appendChild(tipButton('warn',WARN_SVG,'Portion size of the original recipe was changed.'));
      fg.finish();
      groupUl(it).appendChild(li);
    });
    var left=items.filter(function(i){return !i.done;}).length;
    var doneN=items.length-left;
    syncClear();
    applyListFilter(false);
  }
  return { set, render, reorderSoon };
}
