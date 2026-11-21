import { CATS, CAT_HTML, fixCats } from './categories';
import { uid, fullName, shortTitle, nameParts, searchRe } from './names';
import { unitLabel, convertQty, scaleQty } from './units';

(function(){
  var APP_VERSION='v76';
  window.APP_VERSION=APP_VERSION;
  var VKEY='cauldron-last-seen-version',freshInstall=false;
  // Decided before anything is saved: a device with no stored data and no seen version is a new install.
  try{freshInstall=localStorage.getItem('shopping-list-items')===null&&localStorage.getItem('shopping-list-recipes')===null&&localStorage.getItem(VKEY)===null;}catch(e){}
  function nameFrag(it){var f=document.createDocumentFragment();if(it.brand){var b=document.createElement('b');b.className='brand';b.textContent=it.brand;f.appendChild(b);f.appendChild(document.createTextNode(' '));}f.appendChild(document.createTextNode(it.text));return f;}
  function ensureIds(arr){var ch=false;(arr||[]).forEach(function(e){if(e&&!e.id){e.id=uid();ch=true;}});return ch;}
  var uiLocked=false,uiLockTimer=null;
  // Sorting, layout switching and search pause while items from the server animate in.
  function lockUI(ms){
    uiLocked=true;
    document.documentElement.classList.add('animlock');
    clearTimeout(uiLockTimer);
    uiLockTimer=setTimeout(function(){
      uiLocked=false;
      document.documentElement.classList.remove('animlock');
    },ms);
  }
  var KEY="shopping-list-items";
  var items=[];
  try{var raw=localStorage.getItem(KEY);if(raw)items=JSON.parse(raw)||[];}catch(e){items=[];}
  fixCats(items);
  ensureIds(items);
  var list=document.getElementById("list"),
      input=document.getElementById("input"),
      clearBtn=document.getElementById("clear");


  function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify(items));}catch(e){}}
  function save(){saveLocal();if(window.cauldronSync)window.cauldronSync.push('items',items);}
  // Every item you have ever added is remembered here, even after it is deleted from the list or a recipe.
  var HKEY='shopping-list-history',itemHistory=[];
  try{var hr=localStorage.getItem(HKEY);if(hr)itemHistory=JSON.parse(hr)||[];}catch(e){itemHistory=[];}
  fixCats(itemHistory);
  function saveHistLocal(){try{localStorage.setItem(HKEY,JSON.stringify(itemHistory));}catch(e){}}
  function saveHist(){saveHistLocal();if(window.cauldronSync)window.cauldronSync.push('history',itemHistory);}
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
  // An item counts as coming from multiple recipes when it lists several recipes, or one recipe plus a manual top-up.
  function isMulti(it){return !!(it.from&&(it.from.length>1||(it.from.length===1&&it.manual)));}
  // Ticked items always come after unticked ones; inside each part the chosen sort order is kept.
  function sortedItems(){
    var l=sortedBase();
    return l.filter(function(i){return !i.done;}).concat(l.filter(function(i){return i.done;}));
  }
  function sortedBase(){
    var list=items.slice();
    if(sortMode==='az'||sortMode==='za'){
      var sorted=list.sort(function(a,b){return fullName(a).localeCompare(fullName(b),undefined,{sensitivity:'base'});});
      return sortMode==='za'?sorted.reverse():sorted;
    }
    if(sortMode==='cat'){
      var ci=function(it){var i=CATS.indexOf(it.cat);return i<0?CATS.length:i;};
      return list.sort(function(a,b){return ci(a)-ci(b);});
    }
    var order=[];
    items.forEach(function(it){
      if(it.from&&it.from.length&&!isMulti(it)&&order.indexOf(it.from[0].id)<0)order.push(it.from[0].id);
    });
    function rank(it){
      if(isMulti(it))return order.length;
      if(it.from&&it.from.length===1)return order.indexOf(it.from[0].id);
      return order.length+1;
    }
    return list.sort(function(a,b){return rank(a)-rank(b);});
  }
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
  // Tile titles may break after . , - _ : / \ * + ! ? and ) and before (, except between two digits (1.5, 0,5).
  // The name shrinks to fit its box first; only when it still does not fit at the smallest size is it cut off with "...".
  // Plain text nodes with <wbr> between them, so a name can never be read as HTML.
  function setTileName(el,t,brand){if(brand){el.textContent='';var bb=document.createElement('b');bb.className='brand';nameParts(brand).forEach(function(part,i){if(i)bb.appendChild(document.createElement('wbr'));bb.appendChild(document.createTextNode(part));});el.appendChild(bb);el.appendChild(document.createTextNode(' '));nameParts(t).forEach(function(part,i){if(i)el.appendChild(document.createElement('wbr'));el.appendChild(document.createTextNode(part));});return;}
    el.textContent='';
    nameParts(t).forEach(function(part,i){
      if(i)el.appendChild(document.createElement('wbr'));
      el.appendChild(document.createTextNode(part));
    });
  }
  function qtyText(it){return it.qty?it.qty+'\u00a0'+unitLabel(it.qty,it.unit):'';}
  function tileFit(el,base,min,extra){
    var avail=el.closest('.tile').clientWidth-39-(extra||0),s=base;
    el.style.fontSize=s+'px';
    while(el.scrollWidth>avail&&s>min){s-=.5;el.style.fontSize=s+'px';}
  }
  // Names wrap onto up to three lines and shrink to fill the free space; at the minimum size they are cut off.
  // Shared by Shopping list tiles and recipe tiles: break at spaces and punctuation, shrink the font until the name fits
  // its box, and only at the smallest size cut it off with "...".
  function tileFitName(el,s,min,lines){
    s=s||17.6;min=min||9;lines=lines||3;
    var box=el.parentNode;
    function over(){return el.scrollWidth>el.clientWidth+1||el.scrollHeight>box.clientHeight+1||el.scrollHeight>lines*s*1.4+.4*s+2;}
    el.style.cssText='max-height:'+box.clientHeight+'px;font-size:'+s+'px;';
    while(over()&&s>min){s-=.5;el.style.fontSize=s+'px';}
    if(over()){
      var n=Math.min(lines,Math.max(1,Math.floor(box.clientHeight/(s*1.4))));
      el.style.cssText+='overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:'+n+';';
    }
  }
  function fitAll(){
    list.querySelectorAll('.tile').forEach(function(t){
      if(!t.offsetWidth)return;
      var c=t.querySelector('.tcat');if(c)tileFit(c,12.8,8);
      tileFitName(t.querySelector('.tname'));
      tileFit(t.querySelector('.tqty'),17,10,0);
    });
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
    items=items.filter(function(x){return x!==it;});
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
  // Touch swipe on a tile. Swipe left: the text slides out while a red Delete button grows from the right edge.
  // Swipe right (only when opts.leftAct is given): a green check button grows from the left edge.
  // Past 20% of the tile width, letting go locks the button at 40% coverage (tap it to act, tap elsewhere to close).
  // Past 70%, letting go performs the action. A mouse does not swipe; it uses the hover buttons instead.
  var CHK_PATH='<path d="m5 12.5 4.5 4.5L19 7.5"/>',UNCHK_PATH='<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>';
  function chkIn(done){return done?UNCHK_PATH:CHK_PATH;}
  function chkSvg(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+CHK_PATH+'</svg>';}
  function tileSwipe(li,act,tin,onDelete,cancelPress,opts){
    opts=opts||{};
    // thresholds as a share of the width: lock = minimum swipe to stay open, size = open button width, commit = swipe that triggers the action
    var T_LOCK=opts.lock||.2,T_SIZE=opts.size||.4,T_COMMIT=opts.commit||.7;
    var lact=opts.leftAct||null,onLeft=opts.onLeft||function(){};
    var ic=act.firstChild,lic=lact?lact.firstChild:null,r={li:li,x:0,W:0,open:false,gone:false,moved:false,hopped:false,armed:null,raf:0};
    function wOf(v){return Math.max(0,Math.abs(v)-8);}
    function opOf(v){return Math.min(1,Math.max(0,(wOf(v)-16)/24));}
    // x > 0: swiped left (Delete side); x < 0: swiped right (Check side)
    function paint(x){
      r.x=x;var wd=x>0?wOf(x):0,wc=x<0?wOf(x):0;
      tin.style.transform=x?'translate3d('+(-x)+'px,0,0)':'';
      act.style.width=wd+'px';act.style.borderRadius=Math.min(16,wd/2)+'px';
      ic.style.opacity=x>0?opOf(x):0;
      if(lact){lact.style.width=wc+'px';lact.style.borderRadius=Math.min(16,wc/2)+'px';lic.style.opacity=x<0?opOf(x):0;}
    }
    var ga=null;
    function curX(){
      try{var t=getComputedStyle(tin).transform;return t&&t!=='none'?-new DOMMatrix(t).m41:0;}catch(e){return r.x;}
    }
    function stopAnim(){
      if(r.raf){cancelAnimationFrame(r.raf);r.raf=0;}
      if(ga){
        var x=curX(),old=ga;ga=null;
        old.forEach(function(n){n.onfinish=null;n.cancel();});
        paint(x);
      }
    }
    function glide(to,ms,done){
      stopAnim();
      if(noMotion()||!tin.animate){paint(to);if(done)done();return;}
      var from=r.x;
      function on(v,side){return side>0?v>0:v<0;}
      function geo(v,side){return{width:(on(v,side)?wOf(v):0)+'px',borderRadius:'16px'};}
      function opS(v,side){return on(v,side)?opOf(v):0;}
      var o={duration:ms,easing:'cubic-bezier(.33,1,.68,1)',fill:'forwards'};
      var a1=tin.animate([{transform:'translate3d('+(-from)+'px,0,0)'},{transform:'translate3d('+(-to)+'px,0,0)'}],o);
      var a2=act.animate([geo(from,1),geo(to,1)],o);
      var anims=[a1,a2];
      if(ic&&ic.animate)anims.push(ic.animate([{opacity:opS(from,1)},{opacity:opS(to,1)}],o));
      if(lact){
        anims.push(lact.animate([geo(from,-1),geo(to,-1)],o));
        if(lic&&lic.animate)anims.push(lic.animate([{opacity:opS(from,-1)},{opacity:opS(to,-1)}],o));
      }
      ga=anims;
      a1.onfinish=function(){
        if(ga!==anims)return;
        ga=null;
        paint(to);
        anims.forEach(function(n){n.onfinish=null;n.cancel();});
        if(done)done();
      };
    }
    // side: 'd' (delete), 'c' (check) or null
    function arm(side){
      if(r.armed===side)return;r.armed=side;
      act.classList.toggle('armed',side==='d');
      if(lact)lact.classList.toggle('armed',side==='c');
      if(side==='d'&&opts.onArm)opts.onArm(ic);
      if(side&&navigator.vibrate)navigator.vibrate(8);
    }
    function hop(side){
      if(r.hopped)return;r.hopped=true;
      var el=side<0?lic:ic;
      if(side>0&&opts.onHop)opts.onHop(ic);
      if(noMotion()||!el||!el.animate)return;
      el.animate([
        {transform:'translateY(0) scale(1,1)'},
        {transform:'translateY(2px) scale(1.1,.88)',offset:.15},
        {transform:'translateY(-8px) scale(.92,1.12)',offset:.4},
        {transform:'translateY(0) scale(1.08,.92)',offset:.68},
        {transform:'translateY(-2px) scale(.98,1.03)',offset:.84},
        {transform:'translateY(0) scale(1,1)'}
      ],{duration:540,easing:'ease-out'});
    }
    r.close=function(){
      arm(null);glide(0,300);r.open=false;act.tabIndex=-1;if(lact)lact.tabIndex=-1;
      if(swOpen===r)swOpen=null;
    };
    function lockIt(side){
      if(swOpen&&swOpen!==r)swOpen.close();
      arm(null);glide(side*r.W*T_SIZE,300,function(){hop(side);});
      r.open=true;swOpen=r;(side>0?act:lact).tabIndex=0;
    }
    function commit(side){
      if(r.gone)return;
      r.gone=true;arm(side>0?'d':'c');
      var btn=side>0?act:lact,fn=side>0?onDelete:onLeft;
      glide(side*(r.W-8),200,(side<0||opts.keep)?function(){btn.blur();fn();r.gone=false;r.close();}:fn);
    }
    var sx=0,sy=0,base=0,lock=null,pid=null;
    li.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse'||r.gone||(e.target.closest&&e.target.closest('.tact')))return;
      stopAnim();r.W=li.clientWidth;sx=e.clientX;sy=e.clientY;base=r.x;lock=null;r.moved=false;pid=e.pointerId;r.hopped=r.open;
    });
    li.addEventListener('pointermove',function(e){
      if(pid!==e.pointerId)return;
      var dx=e.clientX-sx,dy=e.clientY-sy;
      if(!lock&&(Math.abs(dx)>6||Math.abs(dy)>6)){
        lock=Math.abs(dx)>Math.abs(dy)?'h':'v';
        if(lock==='h'){
          li.setPointerCapture(e.pointerId);cancelPress();
          if(swOpen&&swOpen!==r)swOpen.close();
        }
      }
      if(lock!=='h')return;
      r.moved=true;
      var max=r.W-8,x=base-dx;
      if(x<0&&!lact)x=x*.25;
      else if(x<-max)x=-max+(x+max)*.25;
      else if(x>max)x=max+(x-max)*.25;
      paint(x);
      if(x>=r.W*T_SIZE)hop(1);else if(lact&&x<=-r.W*T_SIZE)hop(-1);
      arm(x>=r.W*T_COMMIT?'d':(lact&&x<=-r.W*T_COMMIT)?'c':null);
    });
    function end(e){
      if(pid!==e.pointerId)return;
      pid=null;
      if(lock!=='h')return;
      if(r.x>=r.W*T_COMMIT)commit(1);
      else if(lact&&r.x<=-r.W*T_COMMIT)commit(-1);
      else if(r.x>r.W*T_LOCK)lockIt(1);
      else if(lact&&r.x<-r.W*T_LOCK)lockIt(-1);
      else r.close();
    }
    li.addEventListener('pointerup',end);
    li.addEventListener('pointercancel',end);
    // after a drag a tap must not open or change the tile
    li.addEventListener('click',function(e){
      if(e.target.closest&&e.target.closest('.tact')){r.moved=false;return;}
      if(r.moved){r.moved=false;e.preventDefault();e.stopPropagation();}
    },true);
    li.addEventListener('keydown',function(e){
      if(e.key==='Delete'&&e.target.classList&&e.target.classList.contains('tile')){e.preventDefault();onDelete();}
    });
    act.addEventListener('click',function(){r.W=li.clientWidth;commit(1);});
    if(lact)lact.addEventListener('click',function(){r.W=li.clientWidth;commit(-1);});
    return r;
  }

  // ---- Swipe to delete ----
  // Touch: the row slides left over a red shape that grows from a sliver into a pill (swipe past about half the
  // row to delete it outright). Mouse or trackpad: no swiping, a Delete pill shows on hover or keyboard focus.
  var SW_W=88,SW_GAP=10,SW_EASE='cubic-bezier(.2,.7,.2,1)',swOpen=null;
  var SW_TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';
  // Returns the element that holds the row's content; the caller fills it and then calls .finish().
  function swipeRow(li,onDelete,label){
    li.classList.add('sw');
    var act=document.createElement('button');act.type='button';act.className='swact';act.tabIndex=-1;
    act.setAttribute('aria-label','Delete '+label);act.innerHTML=SW_TRASH;
    var fg=document.createElement('div');fg.className='swfg';
    var hdel=document.createElement('button');hdel.type='button';hdel.className='swdel';
    hdel.setAttribute('aria-label','Delete '+label);hdel.innerHTML=SW_TRASH+'Delete';
    li.appendChild(act);li.appendChild(fg);
    fg.finish=function(){fg.appendChild(hdel);};
    var r={li:li,x:0,open:false,raf:0,h:0,hopped:false,gone:false,lift:false,op:-1};
    function paint(x){
      r.x=x;
      fg.style.transform='translate3d('+x+'px,0,0)';
      var lift=x<-1;if(lift!==r.lift){r.lift=lift;fg.classList.toggle('lifted',lift);}
      var h=r.h||(r.h=li.clientHeight-16),w=Math.max(0,-x-2*SW_GAP);
      act.style.width=w+'px';
      act.style.borderRadius=(Math.min(w,h)/2)+'px';
      var o=Math.min(1,Math.max(0,(w-20)/24));if(o!==r.op){r.op=o;act.firstChild.style.opacity=o;}
    }
    var ga=null;
    function curX(){
      try{var t=getComputedStyle(fg).transform;return t&&t!=='none'?new DOMMatrix(t).m41:0;}catch(e){return r.x;}
    }
    // if a settle animation is still running, freeze the row where it currently is
    function stop(){
      if(r.raf){cancelAnimationFrame(r.raf);r.raf=0;}
      if(ga){
        var x=curX(),old=ga;ga=null;
        old.forEach(function(n){n.onfinish=null;n.cancel();});
        paint(x);
      }
    }
    // while dragging the position is painted straight from the pointer event (no requestAnimationFrame,
    // which iOS Low Power Mode caps at 30 fps)
    function drag(x){paint(x);}
    // settle animations use the Web Animations API: the transform runs on the compositor
    function glide(x,ms,done){
      stop();
      if(noMotion()||!fg.animate){paint(x);if(done)done();return;}
      var from=r.x,h=r.h||(r.h=li.clientHeight-16),ic=act.firstChild;
      function wOf(v){return Math.max(0,-v-2*SW_GAP);}
      function geo(v){var w=wOf(v);return{width:w+'px',borderRadius:(h/2)+'px'};}
      function opOf(v){return Math.min(1,Math.max(0,(wOf(v)-20)/24));}
      if(x<-1&&!r.lift){r.lift=true;fg.classList.add('lifted');}
      var o={duration:ms||300,easing:'cubic-bezier(.33,1,.68,1)',fill:'forwards'};
      var a1=fg.animate([{transform:'translate3d('+from+'px,0,0)'},{transform:'translate3d('+x+'px,0,0)'}],o);
      var a2=act.animate([geo(from),geo(x)],o);
      var anims=[a1,a2];
      if(ic&&ic.animate)anims.push(ic.animate([{opacity:opOf(from)},{opacity:opOf(x)}],o));
      ga=anims;
      a1.onfinish=function(){
        if(ga!==anims)return;
        ga=null;
        paint(x);
        anims.forEach(function(n){n.onfinish=null;n.cancel();});
        if(done)done();
      };
    }
    // the icon hops once per gesture, when the shape reaches its full pill size
    function hop(){
      if(r.hopped)return;
      r.hopped=true;
      var s=act.firstChild;
      if(noMotion()||!s||!s.animate)return;
      s.animate([
        {transform:'translateY(0) scale(1,1)'},
        {transform:'translateY(2px) scale(1.1,.88)',offset:.15},
        {transform:'translateY(-8px) scale(.92,1.12)',offset:.4},
        {transform:'translateY(0) scale(1.08,.92)',offset:.68},
        {transform:'translateY(-2px) scale(.98,1.03)',offset:.84},
        {transform:'translateY(0) scale(1,1)'}
      ],{duration:540,easing:'ease-out'});
    }
    r.close=function(){
      act.classList.remove('armed');
      glide(0,300,function(){fg.style.willChange='';});
      r.open=false;act.tabIndex=-1;
      if(swOpen===r)swOpen=null;
    };
    function openIt(){
      if(swOpen&&swOpen!==r)swOpen.close();
      act.classList.remove('armed');
      glide(-SW_W,300,hop);
      r.open=true;swOpen=r;act.tabIndex=0;
    }
    function collapse(){
      if(noMotion()||!li.animate){onDelete();return;}
      var ul=li.parentNode;
      // Last row of the whole list: morph the box into the empty-state message instead of collapsing it to a sliver
      if(ul&&ul.querySelectorAll('li').length===1&&(ul.id==='viewList'||ul.parentNode.querySelectorAll(':scope > ul').length===1)){
        var h0=ul.getBoundingClientRect().height;
        onDelete();
        var nu=ul.id==='viewList'?ul:list.querySelector('ul');
        if(!nu||!nu.animate)return;
        var h1=nu.getBoundingClientRect().height,ov=nu.style.overflow;
        nu.style.overflow='hidden';
        var a1=nu.animate([{height:h0+'px'},{height:h1+'px'}],{duration:280,easing:SW_EASE});
        var ph=nu.querySelector('li');
        if(ph&&ph.animate)ph.animate([{opacity:0},{opacity:1}],{duration:280,easing:SW_EASE});
        a1.onfinish=a1.oncancel=function(){nu.style.overflow=ov;};
        return;
      }
      var h=li.getBoundingClientRect().height;
      li.style.overflow='hidden';
      var a=li.animate([{height:h+'px',opacity:1},{height:'0px',opacity:0}],{duration:240,easing:SW_EASE,fill:'forwards'});
      a.onfinish=function(){onDelete();};
    }
    function remove(){if(r.gone)return;r.gone=true;collapse();}
    // swiping past the threshold (or tapping the pill) stretches the shape across the row, then removes it
    function commit(){
      if(r.gone)return;
      r.gone=true;r.h=li.clientHeight-16;
      act.classList.add('armed');
      glide(-li.clientWidth,260,collapse);
    }
    var sx=0,sy=0,base=0,lock=null,moved=false,x=0,pid=null,armed=false,full=0,thr=0;
    fg.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse'||r.gone||e.target.closest('.grip'))return;
      stop();fg.style.willChange='transform';
      r.h=li.clientHeight-16;r.hopped=r.open;full=li.clientWidth;thr=full*.55;armed=false;
      sx=e.clientX;sy=e.clientY;base=r.x;lock=null;moved=false;x=base;pid=e.pointerId;
    });
    fg.addEventListener('pointermove',function(e){
      if(pid!==e.pointerId)return;
      var dx=e.clientX-sx,dy=e.clientY-sy;
      if(!lock&&(Math.abs(dx)>6||Math.abs(dy)>6)){
        lock=Math.abs(dx)>Math.abs(dy)?'h':'v';
        if(lock==='h'){
          fg.setPointerCapture(e.pointerId);
          if(swOpen&&swOpen!==r)swOpen.close();
        }
      }
      if(lock!=='h')return;
      moved=true;
      x=base+dx;
      if(x>0)x=x*.25;
      else if(x<-full)x=-full+(x+full)*.25;
      drag(x);
      if(x<=-SW_W)hop();
      var arm=x<-thr;
      if(arm!==armed){armed=arm;act.classList.toggle('armed',arm);if(arm&&navigator.vibrate)navigator.vibrate(8);}
    });
    function end(e){
      if(pid!==e.pointerId)return;
      pid=null;
      if(lock==='h'){if(x<-thr)commit();else if(x<-SW_W/2)openIt();else r.close();}
      else if(!r.open)fg.style.willChange='';
    }
    fg.addEventListener('pointerup',end);
    fg.addEventListener('pointercancel',end);
    // after a drag, or while a row is open, a tap only closes things; it never ticks or edits the item
    fg.addEventListener('click',function(e){
      if(moved){moved=false;e.preventDefault();e.stopPropagation();return;}
      if(r.open){e.preventDefault();e.stopPropagation();r.close();return;}
      if(swOpen){e.preventDefault();e.stopPropagation();swOpen.close();}
    },true);
    fg.addEventListener('keydown',function(e){
      if(e.key==='Delete'){e.preventDefault();remove();}
    });
    act.addEventListener('click',commit);
    hdel.addEventListener('click',function(e){e.stopPropagation();remove();});
    return fg;
  }
  document.addEventListener('pointerdown',function(e){
    if(swOpen&&!swOpen.li.contains(e.target))swOpen.close();
  });

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
    hideSuggest();
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
    input.value="";document.getElementById("addCat").value="";document.getElementById("brand").value="";hideSuggest();
    if(ex)openDesc(ex);
  });
  document.getElementById('cfCancel').addEventListener('click',function(){cfPending=null;dlgConflict.close();});
  dlgConflict.addEventListener('click',function(ev){if(ev.target===dlgConflict){cfPending=null;dlgConflict.close();}});
  clearBtn.addEventListener("click",function(){openRemoveChecked();});
  function removeChecked(){
    var gone=[];
    items.forEach(function(it,i){if(it.done)gone.push({it:it,idx:i});});
    items=items.filter(function(i){return !i.done;});
    save();render();
    showToast(gone.length===1?'Item removed.':'Items removed.',function(){
      gone.forEach(function(g){items.splice(Math.min(g.idx,items.length),0,g.it);});
      save();render();
    });
  }
  var currentView='list',sliding=false;
  function switchView(v){
    if(swOpen)swOpen.close();
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

  var RKEY='shopping-list-recipes',recipes=[];
  try{var rr=localStorage.getItem(RKEY);if(rr)recipes=JSON.parse(rr)||[];}catch(e){recipes=[];}
  recipes.forEach(function(r){if(!r.portions)r.portions=4;});
  fixCats(recipes);
  saveR();
  function saveRLocal(){try{localStorage.setItem(RKEY,JSON.stringify(recipes));}catch(e){}}
  function saveR(){saveRLocal();if(window.cauldronSync)window.cauldronSync.push('recipes',recipes);}
  var recipesEl=document.getElementById('recipes'),unitHTML=document.getElementById('unit').innerHTML;

  var viewTarget=null,dlgView=document.getElementById('dlgView'),viewList=document.getElementById('viewList');
  var CART_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="lns" d="M3 6h9M3 13h18M3 19h18"/><path class="pls" d="M19 3v6M16 6h6"/></svg>';
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
        undo.push(function(){items=items.filter(function(x){return x!==n;});});
      }
    });
    recordHistory(list);
    save();render();
    return function(){
      undo.reverse().forEach(function(fn){fn();});
      save();render();
    };
  }

  var toast=document.getElementById('toast'),
      toastMsg=document.getElementById('toastMsg'),
      toastTimer=null,toastAction=null;
  var toastAnim=null,hiding=false;
  function noMotion(){return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  function toastDist(){return toast.offsetHeight+160;}
  function hideToast(){
    toastAction=null;
    clearTimeout(toastTimer);
    if(toast.hidden||hiding)return;
    if(noMotion()||!toast.animate){toast.hidden=true;return;}
    hiding=true;
    toast.style.pointerEvents='none';
    var a=toast.animate([
      {transform:'translate(-50%,0)',opacity:1},
      {transform:'translate(-50%,'+toastDist()+'px)',opacity:0}
    ],{duration:240,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    toastAnim=a;
    a.onfinish=function(){
      if(toastAnim!==a)return;
      toast.hidden=true;hiding=false;toastAnim=null;
      toast.style.pointerEvents='';
      a.cancel();
    };
  }
  var toastKind='undo';
  function showToast(msg,undo,ms,label){
    placeToast();
    toastClip.style.height='';toastRow.style.height='';
    toastMsg.textContent=msg;
    toastAction=undo;toastKind=label?'custom':'undo';
    document.getElementById('toastUndo').textContent=label||'Undo';
    document.getElementById('toastUndo').hidden=!undo;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(hideToast,ms||7000);
    var wasVisible=!toast.hidden&&!hiding;
    if(hiding){
      if(toastAnim)toastAnim.cancel();
      hiding=false;toastAnim=null;
      toast.style.pointerEvents='';
    }
    toast.hidden=false;
    if(wasVisible||noMotion()||!toast.animate)return;
    toast.animate([
      {transform:'translate(-50%,'+toastDist()+'px)',opacity:0},
      {transform:'translate(-50%,0)',opacity:1}
    ],{duration:300,easing:'cubic-bezier(.2,.7,.2,1)'});
  }
  var toastClip=document.getElementById('toastClip'),toastRow=document.getElementById('toastRow');
  function swapToast(msg,ms){
    if(noMotion()||!toastRow.animate){showToast(msg,null,ms);return;}
    var h=toastRow.offsetHeight;
    toastClip.style.height=h+'px';toastRow.style.height=h+'px';
    var old=toastRow.cloneNode(true);
    old.removeAttribute('id');
    old.querySelectorAll('[id]').forEach(function(n){n.removeAttribute('id');});
    old.inert=true;
    old.style.cssText='position:absolute;left:0;top:0;width:100%;height:'+h+'px';
    toastClip.appendChild(old);
    toastMsg.textContent=msg;toastAction=null;
    document.getElementById('toastUndo').hidden=true;
    clearTimeout(toastTimer);toastTimer=setTimeout(hideToast,ms);
    var oa=old.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-100%)',opacity:0}],{duration:320,easing:EASE,fill:'forwards'});
    var na=toastRow.animate([{transform:'translateY(100%)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:320,easing:EASE});
    na.onfinish=na.oncancel=function(){
      oa.cancel();
      if(old.parentNode)old.parentNode.removeChild(old);
    };
  }
  var undoBtn=document.getElementById('toastUndo');
  undoBtn.addEventListener('click',function(){
    if(undoBtn.classList.contains('pressed'))return;
    undoBtn.classList.add('pressed');
    var act=toastAction;
    setTimeout(function(){
      undoBtn.classList.remove('pressed');
      var kind=toastKind;
      if(act)act();
      if(kind==='undo')swapToast('Changes undone.',2500);else hideToast();
    },175);
  });

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

  var EASE='cubic-bezier(.2,.7,.2,1)',PROPS=['paddingTop','paddingBottom','marginTop','marginBottom','borderTopWidth','borderBottomWidth'];
  function snap(el){
    var cs=getComputedStyle(el),o={height:el.getBoundingClientRect().height+'px',opacity:cs.opacity};
    PROPS.forEach(function(p){o[p]=cs[p];});
    return o;
  }
  function zero(){var o={height:'0px',opacity:0};PROPS.forEach(function(p){o[p]='0px';});return o;}
  function toggleEl(el,show,animate){
    var running=el.getAnimations().length>0;
    if(!animate||noMotion()||!el.animate){
      el.getAnimations().forEach(function(a){a.cancel();});
      el.hidden=!show;el.style.overflow='';return;
    }
    if(!running&&el.hidden===!show)return;
    var wasHidden=el.hidden,cur=running?snap(el):null;
    el.getAnimations().forEach(function(a){a.cancel();});
    el.hidden=false;el.style.overflow='hidden';
    var nat=snap(el);
    var a=el.animate([cur||(wasHidden?zero():nat),show?nat:zero()],{duration:260,easing:EASE,fill:'forwards'});
    a.onfinish=function(){if(!show)el.hidden=true;el.style.overflow='';a.cancel();};
  }
  function setLi(li,show,animate){
    var nw=show?'1':'0';
    if(animate&&(li.dataset.show||'1')===nw)return;
    li.dataset.show=nw;toggleEl(li,show,animate);
  }
  function markLast(ul){
    var last=null;
    ul.classList.add('f');
    ul.querySelectorAll('li').forEach(function(li){
      li.classList.remove('last');
      if((li.dataset.show||'1')==='1')last=li;
    });
    if(last)last.classList.add('last');
  }

  function clearMarks(root){
    root.querySelectorAll('mark.hl').forEach(function(m){m.replaceWith(document.createTextNode(m.textContent));});
    root.normalize();
  }
  // Search treats every character that is not a letter or digit as a space: "coconut cashew", "coconut/cashew"
  // and "coconut - cashew" all find "Coconut/Cashew". With no letters or digits typed, the text is searched as typed.
  // Marks every match, also when it runs across the line breaks of a tile title (several text pieces).
  function markText(el,re){
    var nodes=[],tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);while(tw.nextNode()){var pn=tw.currentNode.parentNode;if(!(pn.closest&&pn.closest('.qty')))nodes.push(tw.currentNode);}
    if(!nodes.length)return;
    var full=nodes.map(function(n){return n.nodeValue;}).join(''),ranges=[],m;
    re.lastIndex=0;
    while((m=re.exec(full))){
      if(!m[0].length){re.lastIndex++;continue;}
      ranges.push([m.index,m.index+m[0].length]);
    }
    if(!ranges.length)return;
    var off=0;
    nodes.forEach(function(n){
      var t=n.nodeValue,start=off,end=off+t.length,segs=[];
      off=end;
      ranges.forEach(function(r){
        var a=Math.max(r[0],start),b=Math.min(r[1],end);
        if(a<b)segs.push([a-start,b-start]);
      });
      if(!segs.length)return;
      var frag=document.createDocumentFragment(),pos=0;
      segs.forEach(function(sg){
        frag.appendChild(document.createTextNode(t.slice(pos,sg[0])));
        var mk=document.createElement('mark');mk.className='hl';mk.textContent=t.slice(sg[0],sg[1]);
        frag.appendChild(mk);
        pos=sg[1];
      });
      frag.appendChild(document.createTextNode(t.slice(pos)));
      n.replaceWith(frag);
    });
  }

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
  document.getElementById('dlgChangeClose').addEventListener('click',function(){dlgChange.close();});
  dlgChange.addEventListener('click',function(ev){if(ev.target===dlgChange)dlgChange.close();});
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

  var sx=0,sy=0,dx=0,dy=0,dragging=false;
  toast.addEventListener('pointerdown',function(ev){
    if(hiding||ev.target.closest('button')||toast.getAnimations().length)return;
    dragging=true;sx=ev.clientX;sy=ev.clientY;dx=0;dy=0;
    clearTimeout(toastTimer);
    toast.setPointerCapture(ev.pointerId);
  });
  toast.addEventListener('pointermove',function(ev){
    if(!dragging)return;
    dy=Math.max(0,ev.clientY-sy);
    toast.style.transform='translate(calc(-50% + '+dx+'px),'+dy+'px)';
    toast.style.opacity=Math.max(.3,1-Math.max(Math.abs(dx)/300,dy/150));
  });
  function endDrag(){
    if(!dragging)return;
    dragging=false;
    var cur={transform:toast.style.transform||'translate(-50%,0)',opacity:toast.style.opacity||1};
    toast.style.transform='';toast.style.opacity='';
    var far=dy>40;
    if(!far){
      if(toast.animate)toast.animate([cur,{transform:'translate(-50%,0)',opacity:1}],{duration:180,easing:EASE});
      toastTimer=setTimeout(hideToast,3000);
      return;
    }
    toastAction=null;
    if(noMotion()||!toast.animate){toast.hidden=true;return;}
    var tx=0,ty=toastDist();
    hiding=true;toast.style.pointerEvents='none';
    var a=toast.animate([cur,{transform:'translate(calc(-50% + '+tx+'px),'+ty+'px)',opacity:0}],{duration:220,easing:'ease-in',fill:'forwards'});
    toastAnim=a;
    a.onfinish=function(){
      if(toastAnim!==a)return;
      toast.hidden=true;hiding=false;toastAnim=null;
      toast.style.pointerEvents='';
      a.cancel();
    };
  }
  toast.addEventListener('pointerup',endDrag);
  toast.addEventListener('pointercancel',function(){dx=0;dy=0;endDrag();});


  var suggestEl=document.getElementById('suggest'),sugIdx=-1;
  function nameCandidates(q,limit){
    var map={};
    function add(name,src,unit,cat){
      var k=name.toLowerCase();
      if(!map[k]||(src==='list'&&map[k].src!=='list'))map[k]={name:name,src:src,unit:unit,cat:cat};
    }
    items.forEach(function(it){add(it.text,'list',it.unit,it.cat);});
    recipes.forEach(function(r){r.items.forEach(function(it){add(it.text,'recipe',it.unit,it.cat);});});
    itemHistory.forEach(function(h){add(h.text,'history',h.unit,h.cat);});
    var out=Object.keys(map).map(function(k){return map[k];}).filter(function(c){return c.name.toLowerCase().indexOf(q)>-1;});
    out.sort(function(a,b){
      var as=a.name.toLowerCase().indexOf(q)===0?0:1,bs=b.name.toLowerCase().indexOf(q)===0?0:1;
      return as-bs||a.name.localeCompare(b.name);
    });
    return limit?out.slice(0,limit):out;
  }
  function hideSuggest(){suggestEl.hidden=true;suggestEl.innerHTML='';sugIdx=-1;input.parentNode.classList.remove('sugopen');}
  function pickSuggest(x){
    input.value=x.name;
    var u=document.getElementById('unit'),qe=document.getElementById('qty');
    var cs=document.getElementById('addCat');
    if(!cs.value&&x.cat)cs.value=x.cat;
    hideSuggest();
    if(!qe.value)qe.focus();
  }
  function showSuggest(){
    var q=input.value.trim().toLowerCase();
    if(!q){hideSuggest();return;}
    var c=nameCandidates(q);
    if(!c.length){hideSuggest();return;}
    suggestEl.innerHTML='';sugIdx=-1;
    c.forEach(function(x){
      var b=document.createElement('button');b.type='button';b.className='sopt';b.setAttribute('role','option');
      var s=document.createElement('span');s.textContent=x.name;
      var sm=document.createElement('small');sm.textContent=x.src==='list'?'On your list':x.src==='recipe'?'In a recipe':'From history';
      b.appendChild(s);b.appendChild(sm);
      b.addEventListener('mousedown',function(ev){ev.preventDefault();});
      b.addEventListener('click',function(){pickSuggest(x);});
      b._x=x;
      suggestEl.appendChild(b);
    });
    suggestEl.hidden=false;
    input.parentNode.classList.add('sugopen');
    fitSuggest();
  }
  // The list may be as long as the screen allows (above the keyboard when it is open); beyond that it scrolls.
  function fitSuggest(){
    if(suggestEl.hidden)return;
    var v=window.visualViewport,bottom=v?v.offsetTop+v.height:window.innerHeight;
    var kbOpen=v&&(window.innerHeight-(v.height+v.offsetTop))>80;
    var top=suggestEl.getBoundingClientRect().top;
    suggestEl.style.maxHeight=Math.max(120,bottom-top-(kbOpen?60:12))+'px';
  }
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',fitSuggest);
    window.visualViewport.addEventListener('scroll',fitSuggest);
  }
  window.addEventListener('resize',fitSuggest);
  document.getElementById('inputClear').addEventListener('mousedown',function(ev){ev.preventDefault();});
  document.getElementById('inputClear').addEventListener('click',function(){
    hideSuggest();input.focus();
  });
  function moveSuggest(step){
    var opts=suggestEl.querySelectorAll('.sopt');
    if(!opts.length)return;
    sugIdx=(sugIdx+step+opts.length)%opts.length;
    opts.forEach(function(o,i){o.classList.toggle('on',i===sugIdx);});
  }
  input.addEventListener('input',showSuggest);
  input.addEventListener('keydown',function(ev){
    if(suggestEl.hidden)return;
    if(ev.key==='ArrowDown'){ev.preventDefault();moveSuggest(1);}
    else if(ev.key==='ArrowUp'){ev.preventDefault();moveSuggest(-1);}
    else if(ev.key==='Enter'&&sugIdx>=0){ev.preventDefault();pickSuggest(suggestEl.querySelectorAll('.sopt')[sugIdx]._x);}
    else if(ev.key==='Escape'){ev.preventDefault();hideSuggest();}
  });
  document.addEventListener('click',function(ev){
    if(!suggestEl.hidden&&!suggestEl.contains(ev.target)&&ev.target!==input)hideSuggest();
  });
  dlgItem.addEventListener('close',function(){
    hideSuggest();
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

  // Open windows sit in the browser's top layer and block everything outside them, so a banner kept in the page
  // would hide behind them. The banner therefore moves into the topmost window that is open and not closing
  // (and back to the page when none is), which keeps it in front and tappable.
  var dlgStack=[];
  function topDialog(){for(var i=dlgStack.length-1;i>=0;i--){var d=dlgStack[i];if(d.open&&!d._closing)return d;}return null;}
  function placeToast(){var t=topDialog()||document.body;if(toast.parentNode!==t)t.appendChild(toast);}
  var nativeShow=HTMLDialogElement.prototype.showModal,nativeClose=HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.showModal=function(){
    if(this._closing)return;
    nativeShow.call(this);
    var si=dlgStack.indexOf(this);if(si>-1)dlgStack.splice(si,1);dlgStack.push(this);placeToast();
    if(noMotion()||!this.animate)return;
    var r=this.getBoundingClientRect(),d=-(r.top+r.height+20);
    this.animate([{transform:'translateY('+d+'px)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:380,easing:EASE});
    try{this.animate([{opacity:0},{opacity:1}],{duration:380,pseudoElement:'::backdrop'});}catch(e){}
    // Alert windows shake once after sliding in and ignore taps, Esc and the backdrop until that is over.
    if(this.hasAttribute('data-alert')){
      var al=this;al._lock=true;al.inert=true;
      setTimeout(function(){if(al.open)shake(al);},400);
      setTimeout(function(){al._lock=false;al.inert=false;if(al.open)al.focus({preventScroll:true});},830);
    }
  };
  HTMLDialogElement.prototype.close=function(rv){
    var dlg=this;
    if(dlg._lock)return;
    if(!dlg.open||dlg._closing||noMotion()||!dlg.animate){nativeClose.call(dlg,rv);placeToast();return;}
    dlg._closing=true;placeToast();
    var r=dlg.getBoundingClientRect(),sy=dlg._startY||0,ms=dlg._closeMs||320,ez=dlg._closeMs?'cubic-bezier(.25,.5,.75,1)':'cubic-bezier(.4,0,1,1)';dlg._startY=0;dlg._closeMs=0;var d=-(r.top-sy+r.height+20);
    var a=dlg.animate([{transform:'translateY('+sy+'px)',opacity:1},{transform:'translateY('+d+'px)',opacity:0}],{duration:ms,easing:ez,fill:'forwards'});
    var b=null;
    try{b=dlg.animate([{opacity:1},{opacity:0}],{duration:ms,fill:'forwards',pseudoElement:'::backdrop'});}catch(e){}
    a.onfinish=function(){
      dlg._closing=false;
      a.cancel();if(b)b.cancel();
      nativeClose.call(dlg,rv);placeToast();
    };
  };
  document.querySelectorAll('dialog').forEach(function(dlg){
    dlg.addEventListener('cancel',function(ev){ev.preventDefault();if(dlg.id==='dlgDesc')requestCloseDesc();else if(dlg.id==='dlgEdit')requestCloseEdit();else if(dlg.id==='dlgRecipeEdit')requestCloseRE();else if(dlg.id==='dlgAddList')onAddListNo();else dlg.close();});
  });

    // ---- Swipe a window up to dismiss it (touch only). Warning windows and the Add to Shopping list prompt are left out. ----
  function curTY(el){try{var t=getComputedStyle(el).transform;return t&&t!=='none'?new DOMMatrix(t).m42:0;}catch(e){return 0;}}
  function swipeDismiss(dlg,dismiss){
    var st=null,ga=null,hid=false;
    function showT(){if(hid){toast.style.visibility='';hid=false;}}
    function paint(y){
      dlg.style.transform=y?'translate3d(0,'+y+'px,0)':'';
      var p=Math.min(1,-y/((dlg.offsetHeight||1)*1.2));
      dlg.style.setProperty('--bd',String(1-p*.85));
    }
    function stopGlide(){
      if(!ga)return null;
      var y=curTY(dlg);ga.onfinish=null;ga.cancel();ga=null;paint(y);return y;
    }
    // content that can still scroll down keeps the swipe for itself
    function canScroll(el){
      while(el){
        if(el.nodeType===1){
          var oy=getComputedStyle(el).overflowY;
          if((oy==='auto'||oy==='scroll')&&el.scrollHeight>el.clientHeight+1&&el.scrollTop+el.clientHeight<el.scrollHeight-1)return true;
        }
        if(el===dlg)break;
        el=el.parentNode;
      }
      return false;
    }
    function back(y){
      stopGlide();
      var done=function(){paint(0);dlg.style.removeProperty('--bd');dlg.style.willChange='';showT();};
      if(noMotion()||!dlg.animate){done();return;}
      var b0=parseFloat(dlg.style.getPropertyValue('--bd'));if(!(b0>=0))b0=1;
      var a=dlg.animate([{transform:'translate3d(0,'+y+'px,0)','--bd':b0},{transform:'translate3d(0,0,0)','--bd':1}],{duration:380,easing:'cubic-bezier(.34,1.3,.64,1)',fill:'forwards'});
      ga=a;
      a.onfinish=function(){if(ga!==a)return;ga=null;a.onfinish=null;done();a.cancel();};
    }
    function fling(y,v){
      var r=dlg.getBoundingClientRect(),off=r.top-y+r.height+20,speed=Math.max(-v,1.2);
      dlg._startY=y;dlg._closeMs=Math.max(160,Math.min(320,(off+y)/speed));
      dismiss();
      // a window that stays open (for example the Discard changes question) bounces back
      if(dlg.open&&!dlg._closing){dlg._startY=0;dlg._closeMs=0;back(y);}
      showT();
    }
    // while a swipe is in progress, every scrollable section inside the window is frozen
    var frozen=[];
    function freezeScroll(){
      thawScroll();
      Array.prototype.slice.call(dlg.querySelectorAll('*')).concat([dlg]).forEach(function(el){
        var oy=getComputedStyle(el).overflowY;
        if((oy==='auto'||oy==='scroll')&&el.scrollHeight>el.clientHeight+1){frozen.push({el:el,v:el.style.overflowY});el.style.overflowY='hidden';}
      });
    }
    function thawScroll(){frozen.forEach(function(f){f.el.style.overflowY=f.v;});frozen=[];}
    function activate(){
      st.on=true;dlg.style.willChange='transform';freezeScroll();
      if(toast.parentNode===dlg){toast.style.visibility='hidden';hid=true;}
    }
    function vel(s,now){
      var a=s.s[0],b=s.s[s.s.length-1];
      if(!a||!b||now-b.t>80||b.t===a.t)return 0;
      return (b.y-a.y)/(b.t-a.t);
    }
    dlg.addEventListener('touchstart',function(e){
      if(e.touches.length!==1||dlg._closing){st=null;return;}
      var tg=e.target;
      if(tg.closest&&tg.closest('.grip,.toast')){st=null;return;}
      var t=e.touches[0];
      st={el:tg,x:t.clientX,y:t.clientY,ly:t.clientY,cy:0,on:false,dead:false,s:[]};
      var g=stopGlide();
      if(g!==null){st.cy=g;activate();}   // catch a window that is still bouncing back
    },{passive:true});
    dlg.addEventListener('touchmove',function(e){
      var s=st;if(!s||s.dead)return;
      var t=e.touches[0];
      if(!s.on){
        var dx=t.clientX-s.x,dy=t.clientY-s.y;
        if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
        if(dy<0&&-dy>Math.abs(dx)*1.2&&!canScroll(s.el)){activate();s.ly=t.clientY;}
        else{s.dead=true;return;}
      }
      if(e.cancelable)e.preventDefault();
      s.cy=Math.min(0,s.cy+(t.clientY-s.ly));s.ly=t.clientY;
      var now=e.timeStamp;
      s.s.push({t:now,y:s.cy});
      while(s.s.length>2&&now-s.s[0].t>100)s.s.shift();
      paint(s.cy);
    },{passive:false});
    function end(e){
      var s=st;st=null;
      if(!s||!s.on)return;
      thawScroll();var y=s.cy,v=vel(s,e.timeStamp),h=dlg.offsetHeight||1;
      var go=e.type==='touchend'&&y<-4&&v<=.3&&(v<-.45||-y>Math.max(60,h*.33));
      if(go)fling(y,v);else{back(y);}
    }
    dlg.addEventListener('touchend',end);
    dlg.addEventListener('touchcancel',end);
    dlg.addEventListener('close',function(){
      if(ga){ga.onfinish=null;ga.cancel();ga=null;}
      dlg.style.transform='';dlg.style.removeProperty('--bd');dlg.style.willChange='';st=null;thawScroll();showT();
    });
  }
  document.querySelectorAll('dialog').forEach(function(d){
    if(d.hasAttribute('data-alert'))return;
    swipeDismiss(d,d.id==='dlgDesc'?requestCloseDesc:d.id==='dlgEdit'?requestCloseEdit:d.id==='dlgRecipeEdit'?requestCloseRE:function(){d.close();});
  });

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
  function sortedRecipes(){
    var l=recipes.slice();
    var byName=function(a,b){return a.name.localeCompare(b.name,undefined,{sensitivity:'base'});};
    if(rsort==='az')l.sort(byName);
    else if(rsort==='za')l.sort(function(a,b){return byName(b,a);});
    else if(rsort==='pu')l.sort(function(a,b){return (a.portions-b.portions)||byName(a,b);});
    else if(rsort==='pd')l.sort(function(a,b){return (b.portions-a.portions)||byName(a,b);});
    else if(rsort==='iu')l.sort(function(a,b){return ((a.items||[]).length-(b.items||[]).length)||byName(a,b);});
    else l.sort(function(a,b){return ((b.items||[]).length-(a.items||[]).length)||byName(a,b);});
    return l;
  }
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

  var keyOf=new WeakMap(),keyCount=0;
  function keyFor(o){if(!keyOf.has(o))keyOf.set(o,++keyCount);return keyOf.get(o);}
  function flipReorder(container,sel,key,renderFn){
    var first={};
    container.querySelectorAll(sel).forEach(function(el){first[el.dataset[key]]=el.getBoundingClientRect();});
    renderFn();
    if(noMotion())return;
    container.querySelectorAll(sel).forEach(function(el){
      var f=first[el.dataset[key]];
      if(!f||!f.height||!el.animate)return;
      var l=el.getBoundingClientRect(),dy=f.top-l.top,dx=f.left-l.left;
      if(Math.abs(dy)<1&&Math.abs(dx)<1)return;
      el.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'translate(0,0)'}],{duration:450,easing:EASE});
    });
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

  function shake(el){
    if(noMotion()||!el.animate)return;
    el.animate([
      {transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},
      {transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(-2px)'},{transform:'translateX(0)'}
    ],{duration:420,easing:'ease-in-out'});
  }
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
    recipes=recipes.filter(function(x){return x!==r;});
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

  function makeSuggest(inp,box,unitSel,qtySel,catSel){
    var idx=-1;
    function hide(){box.hidden=true;box.innerHTML='';idx=-1;inp.parentNode.classList.remove('sugopen');}
    function pick(x){
      inp.value=x.name;
      if(catSel&&!catSel.value&&x.cat)catSel.value=x.cat;
      hide();
      if(!qtySel.value)qtySel.focus();
    }
    function show(){
      var q=inp.value.trim().toLowerCase();
      if(!q){hide();return;}
      var c=nameCandidates(q);
      if(!c.length){hide();return;}
      box.innerHTML='';idx=-1;
      c.forEach(function(x){
        var b=document.createElement('button');b.type='button';b.className='sopt';b.setAttribute('role','option');
        var s=document.createElement('span');s.textContent=x.name;
        var sm=document.createElement('small');sm.textContent=x.src==='list'?'On your list':x.src==='recipe'?'In a recipe':'From history';
        b.appendChild(s);b.appendChild(sm);
        b.addEventListener('mousedown',function(ev){ev.preventDefault();});
        b.addEventListener('click',function(){pick(x);});
        b._x=x;
        box.appendChild(b);
      });
      box.hidden=false;
      inp.parentNode.classList.add('sugopen');
      fit();
    }
    // The list may be as long as the screen allows (above the keyboard when it is open); beyond that it scrolls.
    function fit(){
      if(box.hidden)return;
      var v=window.visualViewport,bottom=v?v.offsetTop+v.height:window.innerHeight;
      var kbOpen=v&&(window.innerHeight-(v.height+v.offsetTop))>80;
      var top=box.getBoundingClientRect().top;
      box.style.maxHeight=Math.max(120,bottom-top-(kbOpen?60:12))+'px';
    }
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize',fit);
      window.visualViewport.addEventListener('scroll',fit);
    }
    window.addEventListener('resize',fit);
    var clr=inp.parentNode.querySelector('.inclear');
    if(clr){
      clr.addEventListener('mousedown',function(ev){ev.preventDefault();});
      clr.addEventListener('click',function(){hide();inp.focus();});
    }
    function move(step){
      var opts=box.querySelectorAll('.sopt');
      if(!opts.length)return;
      idx=(idx+step+opts.length)%opts.length;
      opts.forEach(function(o,i){o.classList.toggle('on',i===idx);});
    }
    inp.addEventListener('input',show);
    inp.addEventListener('keydown',function(ev){
      if(box.hidden)return;
      if(ev.key==='ArrowDown'){ev.preventDefault();move(1);}
      else if(ev.key==='ArrowUp'){ev.preventDefault();move(-1);}
      else if(ev.key==='Enter'&&idx>=0){ev.preventDefault();pick(box.querySelectorAll('.sopt')[idx]._x);}
      else if(ev.key==='Escape'){ev.preventDefault();hide();}
    });
    document.addEventListener('click',function(ev){
      if(!box.hidden&&!box.contains(ev.target)&&ev.target!==inp)hide();
    });
    return {hide:hide};
  }
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
    items=[];
    save();render();
    showToast('List cleared.',function(){items=all.slice();save();render();},7000);
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
  // Sync hooks used by the Firebase module below. Every list entry is stored on its own, so the module only
  // ever hands over single entries that changed (ups) or were deleted (rem).
  function putEntry(arr,u,idf,sorted){
    var id=idf(u),i=-1,j;
    for(j=0;j<arr.length;j++){if(idf(arr[j])===id){i=j;break;}}
    if(i>-1){var o=arr[i];Object.keys(o).forEach(function(k){delete o[k];});Object.assign(o,u);return;}
    var p=arr.length;
    if(sorted){for(j=0;j<arr.length;j++){if(String(idf(arr[j]))>id){p=j;break;}}}
    arr.splice(p,0,u);
  }
  function normRecipe(r){if(!r.portions)r.portions=4;if(!r.items)r.items=[];}
  window.cauldronApp={
    items:function(){return items;},
    recipes:function(){return recipes;},
    history:function(){return itemHistory;},
    replaceAll:function(kind,list){
      list=list||[];
      if(kind==='items'){items=list;fixCats(items);ensureIds(items);saveLocal();render();}
      else if(kind==='recipes'){recipes=list;recipes.forEach(normRecipe);fixCats(recipes);saveRLocal();renderRecipes();render();}
      else{itemHistory=list;fixCats(itemHistory);saveHistLocal();}
    },
    applyChanges:function(kind,ups,rem){
      var fixed=fixCats(ups);
      if(kind==='items'){
        if(rem.length)items=items.filter(function(x){return rem.indexOf(x.id)<0;});
        ups.forEach(function(u){putEntry(items,u,function(x){return x.id;},true);});
        saveLocal();withAnim('list',render,true);if(fixed)save();
      }else if(kind==='recipes'){
        if(rem.length)recipes=recipes.filter(function(x){return rem.indexOf(String(x.id))<0;});
        ups.forEach(function(u){normRecipe(u);putEntry(recipes,u,function(x){return String(x.id);},false);});
        saveRLocal();withAnim('recipes',function(){renderRecipes();render();},true);if(fixed)saveR();
      }else{
        ups.forEach(function(u){putEntry(itemHistory,u,function(x){return String(x.text).toLowerCase();},false);});
        saveHistLocal();if(fixed)saveHist();
      }
    }
  };

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

  var UNLINK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" x2="8" y1="2" y2="5"/><line x1="2" x2="5" y1="8" y2="8"/><line x1="16" x2="16" y1="19" y2="22"/><line x1="19" x2="22" y1="16" y2="16"/></svg>';
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

  // ---- Patch notes: shown once, the first time a new version is opened ----
  // To release a new version: raise APP_VERSION above and add an entry here (tag: new, better or fixed). Entries only appear in the
  // version history (footer). The optional SHOWCASE entry below is what is shown once after the update.
  var NOTES={
    'v76':{date:'21 November 2026',entries:[
      {tag:'better',title:'Moved to TypeScript tooling',text:'Cauldron is now built with Vite and TypeScript under the hood. Nothing changes in how the app looks or works.'}
    ]},
    'v75':{date:'19 November 2026',entries:[
      {tag:'better',title:'Sync library updated',text:'The sync engine behind Cauldron was updated to the latest Firebase release, for better security and reliability. Nothing changes in how the app looks or works.'}
    ]},
    'v74':{date:'19 November 2026',entries:[
      {tag:'better',title:'Details under the name',text:'The Description window now shows the category, quantity and unit as a subheader below the item name, the same way recipe windows show portions and ingredients.'},
      {tag:'better',title:'Quantity and unit back in Edit item',text:'Quantity and unit are edited in the "Edit item" window again, next to name, brand and category. The Description window now only saves the description.'},
      {tag:'new',title:'Notebook lines',text:'List rows and recipe ingredients now have a soft red vertical line between the checkbox or drag handle and the item name, like the margin line in a notebook.'}
    ]},
    'v73':{date:'19 November 2026',entries:[
      {tag:'better',title:'New handwriting font',text:'Item names and recipe titles now use Playpen Sans instead of Caveat. Brand names are now shown in even bolder font.'}
    ]},
    'v72':{date:'17 November 2026',entries:[
      {tag:'new',title:'Item descriptions',text:'Tapping an item in the Shopping list now opens a new window with an input field where you can enter notes that are assigned to that item.'},
      {tag:'better',title:'Edit item behind the pencil',text:'The "Edit item" window now sits behind the pencil button in the Description window.'},
      {tag:'better',title:'Re-linking rules',text:'Re-linking has been overhauled to handle item renames, both in the Shopping list and in the Recipes. If a rename is done on an item that is already on the Shopping list, then you are presented with a window that lets you rename the already added item (without having to re-link it).'}
    ]},
    'v71':{date:'17 November 2026',entries:[
      {tag:'better',title:'Floating unlink button in tiles',demo:'v71',text:'In the tile layout, the broken chain icon is now a round button that sits in the bottom right corner of its tile. It stays tappable even when you swipe over a tile. Tap it to "re-link" an item.'},
      {tag:'better',title:'Firmer swipes in tiles',text:'In tile layout, swipe actions now require you to swipe a longer distance to avoid accidental swipes.'}
    ]},
    'v70':{date:'16 November 2026',entries:[
      {tag:'new',title:'Swipe right to check off',demo:'v70',text:'In the tile layout, swipe a tile to the right to check it off (or uncheck it). Swipe a little and tap the green button, or swipe all the way across.'},
      {tag:'better',title:'Tap a tile to edit it',text:'On a phone, tapping a tile now opens the Edit item window, like on recipe tiles. Pressing and holding is no longer needed, and accidental taps no longer check items off.'},
      {tag:'new',title:'Right click on computers',text:'On a computer, right click an item to edit it or a recipe to open it. In the tile layout, a left click on a tile now checks it off. The check button on hover is not needed anymore.'},
      {tag:'new',title:'Undo when checking off',text:'Checking off an item now shows a banner at the bottom with an Undo button, so a mistake can be reversed instantly.'}
    ]},
    'v69':{date:'16 November 2026',entries:[
      {tag:'fixed',title:'Long recipe names in tiles',text:'In the Shopping list tile layout sorted by recipe, recipe names longer than 20 characters are now cut off with \u201c...\u201d instead of shrinking to a tiny font.'},
      {tag:'better',title:'Portions first on recipe tiles',text:'Recipe tiles now show the portions before the ingredient count, matching the recipe window. When sorted by ingredients, the ingredient count still comes first.'}
    ]},
    'v68':{date:'15 November 2026',entries:[
      {tag:'new',title:'Unlinked icon in tiles',text:'Tiles in the tile layout now show the broken chain icon in the bottom right corner, next to the quantity, when an item was unlinked from its recipe.'},
      {tag:'better',title:'Re-link from the Edit window',text:'In the "Edit item" window, tapping or clicking the broken chain on a recipe card now opens the "Re-link to recipe" window (when re-linking is possible), instead of only showing a tooltip. On a computer the tooltip still appears on hover.'}
    ]},
    'v67':{date:'15 November 2026',entries:[
      {tag:'new',title:'Brand field',text:'Items now have an optional Brand field. In item names, the brand will always be hightlighted in a bold font.'}
    ]},
    'v66':{date:'14 November 2026',entries:[
      {tag:'new',title:'Cup and slice units',text:'You can now choose \u201ccup\u201d (a cup of yogurt) and \u201cslice\u201d (a slice of bread) as units when adding or editing items.'}
    ]},
    'v65':{date:'14 November 2026',entries:[
      {tag:'better',title:'Layout switch next to the chips',demo:'v65',text:'On a computer, the list and tile switch now sits on the right of the sorting chips in both the Shopping list and Recipes, at the same height. Phones are not affected by this change.'},
      {tag:'new',title:'Three tiles per row',text:'On a computer, all tile layouts now show three tiles per row instead of two. Phones keep two.'}
    ]},
    'v64':{date:'14 November 2026',entries:[
      {tag:'better',title:'Compact recipe info',text:'Recipe cards and the recipe window now show the ingredient count and the portions on one line, separated by a dot, which saves space.'}
    ]},
    'v63':{date:'14 November 2026',entries:[
      {tag:'fixed',title:'Tile text size on startup',text:'Long item and recipe names in tiles no longer start out too small and only grow after syncing. They now fit correctly as soon as the handwriting font has loaded.'}
    ]},
    'v62':{date:'13 November 2026',entries:[
      {tag:'new',title:'Checked items move to the bottom',text:'Items you tick off now fade out and reappear at the bottom of the Shopping list. In the list layout they land in their own \u201cChecked off\u201d section; in the tile layout they simply move to the end. Untick an item and it moves back up.'}
    ]},
    'v61':{date:'13 November 2026',entries:[
      {tag:'new',title:'Ingredient count in recipes',text:'The recipe window now shows how many ingredients the recipe has, just above the portions.'},
      {tag:'new',title:'Sort by ingredients',text:'In Recipes, a new Ingredients chip next to Portions sorts your recipes by number of ingredients. Tap it again to switch between fewest first and most first.'}
    ]},
    'v60':{date:'13 November 2026',entries:[
      {tag:'fixed',title:'Portions when adding a recipe twice',text:'Adding the same recipe to the Shopping list again now adds up the portions shown on the item, so the label matches the quantity.'},
      {tag:'new',title:'Already on your list',text:'When you add a recipe that is already on the Shopping list, the window now says so in an orange box.'}
    ]},
    'v59':{date:'13 November 2026',entries:[
      {tag:'new',title:'Swipe to \u201cadd to Shopping list\u201d',demo:'v59',text:'In Recipes, swipe a recipe to the left to add it to your Shopping list. Swipe a little and tap the green button, or swipe all the way across.'},
      {tag:'new',title:'Ingredient count',text:'Recipe cards and tiles now show how many ingredients each recipe has, just above the portions.'},
      {tag:'better',title:'Cleaner recipe cards',text:'The \u201cAdd to Shopping list\u201d button is gone from recipe cards and tiles. On a computer it appears when you hover over a recipe.'}
    ]},
    'v58':{date:'11 November 2026',entries:[
      {tag:'fixed',title:'Item names cut off in tiles',text:'The last letter of an item name, such as \u201cchicken breast\u201d, is no longer clipped on Shopping list tiles.'}
    ]},
    'v57':{date:'11 November 2026',entries:[
      {tag:'new',title:'Recipe slider',demo:'v57',text:'When an item comes from several recipes, the \u201cEdit item\u201d and \u201cUnlink from recipe\u201d windows show one recipe card at a time. Swipe left or right to see the others, or tap a dot to jump to one.'}
    ]},
    'v56':{date:'11 November 2026',entries:[
      {tag:'fixed',title:'\u201cUnlink\u201d icon rework',text:'The broken chain link icon now has more consistent spacing across the app.'},
      {tag:'better',title:'Handling of recipes from multiple sources',text:'Items that are added through multiple sources are merged carefully and maintain their link so tracing back the source is still possible.'},
      {tag:'better',title:'No re-linking of mixed items',text:'Items that were added through multiple sources can no longer be re-linked.'}
    ]},
    'v55':{date:'10 November 2026',entries:[
      {tag:'new',title:'Swipe windows away',text:'On a phone, swipe a window up to close it.'},
      {tag:'better',title:'No more \u00d7 buttons on phones',text:'Windows on touch screens no longer have a close button. Tap outside or swipe up instead. Warning windows use their \u201cCancel\u201d or \u201cNo\u201d buttons instead.'},
      {tag:'new',title:'Re-link to recipe',demo:'v55',text:'Tap the broken chain on an item you unlinked by changing its quantity or unit to re-link it. Its original quantity and unit are restored.'},
      {tag:'better',title:'Re-worked unlinking',text:'The \u201cUnlink from recipe\u201d window now has a 3 second timer on its confirm button, a Cancel button, and closes when you tap outside it, which returns you to the Edit item window.'}
    ]},
    'v54':{date:'10 November 2026',entries:[
      {tag:'better',title:'Streamlined, uniform colour scheme',text:'The colors for various windows and input fields have been updated, both in light and dark modes.'},
      {tag:'better',title:'No automatic focus',text:'The \u201cAdd item\u201d, \u201cAdd to recipe\u201d and \u201cAdd recipe\u201d windows no longer start with a field selected, so the keyboard stays closed until you tap a field.'},
      {tag:'fixed',title:'White dropdown arrows',text:'In dark mode, the up and down arrows on dropdown menus are now white instead of black.'}
    ]},
    'v53':{date:'10 November 2026',entries:[
      {tag:'better',title:'Colour changes to Recipe and \u201cAdd to Shopping list\u201d windows',text:'The colour schemes for these two windows have been changed for better visual clarity.'}
    ]},
    'v52':{date:'10 November 2026',entries:[
      {tag:'fixed',title:'Smoother swipe-to-delete',text:'Swiping on rows and tiles to delete items is now supported by better animation handling.'}
    ]},
    'v51':{date:'9 November 2026',entries:[
      {tag:'better',title:'Clear button only closes suggestions',text:'The \u00d7 in item name fields now only closes the suggestions list and keeps what you typed. Keep typing and the list returns whenever there is a match.'}
    ]},
    'v50':{date:'9 November 2026',entries:[
      {tag:'better',title:'Suggestions in recipes',text:'The \u201cAdd item\u201d window in Recipes now shows the same hint text in the item name field and a suggestions list that shows every match and scrolls at the edge of the screen.'},
      {tag:'new',title:'Clear button in recipes',text:'While suggestions are showing in the recipe \u201cAdd item\u201d window, a \u00d7 appears inside the field. Tap it to clear your input and close the suggestions.'},
      {tag:'new',title:'Suggestions when editing',text:'The \u201cEdit item\u201d windows in the Shopping list and in Recipes now have the same hint text, suggestions list and clear button.'},
      {tag:'fixed',title:'Add windows start empty',text:'Closing an \u201cAdd item\u201d or \u201cAdd recipe\u201d window without saving now clears what you typed.'}
    ]},
    'v49':{date:'9 November 2026',entries:[
      {tag:'better',title:'\u201cAdd item\u201d window stays full size',text:'The \u201cAdd item\u201d window no longer shrinks when the keyboard opens.'},
      {tag:'better',title:'Expanded suggestions list',text:'The list of item name suggestions now shows every match and scrolls when it reaches the edge of the screen.'},
      {tag:'new',title:'Clear button for suggestions list',text:'While suggestions are showing, a \u00d7 appears inside the field. Tap it to clear your input and close the suggestions.'}
    ]},
    'v48':{date:'8 November 2026',entries:[
      {tag:'new',title:'Swipe to delete in tiles',demo:'v48',text:'Swipe a tile to the left to delete it, just like in the list layout.'},
      {tag:'fixed',title:'Delete button removed',text:'Deleting from the Edit window is no longer an option. Swiping now fills that gap, both in list and tile view. With a mouse, deleting works through a Delete button that appears on hover.'}
    ]},
    'v47':{date:'7 November 2026',entries:[
      {tag:'better',title:'Locked while refreshing',text:'While a pull to refresh is running, only the tabs, the add buttons and search can be used. Everything else is paused until the refresh finishes.'}
    ]},
    'v46':{date:'7 November 2026',entries:[
      {tag:'better',title:'Smoother updates',text:'Sorting, layout and search buttons pause briefly while changes from the server animate in.'}
    ]},
    'v45':{date:'7 November 2026',entries:[
      {tag:'fixed',title:'Search highlighting in tiles',text:'Search now highlights text in recipe tiles again.'}
    ]},
    'v44':{date:'6 November 2026',entries:[
      {tag:'new',title:'Warning about conflicting units',text:'Adding an item that is already on the list with a unit that cannot be converted now gives a warning.'},
      {tag:'new',title:'Animated warning windows',text:'Warning windows now shake when they appear onto the screen.'}
    ]},
    'v43':{date:'5 November 2026',entries:[
      {tag:'new',title:'Pull to refresh',demo:'v43',text:'Pull lists down to update local data and ensure you are always in sync.'},
      {tag:'new',title:'More animations',text:'When lists are updated from server-side, these changes are now animated.'}
    ]},
    'v42':{date:'5 November 2026',entries:[
      {tag:'fixed',title:'Search bar placeholder text',text:'The text inside the search bar now displays correctly and is no longer cut off.'}
    ]},
    'v41':{date:'4 November 2026',entries:[
      {tag:'fixed',title:'Title cutoff and spacing in tile layout',text:'Titles are now correctly cut off in tiles, and spacing and font size are adjusted so the entire title fits. If a title still does not fit, it is shortened with \u201c...\u201d at the end.'},
      {tag:'fixed',title:'Search highlighting',text:'Special characters are treated as spaces so that searches return more results.'}
    ]},
    'v40':{date:'4 November 2026',entries:[
      {tag:'new',title:'Version history',text:'Tap the version button at the bottom to see the patch notes of every version so far.'},
      {tag:'new',title:'Footer in Recipes',text:'The Recipes view now shows the same footer as the Shopping list.'},
      {tag:'better',title:'Tidier footer',text:'The footer has been cleaned up and now includes the button for the version history.'},
      {tag:'better',title:'Bigger recipe titles',text:'On a computer, tile names are larger and can use up to 4 lines. Phones are not affected by this change.'}
    ]},
    'v39':{date:'4 November 2026',entries:[
      {tag:'fixed',title:'Search bar',text:'Fixed an issue where the search bar had inconsistent sizing.'}
    ]},
    'v38':{date:'4 November 2026',entries:[
      {tag:'new',title:'Tube and container units',text:'You can now choose \u201ctube\u201d and \u201ccontainer\u201d when adding items.'},
      {tag:'better',title:'Layout toggle for recipes',text:'In Recipes, the menu button is now a layout toggle (instead of a slider). Tap it to switch between list and tiles.'},
      {tag:'better',title:'No more dozen',text:'\u201cDozen\u201d is no longer offered as a unit. Items that already use it keep it.'},
      {tag:'fixed',title:'Recipe names on tiles',text:'The last letter of a recipe name is no longer cut off on tiles.'}
    ]},
    'v37':{date:'3 November 2026',entries:[
      {tag:'new',title:'Recipes as tiles',text:'Show your recipes as tiles, with a button on each one to add it to your Shopping list.'},
      {tag:'new',title:'Menu for recipes',text:'Recipes now have their own menu button with the layout switch.'},
      {tag:'better',title:'Tidier when empty',text:'With nothing in a list, the menu and search buttons are hidden in both views.'}
    ]},
    'v36':{date:'3 November 2026',entries:[
      {tag:'fixed',title:'Smoother last-item delete',text:'Deleting the last item in a list now flows straight into the empty message instead of shrinking away first.'}
    ]},
    'v35':{date:'2 November 2026',entries:[
      {tag:'new',title:'Swipe to delete',demo:'v35',text:'Swipe an item to the left to reveal a Delete button, or swipe all the way across to remove it. On a computer, hover over the item instead.'},
      {tag:'better',title:'No more \u00d7 buttons',text:'Items in the Shopping list and in recipe windows are tidier now that Delete sits behind the swipe.'}
    ]},
    'v34':{date:'2 November 2026',entries:[
      {tag:'better',title:'Simpler ingredient list',text:'The Add to shopping list window now shows 4 and a half ingredients, with the half row hinting that you can scroll.'}
    ]},
    'v33':{date:'2 November 2026',entries:[
      {tag:'better',title:'Recipes open in a window',text:'Tap a recipe to see and change its ingredients. Delete now sits with the other recipe buttons.'},
      {tag:'new',title:'Shopping list button on recipes',text:'Add a recipe to your shopping list straight from the list, without opening it.'},
      {tag:'better',title:'Banners stay in front',text:'Messages like \u201cItem added. Add another?\u201d now appear in front of open windows.'}
    ]},
    'v32':{date:'2 November 2026',entries:[
      {tag:'better',title:'Patch notes catch you up',text:'If you skip an update, you now see the changes from every version you missed in one window.'}
    ]},
    'v31':{date:'1 November 2026',entries:[
      {tag:'better',title:'Smoother search',text:'The search bar now opens and closes in step with the keyboard.'}
    ]},
    'v30':{date:'31 October 2026',entries:[
      {tag:'new',title:'Patch notes',text:'After an update you now see a short summary of what changed.'}
    ]}
  };
  var TAGS={new:'New',better:'Better',fixed:'Fixed'};
  var dlgShowcase=document.getElementById('dlgShowcase'),notesChecked=false;
  function vnum(k){return parseInt(String(k).replace(/\D/g,''),10)||0;}
  function markSeen(){try{localStorage.setItem(VKEY,APP_VERSION);}catch(e){}}
  function addNoteRows(box,entries){
    entries.forEach(function(e){
      var row=document.createElement('div');row.className='nrow';
      var tg=document.createElement('span');tg.className='ntag '+e.tag;tg.textContent=TAGS[e.tag]||e.tag;
      var col=document.createElement('div');
      var h=document.createElement('div');h.className='nhd';h.textContent=e.title;
      var t=document.createElement('div');t.className='ntx';t.textContent=e.text;
      col.appendChild(h);col.appendChild(t);
      if(e.demo&&SHOWCASE[e.demo]){
        var sb=document.createElement('button');sb.type='button';sb.className='vpill scbtn';sb.textContent='See how it works';
        sb.setAttribute('aria-label','See how it works: '+e.title);
        sb.addEventListener('click',function(){openShowcase(e.demo);});
        col.appendChild(sb);
      }
      row.appendChild(tg);row.appendChild(col);box.appendChild(row);
    });
  }
  // ---- Feature showcase: after an update, one new feature of that version is shown with a small looping demo ----
  // Add ?showcase to the address to preview it at any time.
  var SC_SWIPE_CHECK='<div class="scwrap"><div class="sctile"><span class="scact">'+chkSvg()+'</span><div class="scin"><span class="sccat">Pancakes</span><span class="scmid"><span class="scname">Milk</span></span><span class="scqty">500\u00a0ml</span></div></div><span class="scfinger"></span></div>';
  var SC_SWIPE_ADD='<div class="scwrap scx"><div class="sctile"><span class="scactr add">'+CART_SVG+'</span><div class="scin"><span class="scmid"><span class="scname">Pancakes</span></span><span class="scsub">up to 4 portions</span><span class="scsub">6 ingredients</span></div></div><span class="scfinger"></span></div>';
  var SC_SWIPE_DEL='<div class="scwrap scx scdel"><div class="sctile"><span class="scactr">'+SW_TRASH+'</span><div class="scin"><span class="sccat">Pancakes</span><span class="scmid"><span class="scname">Milk</span></span><span class="scqty">500\u00a0ml</span></div></div><span class="scfinger"></span></div>';
  function scRow(q,n,mid){return '<div class="scrow'+(mid?' mid':'')+'">'+(mid?'<span class="scpill">'+SW_TRASH+'</span>':'')+'<div class="scrw'+(mid?' scfg':'')+'"><span class="scbox"></span><span class="scrt"><strong>'+q+'</strong> '+n+'</span></div></div>';}
  var SC_SWIPE_ROW='<div class="scwrapl">'+scRow('6\u00a0pcs','Eggs')+scRow('1\u00a0l','Milk',true)+scRow('250\u00a0g','Butter')+'<span class="scfinger"></span></div>';
  var SC_LIST_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="7" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="17" r="1" fill="currentColor"/><path d="M10 7h10M10 12h10M10 17h10"/></svg>';
  var SC_GRID_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>';
  function sc65Row(q,n){return '<div class="sc65r"><span class="sc65b"></span><span class="sc65t"><strong>'+q+'</strong> '+n+'</span></div>';}
  function sc65Tile(q,n){return '<div class="sc65tl"><span class="sc65tn">'+n+'</span><span class="sc65tq">'+q+'</span></div>';}
  var SC_LAYOUT='<div class="sc65"><div class="sc65bar"><span class="sc65chip on">By recipe</span><span class="sc65chip">By category</span><span class="sc65chip">A to Z</span><span class="sc65sw"><span class="sc65th"></span><span class="sc65ic sc65i1">'+SC_LIST_IC+'</span><span class="sc65ic sc65i2">'+SC_GRID_IC+'</span></span></div><div class="sc65body"><div class="sc65rows">'+sc65Row('6\u00a0pcs','Eggs')+sc65Row('1\u00a0l','Milk')+sc65Row('250\u00a0g','Butter')+'</div><div class="sc65tiles">'+sc65Tile('6\u00a0pcs','Eggs')+sc65Tile('1\u00a0l','Milk')+sc65Tile('250\u00a0g','Butter')+'</div></div><span class="scfinger"></span></div>';
  function sc57Card(n,p){return '<div class="sc57c"><span class="sc57n">'+n+'</span><span class="sc57p">up to '+p+' portions</span></div>';}
  var SC_SLIDER='<div class="sc57"><div class="sc57clip"><div class="sc57track">'+sc57Card('Pancakes',4)+sc57Card('Cr\u00eapes',6)+sc57Card('Waffles',2)+'</div></div><div class="sc57dots"><span class="sc57d d1"></span><span class="sc57d d2"></span><span class="sc57d d3"></span></div><span class="scfinger"></span></div>';
  var SC_RELINK='<div class="sc55"><div class="sc55dlg"><span class="sc55dt">Re-link to recipe?</span><span class="sc55ds">Pancakes \u00b7 the original quantity and unit are restored</span><span class="sc55btn">Confirm</span></div><div class="sc55row"><span class="scbox"></span><span class="scrt"><span class="sc55q"><strong class="sc55qa">1.5\u00a0l</strong><strong class="sc55qb">1\u00a0l</strong></span> Milk</span><span class="sc55chain">'+UNLINK_SVG+'</span></div><span class="scfinger sc55f1"></span><span class="scfinger sc55f2"></span></div>';
  var SC_SPIN='<svg class="sc43spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">'+(function(){var o='';for(var i=0;i<12;i++)o+='<line x1="12" y1="3" x2="12" y2="7.5" transform="rotate('+(i*30)+' 12 12)" opacity="'+Math.max(.2,1-((12-i)%12)*.075).toFixed(2)+'"/>';return o;})()+'</svg>';
  var SC_PTR='<div class="sc43"><div class="sc43ptr"><span class="sc43orb">'+SC_SPIN+'<svg class="sc43ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span><span class="sc43cap"><span class="sc43ca">Last updated Yesterday, 18:30</span><span class="sc43cb">Last updated Today, 09:41</span></span></div><div class="sc43list">'+scRow('6\u00a0pcs','Eggs')+scRow('1\u00a0l','Milk')+scRow('250\u00a0g','Butter')+'</div><span class="scfinger"></span></div>';
  var SC_UNLINK='<div class="sc71"><div class="sc71tile"><div class="sc71in"><span class="sccat">Pancakes</span><span class="scmid"><span class="scname">Milk</span></span><span class="sc71q"><span class="scqty sc71qa">1\u00a0l</span><span class="scqty sc71qb">500\u00a0ml</span></span></div><span class="sc71chain">'+UNLINK_SVG+'</span></div><div class="sc71dlg"><span class="sc71dt">Re-link to recipe?</span><span class="sc71ds">Pancakes \u00b7 the original quantity and unit are restored</span><span class="sc71btn">Confirm</span></div><span class="scfinger sc71f2"></span><span class="scfinger sc71f3"></span></div>';
  var SHOWCASE={
    'v71':{
      title:'Floating unlink button in tiles',
      alt:'The outlined chain button in a tile\'s bottom right corner is tapped and fills with colour, the Re-link window opens and is confirmed, the quantity changes from 1 l back to 500 ml, and the chain disappears.',
      demo:SC_UNLINK,
      steps:[
        'Open the Shopping list in the tile layout and find a tile with a chain button in its bottom right corner.',
        'Tap the chain button. It fills with colour while you press it.',
        'The Re-link window opens. Tap Confirm once the 3 second timer has run out. The original quantity (500 ml) is restored.'
      ]
    },
    'v43':{
      title:'Pull to refresh',
      alt:'A list is pulled down from its top, a spinner fills up and turns into a check mark, and the list springs back with an updated time.',
      demo:SC_PTR,
      steps:[
        'Open the Shopping list or Recipes and scroll to the top.',
        'Pull the list down until the spinner fills up, then let go.',
        'Wait for the check mark. The caption shows when you last updated. A red mark means you are offline.'
      ]
    },
    'v65':{
      title:'Layout switch next to the chips',
      alt:'On a computer, a switch at the right end of the sorting chips is clicked and the list changes into tiles, then back into a list.',
      demo:SC_LAYOUT,
      steps:[
        'Open the Shopping list or Recipes on a computer.',
        'Find the switch at the right end of the row with the sorting chips.',
        'Click it to change between list and tiles. Click it again to go back.'
      ]
    },
    'v57':{
      title:'Recipe slider',
      alt:'Recipe cards are swiped sideways one at a time while the dots below show which card is in view.',
      demo:SC_SLIDER,
      steps:[
        'Open an item that comes from more than one recipe.',
        'Swipe the recipe card left or right, or tap a dot below it, to see the next recipe.',
        'The window grows or shrinks to fit the card you are looking at.'
      ]
    },
    'v55':{
      title:'Re-link to recipe',
      alt:'The broken chain on an item is tapped, a window asks to re-link it and after confirming, the original quantity returns and the chain disappears.',
      demo:SC_RELINK,
      steps:[
        'Find an item with a broken chain, in the Shopping list or on its recipe card in the Edit item window.',
        'Tap the chain. A window shows the recipe the item will be linked to.',
        'Tap Confirm once the 3 second timer has run out. Changed your mind? Tap Undo in the banner.'
      ]
    },
    'v59':{
      title:'Swipe to add to Shopping list',
      alt:'A recipe tile is swiped to the left, a green cart button appears and the recipe is sent to the Shopping list.',
      demo:SC_SWIPE_ADD,
      steps:[
        'Open the Recipes tab.',
        'Swipe a recipe to the left. Go all the way across to continue at once.',
        'Stopped halfway? Tap the green button. A window opens where you choose the portions and ingredients.'
      ]
    },
    'v48':{
      title:'Swipe to delete in tiles',
      alt:'A tile is swiped to the left, a red trash button appears and the tile is deleted.',
      demo:SC_SWIPE_DEL,
      steps:[
        'Open the Shopping list and switch to the tile layout.',
        'Swipe a tile to the left. Go all the way across to delete it at once.',
        'Stopped halfway? Tap the red button. Deleted by mistake? Tap Undo in the banner.'
      ]
    },
    'v35':{
      title:'Swipe to delete',
      alt:'A list row is swiped to the left, a red trash pill grows from the right edge and the row is removed.',
      demo:SC_SWIPE_ROW,
      steps:[
        'Open the Shopping list, or open a recipe.',
        'Swipe an item to the left. Go past halfway across to delete it at once.',
        'Stopped halfway? Tap the red button. Tap Undo in the banner to bring the item back.'
      ]
    },
    'v70':{
      title:'Swipe to check off',
      alt:'A tile is swiped to the right, a green check button appears and the tile is checked off.',
      demo:SC_SWIPE_CHECK,
      steps:[
        'Open the Shopping list and switch to the tile layout.',
        'Swipe a tile to the right. Go all the way across to check it off at once.',
        'Stopped halfway? Tap the green button. Swipe a checked tile the same way to uncheck it.'
      ]
    }
  };
  function checkNotes(){
    if(notesChecked)return;
    notesChecked=true;
    var force=/[?&]showcase(=|&|$)/.test(location.search);
    var seen=null;try{seen=localStorage.getItem(VKEY);}catch(e){}
    if(!force){
      if(seen===APP_VERSION)return;
      if(freshInstall){markSeen();return;}
    }
    if(!SHOWCASE[APP_VERSION]){markSeen();return;}
    openShowcase(APP_VERSION);
  }
  // Also used by the "See how it works" buttons in the version history.
  function openShowcase(v){
    var sc=SHOWCASE[v];if(!sc)return;
    document.getElementById('scVer').textContent=v;
    document.getElementById('scTitle').textContent=sc.title;
    var st=document.getElementById('scStage');st.innerHTML=sc.demo;st.setAttribute('aria-label',sc.alt);
    var box=document.getElementById('scSteps');box.innerHTML='';
    sc.steps.forEach(function(t,i){
      var row=document.createElement('div');row.className='scstep';
      var n=document.createElement('span');n.className='scn';n.textContent=i+1;
      var x=document.createElement('span');x.className='sct';x.textContent=t;
      row.appendChild(n);row.appendChild(x);box.appendChild(row);
    });
    dlgShowcase.showModal();
    dlgShowcase.setAttribute('tabindex','-1');
    dlgShowcase.focus({preventScroll:true});
  }
  var dlgHistory=document.getElementById('dlgHistory');
  function openHistory(){
    document.getElementById('histVer').textContent=APP_VERSION;
    var box=document.getElementById('histList');box.innerHTML='';
    Object.keys(NOTES).sort(function(a,b){return vnum(b)-vnum(a);}).forEach(function(k){
      var n=NOTES[k];
      var g=document.createElement('div');g.className='ngrp';
      var gv=document.createElement('span');gv.className='ngv';gv.textContent=k;
      var gd=document.createElement('span');gd.className='ngd';gd.textContent=n.date;
      var gl=document.createElement('span');gl.className='ngl';
      g.appendChild(gv);g.appendChild(gd);g.appendChild(gl);box.appendChild(g);
      addNoteRows(box,n.entries);
    });
    box.scrollTop=0;
    dlgHistory.showModal();
    dlgHistory.setAttribute('tabindex','-1');
    dlgHistory.focus({preventScroll:true});
  }
  document.getElementById('histOk').addEventListener('click',function(){dlgHistory.close();});
  dlgHistory.addEventListener('click',function(ev){if(ev.target===dlgHistory)dlgHistory.close();});
  dlgShowcase.addEventListener('close',markSeen);
  dlgShowcase.addEventListener('click',function(ev){if(ev.target===dlgShowcase)dlgShowcase.close();});
  document.getElementById('scOk').addEventListener('click',function(){dlgShowcase.close();});
  window.cauldronNotes={check:checkNotes,history:openHistory};

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
  var PTR_TH=60,PTR_HOLD=64,ptrBusy=false;
  // While a manual refresh runs, everything except the tabs, the add buttons and search is locked (inert also
  // blocks keyboard use). Items, recipes, sort chips, layout buttons, the menu, the footer and Undo wait.
  var LOCK_SEL='.sort,#list,#recipes,.syncfoot,#menu,#menuBtn,#layoutToggle,#toastUndo';
  function setRefreshLock(on){
    document.documentElement.classList.toggle('ptrlock',on);
    if(on){if(swOpen)swOpen.close();closeMenu();}
    document.querySelectorAll(LOCK_SEL).forEach(function(el){el.inert=on;});
  }
  function ptP2(v){return String(v).padStart(2,'0');}
  function lastSyncText(){
    var s=window.cauldronSync,d=s&&s.lastSync&&s.lastSync();
    if(!d)return 'Not updated yet';
    var n=new Date(),k=Math.round((new Date(n.getFullYear(),n.getMonth(),n.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);
    return 'Last updated '+(k<=0?'Today':k===1?'Yesterday':d.toLocaleDateString(undefined,{day:'numeric',month:'short'}))+', '+ptP2(d.getHours())+':'+ptP2(d.getMinutes());
  }
  function setupPull(sc){
    var clip=document.createElement('div');clip.className='ptrclip';
    clip.innerHTML='<div class="ptr"><div class="ptrorb"><svg class="ptrspin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"></svg><svg class="ptrok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg><svg class="ptrbad" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg></div><span class="ptrcap" role="status" aria-live="polite"></span></div>';
    sc.parentNode.insertBefore(clip,sc);
    var ptr=clip.firstChild,cap=ptr.querySelector('.ptrcap'),sp=ptr.querySelector('.ptrspin'),spokes=[],fade=[],i,l;
    for(i=0;i<12;i++){
      l=document.createElementNS('http://www.w3.org/2000/svg','line');
      l.setAttribute('x1','12');l.setAttribute('y1','3');l.setAttribute('x2','12');l.setAttribute('y2','7.5');
      l.setAttribute('transform','rotate('+(i*30)+' 12 12)');
      sp.appendChild(l);spokes.push(l);fade.push(Math.max(.2,1-((12-i)%12)*.075));
    }
    var state='idle',pull=0,active=false,decided=false,sy=0,sx=0,armedOnce=false;
    function setSpokes(prog,load){spokes.forEach(function(s,j){s.style.opacity=load?fade[j]:(j<prog*12?.9:.15);});}
    function setPull(p,anim){
      pull=p;
      var mv=anim&&!noMotion()?'transform .45s cubic-bezier(.34,1.3,.64,1)':'none';
      ptr.style.transition=mv;
      sc.style.transition=mv==='none'?'none':mv+',--ft .25s ease,--fb .25s ease';
      sc.style.transform=p?'translateY('+p+'px)':'';
      ptr.style.transform='translateY('+(p-PTR_HOLD)+'px)';
      ptr.style.opacity=Math.min(1,p/28);
    }
    function reset(delay){
      setTimeout(function(){
        state='idle';ptrBusy=false;setRefreshLock(false);armedOnce=false;ptr.className='ptr';setSpokes(0);sc.style.transition='';
      },delay);
    }
    function finish(r){
      var hold;
      ptr.classList.remove('loading');
      if(!r.ok){
        ptr.classList.add('bad');cap.textContent='Offline \u00b7 showing saved copy';hold=1500;
      }else{
        if(r.changed)ptr.classList.add('ok');
        cap.textContent=lastSyncText();
        if(cap.animate&&!noMotion())cap.animate([{opacity:.2},{opacity:1}],{duration:300});
        hold=r.changed?800:350;
      }
      setTimeout(function(){setPull(0,true);reset(480);},hold);
    }
    function run(){
      state='loading';ptrBusy=true;setRefreshLock(true);
      ptr.classList.add('loading');setSpokes(1,true);
      cap.textContent=lastSyncText();
      setPull(PTR_HOLD,true);
      var t0=Date.now(),s=window.cauldronSync;
      var job=(s&&s.refresh)?s.refresh():Promise.reject(new Error('offline'));
      job.then(function(r){return {ok:true,changed:!!(r&&r.changed)};},function(){return {ok:false};}).then(function(r){
        setTimeout(function(){finish(r);},Math.max(0,600-(Date.now()-t0)));
      });
    }
    sc.addEventListener('touchstart',function(e){
      if(state!=='idle'||ptrBusy||sc.scrollTop>0||e.touches.length!==1||(e.target.closest&&e.target.closest('dialog'))){active=false;return;}
      active=true;decided=false;armedOnce=false;
      sy=e.touches[0].clientY;sx=e.touches[0].clientX;
      clip.style.top=sc.offsetTop+'px';
      cap.textContent=lastSyncText();
    },{passive:true});
    sc.addEventListener('touchmove',function(e){
      if(!active)return;
      var t=e.touches[0],dy=t.clientY-sy,dx=t.clientX-sx;
      if(!decided){
        if(Math.abs(dy)<6&&Math.abs(dx)<6)return;
        if(dy>0&&dy>Math.abs(dx)*1.2)decided=true;else{active=false;return;}
      }
      if(sc.scrollTop>0){active=false;setPull(0,false);return;}
      if(dy<=0){setPull(0,false);return;}
      if(e.cancelable)e.preventDefault();
      var p=120*(1-Math.exp(-dy/200)),prog=Math.min(1,p/PTR_TH);
      setPull(p,false);setSpokes(prog);
      if(p>=PTR_TH&&!armedOnce){armedOnce=true;if(navigator.vibrate)navigator.vibrate(10);}
      else if(p<PTR_TH)armedOnce=false;
    },{passive:false});
    function end(){
      if(!active)return;
      active=false;
      if(!decided)return;
      if(pull>=PTR_TH)run();else{setPull(0,true);reset(250);}
    }
    sc.addEventListener('touchend',end);
    sc.addEventListener('touchcancel',end);
    setSpokes(0);
  }
  document.querySelectorAll('.scroller').forEach(setupPull);

  render();
  renderRecipes();
})();
