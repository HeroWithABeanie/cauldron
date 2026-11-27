// VERBATIM copy of the code that was in src/app.js before step 1c-7a (after 1c-6c, 480 lines): deleteItem (lines 98-109), removeChecked
// (178-187), performDelete (355-363) and the block from "Checking an item off" to doWipe (395-427). In app.js these sit far apart; here they are
// put one after the other inside a factory, because in app.js they are functions of the big closure; what they use comes in through env.
// @ts-nocheck
import * as store from '../../src/store';

export function makeOldItemActions(env) {
  var items=env.items,recipes=env.recipes,list=env.list,save=env.save,saveR=env.saveR,render=env.render,renderRecipes=env.renderRecipes,withAnim=env.withAnim,showToast=env.showToast;
  var syncClear=env.syncClear,reorderSoon=env.reorderSoon,openWipe=env.openWipe,keyFor=env.keyFor;
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
  function performDelete(r){
    var idx=recipes.indexOf(r);
    store.setList('recipes',recipes.filter(function(x){return x!==r;}));
    saveR();renderRecipes();
    showToast('Recipe deleted.',function(){
      recipes.splice(Math.min(idx,recipes.length),0,r);
      saveR();renderRecipes();
    });
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
  return {deleteItem:deleteItem,removeChecked:removeChecked,performDelete:performDelete,checkedToast:checkedToast,setChecked:setChecked,doWipe:doWipe};
}
