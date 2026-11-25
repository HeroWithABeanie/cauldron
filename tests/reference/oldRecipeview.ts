// VERBATIM copy of addSwipe, renderRecipes, fitView, renderView and openView (with the recipe window's close handler) as they were in
// src/app.js before step 1b-6 (v76). Only used by tests, to check that recipeview.ts behaves exactly like the old code. The names the old
// code took from app.js's closure (recipesEl, dlgView, viewList, recipes, items, recipeLayout, rsort, query) are variables of the factory;
// the app's own functions (sortedRecipes, save, saveR, render, applyRecipeFilter, syncClear, dismissSearch, enableDrag, openShop,
// openRecipeEdit) and showToast come in as `fn`. infoLine is app.js's one-line wrapper around infoLineFor.
// @ts-nocheck
import { fullName } from '../../src/names';
import { unitLabel } from '../../src/units';
import { setTileName, fitRTiles } from '../../src/tiles';
import { tileSwipe, swipeRow } from '../../src/swipe';
import { nameFrag, isDesk } from '../../src/ui';
import { popList, spinPlus } from '../../src/rowfx';
import { CART_SVG } from '../../src/icons';
import { ingText, portionsText, infoLine as infoLineFor } from '../../src/viewtext';

export function makeOldRecipeView(init, fn) {
  var recipesEl, dlgView, viewList, recipes, items, recipeLayout, rsort, query;
  var { sortedRecipes, save, saveR, render, applyRecipeFilter, syncClear, dismissSearch, enableDrag, openShop, openRecipeEdit, showToast } = fn;
  function set(o) { ({ recipesEl, dlgView, viewList, recipes, items, recipeLayout, rsort, query } = Object.assign({ recipesEl, dlgView, viewList, recipes, items, recipeLayout, rsort, query }, o)); }
  set(init);
  var viewTarget=null;
  function infoLine(r){return infoLineFor(r,rsort);}
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
  return { renderRecipes: renderRecipes, fitView: fitView, getTarget: function () { return viewTarget; }, set: set };
}
