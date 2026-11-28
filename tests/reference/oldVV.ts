// VERBATIM copy of the visual viewport code as it was in src/app.js before step 1c-8c (the file as it was after step 1c-8b): lines 126-136.
// Wrapped in a factory because in app.js it is a statement of the big closure. Generated with sed from the old file, see the test.
// @ts-nocheck
export function makeOldVV() {
  function syncVV(){
    var v=window.visualViewport;if(!v)return;
    var st=document.documentElement.style;
    st.setProperty('--vvh',v.height+'px');
    st.setProperty('--vvt',v.offsetTop+'px');
  }
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',syncVV);
    window.visualViewport.addEventListener('scroll',syncVV);
    syncVV();
  }
}
