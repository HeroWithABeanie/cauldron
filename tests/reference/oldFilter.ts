// VERBATIM copy of applyListFilter and applyRecipeFilter as they were in src/app.js before step 1b-4 (v76). Only used by tests, to check
// that filter.ts behaves exactly like the old code. The names the old code took from app.js's closure (list, recipesEl, items,
// recipes, query, currentView, recipeLayout) are variables of the factory (set() changes them); the row effects (clearMarks ...)
// come in as `fx`, so a test can record the calls instead of running them in a browser.
// @ts-nocheck
import { searchRe, fullName } from '../../src/names';
import { unitLabel } from '../../src/units';
import { nameFrag } from '../../src/ui';

export function makeOldFilter(init, fx) {
  var list, recipesEl, items, recipes, query, currentView, recipeLayout;
  var { clearMarks, markText, toggleEl, markLast, setLi, fitRTiles } = fx;
  function set(o) { ({ list, recipesEl, items, recipes, query, currentView, recipeLayout } = Object.assign({ list, recipesEl, items, recipes, query, currentView, recipeLayout }, o)); }
  set(init);
  function applyListFilter(animate){
    var q=currentView==='list'?query.trim().toLowerCase():'',any=false;
    var re=q?searchRe(q,'iu'):null,hre=q?searchRe(q,'giu'):null;
    if(list.querySelector('ul.grid')){
      list.querySelectorAll('.grid>li').forEach(function(li){
        var s=!q||re.test(li.dataset.name);
        li.hidden=!s;if(s)any=true;
        var nm=li.querySelector('.tname');
        if(nm){clearMarks(nm);if(q)markText(nm,hre);}
      });
      toggleEl(document.getElementById('noItems'),!!q&&!any&&items.length>0,false);
      return;
    }
    list.querySelectorAll('ul').forEach(function(ul){
      if(ul.querySelector('li.empty')){markLast(ul);return;}
      var lis=ul.querySelectorAll('li'),shows=[],n=0;
      lis.forEach(function(li){
        var s=!q||re.test(li.dataset.name);shows.push(s);if(s)n++;
        var nm=li.querySelector('.name');
        if(nm){clearMarks(nm);if(q)markText(nm,hre);}
      });
      if(ul.classList.contains('donegrp'))ul.dataset.count=n;
      var wasShown=ul.dataset.shown!=='0';
      if(n>0){
        any=true;
        if(!wasShown){
          lis.forEach(function(li,i){setLi(li,shows[i],false);});
          ul.dataset.shown='1';toggleEl(ul,true,animate);
        }else lis.forEach(function(li,i){setLi(li,shows[i],animate);});
      }else if(wasShown){ul.dataset.shown='0';toggleEl(ul,false,animate);}
      markLast(ul);
    });
    toggleEl(document.getElementById('noItems'),!!q&&!any&&items.length>0,animate);
  }
  function applyRecipeFilter(animate){
    var q=currentView==='recipes'?query.trim().toLowerCase():'',any=false;
    var re=q?searchRe(q,'iu'):null,hre=q?searchRe(q,'giu'):null;
    recipesEl.querySelectorAll('.recipe,.rtile').forEach(function(card){
      var r=recipes.find(function(x){return String(x.id)===card.dataset.rid;});
      if(!r)return;
      var nameHit=!q||re.test(r.name);
      var hits=q?r.items.filter(function(it){return re.test(fullName(it));}):[];
      var visible=nameHit||hits.length>0,shown=card.dataset.shown!=='0';
      if(card.classList.contains('rtile')){
        card.hidden=!visible;card.dataset.shown=visible?'1':'0';if(visible)any=true;
        var tnm=card.querySelector('.rname');
        if(tnm){clearMarks(tnm);if(q&&visible)markText(tnm,hre);}
        return;
      }
      var title=card.querySelector('.ctitle');
      clearMarks(title);if(q)markText(title,hre);
      // Matching ingredients unfold under the title; the card still opens the full recipe when tapped.
      var hb=card.querySelector('.hits'),box=card.querySelector('.hrows');
      if(hits.length){
        box.innerHTML='';
        hits.forEach(function(it){
          var row=document.createElement('span');row.className='hrow';
          var a=document.createElement('span');a.className='hq';a.textContent=it.qty+'\u00a0'+unitLabel(it.qty,it.unit);
          var n=document.createElement('span');n.className='hn';n.appendChild(nameFrag(it));
          if(q)markText(n,hre);
          row.appendChild(a);row.appendChild(n);box.appendChild(row);
        });
      }
      hb.classList.toggle('open',hits.length>0);
      hb.setAttribute('aria-hidden',hits.length?'false':'true');
      if(visible){
        any=true;
        if(!shown){card.dataset.shown='1';toggleEl(card,true,animate);}
      }else if(shown){card.dataset.shown='0';toggleEl(card,false,animate);}
    });
    if(recipeLayout==='tile')fitRTiles();
    toggleEl(document.getElementById('noRecipes'),!!q&&!any&&recipes.length>0,animate);
  }
  return { set, applyListFilter, applyRecipeFilter };
}
