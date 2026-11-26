// VERBATIM copy of the Description, Edit item, Unlink and Re-link code as it was in src/app.js before step 1c-4 (after 1c-3, 1,176 lines):
// lines 453-679 (the windows, including the old, never-called setupEditSlider), 799-807 (editDirty, requestCloseEdit) and 816-819
// (the Edit item suggestions and its close listeners), in that order. Wrapped in a factory because in app.js these are variables of the
// big closure: the lists and the helpers they use are passed in through env. The wrapper returns the functions a test needs.
// @ts-nocheck
import { CAT_HTML } from '../../src/categories';
import { unitLabel } from '../../src/units';
import { nameFrag, shake } from '../../src/ui';
import { isMulti } from '../../src/sorting';
import { timedConfirm } from '../../src/timedconfirm';
import { brokenLink } from '../../src/tips';
import { setupSlider } from '../../src/slider';

export function makeOldItemDialogs(env) {
  var items=env.items,recipes=env.recipes,save=env.save,render=env.render,recordHistory=env.recordHistory,openDiscard=env.openDiscard;
  var ensureOpt=env.ensureOpt,recipeCardEl=env.recipeCardEl,makeSuggest=env.makeSuggest,showToast=env.showToast,unitHTML=env.unitHTML,COOK_HTML=env.COOK_HTML;
  var dlgEdit=document.getElementById('dlgEdit'),
      editName=document.getElementById('editName'),
      editCat=document.getElementById('editCat'),
      editTarget=null;
  var editBrand=document.getElementById('editBrand');
  editCat.innerHTML=CAT_HTML;
  var editQty=document.getElementById('editQty'),editUnit=document.getElementById('editUnit');
  editUnit.innerHTML=unitHTML+COOK_HTML;
  // Source recipes in the Edit item window: a swipeable row with one card at a time. While swiping, the row's height
  // blends from the card you leave to the card you arrive at, so the window grows or shrinks with the cards.
  var editSlide=null;
  function teardownEditSlider(){
    if(!editSlide)return;
    if(editSlide.ro)editSlide.ro.disconnect();
    editSlide=null;
  }
  function setupEditSlider(sl,dots){teardownEditSlider();editSlide=setupSlider(sl,dots);}
  var unlinkSlide=null;
  function teardownUnlinkSlider(){
    if(unlinkSlide&&unlinkSlide.ro)unlinkSlide.ro.disconnect();
    unlinkSlide=null;
  }
  // Builds the swipeable recipe cards (and the dots when there are several) inside a container.
  function buildCardSlider(box,froms){
    box.innerHTML='';
    var sl=document.createElement('div'),tr=document.createElement('div'),dots=null;
    sl.className='cslider';tr.className='ctrack';sl.appendChild(tr);
    sl.setAttribute('role','group');sl.setAttribute('aria-roledescription','carousel');sl.setAttribute('aria-label','Source recipes');
    if(froms.length>1)sl.tabIndex=0;
    froms.forEach(function(f,fi){
      var card=recipeCardEl(f);
      card.setAttribute('role','group');card.setAttribute('aria-roledescription','slide');card.setAttribute('aria-label',(fi+1)+' of '+froms.length);
      tr.appendChild(card);
    });
    box.appendChild(sl);
    if(froms.length>1){
      dots=document.createElement('div');dots.className='cdots';
      froms.forEach(function(f,fi){
        var d=document.createElement('button');d.type='button';d.className='cdot';
        d.setAttribute('aria-label','Show recipe '+(fi+1)+' of '+froms.length);
        dots.appendChild(d);
      });
      box.appendChild(dots);
    }
    return {sl:sl,dots:dots};
  }
  function openEdit(it){
    editTarget=it;
    editName.value=it.text;editBrand.value=it.brand||'';
    editQty.value=it.qty||'';
    if(it.unit)ensureOpt(editUnit,it.unit);
    editUnit.value=it.unit||'';
    editCat.value=it.cat||'';
    dlgEdit.showModal();
    dlgEdit.setAttribute('tabindex','-1');
    dlgEdit.focus({preventScroll:true});
  }
  // ---- Description window (v72): tapping an item opens this first; the pencil leads to the Edit item window ----
  var dlgDesc=document.getElementById('dlgDesc'),descText=document.getElementById('descText'),descCount=document.getElementById('descCount'),descTarget=null,descSlide=null,DESC_MAX=100;
  function teardownDesc(){if(descSlide&&descSlide.ro)descSlide.ro.disconnect();descSlide=null;}
  function syncDescCount(){
    var n=descText.value.length;
    descCount.textContent=n+'/'+DESC_MAX;descCount.classList.toggle('full',n>=DESC_MAX);
  }
  // Rebuilds everything except the text box, so unsaved text survives a trip to the Edit item window.
  function refreshDesc(){
    var it=descTarget;
    if(!it||items.indexOf(it)<0){if(dlgDesc.open)dlgDesc.close();return;}
    var nm=document.getElementById('descName');nm.textContent='';nm.appendChild(nameFrag(it));
    document.getElementById('descSub').textContent=[it.cat||'',it.qty?it.qty+'\u00a0'+unitLabel(it.qty,it.unit):''].filter(Boolean).join(' \u00b7 ');
    var cards=document.getElementById('descCards'),linked=!!(it.from&&it.from.length),sl=null,dots=null,tr;
    cards.innerHTML='';teardownDesc();
    if(linked){
      var lb=document.createElement('span');lb.className='flabel';lb.textContent=it.from.length>1?'From recipes':'From recipe';cards.appendChild(lb);
      sl=document.createElement('div');sl.className='cslider';
      tr=document.createElement('div');tr.className='ctrack';sl.appendChild(tr);
      if(it.from.length>1)sl.tabIndex=0;
      sl.setAttribute('role','group');sl.setAttribute('aria-roledescription','carousel');sl.setAttribute('aria-label','Source recipes');
      it.from.forEach(function(f,fi){
        var rc=recipes.find(function(x){return x.id===f.id;});
        var card=document.createElement('div');card.className='shophead'+(it.unlinked?' hasbrk':'');
        card.setAttribute('role','group');card.setAttribute('aria-roledescription','slide');card.setAttribute('aria-label',(fi+1)+' of '+it.from.length);
        var n=document.createElement('p');n.className='shopname';n.textContent=rc?rc.name:f.name;
        card.appendChild(n);
        if(rc&&rc.portions){
          var p=document.createElement('p');p.className='portions';
          p.textContent='up to '+rc.portions+(rc.portions===1?' portion':' portions');
          card.appendChild(p);
        }
        if(it.unlinked){var canRe=!!(it.orig&&it.from.length===1&&!isMulti(it));card.appendChild(brokenLink('cardbrk',canRe?function(){openRelink(it,true);}:null,isMulti(it)?'Re-linking not possible':null));}
        tr.appendChild(card);
      });
      cards.appendChild(sl);
      if(it.from.length>1){
        dots=document.createElement('div');dots.className='cdots';
        it.from.forEach(function(f,fi){
          var d=document.createElement('button');d.type='button';d.className='cdot';
          d.setAttribute('aria-label','Show recipe '+(fi+1)+' of '+it.from.length);
          dots.appendChild(d);
        });
        cards.appendChild(dots);
      }
    }
    cards.hidden=!linked;
    if(sl)descSlide=setupSlider(sl,dots);
  }
  function openDesc(it){
    descTarget=it;descText.value=it.desc||'';syncDescCount();
    dlgDesc.showModal();
    dlgDesc.setAttribute('tabindex','-1');
    dlgDesc.focus({preventScroll:true});   // the text box is deliberately not focused
    refreshDesc();descText.scrollTop=0;
  }
  function descDirty(){var it=descTarget;return !!it&&descText.value.trim()!==(it.desc||'');}
  function requestCloseDesc(){
    if(dlgDesc._closing)return;
    if(descDirty()){openDiscard(function(){dlgDesc.close();});}
    else dlgDesc.close();
  }
  // Quantity and unit are edited in the Edit item window; this window only saves the description, which never unlinks the item.
  function saveDesc(){
    var it=descTarget;if(!it)return;
    if(!descDirty()){dlgDesc.close();return;}
    var v=descText.value.trim(),prev=it.desc;
    if(v)it.desc=v;else delete it.desc;
    save();
    dlgDesc.close();
    showToast('Item updated.',function(){
      if(prev)it.desc=prev;else delete it.desc;
      save();
    });
  }
  descText.addEventListener('input',function(e){
    syncDescCount();
    // a paste that was cut off by the limit also shakes the counter
    if(e.inputType==='insertFromPaste'&&descText.value.length>=DESC_MAX)shake(descCount);
  });
  // typing when the box is already full (and nothing is selected to be replaced) shakes the counter
  descText.addEventListener('beforeinput',function(e){
    if(e.inputType&&e.inputType.indexOf('insert')===0&&e.inputType!=='insertFromPaste'&&descText.value.length>=DESC_MAX&&descText.selectionStart===descText.selectionEnd)shake(descCount);
  });
  document.getElementById('descEdit').addEventListener('click',function(){if(descTarget)openEdit(descTarget);});
  document.getElementById('descSave').addEventListener('click',saveDesc);
  document.getElementById('dlgDescClose').addEventListener('click',requestCloseDesc);
  dlgDesc.addEventListener('click',function(ev){if(ev.target===dlgDesc)requestCloseDesc();});
  dlgDesc.addEventListener('close',function(){descTarget=null;teardownDesc();});
  document.getElementById('dlgEditClose').addEventListener('click',requestCloseEdit);
  dlgEdit.addEventListener('click',function(ev){if(ev.target===dlgEdit)requestCloseEdit();});
  var dlgUnlink=document.getElementById('dlgUnlink'),pendingEdit=null,
      unlinkTimer=timedConfirm(dlgUnlink,document.getElementById('unlinkConfirm'),document.getElementById('unlinkFill'),document.getElementById('unlinkLbl'),'Unlink and save',3);
  function applyEdit(it,t,qty,unit,cat,brand){
    var prev={text:it.text,qty:it.qty,unit:it.unit,cat:it.cat,brand:it.brand,unlinked:it.unlinked};
    var amountChanged=t!==it.text||qty!==it.qty||unit!==it.unit;
    if(brand)it.brand=brand;else delete it.brand;it.text=t;it.qty=qty;it.unit=unit;
    if(cat)it.cat=cat;else delete it.cat;
    recordHistory([{text:t,unit:unit,cat:cat}]);
    if(amountChanged&&it.from&&it.from.length){if(!prev.unlinked)it.orig={qty:prev.qty,unit:prev.unit,text:prev.text,brand:prev.brand};it.unlinked=true;}
    save();render();
    dlgEdit.close();
    showToast('Item updated.',function(){
      it.text=prev.text;it.qty=prev.qty;it.unit=prev.unit;
      if(prev.cat)it.cat=prev.cat;else delete it.cat;
      if(prev.brand)it.brand=prev.brand;else delete it.brand;
      if(prev.unlinked)it.unlinked=true;else{delete it.unlinked;delete it.orig;}
      save();render();
    });
  }
  document.getElementById('unlinkConfirm').addEventListener('click',function(){
    if(unlinkTimer.locked())return;
    var p=pendingEdit;pendingEdit=null;
    dlgUnlink.close();
    if(p)applyEdit(p.it,p.t,p.qty,p.unit,p.cat,p.brand);
  });
  document.getElementById('unlinkNo').addEventListener('click',function(){dlgUnlink.close();});
  // Cancelling (button, tap outside or Esc) simply falls back to the Edit item window underneath.
  dlgUnlink.addEventListener('click',function(ev){if(ev.target===dlgUnlink)dlgUnlink.close();});
  dlgUnlink.addEventListener('close',function(){pendingEdit=null;});
  dlgUnlink.addEventListener('close',teardownUnlinkSlider);
  // ---- Re-link: tapping the broken chain on an item that was unlinked by changing it restores its original quantity and unit ----
  var dlgRelink=document.getElementById('dlgRelink'),relinkTarget=null,
      relinkTimer=timedConfirm(dlgRelink,document.getElementById('relinkConfirm'),document.getElementById('relinkFill'),document.getElementById('relinkLbl'),'Confirm',3);
  var relinkFromEdit=false;
  function openRelink(it,fromEdit){
    if(!it||!it.from||it.from.length!==1||!it.orig||isMulti(it))return;
    relinkTarget=it;relinkFromEdit=!!fromEdit;
    document.getElementById('relinkMsg').textContent='This item will be re-linked to the following recipe:';
    var uc=document.getElementById('relinkCards');uc.innerHTML='';
    it.from.forEach(function(f){uc.appendChild(recipeCardEl(f));});
    relinkTimer.open();
  }
  document.getElementById('relinkConfirm').addEventListener('click',function(){
    if(relinkTimer.locked())return;
    var it=relinkTarget,fe=relinkFromEdit;relinkTarget=null;relinkFromEdit=false;
    dlgRelink.close();
    if(!it||items.indexOf(it)<0||!it.unlinked||!it.orig)return;
    if(fe&&dlgEdit.open)dlgEdit.close();   // the Edit window would still show the old quantity and unit
    var prev={qty:it.qty,unit:it.unit,text:it.text,brand:it.brand,orig:it.orig,manual:it.manual},o=prev.orig;
    it.qty=o.qty;it.unit=o.unit;
    // the name comes back too (items unlinked before v72 have no saved name and keep theirs)
    if(o.text!==undefined){it.text=o.text;if(o.brand)it.brand=o.brand;else delete it.brand;}
    delete it.unlinked;delete it.orig;delete it.manual;
    save();render();if(dlgDesc.open)refreshDesc();
    showToast('Item re-linked.',function(){
      it.qty=prev.qty;it.unit=prev.unit;it.text=prev.text;if(prev.brand)it.brand=prev.brand;else delete it.brand;it.unlinked=true;it.orig=prev.orig;if(prev.manual)it.manual=true;
      save();render();
    });
  });
  document.getElementById('relinkNo').addEventListener('click',function(){dlgRelink.close();});
  dlgRelink.addEventListener('click',function(ev){if(ev.target===dlgRelink)dlgRelink.close();});
  dlgRelink.addEventListener('close',function(){relinkTarget=null;relinkFromEdit=false;});
  document.getElementById('editForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var it=editTarget,t=editName.value.trim(),qty=parseFloat(editQty.value),unit=editUnit.value,cat=editCat.value,brand=editBrand.value.trim();
    if(!it||!t)return;
    if(!(qty>0)||!unit){shake(editQty);editQty.focus();return;}
    var amountChanged=t!==it.text||qty!==it.qty||unit!==it.unit;
    if(!amountChanged&&cat===(it.cat||'')&&brand===(it.brand||'')){dlgEdit.close();return;}
    if(amountChanged&&it.from&&it.from.length&&!it.unlinked){
      pendingEdit={it:it,t:t,qty:qty,unit:unit,cat:cat,brand:brand};
      var bs=buildCardSlider(document.getElementById('unlinkCards'),it.from);
      document.getElementById('unlinkMsg').textContent=(it.from.length>1?'This item is linked to these recipes.':'This item is linked to this recipe.')+' Saving your changes will unlink it from '+(it.from.length>1?'those recipes':'that recipe')+'. The recipe label stays on the item.';
      unlinkTimer.open();
      teardownUnlinkSlider();unlinkSlide=setupSlider(bs.sl,bs.dots);
      return;
    }
    applyEdit(it,t,qty,unit,cat,brand);
  });
  function editDirty(){
    var it=editTarget;
    return !!it&&(editName.value.trim()!==it.text||editBrand.value.trim()!==(it.brand||'')||(parseFloat(editQty.value)||0)!==(it.qty||0)||editUnit.value!==(it.unit||'')||editCat.value!==(it.cat||''));
  }
  function requestCloseEdit(){
    if(dlgEdit._closing||dlgEdit.getAttribute('data-x'))return;
    if(editDirty()){openDiscard(function(){dlgEdit.close();});}
    else dlgEdit.close();
  }
  var editSuggest=makeSuggest(editName,document.getElementById('suggestE'),null,{value:1},editCat);
  dlgEdit.addEventListener('close',editSuggest.hide);
  dlgEdit.addEventListener('close',teardownEditSlider);
  dlgEdit.addEventListener('close',function(){if(dlgDesc.open)refreshDesc();});
  return {openDesc:openDesc,openRelink:openRelink,openEdit:openEdit,requestCloseDesc:requestCloseDesc,requestCloseEdit:requestCloseEdit};
}
