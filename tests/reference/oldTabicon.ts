// VERBATIM copy of animateTabIcon, setSwap and setSwapAll as they were in src/app.js before step 1c-1 (v76). Only used by tests, to
// check that tabicon.ts behaves exactly like the old code.
// @ts-nocheck
import { noMotion } from '../../src/ui';

  function animateTabIcon(v){
    if(noMotion())return;
    var tab=document.querySelector('.tab[data-view="'+v+'"]'),svg=tab&&tab.querySelector('svg');
    if(!svg||!svg.animate)return;
    if(v==='recipes'){
      svg.animate([
        {transform:'translateY(0) scale(1,1)'},
        {transform:'translateY(1px) scale(1.08,.9)',offset:.15},
        {transform:'translateY(-7px) scale(.94,1.1)',offset:.4},
        {transform:'translateY(0) scale(1.06,.94)',offset:.65},
        {transform:'translateY(-2px) scale(.99,1.02)',offset:.82},
        {transform:'translateY(0) scale(1,1)'}
      ],{duration:600,easing:'ease-out'});
      svg.querySelectorAll('.bub').forEach(function(b,i){
        b.animate([
          {transform:'translateY(0) scale(1)'},
          {transform:'translateY(0) scale(1)',offset:.15},
          {transform:'translateY('+(-5-i*1.5)+'px) scale(1.2)',offset:.45},
          {transform:'translateY(1px) scale(.95)',offset:.72},
          {transform:'translateY(0) scale(1)'}
        ],{duration:640,delay:i*45,easing:'ease-out'});
      });
    }else{
      svg.animate([
        {transform:'translateY(0) rotate(0deg)'},
        {transform:'translateY(-3px) rotate(-5deg)',offset:.35},
        {transform:'translateY(0) rotate(3deg)',offset:.7},
        {transform:'translateY(0) rotate(0deg)'}
      ],{duration:600,easing:'ease-out'});
      svg.querySelectorAll('.dot').forEach(function(d,i){
        d.animate([
          {transform:'scale(1)'},{transform:'scale(0)',offset:.2},
          {transform:'scale(1.6)',offset:.5},{transform:'scale(.9)',offset:.75},{transform:'scale(1)'}
        ],{duration:600,delay:i*70,easing:'ease-out'});
      });
      svg.querySelectorAll('.ln').forEach(function(l,i){
        l.animate([
          {transform:'scaleX(1)'},{transform:'scaleX(.15)',offset:.2},
          {transform:'scaleX(1.12)',offset:.55},{transform:'scaleX(.97)',offset:.8},{transform:'scaleX(1)'}
        ],{duration:600,delay:i*70,easing:'ease-out'});
      });
    }
  }

  function setSwap(c){
    var a=c.querySelector('.la'),z=c.querySelector('.lz');
    if(!a||!z||!a.offsetWidth)return;
    c.style.setProperty('--da',(z.offsetLeft+z.offsetWidth-a.offsetWidth-a.offsetLeft)+'px');
    c.style.setProperty('--dz',(a.offsetLeft-z.offsetLeft)+'px');
  }
  function setSwapAll(){document.querySelectorAll('.azchip').forEach(setSwap);}

export { animateTabIcon, setSwap, setSwapAll };
