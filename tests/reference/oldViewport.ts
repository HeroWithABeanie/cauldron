// VERBATIM copy of the code that was in src/app.js before step 1c-6c (after 1c-6b, 548 lines): the scroll fade (lines 474-488) and the keyboard
// handling with the scroll lock (lines 494-521), which sat apart in app.js with the recipe-edit lines in between. Wrapped in a factory because
// in app.js these are variables of the big closure; what they use comes in through env.
// @ts-nocheck

export function makeOldViewport(env) {
  var list=env.list,recipesEl=env.recipesEl,searchInput=env.searchInput;
  function updateFade(sc){
    var up=sc.scrollTop>4,down=sc.scrollTop+sc.clientHeight<sc.scrollHeight-4;
    sc.style.setProperty('--ft',up?'32px':'0px');
    sc.style.setProperty('--fb',down?'32px':'0px');
  }
  var scrollers=document.querySelectorAll('.scroller');
  scrollers.forEach(function(sc){
    sc.addEventListener('scroll',function(){updateFade(sc);},{passive:true});
    updateFade(sc);
  });
  if(window.ResizeObserver){
    var fadeRO=new ResizeObserver(function(){scrollers.forEach(updateFade);});
    scrollers.forEach(function(sc){fadeRO.observe(sc);});
    fadeRO.observe(list);fadeRO.observe(recipesEl);
  }

  // Keyboard handling: shrink the app to the part of the screen the keyboard leaves free, and keep that part
  // pinned to the top of what you see (Safari slides the page up when the keyboard opens).
  var mainEl=document.querySelector('main'),rootEl=document.documentElement;
  function placeBar(){
    var v=window.visualViewport;if(!v)return;
    var kb=Math.round(window.innerHeight-(v.height+v.offsetTop)),open=kb>80;
    rootEl.classList.toggle('kb',open);
    rootEl.style.height=open?Math.round(v.height)+'px':'';
    mainEl.style.transform=open?'translateY('+Math.round(v.offsetTop)+'px)':'';
  }
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',placeBar);
    window.visualViewport.addEventListener('scroll',placeBar);
  }
  // Tapping the field itself makes Safari scroll the whole page to reveal it. Focus it ourselves without scrolling,
  // and undo any page scroll that still sneaks through.
  function lockScroll(){
    if(window.scrollY||rootEl.scrollTop||document.body.scrollTop){
      window.scrollTo(0,0);rootEl.scrollTop=0;document.body.scrollTop=0;
    }
  }
  window.addEventListener('scroll',lockScroll,{passive:true});
  searchInput.addEventListener('touchstart',function(ev){
    if(document.activeElement!==searchInput){ev.preventDefault();searchInput.focus({preventScroll:true});}
  },{passive:false});
  searchInput.addEventListener('focus',function(){
    [0,60,160,320,600].forEach(function(t){setTimeout(lockScroll,t);});
  });
}
