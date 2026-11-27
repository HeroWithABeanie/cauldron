// VERBATIM copy of the code that was in src/app.js before step 1c-6b (after 1c-6a, 614 lines): the layout switches, the "..." menu and syncClear
// (lines 452-521). Wrapped in a factory because in app.js these are variables of the big closure; what they use comes in through env. The lines
// that are not a copy are the header and the return: in app.js layoutMode, recipeLayout, searchOpen and currentView are plain variables that
// other code changes, so the test reads and sets them through get() and set().
// @ts-nocheck
import { uiLocked } from '../../src/ui';

export function makeOldControls(env) {
  var items=env.items,recipes=env.recipes,LKEY=env.LKEY,RLKEY=env.RLKEY,fabbar=env.fabbar,wipeBtn=env.wipeBtn,clearBtn=env.clearBtn,uncheckBtn=env.uncheckBtn;
  var render=env.render,renderRecipes=env.renderRecipes,closeSearch=env.closeSearch;
  var layoutMode=env.layoutMode,recipeLayout=env.recipeLayout,searchOpen=env.searchOpen,currentView=env.currentView;
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
  return {syncClear:syncClear,closeMenu:closeMenu,get:function(){return {layoutMode:layoutMode,recipeLayout:recipeLayout};},set:function(s){searchOpen=s.searchOpen;currentView=s.currentView;}};
}
