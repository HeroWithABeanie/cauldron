import { CAT_HTML } from './categories';
import { uid } from './names';
import { unitLabel, convertQty } from './units';
import * as store from './store';
import { refresh as syncRefresh, lastSyncDate } from './sync';
import { initPullToRefresh } from './pulltorefresh';
import { noMotion, nameFrag, uiLocked, shakeOnInvalid } from './ui';
import { showToast, hideToast } from './toast';
import { initDialogs } from './dialogs';
import { sortedItems as sortItems, sortedRecipes as sortRecipes } from './sorting';
import { closeOpenSwipe, initSwipe } from './swipe';
import { fitAll, fitRTiles } from './tiles';
import { keyFor, flipReorder } from './rowfx';
import { nameCandidates as findNames, makeSuggest as makeSuggestFor } from './suggest';
import { enableDrag as dragReorder } from './drag';
import { topLine as topLineFor } from './viewtext';
import { syncChips as syncSortChips, createRecipeChips, slideLists } from './chips';
import { withAnim as animWith } from './anim';
import { closeTips } from './tips';
import { applyListFilter as filterList, applyRecipeFilter as filterRecipes } from './filter';
import { createListView } from './listview';
import { createRecipeView } from './recipeview';
import { animateTabIcon, setSwapAll } from './tabicon';
import { createSearch } from './search';
import { createConfirms } from './confirms';
import { createItemDialogs } from './itemdialogs';
import { createRecipeDialogs } from './recipedialogs';
import { createRecipeEdit } from './recipeedit';
import { createControls } from './controls';

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
  function syncChips(){syncSortChips(chips,sortMode,listAzDir);}
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
  function topLine(it){return topLineFor(it,sortMode);}
  window.addEventListener('resize',fitAll);
  // The Shopping list on screen (drawing, tick animation) lives in listview.ts; it reads this state through getters.
  var listView=createListView({get list(){return list;},get items(){return items;},get recipes(){return recipes;},get layoutMode(){return layoutMode;},get sortMode(){return sortMode;},get sliding(){return sliding;},get currentView(){return currentView;},
    sortedItems:sortedItems,topLine:topLine,save:save,syncClear:syncClear,applyListFilter:applyListFilter,checkedToast:checkedToast,openDesc:openDesc,openRelink:openRelink,deleteItem:deleteItem});
  function reorderSoon(ms,its){listView.reorderSoon(ms,its);}
  function render(){listView.render();}
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
  initSwipe();

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

  var dlgView=document.getElementById('dlgView'),viewList=document.getElementById('viewList');
  // A change that really goes through (added, removed, edited, deleted, put on the shopping list) ends the search.
  // Cancelling or just looking at a recipe leaves it as it was.
  function dismissSearch(){if(searchOpen)closeSearch(true);}

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
  // The Recipes tab (cards or tiles, swipe to add to the Shopping list) and the recipe window live in recipeview.ts; it reads this state through getters.
  var recipeView=createRecipeView({recipesEl:recipesEl,dlgView:dlgView,viewList:viewList,get recipes(){return recipes;},get items(){return items;},get recipeLayout(){return recipeLayout;},get rsort(){return rsort;},get query(){return query;},
    sortedRecipes:sortedRecipes,save:save,saveR:saveR,render:render,applyRecipeFilter:applyRecipeFilter,syncClear:syncClear,dismissSearch:dismissSearch,enableDrag:enableDrag,openShop:openShop,openRecipeEdit:openRecipeEdit,showToast:showToast});
  function renderRecipes(){recipeView.renderRecipes();}
  dlgView.addEventListener('click',function(ev){if(ev.target===dlgView)dlgView.close();});
  document.getElementById('viewClose').addEventListener('click',function(){dlgView.close();});
  pressFlash(document.getElementById('vAdd'),function(){var vt=recipeView.getTarget();if(vt)openIngredient(vt);});
  pressFlash(document.getElementById('vEdit'),function(){var vt=recipeView.getTarget();if(vt)openChange(vt);});
  pressFlash(document.getElementById('vDel'),function(){var vt=recipeView.getTarget();if(vt)openDelete(vt);});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if(dlgView.open)recipeView.fitView();});

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

  function addToShopping(list,src,sp,partial){return recipeDialogs.addToShopping(list,src,sp,partial);}


  document.getElementById('addCat').innerHTML=CAT_HTML;
  var COOK_HTML='<optgroup label="Cooking"><option value="tsp">teaspoons (tsp)</option><option value="tbsp">tablespoons (tbsp)</option><option value="pinch">pinch</option></optgroup>';
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

  var dlgRecipe=document.getElementById('dlgRecipe');
  document.getElementById('dlgRecipeClose').addEventListener('click',function(){dlgRecipe.close();});
  dlgRecipe.addEventListener('click',function(ev){if(ev.target===dlgRecipe)dlgRecipe.close();});
  dlgRecipe.addEventListener('close',function(){
    document.getElementById('recipeName').value='';document.getElementById('recipePortions').value='';
  });

  // The Add ingredient, Add to Shopping list and Change name / portions windows (and addToShopping, which puts ingredients on the list)
  // live in recipedialogs.ts. items is the one shared list array; showToast comes in through here because toast.ts touches the page when imported.
  var recipeDialogs=createRecipeDialogs({items:items,save:save,saveR:saveR,render:render,renderRecipes:renderRecipes,recordHistory:recordHistory,dismissSearch:dismissSearch,openDiscard:openDiscard,openAddList:openAddList,ensureOpt:ensureOpt,linkedToRecipe:linkedToRecipe,listedPortions:listedPortions,makeSuggest:makeSuggest,showToast:showToast,viewList:viewList,unitHTML:unitHTML,COOK_HTML:COOK_HTML});
  function openIngredient(r){recipeDialogs.openIngredient(r);}
  function openShop(r){recipeDialogs.openShop(r);}
  function openChange(r){recipeDialogs.openChange(r);}
  function requestCloseChange(){recipeDialogs.requestCloseChange();}

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

  // The Description, Edit item, Unlink and Re-link windows live in itemdialogs.ts. They read the lists through getters (the lists get replaced)
  // and ask for the shared helpers; showToast comes in through here because toast.ts touches the page when it is imported.
  var itemDialogs=createItemDialogs({get items(){return items;},get recipes(){return recipes;},save:save,render:render,recordHistory:recordHistory,openDiscard:openDiscard,ensureOpt:ensureOpt,recipeCardEl:recipeCardEl,makeSuggest:makeSuggest,showToast:showToast,unitHTML:unitHTML,COOK_HTML:COOK_HTML});
  function openDesc(it){itemDialogs.openDesc(it);}
  function openRelink(it,fromEdit){itemDialogs.openRelink(it,fromEdit);}
  function requestCloseDesc(){itemDialogs.requestCloseDesc();}
  function requestCloseEdit(){itemDialogs.requestCloseEdit();}

  document.addEventListener('click',closeTips);
  document.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('button');
    if(b&&b.id!=='toastUndo')hideToast();
  },true);

  var query='',searchOpen=false;
  var filterState={get list(){return list;},get recipesEl(){return recipesEl;},get items(){return items;},get recipes(){return recipes;},get query(){return query;},get currentView(){return currentView;},get recipeLayout(){return recipeLayout;}};
  function applyListFilter(animate){filterList(filterState,animate);}
  function applyRecipeFilter(animate){filterRecipes(filterState,animate);}

  var searchInput=document.getElementById('searchInput'),fabbar=document.getElementById('fabbar');
  // The search bar (open, close, typing, the hint animation) lives in search.ts. query and searchOpen stay here: the filters, the menu and the tabs read them too.
  var search=createSearch({get query(){return query;},set query(v){query=v;},get searchOpen(){return searchOpen;},set searchOpen(v){searchOpen=v;},get currentView(){return currentView;},searchInput:searchInput,fabbar:fabbar,closeMenu:closeMenu,applyListFilter:applyListFilter,applyRecipeFilter:applyRecipeFilter});
  function closeSearch(animate){search.close(animate);}
  function updateRow(v){search.updateRow(v);}

  // A quantity field that is empty or invalid shakes (instead of the browser's own bubble).
  ['qty','editQty','reQty','ingQty'].forEach(function(id){shakeOnInvalid(document.getElementById(id));});



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
  function sortedRecipes(){return sortRecipes(recipes,rsort);}
  createRecipeChips({get rsort(){return rsort;},set rsort(v){rsort=v;},recipesEl:recipesEl,renderRecipes:renderRecipes});

  function ensureOpt(sel,v){
    var has=Array.prototype.some.call(sel.options,function(o){return o.value===String(v);});
    if(!has){
      var o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o);
    }
  }

  setSwapAll();
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(setSwapAll);

  // The five confirmation windows (delete recipe, discard changes, add to list?, clear list, remove checked) live in confirms.ts.
  var confirms=createConfirms({dismissSearch:dismissSearch,performDelete:performDelete,doWipe:doWipe,removeChecked:removeChecked,listedPortions:listedPortions,addToShopping:addToShopping,showToast:showToast,openIngredient:openIngredient});
  function openDelete(r){confirms.openDelete(r);}
  function openDiscard(then){confirms.openDiscard(then);}
  function openAddList(r,item){confirms.openAddList(r,item);}
  function onAddListNo(){confirms.onAddListNo();}
  function openWipe(){confirms.openWipe();}
  function openRemoveChecked(){confirms.openRemoveChecked();}
  function performDelete(r){
    var idx=recipes.indexOf(r);
    store.setList('recipes',recipes.filter(function(x){return x!==r;}));
    saveR();renderRecipes();
    showToast('Recipe deleted.',function(){
      recipes.splice(Math.min(idx,recipes.length),0,r);
      saveR();renderRecipes();
    });
  }

  function enableDrag(grip,li,ul,r){dragReorder(grip,li,ul,r,function(){return !!query.trim();},function(){saveR();renderRecipes();});}

  function makeSuggest(inp,box,unitSel,qtySel,catSel){return makeSuggestFor(inp,box,unitSel,qtySel,catSel,nameCandidates);}

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
  var controls=createControls({items:items,recipes:recipes,get layoutMode(){return layoutMode;},set layoutMode(v){layoutMode=v;},get recipeLayout(){return recipeLayout;},set recipeLayout(v){recipeLayout=v;},get searchOpen(){return searchOpen;},get currentView(){return currentView;},LKEY:LKEY,RLKEY:RLKEY,fabbar:fabbar,wipeBtn:wipeBtn,clearBtn:clearBtn,uncheckBtn:uncheckBtn,render:render,renderRecipes:renderRecipes,closeSearch:closeSearch});
  function syncClear(){controls.syncClear();}
  function closeMenu(){controls.closeMenu();}

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

  var recipeEdit=createRecipeEdit({items:items,dismissSearch:dismissSearch,recordHistory:recordHistory,save:save,saveR:saveR,render:render,renderRecipes:renderRecipes,showToast:showToast,openDiscard:openDiscard,ensureOpt:ensureOpt,makeSuggest:makeSuggest,recipeCardEl:recipeCardEl,unitHTML:unitHTML,COOK_HTML:COOK_HTML});
  function openRecipeEdit(r,it){recipeEdit.openRecipeEdit(r,it);}
  function requestCloseRE(){recipeEdit.requestCloseRE();}

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

  items.forEach(function(it){
    (it.from||[]).forEach(function(f){
      if(f.rp===undefined){var rc=recipes.find(function(x){return x.id===f.id;});if(rc)f.rp=rc.portions;}
    });
  });
  save();

  // ---- Smooth changes: items or recipes that arrive from the server (or that you add yourself) are animated ----
  // Own deletions already have the swipe animation, so only deletions made on the server play the reverse animation.
  var animState={get list(){return list;},get recipesEl(){return recipesEl;},get sliding(){return sliding;},get query(){return query;},get currentView(){return currentView;},get layoutMode(){return layoutMode;},get recipeLayout(){return recipeLayout;}};
  function withAnim(kind,fn,lock){animWith(animState,kind,fn,lock);}

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
