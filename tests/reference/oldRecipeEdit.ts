// VERBATIM copy of the code that was in src/app.js before step 1c-6a (after 1c-5, 734 lines): the Recipes view's Edit item window and the
// "rename in the Shopping list" window (lines 555-678). Wrapped in a factory because in app.js these are variables of the big closure;
// what they use comes in through env.
// @ts-nocheck
import { CAT_HTML } from '../../src/categories';
import { unitLabel } from '../../src/units';
import { nameFrag } from '../../src/ui';

export function makeOldRecipeEdit(env) {
  var items=env.items,unitHTML=env.unitHTML,COOK_HTML=env.COOK_HTML,makeSuggest=env.makeSuggest,ensureOpt=env.ensureOpt,openDiscard=env.openDiscard,dismissSearch=env.dismissSearch,recordHistory=env.recordHistory;
  var saveR=env.saveR,save=env.save,renderRecipes=env.renderRecipes,render=env.render,showToast=env.showToast,recipeCardEl=env.recipeCardEl;
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
    if(reDirty()){openDiscard(function(){dlgRE.close();});}
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
  return {openRecipeEdit:openRecipeEdit,requestCloseRE:requestCloseRE};
}
