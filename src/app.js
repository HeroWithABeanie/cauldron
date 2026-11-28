import { CAT_HTML } from './categories';
import * as store from './store';
import { refresh as syncRefresh, lastSyncDate } from './sync';
import { initPullToRefresh } from './pulltorefresh';
import { noMotion, shakeOnInvalid } from './ui';
import { showToast, hideToast } from './toast';
import { initDialogs } from './dialogs';
import { sortedItems as sortItems, sortedRecipes as sortRecipes } from './sorting';
import { closeOpenSwipe, initSwipe } from './swipe';
import { fitAll, fitRTiles } from './tiles';
import { keyFor } from './rowfx';
import { nameCandidates as findNames, makeSuggest as makeSuggestFor } from './suggest';
import { enableDrag as dragReorder } from './drag';
import { topLine as topLineFor } from './viewtext';
import { createRecipeChips, RORDER } from './chips';
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
import { createTabs } from './tabs';
import { createViewport } from './viewport';
import { createItemActions } from './itemactions';
import { createAdding } from './adding';
import { createListSort, loadListSort } from './listsort';
import { linkedToRecipe as linkedTo, listedPortions as portionsListed, recipeCardEl as recipeCardFor, ensureOpt, pressFlash } from './recipelinks';

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
  function recordHistory(entries){adding.recordHistory(entries);}

  var sortMode=loadListSort();
  function sortedItems(){return sortItems(items,sortMode);}
  createListSort({get sortMode(){return sortMode;},set sortMode(v){sortMode=v;},list:list,render:render});

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
  function deleteItem(it,anim){itemActions.deleteItem(it,anim);}
  initSwipe();

  var adding=createAdding({items:items,itemHistory:itemHistory,input:input,get dlgItem(){return dlgItem;},get addSuggest(){return addSuggest;},save:save,saveHist:saveHist,render:render,withAnim:withAnim,showToast:showToast,openItemDialog:openItemDialog,openDesc:openDesc});
  clearBtn.addEventListener("click",function(){openRemoveChecked();});
  function removeChecked(){itemActions.removeChecked();}
  var currentView='list',sliding=false;
  var tabs=createTabs({get currentView(){return currentView;},set currentView(v){currentView=v;},get sliding(){return sliding;},set sliding(v){sliding=v;},syncClear:syncClear,updateRow:updateRow,closeSearch:closeSearch,closeOpenSwipe:closeOpenSwipe,setSwapAll:setSwapAll,fitAll:fitAll,fitRTiles:fitRTiles,animateTabIcon:animateTabIcon});

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

  initDialogs({dlgDesc:function(){requestCloseDesc();},dlgEdit:function(){requestCloseEdit();},dlgRecipeEdit:function(){requestCloseRE();},dlgAddList:function(){onAddListNo();},dlgChange:function(){requestCloseChange();}});

  document.addEventListener('touchstart',function(){},{passive:true});

  var rsort='az';
  try{var rs=localStorage.getItem('shopping-list-rsort');if(RORDER.indexOf(rs)>-1)rsort=rs;}catch(e){}
  function sortedRecipes(){return sortRecipes(recipes,rsort);}
  createRecipeChips({get rsort(){return rsort;},set rsort(v){rsort=v;},recipesEl:recipesEl,renderRecipes:renderRecipes});

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
  function performDelete(r){itemActions.performDelete(r);}

  function enableDrag(grip,li,ul,r){dragReorder(grip,li,ul,r,function(){return !!query.trim();},function(){saveR();renderRecipes();});}

  function makeSuggest(inp,box,unitSel,qtySel,catSel){return makeSuggestFor(inp,box,unitSel,qtySel,catSel,nameCandidates);}

  // Which recipes the items on the list came from, and the recipe card of the Unlink / Re-link / Edit item windows, live in recipelinks.ts (the lists are passed in).
  function linkedToRecipe(r){return linkedTo(items,r);}
  function listedPortions(r){return portionsListed(items,r);}
  function recipeCardEl(f){return recipeCardFor(recipes,f);}

  var uncheckBtn=document.getElementById('uncheck');
  var wipeBtn=document.getElementById('wipe');
  var itemActions=createItemActions({items:items,recipes:recipes,list:list,uncheckBtn:uncheckBtn,wipeBtn:wipeBtn,save:save,saveR:saveR,render:render,renderRecipes:renderRecipes,withAnim:withAnim,showToast:showToast,syncClear:syncClear,reorderSoon:reorderSoon,openWipe:openWipe,keyFor:keyFor});
  function checkedToast(it){itemActions.checkedToast(it);}
  function doWipe(){itemActions.doWipe();}
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


  createViewport({list:list,recipesEl:recipesEl,searchInput:searchInput});

  var recipeEdit=createRecipeEdit({items:items,dismissSearch:dismissSearch,recordHistory:recordHistory,save:save,saveR:saveR,render:render,renderRecipes:renderRecipes,showToast:showToast,openDiscard:openDiscard,ensureOpt:ensureOpt,makeSuggest:makeSuggest,recipeCardEl:recipeCardEl,unitHTML:unitHTML,COOK_HTML:COOK_HTML});
  function openRecipeEdit(r,it){recipeEdit.openRecipeEdit(r,it);}
  function requestCloseRE(){recipeEdit.requestCloseRE();}

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
