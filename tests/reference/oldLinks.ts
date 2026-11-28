// VERBATIM copy of the recipe helpers as they were in src/app.js before step 1c-8b (the file as it was after step 1c-8a): lines 203-209
// (pressFlash), 220-225 (ensureOpt) and 244-268 (linkedFrom, linkedToRecipe, listedPortions, recipeCardEl). Wrapped in a factory because in
// app.js these are functions of the big closure; items and recipes are passed in. Generated with sed from the old file, see the test.
// @ts-nocheck
export function makeOldLinks(env) {
  var items=env.items,recipes=env.recipes;
  function pressFlash(btn,fn){
    btn.addEventListener('click',function(){
      if(btn.classList.contains('pressed'))return;
      btn.classList.add('pressed');
      setTimeout(function(){btn.classList.remove('pressed');fn();},250);
    });
  }
  function ensureOpt(sel,v){
    var has=Array.prototype.some.call(sel.options,function(o){return o.value===String(v);});
    if(!has){
      var o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o);
    }
  }
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
  return {linkedFrom:linkedFrom,linkedToRecipe:linkedToRecipe,listedPortions:listedPortions,recipeCardEl:recipeCardEl,ensureOpt:ensureOpt,pressFlash:pressFlash};
}
