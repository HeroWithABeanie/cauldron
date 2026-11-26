// VERBATIM copy of setupSlider as it was in src/app.js before step 1c-3 (v76), lines 498-571 (the only change: `export` and the
// name oldSetupSlider). noMotion comes from ui.ts, as it did in app.js.
// @ts-nocheck
import { noMotion } from '../../src/ui';

export function oldSetupSlider(sl,dots){
    var tr=sl.firstChild,slides=Array.prototype.slice.call(tr.children),n=slides.length,
        dotEls=dots?Array.prototype.slice.call(dots.children):[],idx=0,cx=0,PAD=16,
        EZ='cubic-bezier(.2,.7,.2,1)',MS='.35s';
    function step(){return n>1?slides[1].offsetLeft-slides[0].offsetLeft:sl.clientWidth;}
    function hAt(p){
      p=Math.max(0,Math.min(n-1,p));
      var a=Math.floor(p),b=Math.min(n-1,a+1),f=p-a,ha=slides[a].offsetHeight,hb=slides[b].offsetHeight;
      return Math.round(ha+(hb-ha)*f)+PAD;
    }
    function paint(x){
      cx=x;
      tr.style.transform='translate3d('+x+'px,0,0)';
      var st=step()||1,p=Math.max(0,Math.min(n-1,-x/st)),cur=Math.round(p);
      sl.style.height=hAt(p)+'px';
      dotEls.forEach(function(d,i){
        var on=i===cur;d.classList.toggle('on',on);
        if(on)d.setAttribute('aria-current','true');else d.removeAttribute('aria-current');
      });
    }
    // lock onto exactly one card
    function go(i,animate){
      idx=Math.max(0,Math.min(n-1,i));
      if(animate&&!noMotion()){tr.style.transition='transform '+MS+' '+EZ;sl.style.transition='height '+MS+' '+EZ;}
      else{tr.style.transition='none';sl.style.transition='none';}
      paint(-idx*step());
    }
    dotEls.forEach(function(d,i){d.addEventListener('click',function(){go(i,true);});});
    var sx=0,sy=0,base=0,lock=null,pid=null,moved=false,samples=[];
    sl.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse'||n<2)return;
      var live=-idx*step();
      try{var t=getComputedStyle(tr).transform;if(t&&t!=='none')live=new DOMMatrix(t).m41;}catch(err){}
      tr.style.transition='none';sl.style.transition='none';paint(live);
      base=live;sx=e.clientX;sy=e.clientY;lock=null;moved=false;pid=e.pointerId;samples=[];
    });
    sl.addEventListener('pointermove',function(e){
      if(pid!==e.pointerId)return;
      var dx=e.clientX-sx,dy=e.clientY-sy;
      if(!lock&&(Math.abs(dx)>6||Math.abs(dy)>6)){
        lock=Math.abs(dx)>Math.abs(dy)?'h':'v';
        if(lock==='h')sl.setPointerCapture(e.pointerId);
      }
      if(lock!=='h')return;
      moved=true;
      var min=-(n-1)*step(),x=base+dx;
      if(x>0)x*=.25;else if(x<min)x=min+(x-min)*.25;
      samples.push({t:e.timeStamp,x:e.clientX});
      while(samples.length>2&&e.timeStamp-samples[0].t>100)samples.shift();
      paint(x);
    });
    function end(e){
      if(pid!==e.pointerId)return;
      pid=null;
      if(lock!=='h'){go(idx,true);return;}
      var st=step(),off=cx+idx*st,v=0,a=samples[0],b=samples[samples.length-1],next=idx;
      if(a&&b&&b.t>a.t&&e.timeStamp-b.t<80)v=(b.x-a.x)/(b.t-a.t);
      if(off<-st*.2||v<-.4)next=idx+1;
      else if(off>st*.2||v>.4)next=idx-1;
      go(next,true);
    }
    sl.addEventListener('pointerup',end);
    sl.addEventListener('pointercancel',end);
    // after a swipe a tap must not trigger anything on the card
    sl.addEventListener('click',function(e){if(moved){moved=false;e.preventDefault();e.stopPropagation();}},true);
    sl.addEventListener('keydown',function(e){
      if(e.key==='ArrowLeft'){e.preventDefault();go(idx-1,true);}
      else if(e.key==='ArrowRight'){e.preventDefault();go(idx+1,true);}
    });
    var ro=null;
    if(window.ResizeObserver){ro=new ResizeObserver(function(){if(pid===null)go(idx,false);});slides.forEach(function(x){ro.observe(x);});}
    go(0,false);
    return {ro:ro};
  }
