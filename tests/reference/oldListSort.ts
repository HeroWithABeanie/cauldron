// VERBATIM copy of the Shopping list sort chips code as it was in src/app.js before step 1c-8a (v76): lines 48-52 (the saved sort and the
// saved A to Z direction) and 54-73 (the chips and their click handler). Wrapped in a factory because in app.js these are variables of
// the big closure; list and render are passed in. The wrapper returns sortMode. Generated with sed from the old file, see the test.
// @ts-nocheck
import { uiLocked } from '../../src/ui';
import { syncChips as syncSortChips, slideLists } from '../../src/chips';
import { flipReorder } from '../../src/rowfx';

export function makeOldListSort(env) {
  var list=env.list,render=env.render;
  var SKEY='shopping-list-sort',sortMode='recipe';
  try{var sm=localStorage.getItem(SKEY);if(sm==='az'||sm==='za'||sm==='cat')sortMode=sm;}catch(e){}
  var listAzDir='az';
  try{if(localStorage.getItem('shopping-list-azdir')==='za')listAzDir='za';}catch(e){}
  if(sortMode==='az'||sortMode==='za')listAzDir=sortMode;
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
  return {get sortMode(){return sortMode;}};
}
