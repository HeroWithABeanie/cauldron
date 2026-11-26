// VERBATIM copy of the recipe sort chips code as it was in src/app.js before step 1c-3 (v76): lines 900-932 (rsort, its saved value,
// the three directions, sortedRecipes, the chips and their click handler). Wrapped in a factory because in app.js these are variables of
// the big closure; recipesEl, renderRecipes and the slide / flip helpers are passed in. The wrapper returns rsort and sortedRecipes.
// @ts-nocheck
import { uiLocked } from '../../src/ui';
import { syncRChips as syncRecipeChips, slideLists } from '../../src/chips';
import { flipReorder } from '../../src/rowfx';
import { sortedRecipes as sortRecipes } from '../../src/sorting';

export function makeOldRecipeChips(env) {
  var recipesEl=env.recipesEl,renderRecipes=env.renderRecipes,recipes=env.recipes;
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
  function syncRChips(){syncRecipeChips(rchips,rsort,rAzDir,rIDir,rPDir);}
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
  return {get rsort(){return rsort;},sortedRecipes:sortedRecipes};
}
