// VERBATIM copy of the code that was in src/app.js before step 1c-7b (after 1c-7a, 425 lines): recordHistory (lines 47-58) and the Add item
// form with commitAdd and the conflicting-units window (lines 102-166). They sat apart in app.js; here they are put one after the other inside
// a factory, because in app.js they are functions of the big closure; what they use comes in through env.
// @ts-nocheck
import { uid } from '../../src/names';
import { unitLabel, convertQty } from '../../src/units';
import { nameFrag } from '../../src/ui';

export function makeOldAdding(env) {
  var items=env.items,itemHistory=env.itemHistory,input=env.input,save=env.save,saveHist=env.saveHist,render=env.render,withAnim=env.withAnim,showToast=env.showToast;
  var dlgItem=env.dlgItem,addSuggest=env.addSuggest,openItemDialog=env.openItemDialog,openDesc=env.openDesc;
  function recordHistory(entries){
    var now=Date.now();
    entries.forEach(function(e){
      if(!e||!e.text)return;
      var name=e.text.trim(),k=name.toLowerCase();
      var h=itemHistory.find(function(x){return x.text.toLowerCase()===k;});
      if(h){h.text=name;if(e.unit)h.unit=e.unit;if(e.cat)h.cat=e.cat;h.last=now;}
      else itemHistory.push({text:name,unit:e.unit||'',cat:e.cat||'',last:now});
    });
    if(itemHistory.length>500){itemHistory.sort(function(a,b){return b.last-a.last;});itemHistory.length=500;}
    saveHist();
  }

  function commitAdd(t,qty,unit,cat,m,brand){
    var qtyEl=document.getElementById("qty"),unitEl=document.getElementById("unit"),catEl=document.getElementById("addCat");
    if(m){
      if(m.from&&m.from.length&&!m.unlinked)m.orig={qty:m.qty,unit:m.unit};
      m.qty=Math.round(((m.qty||0)+convertQty(qty,unit,m.unit))*100)/100;
      if(m.from&&m.from.length){m.unlinked=true;m.manual=true;}
      if(cat&&!m.cat)m.cat=cat;
    }else{
      var n={id:uid(),text:t,qty:qty,unit:unit,done:false};
      if(brand)n.brand=brand;
      if(cat)n.cat=cat;
      items.push(n);
    }
    recordHistory([{text:t,unit:unit,cat:cat}]);
    qtyEl.value="";unitEl.value="pcs";input.value="";catEl.value="";document.getElementById("brand").value="";
    addSuggest.hide();
    save();
    dlgItem.close();
    setTimeout(function(){withAnim('list',render);},340);
    showToast("Item added. Add another?",openItemDialog,7000,"Yes");
  }
  document.getElementById("form").addEventListener("submit",function(ev){
    ev.preventDefault();
    var qtyEl=document.getElementById("qty"),unitEl=document.getElementById("unit");
    var t=input.value.trim(),qty=parseFloat(qtyEl.value),catEl=document.getElementById("addCat"),cat=catEl.value;
    if(!t||!(qty>0)||!unitEl.value)return;
    var brand=document.getElementById('brand').value.trim(),unit=unitEl.value,m=items.find(function(x){return !x.done&&x.text.toLowerCase()===t.toLowerCase()&&(x.brand||'').toLowerCase()===brand.toLowerCase()&&convertQty(qty,unit,x.unit)!==null;});
    if(!m){
      var c=items.find(function(x){return !x.done&&x.text.toLowerCase()===t.toLowerCase()&&(x.brand||'').toLowerCase()===brand.toLowerCase();});
      if(c){openConflict(c,{t:t,qty:qty,unit:unit,cat:cat,brand:brand});return;}
    }
    commitAdd(t,qty,unit,cat,m,brand);
  });
  // ---- Conflicting units: the name is already on the list, but its unit cannot be converted ----
  var dlgConflict=document.getElementById('dlgConflict'),cfPending=null,cfExisting=null;
  function cfRow(id,it){
    var ul=document.getElementById(id);ul.innerHTML='';
    var li=document.createElement('li'),span=document.createElement('span');span.className='name';
    var q=document.createElement('strong');q.className='qty';
    q.textContent=it.qty+'\u00a0'+unitLabel(it.qty,it.unit)+' ';
    span.appendChild(q);span.appendChild(nameFrag(it));
    li.appendChild(span);ul.appendChild(li);
  }
  function openConflict(ex,p){
    cfExisting=ex;cfPending=p;
    cfRow('cfExisting',ex);
    cfRow('cfNew',{text:p.t,brand:p.brand,qty:p.qty,unit:p.unit});
    dlgConflict.showModal();
    dlgConflict.setAttribute('tabindex','-1');
    dlgConflict.focus({preventScroll:true});
  }
  document.getElementById('cfSeparate').addEventListener('click',function(){
    var p=cfPending;cfPending=null;if(!p)return;
    dlgConflict.close();
    commitAdd(p.t,p.qty,p.unit,p.cat,null,p.brand);
  });
  document.getElementById('cfMerge').addEventListener('click',function(){
    var ex=cfExisting;cfPending=null;
    dlgConflict.close();dlgItem.close();
    document.getElementById("qty").value="";document.getElementById("unit").value="pcs";
    input.value="";document.getElementById("addCat").value="";document.getElementById("brand").value="";addSuggest.hide();
    if(ex)openDesc(ex);
  });
  document.getElementById('cfCancel').addEventListener('click',function(){cfPending=null;dlgConflict.close();});
  dlgConflict.addEventListener('click',function(ev){if(ev.target===dlgConflict){cfPending=null;dlgConflict.close();}});
  return {recordHistory:recordHistory};
}
