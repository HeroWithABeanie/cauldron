// VERBATIM copy of the search code as it was in src/app.js before step 1c-3 (v76): line 767 (the timing constants), lines 771-832
// (stopPh, startPh, currentSearchBtn, updateRow, applyCurrent, openSearch, closeSearch, requestCloseSearch and the listeners).
// Wrapped in a factory because in app.js these are variables of the big closure: query, searchOpen, currentView, the elements,
// searchHint, closeMenu and the two filters are declared / passed in here, and the wrapper returns the functions so a test can call them.
// @ts-nocheck
import { noMotion, uiLocked } from '../../src/ui';

export function makeOldSearch(env) {
  var query='',searchOpen=false,currentView='list';
  var searchbar=env.searchbar,searchInput=env.searchInput,fabbar=env.fabbar,searchPhEl=env.searchPhEl,searchPhText=env.searchPhText,searchHint=env.searchHint;
  var closeMenu=env.closeMenu,applyListFilter=env.applyListFilter,applyRecipeFilter=env.applyRecipeFilter;
  var KB_MS=280,KB_EASE='cubic-bezier(.22,.9,.3,1)';
  function stopPh(){searchHint.stop();}
  function startPh(){searchHint.start();}
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
    searchHint.pause();searchPhEl.classList.remove('hide');
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
  window.addEventListener('resize',function(){if(searchOpen&&!searchInput.value&&searchHint.resized())startPh();});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if(searchOpen&&!searchInput.value)startPh();});
  return {
    openSearch:openSearch,closeSearch:closeSearch,requestCloseSearch:requestCloseSearch,updateRow:updateRow,
    get query(){return query;},get searchOpen(){return searchOpen;},setView:function(v){currentView=v;}
  };
}
