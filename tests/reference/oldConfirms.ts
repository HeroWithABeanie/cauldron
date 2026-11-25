// VERBATIM copy of the five confirmation windows as they were in src/app.js before step 1c-2 (v76): lines 943-955 and 965-975 (delete
// recipe; performDelete, lines 956-964, stays in app.js and is passed in), 979-984 and 994-1003 (discard changes), 1017-1022 and 1035-1060
// (add to list), 1108-1122 (clear list) and 1194-1208 (remove checked). Only used by tests, to check that confirms.ts behaves exactly like
// the old code. The app's own functions come in as `fn`. In app.js the windows that ask before discarding changes did
// `discardThen=function(){...};openDiscard();`; that call-site pair is here as openDiscard(then).
// @ts-nocheck
import { timedConfirm } from '../../src/timedconfirm';

export function makeOldConfirms(fn) {
  var { dismissSearch, performDelete, doWipe, removeChecked, listedPortions, addToShopping, showToast, openIngredient } = fn;
  var dlgDelete=document.getElementById('dlgDelete'),
      deleteYes=document.getElementById('deleteYes'),
      deleteFill=document.getElementById('deleteFill'),
      deleteLbl=document.getElementById('deleteLbl'),
      deleteTarget=null,
      deleteConfirm=timedConfirm(dlgDelete,deleteYes,deleteFill,deleteLbl,'Yes',5);
  function openDelete(r){
    deleteTarget=r;
    document.getElementById('deleteName').textContent=r.name;
    document.getElementById('deletePortions').textContent='up to '+r.portions+(r.portions===1?' portion':' portions');
    document.getElementById('deleteMsg').textContent='Delete this recipe and all of its ingredients?';
    deleteConfirm.open();
  }
  deleteYes.addEventListener('click',function(){
    if(deleteConfirm.locked())return;
    if(!deleteTarget)return;
    var r=deleteTarget;deleteTarget=null;
    dlgDelete.close();
    dismissSearch();
    performDelete(r);
  });
  document.getElementById('deleteCancel').addEventListener('click',function(){dlgDelete.close();});
  document.getElementById('deleteClose').addEventListener('click',function(){dlgDelete.close();});
  dlgDelete.addEventListener('click',function(ev){if(ev.target===dlgDelete)dlgDelete.close();});
  var dlgDiscard=document.getElementById('dlgDiscard'),
      discardYes=document.getElementById('discardYes'),
      discardFill=document.getElementById('discardFill'),
      discardLbl=document.getElementById('discardLbl'),
      discardThen=null,
      discConfirm=timedConfirm(dlgDiscard,discardYes,discardFill,discardLbl,'Yes',2);
  function openDiscard(){
    discConfirm.open();
  }
  discardYes.addEventListener('click',function(){
    if(discConfirm.locked())return;
    dlgDiscard.close();
    if(discardThen)discardThen();
  });
  document.getElementById('discardCancel').addEventListener('click',function(){dlgDiscard.close();});
  dlgDiscard.addEventListener('click',function(ev){if(ev.target===dlgDiscard)dlgDiscard.close();});
  var dlgAddList=document.getElementById('dlgAddList'),
      addListNo=document.getElementById('addListNo'),
      addListFill=document.getElementById('addListFill'),
      addListLbl=document.getElementById('addListLbl'),
      addListTarget=null,addListItem=null,
      addConfirm=timedConfirm(dlgAddList,addListNo,addListFill,addListLbl,'No',2);
  function openAddList(r,item){
    addListTarget=r;addListItem=item;
    document.getElementById('addListName').textContent=r.name;
    document.getElementById('addListPortions').textContent='up to '+r.portions+(r.portions===1?' portion':' portions');
    addConfirm.open();
  }
  function onAddListNo(){
    if(!addListTarget)return;
    if(addConfirm.locked())return;
    var r=addListTarget;addListTarget=null;
    dlgAddList.close();
    showToast('Item added. Add another?',function(){openIngredient(r);},7000,'Yes');
  }
  addListNo.addEventListener('click',onAddListNo);
  dlgAddList.addEventListener('click',function(ev){if(ev.target===dlgAddList)onAddListNo();});
  document.getElementById('addListYes').addEventListener('click',function(){
    if(!addListTarget)return;
    var r=addListTarget;addListTarget=null;
    dlgAddList.close();
    var sp=listedPortions(r)||r.portions,fac=sp/(r.portions||1);
    var missing=addListItem?[addListItem]:[];
    var undo=addToShopping(missing.map(function(it){
      return{text:it.text,qty:Math.max(0.01,Math.round(it.qty*fac*100)/100),unit:it.unit,cat:it.cat,brand:it.brand};
    }),r,sp,true);
    showToast('Item added to Shopping list.',undo,7000);
  });
  var dlgWipe=document.getElementById('dlgWipe'),
      wipeYes=document.getElementById('wipeYes'),
      wipeFill=document.getElementById('wipeFill'),
      wipeLbl=document.getElementById('wipeLbl'),
      wipeConfirm=timedConfirm(dlgWipe,wipeYes,wipeFill,wipeLbl,'Yes',5);
  function openWipe(){
    wipeConfirm.open();
  }
  wipeYes.addEventListener('click',function(){
    if(wipeConfirm.locked())return;
    dlgWipe.close();
    doWipe();
  });
  document.getElementById('wipeNo').addEventListener('click',function(){dlgWipe.close();});
  dlgWipe.addEventListener('click',function(ev){if(ev.target===dlgWipe)dlgWipe.close();});
  var dlgRemove=document.getElementById('dlgRemove'),
      removeYes=document.getElementById('removeYes'),
      removeFill=document.getElementById('removeFill'),
      removeLbl=document.getElementById('removeLbl'),
      removeConfirm=timedConfirm(dlgRemove,removeYes,removeFill,removeLbl,'Yes',3);
  function openRemoveChecked(){
    removeConfirm.open();
  }
  removeYes.addEventListener('click',function(){
    if(removeConfirm.locked())return;
    dlgRemove.close();
    removeChecked();
  });
  document.getElementById('removeNo').addEventListener('click',function(){dlgRemove.close();});
  dlgRemove.addEventListener('click',function(ev){if(ev.target===dlgRemove)dlgRemove.close();});
  function openDiscardThen(then){discardThen=then;openDiscard();}
  return { openDelete: openDelete, openDiscard: openDiscardThen, openAddList: openAddList, onAddListNo: onAddListNo, openWipe: openWipe, openRemoveChecked: openRemoveChecked };
}
