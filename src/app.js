import { CATS, CAT_HTML } from './categories';
import { uid, fullName, shortTitle, nameParts, searchRe } from './names';
import { unitLabel, convertQty, scaleQty } from './units';
import * as store from './store';
import { refresh as syncRefresh, lastSyncDate } from './sync';
import { chkIn, chkSvg, SW_TRASH, CART_SVG, UNLINK_SVG } from './icons';
import { initPullToRefresh } from './pulltorefresh';
import { noMotion, EASE, nameFrag, lockUI, uiLocked, shake, shakeOnInvalid } from './ui';
import { toast, showToast, hideToast } from './toast';
import { initDialogs } from './dialogs';
import { isMulti, sortedItems as sortItems, sortedRecipes as sortRecipes } from './sorting';
import { tileSwipe, swipeRow, closeOpenSwipe, initSwipe } from './swipe';
import { setTileName, qtyText, tileFitName, fitAll } from './tiles';
import { toggleEl, setLi, markLast, clearMarks, markText, keyFor, flipReorder } from './rowfx';
import { nameCandidates as findNames, makeSuggest as makeSuggestFor } from './suggest';

(function(){
  var APP_VERSION=__APP_VERSION__;
  window.APP_VERSION=APP_VERSION;
  // The data lives in store.ts: one array per kind that is only ever changed in place (see store.setList).
  var items=store.items,recipes=store.recipes,itemHistory=store.history;
  var list=document.getElementById("list"),
      input=document.getElementById("input"),
      clearBtn=document.getElementById("clear");


  function save(){store.save('items');}
  // Every item you have ever added is remembered here, even after it is deleted from the list or a recipe.
  function saveHist(){store.save('history');}
  function recordHistory(entries){
    var now=Date.now();
    entries.forEach(function(e){
      if(!e||!e.text)return;
      var name=e.text.trim(),k=name.toLowerCase();
      var h=itemHistory.find(function(x){return x.text.toLowerCase()===k;});
      if(h){h.text=name;if(e.unit)h.unit=e.unit;if(e.cat)h.cat=e.cat;h.last=now;}
      else itemHistory.push({text:name,unit:e.unit||'',cat:e.cat||'',last:now});
    });
    if(itemHistory.length>500){itemHistory.sort(function(a,b){return b.last-a.last;});itemHistory.length=500;}
    saveHist();
  }

  var SKEY='shopping-list-sort',sortMode='recipe';
  try{var sm=localStorage.getItem(SKEY);if(sm==='az'||sm==='za'||sm==='cat')sortMode=sm;}catch(e){}
  var listAzDir='az';
  try{if(localStorage.getItem('shopping-list-azdir')==='za')listAzDir='za';}catch(e){}
  if(sortMode==='az'||sortMode==='za')listAzDir=sortMode;
  function sortedItems(){return sortItems(items,sortMode);}
  var chips=document.querySelectorAll('#view-list .chip');
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
  chips.forEach(function(c){
    c.addEventListener('click',function(){
      if(uiLocked)return;
      var prev=sortMode,ord=['recipe','cat','az','za'],next=c.dataset.sort;
      if(next==='a'){next=(prev==='az'||prev==='za')?(prev==='az'?'za':'az'):listAzDir;listAzDir=next;}
      if(next===prev)return;
      var slide=!((prev==='az'||prev==='za')&&(next==='az'||next==='za'));
      var old=slide?list.cloneNode(true):null,top=list.offsetTop;
      sortMode=next;
      try{localStorage.setItem(SKEY,sortMode);localStorage.setItem('shopping-list-azdir',listAzDir);}catch(e){}
      syncChips();
      if(slide){
        render();
        slideLists(old,top,ord.indexOf(next)>ord.indexOf(prev)?1:-1,list);
      }else flipReorder(list,'li[data-key]','key',render);
    });
  });
  syncChips();

  // ---- Grid layout (alternative to the list layout, chosen with the button next to the search button) ----
  var LKEY='shopping-list-layout',layoutMode='list';
  try{if(localStorage.getItem(LKEY)==='grid')layoutMode='grid';}catch(e){}
  var RLKEY='shopping-list-recipe-layout',recipeLayout='card';
  try{if(localStorage.getItem(RLKEY)==='tile')recipeLayout='tile';}catch(e){}
  // Line above the name: recipe when sorted by recipe, category when sorted by category, nothing for A to Z.
  // Recipe names longer than 20 characters are cut after the 20th character and end in three dots.
  function topLine(it){
    if(sortMode==='recipe'){
      if(isMulti(it))return 'Multiple recipes';
      return it.from&&it.from.length===1?shortTitle(it.from[0].name):'';
    }
    if(sortMode==='cat')return it.cat||'';
    return null;
  }
  window.addEventListener('resize',fitAll);
  // ---- Tick / untick: the row fades out where it was and fades in at its new place while the rest of the list glides
  // into the new arrangement. The "Checked off" section grows in (and shrinks away) the same way. ----
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
  function deleteItem(it,anim){
    var idx=items.indexOf(it);
    if(idx<0)return;
    store.setList('items',items.filter(function(x){return x!==it;}));
    save();
    if(anim)withAnim('list',render);else render();
    showToast('Item removed.',function(){
      items.splice(Math.min(idx,items.length),0,it);
      save();
      if(anim)withAnim('list',render);else render();
    });
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
  initSwipe();

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

  function commitAdd(t,qty,unit,cat,m,brand){
    var qtyEl=document.getElementById("qty"),unitEl=document.getElementById("unit"),catEl=document.getElementById("addCat");
    if(m){
      if(m.from&&m.from.length&&!m.unlinked)m.orig={qty:m.qty,unit:m.unit};
      m.qty=Math.round(((m.qty||0)+convertQty(qty,unit,m.unit))*100)/100;
      if(m.from&&m.from.length){m.unlinked=true;m.manual=true;}
      if(cat&&!m.cat)m.cat=cat;
    }else{
      var n={id:uid(),text:t,qty:qty,unit:unit,done:false};
      if(brand)n.brand=brand;
      if(cat)n.cat=cat;
      items.push(n);
    }
    recordHistory([{text:t,unit:unit,cat:cat}]);
    qtyEl.value="";unitEl.value="pcs";input.value="";catEl.value="";document.getElementById("brand").value="";
    addSuggest.hide();
    save();
    dlgItem.close();
    setTimeout(function(){withAnim('list',render);},340);
    showToast("Item added. Add another?",openItemDialog,7000,"Yes");
  }
  document.getElementById("form").addEventListener("submit",function(ev){
    ev.preventDefault();
    var qtyEl=document.getElementById("qty"),unitEl=document.getElementById("unit");
    var t=input.value.trim(),qty=parseFloat(qtyEl.value),catEl=document.getElementById("addCat"),cat=catEl.value;
    if(!t||!(qty>0)||!unitEl.value)return;
    var brand=document.getElementById('brand').value.trim(),unit=unitEl.value,m=items.find(function(x){return !x.done&&x.text.toLowerCase()===t.toLowerCase()&&(x.brand||'').toLowerCase()===brand.toLowerCase()&&convertQty(qty,unit,x.unit)!==null;});
    if(!m){
      var c=items.find(function(x){return !x.done&&x.text.toLowerCase()===t.toLowerCase()&&(x.brand||'').toLowerCase()===brand.toLowerCase();});
      if(c){openConflict(c,{t:t,qty:qty,unit:unit,cat:cat,brand:brand});return;}
    }
    commitAdd(t,qty,unit,cat,m,brand);
  });
  // ---- Conflicting units: the name is already on the list, but its unit cannot be converted ----
  var dlgConflict=document.getElementById('dlgConflict'),cfPending=null,cfExisting=null;
  function cfRow(id,it){
    var ul=document.getElementById(id);ul.innerHTML='';
    var li=document.createElement('li'),span=document.createElement('span');span.className='name';
    var q=document.createElement('strong');q.className='qty';
    q.textContent=it.qty+'\u00a0'+unitLabel(it.qty,it.unit)+' ';
    span.appendChild(q);span.appendChild(nameFrag(it));
    li.appendChild(span);ul.appendChild(li);
  }
  function openConflict(ex,p){
    cfExisting=ex;cfPending=p;
    cfRow('cfExisting',ex);
    cfRow('cfNew',{text:p.t,brand:p.brand,qty:p.qty,unit:p.unit});
    dlgConflict.showModal();
    dlgConflict.setAttribute('tabindex','-1');
    dlgConflict.focus({preventScroll:true});
  }
  document.getElementById('cfSeparate').addEventListener('click',function(){
    var p=cfPending;cfPending=null;if(!p)return;
    dlgConflict.close();
    commitAdd(p.t,p.qty,p.unit,p.cat,null,p.brand);
  });
  document.getElementById('cfMerge').addEventListener('click',function(){
    var ex=cfExisting;cfPending=null;
    dlgConflict.close();dlgItem.close();
    document.getElementById("qty").value="";document.getElementById("unit").value="pcs";
    input.value="";document.getElementById("addCat").value="";document.getElementById("brand").value="";addSuggest.hide();
    if(ex)openDesc(ex);
  });
  document.getElementById('cfCancel').addEventListener('click',function(){cfPending=null;dlgConflict.close();});
  dlgConflict.addEventListener('click',function(ev){if(ev.target===dlgConflict){cfPending=null;dlgConflict.close();}});
  clearBtn.addEventListener("click",function(){openRemoveChecked();});
  function removeChecked(){
    var gone=[];
    items.forEach(function(it,i){if(it.done)gone.push({it:it,idx:i});});
    store.setList('items',items.filter(function(i){return !i.done;}));
    save();render();
    showToast(gone.length===1?'Item removed.':'Items removed.',function(){
      gone.forEach(function(g){items.splice(Math.min(g.idx,items.length),0,g.it);});
      save();render();
    });
  }
  var currentView='list',sliding=false;
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

  saveR();
  function saveR(){store.save('recipes');}
  var recipesEl=document.getElementById('recipes'),unitHTML=document.getElementById('unit').innerHTML;

  var viewTarget=null,dlgView=document.getElementById('dlgView'),viewList=document.getElementById('viewList');
  function ingText(r){var n=(r.items||[]).length;return n+(n===1?' ingredient':' ingredients');}
  function portionsText(n){return 'up to '+n+(n===1?' portion':' portions');}
  // Portions come first; only when the recipes are sorted by ingredient count does that come first.
  function infoLine(r){
    var a=portionsText(r.portions),b=ingText(r);
    return (rsort==='iu'||rsort==='id')?b+' \u00b7 '+a:a+' \u00b7 '+b;
  }
  // A change that really goes through (added, removed, edited, deleted, put on the shopping list) ends the search.
  // Cancelling or just looking at a recipe leaves it as it was.
  function dismissSearch(){if(searchOpen)closeSearch(true);}

  // Recipe tiles follow the same rules as Shopping list tiles; computers allow one more line.
  function isDesk(){return !!(window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches);}
  function fitRTiles(){
    document.querySelectorAll('.rtile .rname').forEach(function(el){
      if(!el.offsetWidth)return;
      var d=isDesk();
      tileFitName(el,d?20:18.4,9,d?4:3);
    });
  }
  window.addEventListener('resize',fitRTiles);
  // Re-fit tile names every time a font finishes loading (the handwriting font arrives after the first render).
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
  // ---- Swipe a recipe left to add it to the Shopping list (same gesture as swipe-to-delete, but filled accent colour) ----
  function popList(svg){
    if(noMotion()||!svg||!svg.animate)return;
    var l=svg.querySelector('.lns'),p=svg.querySelector('.pls');
    if(l&&l.animate)l.animate([{transform:'scaleX(.15)'},{transform:'scaleX(1.12)',offset:.55},{transform:'scaleX(.97)',offset:.8},{transform:'scaleX(1)'}],{duration:600,easing:'ease-out'});
    if(p&&p.animate)p.animate([{transform:'scale(0)'},{transform:'scale(1.6)',offset:.5},{transform:'scale(.9)',offset:.75},{transform:'scale(1)'}],{duration:600,easing:'ease-out'});
  }
  function spinPlus(svg){
    if(noMotion()||!svg||!svg.animate)return;
    var p=svg.querySelector('.pls');
    if(p&&p.animate)p.animate([{transform:'rotate(0deg) scale(1)'},{transform:'rotate(180deg) scale(1.7)',offset:.5},{transform:'rotate(360deg) scale(1)'}],{duration:520,easing:'cubic-bezier(.34,1.3,.64,1)'});
  }
  function addSwipe(host,tin,r,mount,isTile){
    if(!r.items.length)return null;
    var act=document.createElement('button');act.type='button';act.className='tact add';act.tabIndex=-1;
    act.setAttribute('aria-label','Add '+r.name+' to shopping list');act.innerHTML=CART_SVG;
    host.appendChild(act);
    var sw=tileSwipe(host,act,tin,function(){openShop(r);},function(){},{keep:true,onHop:popList,onArm:spinPlus,lock:isTile?0:.15,size:isTile?0:.25,commit:isTile?0:.55});
    // mouse and trackpad do not swipe: a button shows on hover instead
    var hb=document.createElement('button');hb.type='button';hb.className=isTile?'tdel add':'radd';
    hb.setAttribute('aria-label','Add '+r.name+' to shopping list');hb.title='Add to shopping list';hb.innerHTML=CART_SVG;
    hb.addEventListener('click',function(e){
      e.stopPropagation();
      if(hb.classList.contains('busy'))return;
      hb.classList.add('busy');
      popList(hb.firstChild);spinPlus(hb.firstChild);
      setTimeout(function(){hb.classList.remove('busy');openShop(r);},350);
    });
    if(isTile){
      var zone=document.createElement('div');zone.className='tzone';
      zone.appendChild(hb);host.appendChild(zone);
    }else mount.appendChild(hb);
    return sw;
  }
  function renderRecipes(){
    recipesEl.innerHTML='';
    if(!recipes.length){
      var p=document.createElement('p');p.className='empty';
      p.textContent='No recipes yet. Add your first recipe below.';
      recipesEl.appendChild(p);
    }
    var host=recipesEl;
    if(recipeLayout==='tile'&&recipes.length){host=document.createElement('div');host.className='rgrid';recipesEl.appendChild(host);}
    sortedRecipes().forEach(function(r){
      if(recipeLayout==='tile'){
        var tile=document.createElement('div');tile.className='rtile';tile.dataset.rid=r.id;
        var top=document.createElement('button');top.type='button';top.className='topen';
        top.setAttribute('aria-label',r.name+', '+((rsort==='iu'||rsort==='id')?ingText(r)+', '+portionsText(r.portions):portionsText(r.portions)+', '+ingText(r)));
        var nw=document.createElement('span');nw.className='rnw';
        var nm=document.createElement('span');nm.className='rname';
        setTileName(nm,r.name);
        nw.appendChild(nm);
        var tp=document.createElement('span');tp.className='portions';tp.textContent=portionsText(r.portions);
        var ti=document.createElement('span');ti.className='portions';ti.textContent=ingText(r);
        var sub=document.createElement('span');sub.className='rsub';var ingFirst=(rsort==='iu'||rsort==='id');sub.appendChild(ingFirst?ti:tp);sub.appendChild(ingFirst?tp:ti);
        top.appendChild(nw);top.appendChild(sub);
        var rin=document.createElement('div');rin.className='rin';rin.appendChild(top);tile.appendChild(rin);
        var sw=addSwipe(tile,rin,r,tile,true);
        top.addEventListener('click',function(e){if(sw&&sw.open){sw.close();return;}if(e.detail>0&&isDesk())return;openView(r);});
        tile.addEventListener('contextmenu',function(e){if(isDesk()){e.preventDefault();openView(r);}});
        host.appendChild(tile);
        return;
      }
      var card=document.createElement('section');card.className='recipe';
      card.dataset.rid=r.id;
      var head=document.createElement('div');head.className='chead';
      var open=document.createElement('button');open.type='button';open.className='cbtn';
      var t=document.createElement('span');t.className='ctitle';t.textContent=r.name;
      var pt=document.createElement('span');pt.className='portions';pt.textContent=infoLine(r);
      open.appendChild(t);open.appendChild(pt);
      head.appendChild(open);
      var more=document.createElement('button');more.type='button';more.className='cbtn cbhits';more.tabIndex=-1;
      more.innerHTML='<span class="hits"><span><span class="hrows"></span></span></span>';
      var rin=document.createElement('div');rin.className='rin';
      rin.appendChild(head);rin.appendChild(more);card.appendChild(rin);
      var sw=addSwipe(card,rin,r,head,false);
      var openIt=function(e){if(sw&&sw.open){sw.close();return;}if(e&&e.detail>0&&isDesk())return;openView(r);};
      open.addEventListener('click',openIt);
      more.addEventListener('click',openIt);
      card.addEventListener('contextmenu',function(e){if(isDesk()){e.preventDefault();openView(r);}});
      host.appendChild(card);
    });
    if(viewTarget){
      var nr=recipes.find(function(x){return String(x.id)===String(viewTarget.id);});
      if(nr)viewTarget=nr;
      else{viewTarget=null;if(dlgView.open)dlgView.close();}
    }
    if(viewTarget&&dlgView.open)renderView();
    applyRecipeFilter(false);
    fitRTiles();syncClear();
  }

  // ---- The recipe window: opens when a card is tapped. Only the ingredient list scrolls (6 rows and half of the 7th).
  function fitView(){
    viewList.style.maxHeight='';
    var rows=viewList.querySelectorAll('li:not(.empty)');
    if(rows.length>6){
      var a=rows[0],g=rows[6];
      viewList.style.maxHeight=(g.offsetTop+g.offsetHeight/2-a.offsetTop+3)+'px';
    }
  }
  function renderView(){
    var r=viewTarget;if(!r)return;
    document.getElementById('viewTitle').textContent=r.name;
    document.getElementById('viewPortions').textContent=infoLine(r);
    var st=viewList.scrollTop;
    viewList.innerHTML='';
    if(!r.items.length){
      var e=document.createElement('li');e.className='empty';e.textContent='No ingredients yet.';viewList.appendChild(e);
    }
    r.items.forEach(function(it){
      var li=document.createElement('li');
      var span=document.createElement('span');span.className='name';
      var q=document.createElement('strong');q.className='qty';
      q.textContent=it.qty+'\u00a0'+unitLabel(it.qty,it.unit)+' ';
      span.appendChild(q);span.appendChild(nameFrag(it));
      var doDel=function(){
        var idx=r.items.indexOf(it);
        r.items=r.items.filter(function(x){return x!==it;});
        var hit=items.filter(function(x){
          return !x.unlinked&&x.unit===it.unit&&fullName(x).toLowerCase()===fullName(it).toLowerCase()&&(x.from||[]).some(function(f){return f.id===r.id;});
        });
        hit.forEach(function(x){x.unlinked=true;});
        dismissSearch();
        saveR();save();renderRecipes();render();
        showToast('Item removed.',function(){
          r.items.splice(Math.min(idx,r.items.length),0,it);
          hit.forEach(function(x){delete x.unlinked;});
          saveR();save();renderRecipes();render();
        });
      };
      var grip=document.createElement('span');grip.className='grip';grip.title='Drag to reorder';
      grip.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
      var eb=document.createElement('button');eb.type='button';eb.className='itembtn';
      eb.setAttribute('aria-label','Edit '+it.text);
      eb.appendChild(span);
      eb.addEventListener('click',function(){openRecipeEdit(r,it);});
      var fg=swipeRow(li,doDel,it.text);fg.appendChild(grip);fg.appendChild(eb);fg.finish();viewList.appendChild(li);
      if(query.trim()){grip.style.opacity='.35';grip.style.cursor='default';grip.title='Reordering is off while searching';}
      enableDrag(grip,li,viewList,r);
    });
    if(dlgView.open){fitView();viewList.scrollTop=st;}
  }
  function openView(r){
    viewTarget=r;
    renderView();
    dlgView.showModal();
    dlgView.setAttribute('tabindex','-1');
    dlgView.focus({preventScroll:true});
    fitView();viewList.scrollTop=0;
  }
  dlgView.addEventListener('close',function(){viewTarget=null;});
  dlgView.addEventListener('click',function(ev){if(ev.target===dlgView)dlgView.close();});
  document.getElementById('viewClose').addEventListener('click',function(){dlgView.close();});
  pressFlash(document.getElementById('vAdd'),function(){if(viewTarget)openIngredient(viewTarget);});
  pressFlash(document.getElementById('vEdit'),function(){if(viewTarget)openChange(viewTarget);});
  pressFlash(document.getElementById('vDel'),function(){if(viewTarget)openDelete(viewTarget);});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if(dlgView.open)fitView();});

  document.getElementById('recipeForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var inp=document.getElementById('recipeName'),t=inp.value.trim();
    if(!t)return;
    var pEl=document.getElementById('recipePortions'),portions=parseInt(pEl.value,10);
    if(!(portions>0))return;
    recipes.unshift({id:Date.now(),name:t,portions:portions,items:[]});
    inp.value='';pEl.value='';
    saveR();
    document.getElementById('dlgRecipe').close();
    setTimeout(function(){withAnim('recipes',renderRecipes);},340);
  });

  function addToShopping(list,src,sp,partial){
    var undo=[];
    list.forEach(function(it){
      var nm=fullName(it).toLowerCase();
      // 1) a linked item with the same unit; 2) an item that was unlinked (by editing or by a manual top-up) but still lists its
      // recipes (units must be convertible).
      var m=items.find(function(x){return !x.done&&!x.unlinked&&x.unit===it.unit&&fullName(x).toLowerCase()===nm;})||
        items.find(function(x){return !x.done&&x.unlinked&&x.from&&x.from.length&&fullName(x).toLowerCase()===nm&&convertQty(it.qty,it.unit,x.unit)!==null;});
      if(m){
        var prevFrom=m.from?m.from.map(function(f){return Object.assign({},f);}):null,prevUnl=m.unlinked,prevMan=m.manual;
        var add=m.unit===it.unit?it.qty:Math.round(convertQty(it.qty,it.unit,m.unit)*100)/100;
        m.qty=Math.round(((m.qty||0)+add)*100)/100;
        if(!m.cat&&it.cat)m.cat=it.cat;
        if(src){
          m.from=m.from||[];
          var ex=m.from.find(function(f){return f.id===src.id;});
          if(!ex)m.from.push({id:src.id,name:src.name,rp:src.portions,sp:sp});
          // the same recipe added again: its portions add up, so the label matches the quantity (not when only a single new ingredient is topped up)
          else if(!partial&&ex.sp&&sp)ex.sp+=sp;
          // an item that was added manually first: the recipe is merged in, the link is broken, and it counts as several sources
          if(!prevFrom){m.unlinked=true;m.manual=true;}
        }
        undo.push(function(){
          m.qty=Math.round(((m.qty||0)-add)*100)/100;
          if(prevFrom)m.from=prevFrom;else delete m.from;
          if(prevUnl)m.unlinked=prevUnl;else delete m.unlinked;
          if(prevMan)m.manual=prevMan;else delete m.manual;
        });
      }else{
        var n={id:uid(),text:it.text,qty:it.qty,unit:it.unit,done:false};
        if(it.brand)n.brand=it.brand;
        if(it.cat)n.cat=it.cat;
        if(src)n.from=[{id:src.id,name:src.name,rp:src.portions,sp:sp}];
        items.push(n);
        undo.push(function(){store.setList('items',items.filter(function(x){return x!==n;}));});
      }
    });
    recordHistory(list);
    save();render();
    return function(){
      undo.reverse().forEach(function(fn){fn();});
      save();render();
    };
  }


  var dlg=document.getElementById('dlg'),
      ingRecipeName=document.getElementById('ingRecipeName'),
      ingTarget=null,
      ingQty=document.getElementById('ingQty'),
      ingUnit=document.getElementById('ingUnit'),
      ingName=document.getElementById('ingName'),
      ingCat=document.getElementById('ingCat'),
      ingBrand=document.getElementById('ingBrand');
  document.getElementById('addCat').innerHTML=CAT_HTML;
  document.getElementById('ingCat').innerHTML=CAT_HTML;
  var COOK={tsp:1,tbsp:1,pinch:1};
  var COOK_HTML='<optgroup label="Cooking"><option value="tsp">teaspoons (tsp)</option><option value="tbsp">tablespoons (tbsp)</option><option value="pinch">pinch</option></optgroup>';
  ingUnit.innerHTML=unitHTML+COOK_HTML;
  ingUnit.value='pcs';
  document.getElementById('unit').value='pcs';
  function syncVV(){
    var v=window.visualViewport;if(!v)return;
    var st=document.documentElement.style;
    st.setProperty('--vvh',v.height+'px');
    st.setProperty('--vvt',v.offsetTop+'px');
  }
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',syncVV);
    window.visualViewport.addEventListener('scroll',syncVV);
    syncVV();
  }
  function openIngredient(r){
    ingTarget=r;
    ingRecipeName.textContent=r.name;
    document.getElementById('ingPortionsInfo').textContent='up to '+r.portions+(r.portions===1?' portion':' portions');
    dlg.showModal();
    dlg.setAttribute('tabindex','-1');
    dlg.focus({preventScroll:true});
  }
  document.getElementById('dlgClose').addEventListener('click',function(){dlg.close();});
  dlg.addEventListener('click',function(ev){if(ev.target===dlg)dlg.close();});
  document.getElementById('ingForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var r=ingTarget;
    var t=ingName.value.trim(),qty=parseFloat(ingQty.value);
    if(!r||!t||!(qty>0)||!ingUnit.value)return;
    dismissSearch();
    var added={text:t,qty:qty,unit:ingUnit.value};
    if(ingBrand.value.trim())added.brand=ingBrand.value.trim();
    if(ingCat.value)added.cat=ingCat.value;
    r.items.push(added);
    recordHistory([added]);
    saveR();renderRecipes();
    viewList.scrollTop=viewList.scrollHeight;
    ingQty.value='';ingUnit.value='pcs';ingName.value='';ingCat.value='';ingBrand.value='';
    recipeSuggest.hide();
    dlg.close();
    if(linkedToRecipe(r))openAddList(r,added);
    else showToast('Item added. Add another?',function(){openIngredient(r);},7000,'Yes');
  });

  var dlgRecipe=document.getElementById('dlgRecipe'),
      dlgShop=document.getElementById('dlgShop'),
      shopPortions=document.getElementById('shopPortions'),
      shopTarget=null;
  document.getElementById('dlgRecipeClose').addEventListener('click',function(){dlgRecipe.close();});
  dlgRecipe.addEventListener('click',function(ev){if(ev.target===dlgRecipe)dlgRecipe.close();});
  dlgRecipe.addEventListener('close',function(){
    document.getElementById('recipeName').value='';document.getElementById('recipePortions').value='';
  });

  function openShop(r){
    shopTarget={r:r};
    document.getElementById('shopRecipe').textContent=r.name;
    document.getElementById('shopPortionsInfo').textContent='up to '+r.portions+(r.portions===1?' portion':' portions');
    ensureOpt(shopPortions,r.portions);
    shopPortions.value=r.portions;
    var pv=document.getElementById('shopPreview');
    pv.innerHTML='';
    // recipe already on the list: warn, and mark ingredients that are not on the list yet (skipped last time) and tick them
    var onList=linkedToRecipe(r),lp=listedPortions(r),have={};
    if(onList)items.forEach(function(x){if((x.from||[]).some(function(f){return f.id===r.id;}))have[fullName(x).toLowerCase()]=1;});
    document.getElementById('shopWarn').hidden=!onList;
    if(onList)document.getElementById('shopWarnText').textContent='This recipe is already on your list'+(lp?' for '+lp+(lp===1?' portion':' portions'):'')+'.';
    shopRows=r.items.map(function(it){
      var li=document.createElement('li');
      var lab=document.createElement('label');lab.className='pvrow';
      var skipped=onList&&!have[fullName(it).toLowerCase()];
      var cb=document.createElement('input');cb.type='checkbox';cb.checked=skipped?true:!COOK[it.unit];
      cb.addEventListener('change',updateShopBtn);
      var span=document.createElement('span');span.className='name';
      var q=document.createElement('strong');q.className='qty';
      span.appendChild(q);span.appendChild(nameFrag(it));
      lab.appendChild(cb);
      if(skipped){
        var wrap=document.createElement('span');wrap.className='txt';wrap.appendChild(span);
        var hint=document.createElement('span');hint.className='pvhint';
        hint.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>Not added last time';
        wrap.appendChild(hint);lab.appendChild(wrap);
      }else lab.appendChild(span);
      li.appendChild(lab);pv.appendChild(li);
      return {it:it,cb:cb,q:q};
    });
    renderPreviewQty();updateShopBtn();
    dlgShop.showModal();
    dlgShop.setAttribute('tabindex','-1');
    dlgShop.focus({preventScroll:true});
    pv.style.maxHeight='';pv.style.overflowY='';
    var rows=pv.children;
    if(rows.length>=4){
      // from 4 ingredients on the list scrolls and is capped at 3 and a half single-line rows (measured with a probe row,
      // so wrapped names or hints never change the window size)
      var probe=document.createElement('li'),pl=document.createElement('label'),pc=document.createElement('input'),ps=document.createElement('span'),pq=document.createElement('strong');
      pl.className='pvrow';pc.type='checkbox';ps.className='name';pq.className='qty';pq.textContent='1\u00a0g ';
      ps.appendChild(pq);ps.appendChild(document.createTextNode('Ag'));pl.appendChild(pc);pl.appendChild(ps);probe.appendChild(pl);
      pv.appendChild(probe);
      var rowH=probe.offsetHeight+(parseFloat(getComputedStyle(rows[0]).borderBottomWidth)||0);
      pv.removeChild(probe);
      pv.style.maxHeight=Math.round(rowH*3.5+3)+'px';
      pv.style.overflowY='auto';
    }
    pv.scrollTop=0;
  }
  document.getElementById('dlgShopClose').addEventListener('click',function(){dlgShop.close();});
  dlgShop.addEventListener('click',function(ev){if(ev.target===dlgShop)dlgShop.close();});
  document.getElementById('shopForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var r=shopTarget.r,want=parseInt(shopPortions.value,10);
    if(!(want>0))return;
    var f=want/r.portions;
    var picked=shopRows.filter(function(x){return x.cb.checked;}).map(function(x){return x.it;});
    if(!picked.length)return;
    dismissSearch();
    var undo=addToShopping(picked.map(function(it){
      return{text:it.text,brand:it.brand,qty:scaleQty(it.qty,f),unit:it.unit,cat:it.cat};
    }),r,want);
    dlgShop.close();
    showToast('Ingredients for '+r.name+' added to list',undo);
  });

  var dlgItem=document.getElementById('dlgItem');
  document.getElementById('openItem').addEventListener('click',function(){
    if(currentView==='recipes'){dlgRecipe.showModal();dlgRecipe.setAttribute('tabindex','-1');dlgRecipe.focus({preventScroll:true});return;}
    openItemDialog();
  });
  function openItemDialog(){
    dlgItem.showModal();
    dlgItem.setAttribute('tabindex','-1');
    dlgItem.focus({preventScroll:true});
  }
  document.getElementById('dlgItemClose').addEventListener('click',function(){dlgItem.close();});
  dlgItem.addEventListener('click',function(ev){if(ev.target===dlgItem)dlgItem.close();});

  var dlgEdit=document.getElementById('dlgEdit'),
      editName=document.getElementById('editName'),
      editCat=document.getElementById('editCat'),
      editTarget=null;
  var editBrand=document.getElementById('editBrand');
  editCat.innerHTML=CAT_HTML;
  var editQty=document.getElementById('editQty'),editUnit=document.getElementById('editUnit');
  editUnit.innerHTML=unitHTML+COOK_HTML;
  // Source recipes in the Edit item window: a swipeable row with one card at a time. While swiping, the row's height
  // blends from the card you leave to the card you arrive at, so the window grows or shrinks with the cards.
  var editSlide=null;
  function teardownEditSlider(){
    if(!editSlide)return;
    if(editSlide.ro)editSlide.ro.disconnect();
    editSlide=null;
  }
  function setupEditSlider(sl,dots){teardownEditSlider();editSlide=setupSlider(sl,dots);}
  var unlinkSlide=null;
  function teardownUnlinkSlider(){
    if(unlinkSlide&&unlinkSlide.ro)unlinkSlide.ro.disconnect();
    unlinkSlide=null;
  }
  // Builds the swipeable recipe cards (and the dots when there are several) inside a container.
  function buildCardSlider(box,froms){
    box.innerHTML='';
    var sl=document.createElement('div'),tr=document.createElement('div'),dots=null;
    sl.className='cslider';tr.className='ctrack';sl.appendChild(tr);
    sl.setAttribute('role','group');sl.setAttribute('aria-roledescription','carousel');sl.setAttribute('aria-label','Source recipes');
    if(froms.length>1)sl.tabIndex=0;
    froms.forEach(function(f,fi){
      var card=recipeCardEl(f);
      card.setAttribute('role','group');card.setAttribute('aria-roledescription','slide');card.setAttribute('aria-label',(fi+1)+' of '+froms.length);
      tr.appendChild(card);
    });
    box.appendChild(sl);
    if(froms.length>1){
      dots=document.createElement('div');dots.className='cdots';
      froms.forEach(function(f,fi){
        var d=document.createElement('button');d.type='button';d.className='cdot';
        d.setAttribute('aria-label','Show recipe '+(fi+1)+' of '+froms.length);
        dots.appendChild(d);
      });
      box.appendChild(dots);
    }
    return {sl:sl,dots:dots};
  }
  function setupSlider(sl,dots){
    var tr=sl.firstChild,slides=Array.prototype.slice.call(tr.children),n=slides.length,
        dotEls=dots?Array.prototype.slice.call(dots.children):[],idx=0,cx=0,PAD=16,
        EZ='cubic-bezier(.2,.7,.2,1)',MS='.35s';
    function step(){return n>1?slides[1].offsetLeft-slides[0].offsetLeft:sl.clientWidth;}
    function hAt(p){
      p=Math.max(0,Math.min(n-1,p));
      var a=Math.floor(p),b=Math.min(n-1,a+1),f=p-a,ha=slides[a].offsetHeight,hb=slides[b].offsetHeight;
      return Math.round(ha+(hb-ha)*f)+PAD;
    }
    function paint(x){
      cx=x;
      tr.style.transform='translate3d('+x+'px,0,0)';
      var st=step()||1,p=Math.max(0,Math.min(n-1,-x/st)),cur=Math.round(p);
      sl.style.height=hAt(p)+'px';
      dotEls.forEach(function(d,i){
        var on=i===cur;d.classList.toggle('on',on);
        if(on)d.setAttribute('aria-current','true');else d.removeAttribute('aria-current');
      });
    }
    // lock onto exactly one card
    function go(i,animate){
      idx=Math.max(0,Math.min(n-1,i));
      if(animate&&!noMotion()){tr.style.transition='transform '+MS+' '+EZ;sl.style.transition='height '+MS+' '+EZ;}
      else{tr.style.transition='none';sl.style.transition='none';}
      paint(-idx*step());
    }
    dotEls.forEach(function(d,i){d.addEventListener('click',function(){go(i,true);});});
    var sx=0,sy=0,base=0,lock=null,pid=null,moved=false,samples=[];
    sl.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse'||n<2)return;
      var live=-idx*step();
      try{var t=getComputedStyle(tr).transform;if(t&&t!=='none')live=new DOMMatrix(t).m41;}catch(err){}
      tr.style.transition='none';sl.style.transition='none';paint(live);
      base=live;sx=e.clientX;sy=e.clientY;lock=null;moved=false;pid=e.pointerId;samples=[];
    });
    sl.addEventListener('pointermove',function(e){
      if(pid!==e.pointerId)return;
      var dx=e.clientX-sx,dy=e.clientY-sy;
      if(!lock&&(Math.abs(dx)>6||Math.abs(dy)>6)){
        lock=Math.abs(dx)>Math.abs(dy)?'h':'v';
        if(lock==='h')sl.setPointerCapture(e.pointerId);
      }
      if(lock!=='h')return;
      moved=true;
      var min=-(n-1)*step(),x=base+dx;
      if(x>0)x*=.25;else if(x<min)x=min+(x-min)*.25;
      samples.push({t:e.timeStamp,x:e.clientX});
      while(samples.length>2&&e.timeStamp-samples[0].t>100)samples.shift();
      paint(x);
    });
    function end(e){
      if(pid!==e.pointerId)return;
      pid=null;
      if(lock!=='h'){go(idx,true);return;}
      var st=step(),off=cx+idx*st,v=0,a=samples[0],b=samples[samples.length-1],next=idx;
      if(a&&b&&b.t>a.t&&e.timeStamp-b.t<80)v=(b.x-a.x)/(b.t-a.t);
      if(off<-st*.2||v<-.4)next=idx+1;
      else if(off>st*.2||v>.4)next=idx-1;
      go(next,true);
    }
    sl.addEventListener('pointerup',end);
    sl.addEventListener('pointercancel',end);
    // after a swipe a tap must not trigger anything on the card
    sl.addEventListener('click',function(e){if(moved){moved=false;e.preventDefault();e.stopPropagation();}},true);
    sl.addEventListener('keydown',function(e){
      if(e.key==='ArrowLeft'){e.preventDefault();go(idx-1,true);}
      else if(e.key==='ArrowRight'){e.preventDefault();go(idx+1,true);}
    });
    var ro=null;
    if(window.ResizeObserver){ro=new ResizeObserver(function(){if(pid===null)go(idx,false);});slides.forEach(function(x){ro.observe(x);});}
    go(0,false);
    return {ro:ro};
  }
  function openEdit(it){
    editTarget=it;
    editName.value=it.text;editBrand.value=it.brand||'';
    editQty.value=it.qty||'';
    if(it.unit)ensureOpt(editUnit,it.unit);
    editUnit.value=it.unit||'';
    editCat.value=it.cat||'';
    dlgEdit.showModal();
    dlgEdit.setAttribute('tabindex','-1');
    dlgEdit.focus({preventScroll:true});
  }
  // ---- Description window (v72): tapping an item opens this first; the pencil leads to the Edit item window ----
  var dlgDesc=document.getElementById('dlgDesc'),descText=document.getElementById('descText'),descCount=document.getElementById('descCount'),descTarget=null,descSlide=null,DESC_MAX=100;
  function teardownDesc(){if(descSlide&&descSlide.ro)descSlide.ro.disconnect();descSlide=null;}
  function syncDescCount(){
    var n=descText.value.length;
    descCount.textContent=n+'/'+DESC_MAX;descCount.classList.toggle('full',n>=DESC_MAX);
  }
  // Rebuilds everything except the text box, so unsaved text survives a trip to the Edit item window.
  function refreshDesc(){
    var it=descTarget;
    if(!it||items.indexOf(it)<0){if(dlgDesc.open)dlgDesc.close();return;}
    var nm=document.getElementById('descName');nm.textContent='';nm.appendChild(nameFrag(it));
    document.getElementById('descSub').textContent=[it.cat||'',it.qty?it.qty+'\u00a0'+unitLabel(it.qty,it.unit):''].filter(Boolean).join(' \u00b7 ');
    var cards=document.getElementById('descCards'),linked=!!(it.from&&it.from.length),sl=null,dots=null,tr;
    cards.innerHTML='';teardownDesc();
    if(linked){
      var lb=document.createElement('span');lb.className='flabel';lb.textContent=it.from.length>1?'From recipes':'From recipe';cards.appendChild(lb);
      sl=document.createElement('div');sl.className='cslider';
      tr=document.createElement('div');tr.className='ctrack';sl.appendChild(tr);
      if(it.from.length>1)sl.tabIndex=0;
      sl.setAttribute('role','group');sl.setAttribute('aria-roledescription','carousel');sl.setAttribute('aria-label','Source recipes');
      it.from.forEach(function(f,fi){
        var rc=recipes.find(function(x){return x.id===f.id;});
        var card=document.createElement('div');card.className='shophead'+(it.unlinked?' hasbrk':'');
        card.setAttribute('role','group');card.setAttribute('aria-roledescription','slide');card.setAttribute('aria-label',(fi+1)+' of '+it.from.length);
        var n=document.createElement('p');n.className='shopname';n.textContent=rc?rc.name:f.name;
        card.appendChild(n);
        if(rc&&rc.portions){
          var p=document.createElement('p');p.className='portions';
          p.textContent='up to '+rc.portions+(rc.portions===1?' portion':' portions');
          card.appendChild(p);
        }
        if(it.unlinked){var canRe=!!(it.orig&&it.from.length===1&&!isMulti(it));card.appendChild(brokenLink('cardbrk',canRe?function(){openRelink(it,true);}:null,isMulti(it)?'Re-linking not possible':null));}
        tr.appendChild(card);
      });
      cards.appendChild(sl);
      if(it.from.length>1){
        dots=document.createElement('div');dots.className='cdots';
        it.from.forEach(function(f,fi){
          var d=document.createElement('button');d.type='button';d.className='cdot';
          d.setAttribute('aria-label','Show recipe '+(fi+1)+' of '+it.from.length);
          dots.appendChild(d);
        });
        cards.appendChild(dots);
      }
    }
    cards.hidden=!linked;
    if(sl)descSlide=setupSlider(sl,dots);
  }
  function openDesc(it){
    descTarget=it;descText.value=it.desc||'';syncDescCount();
    dlgDesc.showModal();
    dlgDesc.setAttribute('tabindex','-1');
    dlgDesc.focus({preventScroll:true});   // the text box is deliberately not focused
    refreshDesc();descText.scrollTop=0;
  }
  function descDirty(){var it=descTarget;return !!it&&descText.value.trim()!==(it.desc||'');}
  function requestCloseDesc(){
    if(dlgDesc._closing)return;
    if(descDirty()){discardThen=function(){dlgDesc.close();};openDiscard();}
    else dlgDesc.close();
  }
  // Quantity and unit are edited in the Edit item window; this window only saves the description, which never unlinks the item.
  function saveDesc(){
    var it=descTarget;if(!it)return;
    if(!descDirty()){dlgDesc.close();return;}
    var v=descText.value.trim(),prev=it.desc;
    if(v)it.desc=v;else delete it.desc;
    save();
    dlgDesc.close();
    showToast('Item updated.',function(){
      if(prev)it.desc=prev;else delete it.desc;
      save();
    });
  }
  descText.addEventListener('input',function(e){
    syncDescCount();
    // a paste that was cut off by the limit also shakes the counter
    if(e.inputType==='insertFromPaste'&&descText.value.length>=DESC_MAX)shake(descCount);
  });
  // typing when the box is already full (and nothing is selected to be replaced) shakes the counter
  descText.addEventListener('beforeinput',function(e){
    if(e.inputType&&e.inputType.indexOf('insert')===0&&e.inputType!=='insertFromPaste'&&descText.value.length>=DESC_MAX&&descText.selectionStart===descText.selectionEnd)shake(descCount);
  });
  document.getElementById('descEdit').addEventListener('click',function(){if(descTarget)openEdit(descTarget);});
  document.getElementById('descSave').addEventListener('click',saveDesc);
  document.getElementById('dlgDescClose').addEventListener('click',requestCloseDesc);
  dlgDesc.addEventListener('click',function(ev){if(ev.target===dlgDesc)requestCloseDesc();});
  dlgDesc.addEventListener('close',function(){descTarget=null;teardownDesc();});
  document.getElementById('dlgEditClose').addEventListener('click',requestCloseEdit);
  dlgEdit.addEventListener('click',function(ev){if(ev.target===dlgEdit)requestCloseEdit();});
  var dlgUnlink=document.getElementById('dlgUnlink'),pendingEdit=null,
      unlinkTimer=timedConfirm(dlgUnlink,document.getElementById('unlinkConfirm'),document.getElementById('unlinkFill'),document.getElementById('unlinkLbl'),'Unlink and save',3);
  function applyEdit(it,t,qty,unit,cat,brand){
    var prev={text:it.text,qty:it.qty,unit:it.unit,cat:it.cat,brand:it.brand,unlinked:it.unlinked};
    var amountChanged=t!==it.text||qty!==it.qty||unit!==it.unit;
    if(brand)it.brand=brand;else delete it.brand;it.text=t;it.qty=qty;it.unit=unit;
    if(cat)it.cat=cat;else delete it.cat;
    recordHistory([{text:t,unit:unit,cat:cat}]);
    if(amountChanged&&it.from&&it.from.length){if(!prev.unlinked)it.orig={qty:prev.qty,unit:prev.unit,text:prev.text,brand:prev.brand};it.unlinked=true;}
    save();render();
    dlgEdit.close();
    showToast('Item updated.',function(){
      it.text=prev.text;it.qty=prev.qty;it.unit=prev.unit;
      if(prev.cat)it.cat=prev.cat;else delete it.cat;
      if(prev.brand)it.brand=prev.brand;else delete it.brand;
      if(prev.unlinked)it.unlinked=true;else{delete it.unlinked;delete it.orig;}
      save();render();
    });
  }
  document.getElementById('unlinkConfirm').addEventListener('click',function(){
    if(unlinkTimer.locked())return;
    var p=pendingEdit;pendingEdit=null;
    dlgUnlink.close();
    if(p)applyEdit(p.it,p.t,p.qty,p.unit,p.cat,p.brand);
  });
  document.getElementById('unlinkNo').addEventListener('click',function(){dlgUnlink.close();});
  // Cancelling (button, tap outside or Esc) simply falls back to the Edit item window underneath.
  dlgUnlink.addEventListener('click',function(ev){if(ev.target===dlgUnlink)dlgUnlink.close();});
  dlgUnlink.addEventListener('close',function(){pendingEdit=null;});
  dlgUnlink.addEventListener('close',teardownUnlinkSlider);
  // ---- Re-link: tapping the broken chain on an item that was unlinked by changing it restores its original quantity and unit ----
  var dlgRelink=document.getElementById('dlgRelink'),relinkTarget=null,
      relinkTimer=timedConfirm(dlgRelink,document.getElementById('relinkConfirm'),document.getElementById('relinkFill'),document.getElementById('relinkLbl'),'Confirm',3);
  var relinkFromEdit=false;
  function openRelink(it,fromEdit){
    if(!it||!it.from||it.from.length!==1||!it.orig||isMulti(it))return;
    relinkTarget=it;relinkFromEdit=!!fromEdit;
    document.getElementById('relinkMsg').textContent='This item will be re-linked to the following recipe:';
    var uc=document.getElementById('relinkCards');uc.innerHTML='';
    it.from.forEach(function(f){uc.appendChild(recipeCardEl(f));});
    relinkTimer.open();
  }
  document.getElementById('relinkConfirm').addEventListener('click',function(){
    if(relinkTimer.locked())return;
    var it=relinkTarget,fe=relinkFromEdit;relinkTarget=null;relinkFromEdit=false;
    dlgRelink.close();
    if(!it||items.indexOf(it)<0||!it.unlinked||!it.orig)return;
    if(fe&&dlgEdit.open)dlgEdit.close();   // the Edit window would still show the old quantity and unit
    var prev={qty:it.qty,unit:it.unit,text:it.text,brand:it.brand,orig:it.orig,manual:it.manual},o=prev.orig;
    it.qty=o.qty;it.unit=o.unit;
    // the name comes back too (items unlinked before v72 have no saved name and keep theirs)
    if(o.text!==undefined){it.text=o.text;if(o.brand)it.brand=o.brand;else delete it.brand;}
    delete it.unlinked;delete it.orig;delete it.manual;
    save();render();if(dlgDesc.open)refreshDesc();
    showToast('Item re-linked.',function(){
      it.qty=prev.qty;it.unit=prev.unit;it.text=prev.text;if(prev.brand)it.brand=prev.brand;else delete it.brand;it.unlinked=true;it.orig=prev.orig;if(prev.manual)it.manual=true;
      save();render();
    });
  });
  document.getElementById('relinkNo').addEventListener('click',function(){dlgRelink.close();});
  dlgRelink.addEventListener('click',function(ev){if(ev.target===dlgRelink)dlgRelink.close();});
  dlgRelink.addEventListener('close',function(){relinkTarget=null;relinkFromEdit=false;});
  document.getElementById('editForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var it=editTarget,t=editName.value.trim(),qty=parseFloat(editQty.value),unit=editUnit.value,cat=editCat.value,brand=editBrand.value.trim();
    if(!it||!t)return;
    if(!(qty>0)||!unit){shake(editQty);editQty.focus();return;}
    var amountChanged=t!==it.text||qty!==it.qty||unit!==it.unit;
    if(!amountChanged&&cat===(it.cat||'')&&brand===(it.brand||'')){dlgEdit.close();return;}
    if(amountChanged&&it.from&&it.from.length&&!it.unlinked){
      pendingEdit={it:it,t:t,qty:qty,unit:unit,cat:cat,brand:brand};
      var bs=buildCardSlider(document.getElementById('unlinkCards'),it.from);
      document.getElementById('unlinkMsg').textContent=(it.from.length>1?'This item is linked to these recipes.':'This item is linked to this recipe.')+' Saving your changes will unlink it from '+(it.from.length>1?'those recipes':'that recipe')+'. The recipe label stays on the item.';
      unlinkTimer.open();
      teardownUnlinkSlider();unlinkSlide=setupSlider(bs.sl,bs.dots);
      return;
    }
    applyEdit(it,t,qty,unit,cat,brand);
  });

  function closeTips(){
    document.querySelectorAll('.unlinked.show').forEach(function(b){b.classList.remove('show');});
  }
  document.addEventListener('click',closeTips);
  document.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('button');
    if(b&&b.id!=='toastUndo')hideToast();
  },true);

  var query='',searchOpen=false;
  function applyListFilter(animate){
    var q=currentView==='list'?query.trim().toLowerCase():'',any=false;
    var re=q?searchRe(q,'iu'):null,hre=q?searchRe(q,'giu'):null;
    if(list.querySelector('ul.grid')){
      list.querySelectorAll('.grid>li').forEach(function(li){
        var s=!q||re.test(li.dataset.name);
        li.hidden=!s;if(s)any=true;
        var nm=li.querySelector('.tname');
        if(nm){clearMarks(nm);if(q)markText(nm,hre);}
      });
      toggleEl(document.getElementById('noItems'),!!q&&!any&&items.length>0,false);
      return;
    }
    list.querySelectorAll('ul').forEach(function(ul){
      if(ul.querySelector('li.empty')){markLast(ul);return;}
      var lis=ul.querySelectorAll('li'),shows=[],n=0;
      lis.forEach(function(li){
        var s=!q||re.test(li.dataset.name);shows.push(s);if(s)n++;
        var nm=li.querySelector('.name');
        if(nm){clearMarks(nm);if(q)markText(nm,hre);}
      });
      if(ul.classList.contains('donegrp'))ul.dataset.count=n;
      var wasShown=ul.dataset.shown!=='0';
      if(n>0){
        any=true;
        if(!wasShown){
          lis.forEach(function(li,i){setLi(li,shows[i],false);});
          ul.dataset.shown='1';toggleEl(ul,true,animate);
        }else lis.forEach(function(li,i){setLi(li,shows[i],animate);});
      }else if(wasShown){ul.dataset.shown='0';toggleEl(ul,false,animate);}
      markLast(ul);
    });
    toggleEl(document.getElementById('noItems'),!!q&&!any&&items.length>0,animate);
  }
  function applyRecipeFilter(animate){
    var q=currentView==='recipes'?query.trim().toLowerCase():'',any=false;
    var re=q?searchRe(q,'iu'):null,hre=q?searchRe(q,'giu'):null;
    recipesEl.querySelectorAll('.recipe,.rtile').forEach(function(card){
      var r=recipes.find(function(x){return String(x.id)===card.dataset.rid;});
      if(!r)return;
      var nameHit=!q||re.test(r.name);
      var hits=q?r.items.filter(function(it){return re.test(fullName(it));}):[];
      var visible=nameHit||hits.length>0,shown=card.dataset.shown!=='0';
      if(card.classList.contains('rtile')){
        card.hidden=!visible;card.dataset.shown=visible?'1':'0';if(visible)any=true;
        var tnm=card.querySelector('.rname');
        if(tnm){clearMarks(tnm);if(q&&visible)markText(tnm,hre);}
        return;
      }
      var title=card.querySelector('.ctitle');
      clearMarks(title);if(q)markText(title,hre);
      // Matching ingredients unfold under the title; the card still opens the full recipe when tapped.
      var hb=card.querySelector('.hits'),box=card.querySelector('.hrows');
      if(hits.length){
        box.innerHTML='';
        hits.forEach(function(it){
          var row=document.createElement('span');row.className='hrow';
          var a=document.createElement('span');a.className='hq';a.textContent=it.qty+'\u00a0'+unitLabel(it.qty,it.unit);
          var n=document.createElement('span');n.className='hn';n.appendChild(nameFrag(it));
          if(q)markText(n,hre);
          row.appendChild(a);row.appendChild(n);box.appendChild(row);
        });
      }
      hb.classList.toggle('open',hits.length>0);
      hb.setAttribute('aria-hidden',hits.length?'false':'true');
      if(visible){
        any=true;
        if(!shown){card.dataset.shown='1';toggleEl(card,true,animate);}
      }else if(shown){card.dataset.shown='0';toggleEl(card,false,animate);}
    });
    if(recipeLayout==='tile')fitRTiles();
    toggleEl(document.getElementById('noRecipes'),!!q&&!any&&recipes.length>0,animate);
  }

  var searchbar=document.getElementById('searchbar'),searchInput=document.getElementById('searchInput'),fabbar=document.getElementById('fabbar');
  // Search bar timing, tuned to the roughly 250-300 ms decelerating slide of the iOS/Android keyboard.
  var KB_MS=280,KB_EASE='cubic-bezier(.22,.9,.3,1)';
  // The search hint slides to its end only when it is wider than the bar: wait, slide, hold, jump back, repeat.
  var searchPhEl=document.getElementById('searchPh'),searchPhText=document.getElementById('searchPhText'),phAnim=null,phW=0,PH_HOLD=1200,PH_END=900,PH_SPEED=0.045;
  function stopPh(){if(phAnim){phAnim.cancel();phAnim=null;}}
  function startPh(){
    stopPh();
    if(!searchOpen||searchInput.value||noMotion()||!searchPhText.animate)return;
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
  function currentSearchBtn(){return document.querySelector('#fabRow .searchbtn');}
  function updateRow(v){
    var rec=v==='recipes',add=document.getElementById('openItem'),sb=currentSearchBtn();
    var l1=rec?'Add recipe':'Add item',l2=rec?'Search recipes':'Search items';
    document.getElementById('openItemLabel').textContent=l1;
    sb.setAttribute('aria-label',l2);sb.title=l2;
  }
  function applyCurrent(animate){if(currentView==='list')applyListFilter(animate);else applyRecipeFilter(animate);}
  function openSearch(){
    if(searchOpen||uiLocked)return;
    searchOpen=true;
    closeMenu();
    var btn=currentSearchBtn(),br=btn.getBoundingClientRect(),fr=fabbar.getBoundingClientRect();
    searchbar.style.height=br.height+'px';
    var phText=currentView==='list'?'Search ingredients or items...':'Search recipes or ingredients...';
    stopPh();searchPhEl.classList.remove('hide');searchPhText.textContent=phText;
    searchInput.setAttribute('aria-label',phText.replace(/\.+$/,''));
    searchbar.hidden=false;btn.style.visibility='hidden';fabbar.classList.add('searching');
    // Focus right away (iOS only allows it inside the tap) so the keyboard slides up while the bar expands.
    searchInput.focus({preventScroll:true});
    if(!noMotion()&&searchbar.animate){
      var oa=searchbar.animate([{left:(br.left-fr.left)+'px',width:br.width+'px'},{left:'18px',width:(fr.width-36)+'px'}],{duration:KB_MS,easing:KB_EASE});
      oa.onfinish=function(){if(searchOpen){fabbar.classList.add('covered');startPh();}};
      var mg=searchbar.querySelector('.sicon svg');
      if(mg&&mg.animate)mg.animate([{transform:'scale(.78)'},{transform:'scale(1)'}],{duration:KB_MS*.6,easing:'cubic-bezier(.34,1.56,.64,1)'});
    }else{fabbar.classList.add('covered');startPh();}
  }
  function closeSearch(animate){
    if(!searchOpen)return;
    searchOpen=false;
    searchInput.blur();   // keyboard slides away while the bar collapses
    fabbar.classList.remove('searching','covered');
    query='';searchInput.value='';
    if(phAnim)phAnim.pause();searchPhEl.classList.remove('hide');
    applyCurrent(animate);
    var btn=currentSearchBtn(),br=btn.getBoundingClientRect(),fr=fabbar.getBoundingClientRect();
    var done=function(){stopPh();searchbar.hidden=true;btn.style.visibility='';};
    if(!animate||noMotion()||!searchbar.animate){done();return;}
    var a=searchbar.animate([{left:'18px',width:(fr.width-36)+'px'},{left:(br.left-fr.left)+'px',width:br.width+'px'}],{duration:KB_MS,easing:KB_EASE,fill:'forwards'});
    a.onfinish=function(){done();a.cancel();};
  }
  document.querySelectorAll('.searchbtn').forEach(function(b){b.addEventListener('click',openSearch);});
  var searchCloseBtn=document.getElementById('searchClose'),closeWait=false;
  // The x gives the same little pop as the magnifier, then the bar collapses.
  function requestCloseSearch(){
    if(!searchOpen||closeWait)return;
    if(noMotion()||!searchCloseBtn.animate){closeSearch(true);return;}
    closeWait=true;
    searchCloseBtn.animate([{transform:'scale(.78)'},{transform:'scale(1)'}],{duration:KB_MS*.6,easing:'cubic-bezier(.34,1.56,.64,1)'});
    setTimeout(function(){closeWait=false;closeSearch(true);},KB_MS*.6+2);
  }
  searchCloseBtn.addEventListener('click',requestCloseSearch);
  searchInput.addEventListener('input',function(){
    query=searchInput.value;applyCurrent(true);
    if(query){searchPhEl.classList.add('hide');stopPh();}
    else{searchPhEl.classList.remove('hide');startPh();}
  });
  searchInput.addEventListener('keydown',function(ev){if(ev.key==='Escape')requestCloseSearch();});
  window.addEventListener('resize',function(){if(searchOpen&&!searchInput.value&&searchPhEl.clientWidth!==phW)startPh();});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if(searchOpen&&!searchInput.value)startPh();});

  var dlgChange=document.getElementById('dlgChange'),
      changeName=document.getElementById('changeName'),
      changePortions=document.getElementById('changePortions'),
      changeTarget=null;
  function openChange(r){
    changeTarget=r;
    changeName.value=r.name;
    ensureOpt(changePortions,r.portions||4);
    changePortions.value=r.portions||4;
    dlgChange.showModal();
    dlgChange.setAttribute('tabindex','-1');
    dlgChange.focus({preventScroll:true});
  }
  // Closing the window without saving asks first when the name or the portions were changed (same as the Edit item window).
  function changeDirty(){
    var r=changeTarget;
    return !!r&&(changeName.value.trim()!==r.name||parseInt(changePortions.value,10)!==(r.portions||4));
  }
  function requestCloseChange(){
    if(dlgChange._closing)return;
    if(changeDirty()){discardThen=function(){dlgChange.close();};openDiscard();}
    else dlgChange.close();
  }
  document.getElementById('dlgChangeClose').addEventListener('click',requestCloseChange);
  dlgChange.addEventListener('click',function(ev){if(ev.target===dlgChange)requestCloseChange();});
  // A quantity field that is empty or invalid shakes (instead of the browser's own bubble).
  ['qty','editQty','reQty','ingQty'].forEach(function(id){shakeOnInvalid(document.getElementById(id));});
  document.getElementById('changeForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var r=changeTarget,t=changeName.value.trim(),p=parseInt(changePortions.value,10);
    if(!r||!t||!(p>0))return;
    if(t===r.name&&p===r.portions){dlgChange.close();return;}
    dismissSearch();
    var prev={name:r.name,portions:r.portions};
    function rename(n){items.forEach(function(it){(it.from||[]).forEach(function(f){if(f.id===r.id)f.name=n;});});}
    r.name=t;r.portions=p;rename(t);
    saveR();save();renderRecipes();render();
    dlgChange.close();
    showToast('Recipe updated.',function(){
      r.name=prev.name;r.portions=prev.portions;rename(prev.name);
      saveR();save();renderRecipes();render();
    });
  });



  var addSuggest=makeSuggest(input,document.getElementById('suggest'),null,document.getElementById('qty'),document.getElementById('addCat'));
  function nameCandidates(q,limit){return findNames(q,limit,items,recipes,itemHistory);}
  dlgItem.addEventListener('close',function(){
    addSuggest.hide();
    document.getElementById('qty').value='';document.getElementById('unit').value='pcs';
    input.value='';document.getElementById('addCat').value='';document.getElementById('brand').value='';
  });

  function pressFlash(btn,fn){
    btn.addEventListener('click',function(){
      if(btn.classList.contains('pressed'))return;
      btn.classList.add('pressed');
      setTimeout(function(){btn.classList.remove('pressed');fn();},250);
    });
  }

  initDialogs({dlgDesc:function(){requestCloseDesc();},dlgEdit:function(){requestCloseEdit();},dlgRecipeEdit:function(){requestCloseRE();},dlgAddList:function(){onAddListNo();},dlgChange:function(){requestCloseChange();}});

  document.addEventListener('touchstart',function(){},{passive:true});

  var rsort='az',RORDER=['az','za','pu','pd','iu','id'];
  try{var rs=localStorage.getItem('shopping-list-rsort');if(RORDER.indexOf(rs)>-1)rsort=rs;}catch(e){}
  var rAzDir='az',rPDir='pu',rIDir='iu';
  try{
    if(localStorage.getItem('shopping-list-razdir')==='za')rAzDir='za';
    if(localStorage.getItem('shopping-list-rpdir')==='pd')rPDir='pd';
    if(localStorage.getItem('shopping-list-ridir')==='id')rIDir='id';
  }catch(e){}
  if(rsort==='az'||rsort==='za')rAzDir=rsort;else if(rsort==='pu'||rsort==='pd')rPDir=rsort;else rIDir=rsort;
  function sortedRecipes(){return sortRecipes(recipes,rsort);}
  var rchips=document.querySelectorAll('#recipeSort .chip');
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
  rchips.forEach(function(c){
    c.addEventListener('click',function(){
      if(uiLocked)return;
      var prev=rsort,next=c.dataset.rsort;
      if(next==='p'){next=(prev==='pu'||prev==='pd')?(prev==='pu'?'pd':'pu'):rPDir;rPDir=next;}
      if(next==='a'){next=(prev==='az'||prev==='za')?(prev==='az'?'za':'az'):rAzDir;rAzDir=next;}
      if(next==='i'){next=(prev==='iu'||prev==='id')?(prev==='iu'?'id':'iu'):rIDir;rIDir=next;}
      if(next===prev)return;
      var fam=function(m){return m==='az'||m==='za'?0:(m==='pu'||m==='pd'?1:2);};
      var slide=fam(prev)!==fam(next);
      var old=slide?recipesEl.cloneNode(true):null,top=recipesEl.offsetTop;
      rsort=next;
      try{localStorage.setItem('shopping-list-rsort',rsort);localStorage.setItem('shopping-list-razdir',rAzDir);localStorage.setItem('shopping-list-rpdir',rPDir);localStorage.setItem('shopping-list-ridir',rIDir);}catch(e){}
      syncRChips();
      if(slide){
        renderRecipes();
        slideLists(old,top,RORDER.indexOf(next)>RORDER.indexOf(prev)?1:-1,recipesEl);
      }else flipReorder(recipesEl,'.recipe[data-rid],.rtile[data-rid]','rid',renderRecipes);
    });
  });
  syncRChips();

  function ensureOpt(sel,v){
    var has=Array.prototype.some.call(sel.options,function(o){return o.value===String(v);});
    if(!has){
      var o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o);
    }
  }

  function animateTabIcon(v){
    if(noMotion())return;
    var tab=document.querySelector('.tab[data-view="'+v+'"]'),svg=tab&&tab.querySelector('svg');
    if(!svg||!svg.animate)return;
    if(v==='recipes'){
      svg.animate([
        {transform:'translateY(0) scale(1,1)'},
        {transform:'translateY(1px) scale(1.08,.9)',offset:.15},
        {transform:'translateY(-7px) scale(.94,1.1)',offset:.4},
        {transform:'translateY(0) scale(1.06,.94)',offset:.65},
        {transform:'translateY(-2px) scale(.99,1.02)',offset:.82},
        {transform:'translateY(0) scale(1,1)'}
      ],{duration:600,easing:'ease-out'});
      svg.querySelectorAll('.bub').forEach(function(b,i){
        b.animate([
          {transform:'translateY(0) scale(1)'},
          {transform:'translateY(0) scale(1)',offset:.15},
          {transform:'translateY('+(-5-i*1.5)+'px) scale(1.2)',offset:.45},
          {transform:'translateY(1px) scale(.95)',offset:.72},
          {transform:'translateY(0) scale(1)'}
        ],{duration:640,delay:i*45,easing:'ease-out'});
      });
    }else{
      svg.animate([
        {transform:'translateY(0) rotate(0deg)'},
        {transform:'translateY(-3px) rotate(-5deg)',offset:.35},
        {transform:'translateY(0) rotate(3deg)',offset:.7},
        {transform:'translateY(0) rotate(0deg)'}
      ],{duration:600,easing:'ease-out'});
      svg.querySelectorAll('.dot').forEach(function(d,i){
        d.animate([
          {transform:'scale(1)'},{transform:'scale(0)',offset:.2},
          {transform:'scale(1.6)',offset:.5},{transform:'scale(.9)',offset:.75},{transform:'scale(1)'}
        ],{duration:600,delay:i*70,easing:'ease-out'});
      });
      svg.querySelectorAll('.ln').forEach(function(l,i){
        l.animate([
          {transform:'scaleX(1)'},{transform:'scaleX(.15)',offset:.2},
          {transform:'scaleX(1.12)',offset:.55},{transform:'scaleX(.97)',offset:.8},{transform:'scaleX(1)'}
        ],{duration:600,delay:i*70,easing:'ease-out'});
      });
    }
  }

  function setSwap(c){
    var a=c.querySelector('.la'),z=c.querySelector('.lz');
    if(!a||!z||!a.offsetWidth)return;
    c.style.setProperty('--da',(z.offsetLeft+z.offsetWidth-a.offsetWidth-a.offsetLeft)+'px');
    c.style.setProperty('--dz',(a.offsetLeft-z.offsetLeft)+'px');
  }
  function setSwapAll(){document.querySelectorAll('.azchip').forEach(setSwap);}
  setSwapAll();
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(setSwapAll);

  // A confirmation window whose button stays locked (countdown + sweeping fill) for a few seconds.
  function timedConfirm(dlg,btn,fill,lbl,word,secs){
    var timer=null,anim=null;
    dlg.addEventListener('close',function(){
      clearInterval(timer);
      if(anim){anim.cancel();anim=null;}
    });
    return {
      open:function(){
        if(dlg.open)return;
        btn.classList.add('locked');btn.setAttribute('aria-disabled','true');
        var left=secs;
        lbl.textContent=word+' ('+left+')';
        clearInterval(timer);
        timer=setInterval(function(){
          left--;
          if(left>0){lbl.textContent=word+' ('+left+')';}
          else{clearInterval(timer);lbl.textContent=word;btn.classList.remove('locked');btn.setAttribute('aria-disabled','false');}
        },1000);
        if(anim)anim.cancel();
        if(fill.animate&&!noMotion()){
          anim=fill.animate([{width:'0%'},{width:'100%'}],{duration:secs*1000,easing:'linear',fill:'forwards'});
        }
        dlg.showModal();
        dlg.setAttribute('tabindex','-1');
        dlg.focus({preventScroll:true});
      },
      locked:function(){
        if(!btn.classList.contains('locked'))return false;
        shake(lbl);
        return true;
      }
    };
  }

  var dlgDelete=document.getElementById('dlgDelete'),
      deleteYes=document.getElementById('deleteYes'),
      deleteFill=document.getElementById('deleteFill'),
      deleteLbl=document.getElementById('deleteLbl'),
      deleteTarget=null,
      deleteConfirm=timedConfirm(dlgDelete,deleteYes,deleteFill,deleteLbl,'Yes',5);
  function openDelete(r){
    deleteTarget=r;
    document.getElementById('deleteName').textContent=r.name;
    document.getElementById('deletePortions').textContent='up to '+r.portions+(r.portions===1?' portion':' portions');
    document.getElementById('deleteMsg').textContent='Delete this recipe and all of its ingredients?';
    deleteConfirm.open();
  }
  function performDelete(r){
    var idx=recipes.indexOf(r);
    store.setList('recipes',recipes.filter(function(x){return x!==r;}));
    saveR();renderRecipes();
    showToast('Recipe deleted.',function(){
      recipes.splice(Math.min(idx,recipes.length),0,r);
      saveR();renderRecipes();
    });
  }
  deleteYes.addEventListener('click',function(){
    if(deleteConfirm.locked())return;
    if(!deleteTarget)return;
    var r=deleteTarget;deleteTarget=null;
    dlgDelete.close();
    dismissSearch();
    performDelete(r);
  });
  document.getElementById('deleteCancel').addEventListener('click',function(){dlgDelete.close();});
  document.getElementById('deleteClose').addEventListener('click',function(){dlgDelete.close();});
  dlgDelete.addEventListener('click',function(ev){if(ev.target===dlgDelete)dlgDelete.close();});

  function enableDrag(grip,li,ul,r){
    grip.addEventListener('pointerdown',function(ev){
      if(query.trim()||(ev.pointerType==='mouse'&&ev.button!==0))return;
      var lis=Array.prototype.slice.call(ul.querySelectorAll('li:not(.empty)'));
      if(lis.length<2)return;
      ev.preventDefault();
      var from=lis.indexOf(li),to=from,startY=ev.clientY;
      var rects=lis.map(function(x){return x.getBoundingClientRect();});
      var h=rects[from].height,last=lis.length-1;
      grip.setPointerCapture(ev.pointerId);
      li.classList.add('dragging');
      lis.forEach(function(x){if(x!==li)x.style.transition='transform .2s ease';});
      document.body.style.userSelect='none';
      function move(e){
        var dy=Math.max(rects[0].top-rects[from].top,Math.min(rects[last].top-rects[from].top,e.clientY-startY));
        li.style.transform='translateY('+dy+'px)';
        var center=rects[from].top+dy+h/2,n=0;
        rects.forEach(function(rc,j){if(j!==from&&rc.top+rc.height/2<center)n++;});
        to=n;
        lis.forEach(function(x,j){
          if(x===li)return;
          var s=0;
          if(from<to&&j>from&&j<=to)s=-h;
          else if(from>to&&j>=to&&j<from)s=h;
          x.style.transform=s?'translateY('+s+'px)':'';
        });
      }
      function up(){
        grip.removeEventListener('pointermove',move);
        grip.removeEventListener('pointerup',up);
        grip.removeEventListener('pointercancel',up);
        document.body.style.userSelect='';
        var snap=to===from?0:rects[to].top+(to>from?rects[to].height-h:0)-rects[from].top;
        li.style.transition='transform .15s ease';
        li.style.transform='translateY('+snap+'px)';
        setTimeout(function(){
          lis.forEach(function(x){x.style.transform='';x.style.transition='';});
          li.classList.remove('dragging');
          if(to!==from){
            var m=r.items.splice(from,1)[0];
            r.items.splice(to,0,m);
            saveR();renderRecipes();
          }
        },160);
      }
      grip.addEventListener('pointermove',move);
      grip.addEventListener('pointerup',up);
      grip.addEventListener('pointercancel',up);
    });
  }

  var dlgDiscard=document.getElementById('dlgDiscard'),
      discardYes=document.getElementById('discardYes'),
      discardFill=document.getElementById('discardFill'),
      discardLbl=document.getElementById('discardLbl'),
      discardThen=null,
      discConfirm=timedConfirm(dlgDiscard,discardYes,discardFill,discardLbl,'Yes',2);
  function editDirty(){
    var it=editTarget;
    return !!it&&(editName.value.trim()!==it.text||editBrand.value.trim()!==(it.brand||'')||(parseFloat(editQty.value)||0)!==(it.qty||0)||editUnit.value!==(it.unit||'')||editCat.value!==(it.cat||''));
  }
  function requestCloseEdit(){
    if(dlgEdit._closing||dlgEdit.getAttribute('data-x'))return;
    if(editDirty()){discardThen=function(){dlgEdit.close();};openDiscard();}
    else dlgEdit.close();
  }
  function openDiscard(){
    discConfirm.open();
  }
  discardYes.addEventListener('click',function(){
    if(discConfirm.locked())return;
    dlgDiscard.close();
    if(discardThen)discardThen();
  });
  document.getElementById('discardCancel').addEventListener('click',function(){dlgDiscard.close();});
  dlgDiscard.addEventListener('click',function(ev){if(ev.target===dlgDiscard)dlgDiscard.close();});

  function makeSuggest(inp,box,unitSel,qtySel,catSel){return makeSuggestFor(inp,box,unitSel,qtySel,catSel,nameCandidates);}
  var recipeSuggest=makeSuggest(document.getElementById('ingName'),document.getElementById('suggestR'),ingUnit,ingQty,ingCat);
  // Closing (or dismissing) an Add item window throws away whatever was typed.
  dlg.addEventListener('close',function(){
    ingQty.value='';ingUnit.value='pcs';ingName.value='';ingCat.value='';ingBrand.value='';
    recipeSuggest.hide();
  });
  var editSuggest=makeSuggest(editName,document.getElementById('suggestE'),null,{value:1},editCat);
  dlgEdit.addEventListener('close',editSuggest.hide);
  dlgEdit.addEventListener('close',teardownEditSlider);
  dlgEdit.addEventListener('close',function(){if(dlgDesc.open)refreshDesc();});

  var dlgAddList=document.getElementById('dlgAddList'),
      addListNo=document.getElementById('addListNo'),
      addListFill=document.getElementById('addListFill'),
      addListLbl=document.getElementById('addListLbl'),
      addListTarget=null,addListItem=null,
      addConfirm=timedConfirm(dlgAddList,addListNo,addListFill,addListLbl,'No',2);
  function linkedFrom(r){
    var f0=null;
    items.forEach(function(x){(x.from||[]).forEach(function(f){if(f.id===r.id&&!f0)f0=f;});});
    return f0;
  }
  function linkedToRecipe(r){return !!linkedFrom(r);}
  // the most portions of this recipe that any item on the list covers (items can differ when ingredients were skipped once)
  function listedPortions(r){
    var m=0;
    items.forEach(function(x){(x.from||[]).forEach(function(f){if(f.id===r.id&&f.sp>m)m=f.sp;});});
    return m;
  }
  function openAddList(r,item){
    addListTarget=r;addListItem=item;
    document.getElementById('addListName').textContent=r.name;
    document.getElementById('addListPortions').textContent='up to '+r.portions+(r.portions===1?' portion':' portions');
    addConfirm.open();
  }
  function onAddListNo(){
    if(!addListTarget)return;
    if(addConfirm.locked())return;
    var r=addListTarget;addListTarget=null;
    dlgAddList.close();
    showToast('Item added. Add another?',function(){openIngredient(r);},7000,'Yes');
  }
  addListNo.addEventListener('click',onAddListNo);
  dlgAddList.addEventListener('click',function(ev){if(ev.target===dlgAddList)onAddListNo();});
  document.getElementById('addListYes').addEventListener('click',function(){
    if(!addListTarget)return;
    var r=addListTarget;addListTarget=null;
    dlgAddList.close();
    var sp=listedPortions(r)||r.portions,fac=sp/(r.portions||1);
    var missing=addListItem?[addListItem]:[];
    var undo=addToShopping(missing.map(function(it){
      return{text:it.text,qty:Math.max(0.01,Math.round(it.qty*fac*100)/100),unit:it.unit,cat:it.cat,brand:it.brand};
    }),r,sp,true);
    showToast('Item added to Shopping list.',undo,7000);
  });

  function recipeCardEl(f){
    var rc=recipes.find(function(x){return x.id===f.id;});
    var card=document.createElement('div');card.className='shophead';
    var n=document.createElement('p');n.className='shopname';n.textContent=rc?rc.name:f.name;
    card.appendChild(n);
    if(rc&&rc.portions){
      var p=document.createElement('p');p.className='portions';
      p.textContent='up to '+rc.portions+(rc.portions===1?' portion':' portions');
      card.appendChild(p);
    }
    return card;
  }

  // Checking an item off shows a banner with an instant Undo.
  function checkedToast(it){
    showToast('Item checked off.',function(){if(items.indexOf(it)>-1)setChecked([it],false);});
  }
  var uncheckBtn=document.getElementById('uncheck');
  function setChecked(arr,val){
    arr.forEach(function(x){
      x.done=val;
      var li=list.querySelector('li[data-key="'+keyFor(x)+'"]');
      if(!li)return;
      li.classList.toggle('done',val);
      var cb=li.querySelector('input[type=checkbox]');
      if(cb)cb.checked=val;
      var tl=li.querySelector('.tile');
      if(tl)tl.classList.toggle('done',val);
    });
    save();syncClear();reorderSoon(300,arr);
  }
  uncheckBtn.addEventListener('click',function(){
    var was=items.filter(function(x){return x.done;});
    if(was.length<2)return;
    setChecked(was,false);
    showToast('Items unchecked.',function(){setChecked(was,true);},7000);
  });
  var wipeBtn=document.getElementById('wipe');
  wipeBtn.addEventListener('click',function(){if(items.length)openWipe();});
  function doWipe(){
    if(!items.length)return;
    var all=items.slice();
    store.setList('items',[]);
    save();render();
    showToast('List cleared.',function(){store.setList('items',all.slice());save();render();},7000);
  }
  var dlgWipe=document.getElementById('dlgWipe'),
      wipeYes=document.getElementById('wipeYes'),
      wipeFill=document.getElementById('wipeFill'),
      wipeLbl=document.getElementById('wipeLbl'),
      wipeConfirm=timedConfirm(dlgWipe,wipeYes,wipeFill,wipeLbl,'Yes',5);
  function openWipe(){
    wipeConfirm.open();
  }
  wipeYes.addEventListener('click',function(){
    if(wipeConfirm.locked())return;
    dlgWipe.close();
    doWipe();
  });
  document.getElementById('wipeNo').addEventListener('click',function(){dlgWipe.close();});
  dlgWipe.addEventListener('click',function(ev){if(ev.target===dlgWipe)dlgWipe.close();});
  var layoutBtn=document.getElementById('layoutBtn'),layoutBtnRow=document.getElementById('layoutBtnRow'),layoutToggle=document.getElementById('layoutToggle'),recipeLayoutBtn=document.getElementById('recipeLayoutBtn');
  function syncLayoutBtn(){
    var g=layoutMode==='grid';
    [layoutBtn,layoutBtnRow].forEach(function(b){
      b.classList.toggle('grid',g);
      b.setAttribute('aria-checked',g?'true':'false');
    });
    var t=recipeLayout==='tile',lbl=t?'Switch to list layout':'Switch to tile layout';
    layoutToggle.classList.toggle('tiles',t);
    layoutToggle.setAttribute('aria-checked',t?'true':'false');
    layoutToggle.setAttribute('aria-label',lbl);layoutToggle.title=lbl;
    recipeLayoutBtn.classList.toggle('grid',t);
    recipeLayoutBtn.setAttribute('aria-checked',t?'true':'false');
  }
  function flipRecipeLayout(){
    if(uiLocked)return;
    recipeLayout=recipeLayout==='tile'?'card':'tile';
    try{localStorage.setItem(RLKEY,recipeLayout);}catch(e){}
    syncLayoutBtn();renderRecipes();
  }
  layoutToggle.addEventListener('click',function(){
    layoutToggle.classList.add('pressed');
    setTimeout(function(){layoutToggle.classList.remove('pressed');},125);
    flipRecipeLayout();
  });
  recipeLayoutBtn.addEventListener('click',flipRecipeLayout);
  function flipListLayout(){
    if(uiLocked)return;
    layoutMode=layoutMode==='grid'?'list':'grid';
    try{localStorage.setItem(LKEY,layoutMode);}catch(e){}
    syncLayoutBtn();render();
  }
  layoutBtn.addEventListener('click',flipListLayout);
  layoutBtnRow.addEventListener('click',flipListLayout);
  syncLayoutBtn();
  var menuBtn=document.getElementById('menuBtn');
  function openMenu(){
    if(searchOpen)closeSearch(true);   // opening the menu dismisses an active search
    fabbar.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded','true');
  }
  function closeMenu(){
    fabbar.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded','false');
  }
  menuBtn.addEventListener('click',function(){
    if(fabbar.classList.contains('menu-open'))closeMenu();else openMenu();
  });
  [wipeBtn,clearBtn,uncheckBtn].forEach(function(b){b.addEventListener('click',closeMenu);});
  document.addEventListener('click',function(ev){
    if(!fabbar.classList.contains('menu-open'))return;
    if(ev.target.closest('#menuBtn,#menu'))return;
    closeMenu();
  });
  function syncClear(){
    var n=items.filter(function(x){return x.done;}).length;
    var onList=currentView==='list',has=onList?items.length>0:recipes.length>0;
    wipeBtn.hidden=!onList||!items.length;
    clearBtn.hidden=!onList||n<1;
    uncheckBtn.hidden=!onList||n<2;
    menuBtn.hidden=!onList||!items.length;
    layoutToggle.hidden=onList||!recipes.length;
    recipeLayoutBtn.hidden=!recipes.length;
    if(!onList)closeMenu();
    document.getElementById('menuSep').hidden=!onList||!items.length;
    layoutBtnRow.hidden=!items.length;
    var sb=document.querySelector('#fabRow .searchbtn');if(sb)sb.hidden=!has;
    if(!has){closeMenu();if(searchOpen)closeSearch(false);}
    syncLayoutBtn();
  }

  var dlgRemove=document.getElementById('dlgRemove'),
      removeYes=document.getElementById('removeYes'),
      removeFill=document.getElementById('removeFill'),
      removeLbl=document.getElementById('removeLbl'),
      removeConfirm=timedConfirm(dlgRemove,removeYes,removeFill,removeLbl,'Yes',3);
  function openRemoveChecked(){
    removeConfirm.open();
  }
  removeYes.addEventListener('click',function(){
    if(removeConfirm.locked())return;
    dlgRemove.close();
    removeChecked();
  });
  document.getElementById('removeNo').addEventListener('click',function(){dlgRemove.close();});
  dlgRemove.addEventListener('click',function(ev){if(ev.target===dlgRemove)dlgRemove.close();});

  if(!itemHistory.length){
    var seed=items.map(function(i){return{text:i.text,unit:i.unit,cat:i.cat};});
    recipes.forEach(function(r){(r.items||[]).forEach(function(i){seed.push({text:i.text,unit:i.unit,cat:i.cat});});});
    if(seed.length)recordHistory(seed);
  }
  // Data from the server (sync.ts calls store.replaceAll / store.applyChanges): the store has already updated and
  // saved the list, so all that is left to do here is to redraw.
  store.onRemoteChange(function(kind,how){
    if(kind==='items'){
      if(how==='apply')withAnim('list',render,true);else render();
    }else if(kind==='recipes'){
      if(how==='apply')withAnim('recipes',function(){renderRecipes();render();},true);
      else{renderRecipes();render();}
    }
  });

  var shopRows=[];
  function renderPreviewQty(){
    var r=shopTarget&&shopTarget.r;if(!r)return;
    var f=(parseInt(shopPortions.value,10)||r.portions)/r.portions;
    shopRows.forEach(function(x){
      var n=scaleQty(x.it.qty,f);
      x.q.textContent=n+'\u00a0'+unitLabel(n,x.it.unit)+' ';
    });
  }
  function updateShopBtn(){
    document.getElementById('shopSubmit').disabled=!shopRows.some(function(x){return x.cb.checked;});
  }
  shopPortions.addEventListener('change',renderPreviewQty);

  function updateFade(sc){
    var up=sc.scrollTop>4,down=sc.scrollTop+sc.clientHeight<sc.scrollHeight-4;
    sc.style.setProperty('--ft',up?'32px':'0px');
    sc.style.setProperty('--fb',down?'32px':'0px');
  }
  var scrollers=document.querySelectorAll('.scroller');
  scrollers.forEach(function(sc){
    sc.addEventListener('scroll',function(){updateFade(sc);},{passive:true});
    updateFade(sc);
  });
  if(window.ResizeObserver){
    var fadeRO=new ResizeObserver(function(){scrollers.forEach(updateFade);});
    scrollers.forEach(function(sc){fadeRO.observe(sc);});
    fadeRO.observe(list);fadeRO.observe(recipesEl);
  }

  var dlgRE=document.getElementById('dlgRecipeEdit'),
      reName=document.getElementById('reName'),
      reQty=document.getElementById('reQty'),
      reUnit=document.getElementById('reUnit'),
      reCat=document.getElementById('reCat'),
      reBrand=document.getElementById('reBrand'),
      reTarget=null;
  reUnit.innerHTML=unitHTML+COOK_HTML;
  reCat.innerHTML=CAT_HTML;
  var reSuggest=makeSuggest(reName,document.getElementById('suggestRE'),reUnit,reQty,reCat);
  dlgRE.addEventListener('close',reSuggest.hide);
  function openRecipeEdit(r,it){
    reTarget={r:r,it:it};
    document.getElementById('reRecipe').textContent=r.name;
    document.getElementById('reRecipePortions').textContent='up to '+r.portions+(r.portions===1?' portion':' portions');
    reName.value=it.text;reBrand.value=it.brand||'';
    ensureOpt(reUnit,it.unit);
    reQty.value=it.qty;
    reUnit.value=it.unit;
    reCat.value=it.cat||'';
    dlgRE.showModal();
    dlgRE.setAttribute('tabindex','-1');
    dlgRE.focus({preventScroll:true});
  }
  function reDirty(){
    var t=reTarget&&reTarget.it;
    return !!t&&(reName.value.trim()!==t.text||reBrand.value.trim()!==(t.brand||'')||(parseFloat(reQty.value)||0)!==(t.qty||0)||reUnit.value!==(t.unit||'')||reCat.value!==(t.cat||''));
  }
  function requestCloseRE(){
    if(dlgRE._closing)return;
    if(reDirty()){discardThen=function(){dlgRE.close();};openDiscard();}
    else dlgRE.close();
  }
  document.getElementById('recipeEditClose').addEventListener('click',requestCloseRE);
  dlgRE.addEventListener('click',function(ev){if(ev.target===dlgRE)requestCloseRE();});
  // A rename in the recipe follows into the Shopping list: linked items from this recipe only are renamed and stay linked.
  // Un-linked items from this recipe only are offered the same rename (which also links them again) in a window of their own.
  var dlgRenUnl=document.getElementById('dlgRenUnl'),renCtx=null;
  function commitRecipeEdit(c,relinkCands){
    var r=c.r,it=c.it,prev=c.prev,snaps=[];
    dismissSearch();
    function snap(x){snaps.push({x:x,text:x.text,brand:x.brand,qty:x.qty,unit:x.unit,unlinked:x.unlinked,orig:x.orig?Object.assign({},x.orig):undefined});}
    it.text=c.t;it.qty=c.qty;it.unit=c.unit;
    if(c.brand)it.brand=c.brand;else delete it.brand;
    if(c.cat)it.cat=c.cat;else delete it.cat;
    recordHistory([{text:c.t,unit:c.unit,cat:c.cat}]);
    c.hit.forEach(function(x){
      snap(x);
      var follow=c.renamed&&x.from.length===1;
      if(follow){x.text=c.t;if(c.brand)x.brand=c.brand;else delete x.brand;}
      if(!follow||c.amtChg)x.unlinked=true;
    });
    if(relinkCands)c.cands.forEach(function(x){
      snap(x);
      x.text=c.t;if(c.brand)x.brand=c.brand;else delete x.brand;
      if(x.orig){x.qty=x.orig.qty;x.unit=x.orig.unit;}
      delete x.unlinked;delete x.orig;
    });
    // un-linked items from this recipe remember the name they will return to on re-linking: bring it up to date
    if(c.renamed)items.forEach(function(x){
      if(!x.unlinked||x.manual||!x.orig||x.orig.text===undefined||!x.from||x.from.length!==1||x.from[0].id!==r.id)return;
      if(x.orig.text.toLowerCase()!==prev.text.toLowerCase()||(x.orig.brand||'').toLowerCase()!==(prev.brand||'').toLowerCase())return;
      snap(x);
      var o={qty:x.orig.qty,unit:x.orig.unit,text:c.t};
      if(c.brand)o.brand=c.brand;
      x.orig=o;
    });
    saveR();save();renderRecipes();render();
    dlgRE.close();
    showToast('Item updated.',function(){
      it.text=prev.text;it.qty=prev.qty;it.unit=prev.unit;
      if(prev.brand)it.brand=prev.brand;else delete it.brand;
      if(prev.cat)it.cat=prev.cat;else delete it.cat;
      snaps.forEach(function(s){
        var x=s.x;x.text=s.text;x.qty=s.qty;x.unit=s.unit;
        if(s.brand)x.brand=s.brand;else delete x.brand;
        if(s.unlinked)x.unlinked=s.unlinked;else delete x.unlinked;
        if(s.orig)x.orig=s.orig;else delete x.orig;
      });
      saveR();save();renderRecipes();render();
    });
  }
  function openRenUnl(c){
    renCtx=c;
    var rc=document.getElementById('renCard');rc.innerHTML='';
    rc.appendChild(recipeCardEl({id:c.r.id,name:c.r.name}));
    var ul=document.getElementById('renItems');ul.innerHTML='';
    c.cands.forEach(function(x){
      var li=document.createElement('li'),span=document.createElement('span');span.className='name';
      var q=document.createElement('strong');q.className='qty';
      q.textContent=x.qty+'\u00a0'+unitLabel(x.qty,x.unit)+' ';
      span.appendChild(q);span.appendChild(nameFrag(x));
      li.appendChild(span);ul.appendChild(li);
    });
    var many=c.cands.length>1,restore=c.cands.some(function(x){return !!x.orig;});
    document.getElementById('renMsg').textContent='You renamed this ingredient in the recipe. '+(many?'These items are':'This item is')+' un-linked from it. Letting '+(many?'them':'it')+' be renamed will link '+(many?'them':'it')+' to the recipe again.'+(restore?' The original quantity and unit are restored as well.':'');
    dlgRenUnl.showModal();
    dlgRenUnl.setAttribute('tabindex','-1');
    dlgRenUnl.focus({preventScroll:true});
  }
  function renChoose(relink){var c=renCtx;renCtx=null;dlgRenUnl.close();if(c)commitRecipeEdit(c,relink);}
  document.getElementById('renYes').addEventListener('click',function(){renChoose(true);});
  document.getElementById('renKeep').addEventListener('click',function(){renChoose(false);});
  document.getElementById('renCancel').addEventListener('click',function(){dlgRenUnl.close();});
  dlgRenUnl.addEventListener('click',function(ev){if(ev.target===dlgRenUnl)dlgRenUnl.close();});
  dlgRenUnl.addEventListener('close',function(){renCtx=null;});
  document.getElementById('recipeEditForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var r=reTarget.r,it=reTarget.it,t=reName.value.trim(),qty=parseFloat(reQty.value),unit=reUnit.value,cat=reCat.value,brand=reBrand.value.trim();
    if(!t||!(qty>0)||!unit)return;
    var renamed=t!==it.text||brand!==(it.brand||''),amtChg=qty!==it.qty||unit!==it.unit,core=renamed||amtChg;
    if(!core&&cat===(it.cat||'')){dlgRE.close();return;}
    var prev={text:it.text,qty:it.qty,unit:it.unit,cat:it.cat,brand:it.brand};
    function same(x){return x.text.toLowerCase()===prev.text.toLowerCase()&&(x.brand||'').toLowerCase()===(prev.brand||'').toLowerCase();}
    var hit=!core?[]:items.filter(function(x){
      return !x.unlinked&&x.unit===prev.unit&&same(x)&&(x.from||[]).some(function(f){return f.id===r.id;});
    });
    // un-linked items that come from this recipe alone and still carry the old name
    var cands=(renamed&&!amtChg)?items.filter(function(x){
      return x.unlinked&&!x.manual&&x.from&&x.from.length===1&&x.from[0].id===r.id&&same(x);
    }):[];
    var c={r:r,it:it,t:t,qty:qty,unit:unit,cat:cat,brand:brand,prev:prev,hit:hit,cands:cands,renamed:renamed,amtChg:amtChg};
    if(cands.length)openRenUnl(c);else commitRecipeEdit(c,false);
  });

  // Keyboard handling: shrink the app to the part of the screen the keyboard leaves free, and keep that part
  // pinned to the top of what you see (Safari slides the page up when the keyboard opens).
  var mainEl=document.querySelector('main'),rootEl=document.documentElement;
  function placeBar(){
    var v=window.visualViewport;if(!v)return;
    var kb=Math.round(window.innerHeight-(v.height+v.offsetTop)),open=kb>80;
    rootEl.classList.toggle('kb',open);
    rootEl.style.height=open?Math.round(v.height)+'px':'';
    mainEl.style.transform=open?'translateY('+Math.round(v.offsetTop)+'px)':'';
  }
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',placeBar);
    window.visualViewport.addEventListener('scroll',placeBar);
  }
  // Tapping the field itself makes Safari scroll the whole page to reveal it. Focus it ourselves without scrolling,
  // and undo any page scroll that still sneaks through.
  function lockScroll(){
    if(window.scrollY||rootEl.scrollTop||document.body.scrollTop){
      window.scrollTo(0,0);rootEl.scrollTop=0;document.body.scrollTop=0;
    }
  }
  window.addEventListener('scroll',lockScroll,{passive:true});
  searchInput.addEventListener('touchstart',function(ev){
    if(document.activeElement!==searchInput){ev.preventDefault();searchInput.focus({preventScroll:true});}
  },{passive:false});
  searchInput.addEventListener('focus',function(){
    [0,60,160,320,600].forEach(function(t){setTimeout(lockScroll,t);});
  });

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
  items.forEach(function(it){
    (it.from||[]).forEach(function(f){
      if(f.rp===undefined){var rc=recipes.find(function(x){return x.id===f.id;});if(rc)f.rp=rc.portions;}
    });
  });
  save();

  // ---- Smooth changes: items or recipes that arrive from the server (or that you add yourself) are animated ----
  // Own deletions already have the swipe animation, so only deletions made on the server play the reverse animation.
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

  // ---- Pull to refresh: pull a list down from its top to check the server and update the copy on this device ----
  // While a manual refresh runs, everything except the tabs, the add buttons and search is locked (inert also
  // blocks keyboard use). Items, recipes, sort chips, layout buttons, the menu, the footer and Undo wait.
  var LOCK_SEL='.sort,#list,#recipes,.syncfoot,#menu,#menuBtn,#layoutToggle,#toastUndo';
  function setRefreshLock(on){
    document.documentElement.classList.toggle('ptrlock',on);
    if(on){closeOpenSwipe();closeMenu();}
    document.querySelectorAll(LOCK_SEL).forEach(function(el){el.inert=on;});
  }
  initPullToRefresh({scrollers:document.querySelectorAll('.scroller'),refresh:syncRefresh,lastSyncDate:lastSyncDate,noMotion:noMotion,setLock:setRefreshLock});

  render();
  renderRecipes();
})();
