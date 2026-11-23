// VERBATIM copies of the functions that lived in src/app.js before they moved into modules (v76, before the
// "small helpers" step). They are only used by tests, to check that the new modules behave exactly like the old code.
// The only changes: (1) the names the old code took from app.js's closure (query, saveR, renderRecipes) come in as `env`,
// (2) noMotion / shake / tileFitName come from the modules that already existed back then.
// @ts-nocheck
import { noMotion, shake } from '../../src/ui';
import { tileFitName } from '../../src/tiles';

export function makeOldEnableDrag(env) {
  function enableDrag(grip,li,ul,r){
    grip.addEventListener('pointerdown',function(ev){
      if(env.query.trim()||(ev.pointerType==='mouse'&&ev.button!==0))return;
      var lis=Array.prototype.slice.call(ul.querySelectorAll('li:not(.empty)'));
      if(lis.length<2)return;
      ev.preventDefault();
      var from=lis.indexOf(li),to=from,startY=ev.clientY;
      var rects=lis.map(function(x){return x.getBoundingClientRect();});
      var h=rects[from].height,last=lis.length-1;
      grip.setPointerCapture(ev.pointerId);
      li.classList.add('dragging');
      lis.forEach(function(x){if(x!==li)x.style.transition='transform .2s ease';});
      document.body.style.userSelect='none';
      function move(e){
        var dy=Math.max(rects[0].top-rects[from].top,Math.min(rects[last].top-rects[from].top,e.clientY-startY));
        li.style.transform='translateY('+dy+'px)';
        var center=rects[from].top+dy+h/2,n=0;
        rects.forEach(function(rc,j){if(j!==from&&rc.top+rc.height/2<center)n++;});
        to=n;
        lis.forEach(function(x,j){
          if(x===li)return;
          var s=0;
          if(from<to&&j>from&&j<=to)s=-h;
          else if(from>to&&j>=to&&j<from)s=h;
          x.style.transform=s?'translateY('+s+'px)':'';
        });
      }
      function up(){
        grip.removeEventListener('pointermove',move);
        grip.removeEventListener('pointerup',up);
        grip.removeEventListener('pointercancel',up);
        document.body.style.userSelect='';
        var snap=to===from?0:rects[to].top+(to>from?rects[to].height-h:0)-rects[from].top;
        li.style.transition='transform .15s ease';
        li.style.transform='translateY('+snap+'px)';
        setTimeout(function(){
          lis.forEach(function(x){x.style.transform='';x.style.transition='';});
          li.classList.remove('dragging');
          if(to!==from){
            var m=r.items.splice(from,1)[0];
            r.items.splice(to,0,m);
            env.saveR();env.renderRecipes();
          }
        },160);
      }
      grip.addEventListener('pointermove',move);
      grip.addEventListener('pointerup',up);
      grip.addEventListener('pointercancel',up);
    });
  }
  return enableDrag;
}

export function timedConfirm(dlg,btn,fill,lbl,word,secs){
    var timer=null,anim=null;
    dlg.addEventListener('close',function(){
      clearInterval(timer);
      if(anim){anim.cancel();anim=null;}
    });
    return {
      open:function(){
        if(dlg.open)return;
        btn.classList.add('locked');btn.setAttribute('aria-disabled','true');
        var left=secs;
        lbl.textContent=word+' ('+left+')';
        clearInterval(timer);
        timer=setInterval(function(){
          left--;
          if(left>0){lbl.textContent=word+' ('+left+')';}
          else{clearInterval(timer);lbl.textContent=word;btn.classList.remove('locked');btn.setAttribute('aria-disabled','false');}
        },1000);
        if(anim)anim.cancel();
        if(fill.animate&&!noMotion()){
          anim=fill.animate([{width:'0%'},{width:'100%'}],{duration:secs*1000,easing:'linear',fill:'forwards'});
        }
        dlg.showModal();
        dlg.setAttribute('tabindex','-1');
        dlg.focus({preventScroll:true});
      },
      locked:function(){
        if(!btn.classList.contains('locked'))return false;
        shake(lbl);
        return true;
      }
    };
  }

export function popList(svg){
    if(noMotion()||!svg||!svg.animate)return;
    var l=svg.querySelector('.lns'),p=svg.querySelector('.pls');
    if(l&&l.animate)l.animate([{transform:'scaleX(.15)'},{transform:'scaleX(1.12)',offset:.55},{transform:'scaleX(.97)',offset:.8},{transform:'scaleX(1)'}],{duration:600,easing:'ease-out'});
    if(p&&p.animate)p.animate([{transform:'scale(0)'},{transform:'scale(1.6)',offset:.5},{transform:'scale(.9)',offset:.75},{transform:'scale(1)'}],{duration:600,easing:'ease-out'});
  }
export function spinPlus(svg){
    if(noMotion()||!svg||!svg.animate)return;
    var p=svg.querySelector('.pls');
    if(p&&p.animate)p.animate([{transform:'rotate(0deg) scale(1)'},{transform:'rotate(180deg) scale(1.7)',offset:.5},{transform:'rotate(360deg) scale(1)'}],{duration:520,easing:'cubic-bezier(.34,1.3,.64,1)'});
  }
export function isDesk(){return !!(window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches);}
export function fitRTiles(){
    document.querySelectorAll('.rtile .rname').forEach(function(el){
      if(!el.offsetWidth)return;
      var d=isDesk();
      tileFitName(el,d?20:18.4,9,d?4:3);
    });
  }
