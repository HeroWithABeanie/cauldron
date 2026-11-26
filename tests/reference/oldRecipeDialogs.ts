// VERBATIM copy of the code that was in src/app.js before step 1c-5 (after 1c-4, 941 lines): addToShopping (258-301), the Add ingredient window
// (304-311, 313-314, 316-317, 330-358, 579-584), the Add to Shopping list window (370-437 and 732-744) and the Change name / portions window
// (477-501, 504-519), in that order. The one line that is not a copy is the `var dlgShop...` line, because in app.js it shared a `var` with
// dlgRecipe, which stays there. Wrapped in a factory because in app.js these are variables of the big closure; what they use comes in through env.
// @ts-nocheck
import * as store from '../../src/store';
import { uid, fullName } from '../../src/names';
import { unitLabel, convertQty, scaleQty } from '../../src/units';
import { nameFrag } from '../../src/ui';
import { CAT_HTML } from '../../src/categories';

export function makeOldRecipeDialogs(env) {
  var items=env.items,save=env.save,saveR=env.saveR,render=env.render,renderRecipes=env.renderRecipes,recordHistory=env.recordHistory,dismissSearch=env.dismissSearch;
  var openDiscard=env.openDiscard,openAddList=env.openAddList,ensureOpt=env.ensureOpt,linkedToRecipe=env.linkedToRecipe,listedPortions=env.listedPortions;
  var makeSuggest=env.makeSuggest,showToast=env.showToast,viewList=env.viewList,unitHTML=env.unitHTML,COOK_HTML=env.COOK_HTML;
  function addToShopping(list,src,sp,partial){
    var undo=[];
    list.forEach(function(it){
      var nm=fullName(it).toLowerCase();
      // 1) a linked item with the same unit; 2) an item that was unlinked (by editing or by a manual top-up) but still lists its
      // recipes (units must be convertible).
      var m=items.find(function(x){return !x.done&&!x.unlinked&&x.unit===it.unit&&fullName(x).toLowerCase()===nm;})||
        items.find(function(x){return !x.done&&x.unlinked&&x.from&&x.from.length&&fullName(x).toLowerCase()===nm&&convertQty(it.qty,it.unit,x.unit)!==null;});
      if(m){
        var prevFrom=m.from?m.from.map(function(f){return Object.assign({},f);}):null,prevUnl=m.unlinked,prevMan=m.manual;
        var add=m.unit===it.unit?it.qty:Math.round(convertQty(it.qty,it.unit,m.unit)*100)/100;
        m.qty=Math.round(((m.qty||0)+add)*100)/100;
        if(!m.cat&&it.cat)m.cat=it.cat;
        if(src){
          m.from=m.from||[];
          var ex=m.from.find(function(f){return f.id===src.id;});
          if(!ex)m.from.push({id:src.id,name:src.name,rp:src.portions,sp:sp});
          // the same recipe added again: its portions add up, so the label matches the quantity (not when only a single new ingredient is topped up)
          else if(!partial&&ex.sp&&sp)ex.sp+=sp;
          // an item that was added manually first: the recipe is merged in, the link is broken, and it counts as several sources
          if(!prevFrom){m.unlinked=true;m.manual=true;}
        }
        undo.push(function(){
          m.qty=Math.round(((m.qty||0)-add)*100)/100;
          if(prevFrom)m.from=prevFrom;else delete m.from;
          if(prevUnl)m.unlinked=prevUnl;else delete m.unlinked;
          if(prevMan)m.manual=prevMan;else delete m.manual;
        });
      }else{
        var n={id:uid(),text:it.text,qty:it.qty,unit:it.unit,done:false};
        if(it.brand)n.brand=it.brand;
        if(it.cat)n.cat=it.cat;
        if(src)n.from=[{id:src.id,name:src.name,rp:src.portions,sp:sp}];
        items.push(n);
        undo.push(function(){store.setList('items',items.filter(function(x){return x!==n;}));});
      }
    });
    recordHistory(list);
    save();render();
    return function(){
      undo.reverse().forEach(function(fn){fn();});
      save();render();
    };
  }
  var dlg=document.getElementById('dlg'),
      ingRecipeName=document.getElementById('ingRecipeName'),
      ingTarget=null,
      ingQty=document.getElementById('ingQty'),
      ingUnit=document.getElementById('ingUnit'),
      ingName=document.getElementById('ingName'),
      ingCat=document.getElementById('ingCat'),
      ingBrand=document.getElementById('ingBrand');
  document.getElementById('ingCat').innerHTML=CAT_HTML;
  var COOK={tsp:1,tbsp:1,pinch:1};
  ingUnit.innerHTML=unitHTML+COOK_HTML;
  ingUnit.value='pcs';
  function openIngredient(r){
    ingTarget=r;
    ingRecipeName.textContent=r.name;
    document.getElementById('ingPortionsInfo').textContent='up to '+r.portions+(r.portions===1?' portion':' portions');
    dlg.showModal();
    dlg.setAttribute('tabindex','-1');
    dlg.focus({preventScroll:true});
  }
  document.getElementById('dlgClose').addEventListener('click',function(){dlg.close();});
  dlg.addEventListener('click',function(ev){if(ev.target===dlg)dlg.close();});
  document.getElementById('ingForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var r=ingTarget;
    var t=ingName.value.trim(),qty=parseFloat(ingQty.value);
    if(!r||!t||!(qty>0)||!ingUnit.value)return;
    dismissSearch();
    var added={text:t,qty:qty,unit:ingUnit.value};
    if(ingBrand.value.trim())added.brand=ingBrand.value.trim();
    if(ingCat.value)added.cat=ingCat.value;
    r.items.push(added);
    recordHistory([added]);
    saveR();renderRecipes();
    viewList.scrollTop=viewList.scrollHeight;
    ingQty.value='';ingUnit.value='pcs';ingName.value='';ingCat.value='';ingBrand.value='';
    recipeSuggest.hide();
    dlg.close();
    if(linkedToRecipe(r))openAddList(r,added);
    else showToast('Item added. Add another?',function(){openIngredient(r);},7000,'Yes');
  });
  var dlgShop=document.getElementById('dlgShop'),shopPortions=document.getElementById('shopPortions'),shopTarget=null;
  function openShop(r){
    shopTarget={r:r};
    document.getElementById('shopRecipe').textContent=r.name;
    document.getElementById('shopPortionsInfo').textContent='up to '+r.portions+(r.portions===1?' portion':' portions');
    ensureOpt(shopPortions,r.portions);
    shopPortions.value=r.portions;
    var pv=document.getElementById('shopPreview');
    pv.innerHTML='';
    // recipe already on the list: warn, and mark ingredients that are not on the list yet (skipped last time) and tick them
    var onList=linkedToRecipe(r),lp=listedPortions(r),have={};
    if(onList)items.forEach(function(x){if((x.from||[]).some(function(f){return f.id===r.id;}))have[fullName(x).toLowerCase()]=1;});
    document.getElementById('shopWarn').hidden=!onList;
    if(onList)document.getElementById('shopWarnText').textContent='This recipe is already on your list'+(lp?' for '+lp+(lp===1?' portion':' portions'):'')+'.';
    shopRows=r.items.map(function(it){
      var li=document.createElement('li');
      var lab=document.createElement('label');lab.className='pvrow';
      var skipped=onList&&!have[fullName(it).toLowerCase()];
      var cb=document.createElement('input');cb.type='checkbox';cb.checked=skipped?true:!COOK[it.unit];
      cb.addEventListener('change',updateShopBtn);
      var span=document.createElement('span');span.className='name';
      var q=document.createElement('strong');q.className='qty';
      span.appendChild(q);span.appendChild(nameFrag(it));
      lab.appendChild(cb);
      if(skipped){
        var wrap=document.createElement('span');wrap.className='txt';wrap.appendChild(span);
        var hint=document.createElement('span');hint.className='pvhint';
        hint.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>Not added last time';
        wrap.appendChild(hint);lab.appendChild(wrap);
      }else lab.appendChild(span);
      li.appendChild(lab);pv.appendChild(li);
      return {it:it,cb:cb,q:q};
    });
    renderPreviewQty();updateShopBtn();
    dlgShop.showModal();
    dlgShop.setAttribute('tabindex','-1');
    dlgShop.focus({preventScroll:true});
    pv.style.maxHeight='';pv.style.overflowY='';
    var rows=pv.children;
    if(rows.length>=4){
      // from 4 ingredients on the list scrolls and is capped at 3 and a half single-line rows (measured with a probe row,
      // so wrapped names or hints never change the window size)
      var probe=document.createElement('li'),pl=document.createElement('label'),pc=document.createElement('input'),ps=document.createElement('span'),pq=document.createElement('strong');
      pl.className='pvrow';pc.type='checkbox';ps.className='name';pq.className='qty';pq.textContent='1\u00a0g ';
      ps.appendChild(pq);ps.appendChild(document.createTextNode('Ag'));pl.appendChild(pc);pl.appendChild(ps);probe.appendChild(pl);
      pv.appendChild(probe);
      var rowH=probe.offsetHeight+(parseFloat(getComputedStyle(rows[0]).borderBottomWidth)||0);
      pv.removeChild(probe);
      pv.style.maxHeight=Math.round(rowH*3.5+3)+'px';
      pv.style.overflowY='auto';
    }
    pv.scrollTop=0;
  }
  document.getElementById('dlgShopClose').addEventListener('click',function(){dlgShop.close();});
  dlgShop.addEventListener('click',function(ev){if(ev.target===dlgShop)dlgShop.close();});
  document.getElementById('shopForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var r=shopTarget.r,want=parseInt(shopPortions.value,10);
    if(!(want>0))return;
    var f=want/r.portions;
    var picked=shopRows.filter(function(x){return x.cb.checked;}).map(function(x){return x.it;});
    if(!picked.length)return;
    dismissSearch();
    var undo=addToShopping(picked.map(function(it){
      return{text:it.text,brand:it.brand,qty:scaleQty(it.qty,f),unit:it.unit,cat:it.cat};
    }),r,want);
    dlgShop.close();
    showToast('Ingredients for '+r.name+' added to list',undo);
  });
  var dlgChange=document.getElementById('dlgChange'),
      changeName=document.getElementById('changeName'),
      changePortions=document.getElementById('changePortions'),
      changeTarget=null;
  function openChange(r){
    changeTarget=r;
    changeName.value=r.name;
    ensureOpt(changePortions,r.portions||4);
    changePortions.value=r.portions||4;
    dlgChange.showModal();
    dlgChange.setAttribute('tabindex','-1');
    dlgChange.focus({preventScroll:true});
  }
  // Closing the window without saving asks first when the name or the portions were changed (same as the Edit item window).
  function changeDirty(){
    var r=changeTarget;
    return !!r&&(changeName.value.trim()!==r.name||parseInt(changePortions.value,10)!==(r.portions||4));
  }
  function requestCloseChange(){
    if(dlgChange._closing)return;
    if(changeDirty()){openDiscard(function(){dlgChange.close();});}
    else dlgChange.close();
  }
  document.getElementById('dlgChangeClose').addEventListener('click',requestCloseChange);
  dlgChange.addEventListener('click',function(ev){if(ev.target===dlgChange)requestCloseChange();});
  document.getElementById('changeForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var r=changeTarget,t=changeName.value.trim(),p=parseInt(changePortions.value,10);
    if(!r||!t||!(p>0))return;
    if(t===r.name&&p===r.portions){dlgChange.close();return;}
    dismissSearch();
    var prev={name:r.name,portions:r.portions};
    function rename(n){items.forEach(function(it){(it.from||[]).forEach(function(f){if(f.id===r.id)f.name=n;});});}
    r.name=t;r.portions=p;rename(t);
    saveR();save();renderRecipes();render();
    dlgChange.close();
    showToast('Recipe updated.',function(){
      r.name=prev.name;r.portions=prev.portions;rename(prev.name);
      saveR();save();renderRecipes();render();
    });
  });
  var recipeSuggest=makeSuggest(document.getElementById('ingName'),document.getElementById('suggestR'),ingUnit,ingQty,ingCat);
  // Closing (or dismissing) an Add item window throws away whatever was typed.
  dlg.addEventListener('close',function(){
    ingQty.value='';ingUnit.value='pcs';ingName.value='';ingCat.value='';ingBrand.value='';
    recipeSuggest.hide();
  });
  var shopRows=[];
  function renderPreviewQty(){
    var r=shopTarget&&shopTarget.r;if(!r)return;
    var f=(parseInt(shopPortions.value,10)||r.portions)/r.portions;
    shopRows.forEach(function(x){
      var n=scaleQty(x.it.qty,f);
      x.q.textContent=n+'\u00a0'+unitLabel(n,x.it.unit)+' ';
    });
  }
  function updateShopBtn(){
    document.getElementById('shopSubmit').disabled=!shopRows.some(function(x){return x.cb.checked;});
  }
  shopPortions.addEventListener('change',renderPreviewQty);
  return {openIngredient:openIngredient,openShop:openShop,openChange:openChange,requestCloseChange:requestCloseChange,addToShopping:addToShopping};
}
