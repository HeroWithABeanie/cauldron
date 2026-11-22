// The small looping demos ("See how it works") that go with some patch notes, and the showcase shown once after
// an update. The demos are plain HTML strings; their animations live in style.css.
import { chkSvg, SW_TRASH, CART_SVG, UNLINK_SVG } from './icons';

export interface Showcase { title: string; alt: string; demo: string; steps: string[] }

// Add ?showcase to the address to preview the showcase of the current version at any time.
const SC_SWIPE_CHECK='<div class="scwrap"><div class="sctile"><span class="scact">'+chkSvg()+'</span><div class="scin"><span class="sccat">Pancakes</span><span class="scmid"><span class="scname">Milk</span></span><span class="scqty">500\u00a0ml</span></div></div><span class="scfinger"></span></div>';
const SC_SWIPE_ADD='<div class="scwrap scx"><div class="sctile"><span class="scactr add">'+CART_SVG+'</span><div class="scin"><span class="scmid"><span class="scname">Pancakes</span></span><span class="scsub">up to 4 portions</span><span class="scsub">6 ingredients</span></div></div><span class="scfinger"></span></div>';
const SC_SWIPE_DEL='<div class="scwrap scx scdel"><div class="sctile"><span class="scactr">'+SW_TRASH+'</span><div class="scin"><span class="sccat">Pancakes</span><span class="scmid"><span class="scname">Milk</span></span><span class="scqty">500\u00a0ml</span></div></div><span class="scfinger"></span></div>';
function scRow(q: string, n: string, mid?: boolean){return '<div class="scrow'+(mid?' mid':'')+'">'+(mid?'<span class="scpill">'+SW_TRASH+'</span>':'')+'<div class="scrw'+(mid?' scfg':'')+'"><span class="scbox"></span><span class="scrt"><strong>'+q+'</strong> '+n+'</span></div></div>';}
const SC_SWIPE_ROW='<div class="scwrapl">'+scRow('6\u00a0pcs','Eggs')+scRow('1\u00a0l','Milk',true)+scRow('250\u00a0g','Butter')+'<span class="scfinger"></span></div>';
const SC_LIST_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="7" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="17" r="1" fill="currentColor"/><path d="M10 7h10M10 12h10M10 17h10"/></svg>';
const SC_GRID_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>';
function sc65Row(q,n){return '<div class="sc65r"><span class="sc65b"></span><span class="sc65t"><strong>'+q+'</strong> '+n+'</span></div>';}
function sc65Tile(q,n){return '<div class="sc65tl"><span class="sc65tn">'+n+'</span><span class="sc65tq">'+q+'</span></div>';}
const SC_LAYOUT='<div class="sc65"><div class="sc65bar"><span class="sc65chip on">By recipe</span><span class="sc65chip">By category</span><span class="sc65chip">A to Z</span><span class="sc65sw"><span class="sc65th"></span><span class="sc65ic sc65i1">'+SC_LIST_IC+'</span><span class="sc65ic sc65i2">'+SC_GRID_IC+'</span></span></div><div class="sc65body"><div class="sc65rows">'+sc65Row('6\u00a0pcs','Eggs')+sc65Row('1\u00a0l','Milk')+sc65Row('250\u00a0g','Butter')+'</div><div class="sc65tiles">'+sc65Tile('6\u00a0pcs','Eggs')+sc65Tile('1\u00a0l','Milk')+sc65Tile('250\u00a0g','Butter')+'</div></div><span class="scfinger"></span></div>';
function sc57Card(n,p){return '<div class="sc57c"><span class="sc57n">'+n+'</span><span class="sc57p">up to '+p+' portions</span></div>';}
const SC_SLIDER='<div class="sc57"><div class="sc57clip"><div class="sc57track">'+sc57Card('Pancakes',4)+sc57Card('Cr\u00eapes',6)+sc57Card('Waffles',2)+'</div></div><div class="sc57dots"><span class="sc57d d1"></span><span class="sc57d d2"></span><span class="sc57d d3"></span></div><span class="scfinger"></span></div>';
const SC_RELINK='<div class="sc55"><div class="sc55dlg"><span class="sc55dt">Re-link to recipe?</span><span class="sc55ds">Pancakes \u00b7 the original quantity and unit are restored</span><span class="sc55btn">Confirm</span></div><div class="sc55row"><span class="scbox"></span><span class="scrt"><span class="sc55q"><strong class="sc55qa">1.5\u00a0l</strong><strong class="sc55qb">1\u00a0l</strong></span> Milk</span><span class="sc55chain">'+UNLINK_SVG+'</span></div><span class="scfinger sc55f1"></span><span class="scfinger sc55f2"></span></div>';
const SC_SPIN='<svg class="sc43spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">'+(function(){var o='';for(var i=0;i<12;i++)o+='<line x1="12" y1="3" x2="12" y2="7.5" transform="rotate('+(i*30)+' 12 12)" opacity="'+Math.max(.2,1-((12-i)%12)*.075).toFixed(2)+'"/>';return o;})()+'</svg>';
const SC_PTR='<div class="sc43"><div class="sc43ptr"><span class="sc43orb">'+SC_SPIN+'<svg class="sc43ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span><span class="sc43cap"><span class="sc43ca">Last updated Yesterday, 18:30</span><span class="sc43cb">Last updated Today, 09:41</span></span></div><div class="sc43list">'+scRow('6\u00a0pcs','Eggs')+scRow('1\u00a0l','Milk')+scRow('250\u00a0g','Butter')+'</div><span class="scfinger"></span></div>';
const SC_UNLINK='<div class="sc71"><div class="sc71tile"><div class="sc71in"><span class="sccat">Pancakes</span><span class="scmid"><span class="scname">Milk</span></span><span class="sc71q"><span class="scqty sc71qa">1\u00a0l</span><span class="scqty sc71qb">500\u00a0ml</span></span></div><span class="sc71chain">'+UNLINK_SVG+'</span></div><div class="sc71dlg"><span class="sc71dt">Re-link to recipe?</span><span class="sc71ds">Pancakes \u00b7 the original quantity and unit are restored</span><span class="sc71btn">Confirm</span></div><span class="scfinger sc71f2"></span><span class="scfinger sc71f3"></span></div>';
export const SHOWCASE: Record<string, Showcase> = {
  'v71':{
    title:'Floating unlink button in tiles',
    alt:'The outlined chain button in a tile\'s bottom right corner is tapped and fills with colour, the Re-link window opens and is confirmed, the quantity changes from 1 l back to 500 ml, and the chain disappears.',
    demo:SC_UNLINK,
    steps:[
      'Open the Shopping list in the tile layout and find a tile with a chain button in its bottom right corner.',
      'Tap the chain button. It fills with colour while you press it.',
      'The Re-link window opens. Tap Confirm once the 3 second timer has run out. The original quantity (500 ml) is restored.'
    ]
  },
  'v43':{
    title:'Pull to refresh',
    alt:'A list is pulled down from its top, a spinner fills up and turns into a check mark, and the list springs back with an updated time.',
    demo:SC_PTR,
    steps:[
      'Open the Shopping list or Recipes and scroll to the top.',
      'Pull the list down until the spinner fills up, then let go.',
      'Wait for the check mark. The caption shows when you last updated. A red mark means you are offline.'
    ]
  },
  'v65':{
    title:'Layout switch next to the chips',
    alt:'On a computer, a switch at the right end of the sorting chips is clicked and the list changes into tiles, then back into a list.',
    demo:SC_LAYOUT,
    steps:[
      'Open the Shopping list or Recipes on a computer.',
      'Find the switch at the right end of the row with the sorting chips.',
      'Click it to change between list and tiles. Click it again to go back.'
    ]
  },
  'v57':{
    title:'Recipe slider',
    alt:'Recipe cards are swiped sideways one at a time while the dots below show which card is in view.',
    demo:SC_SLIDER,
    steps:[
      'Open an item that comes from more than one recipe.',
      'Swipe the recipe card left or right, or tap a dot below it, to see the next recipe.',
      'The window grows or shrinks to fit the card you are looking at.'
    ]
  },
  'v55':{
    title:'Re-link to recipe',
    alt:'The broken chain on an item is tapped, a window asks to re-link it and after confirming, the original quantity returns and the chain disappears.',
    demo:SC_RELINK,
    steps:[
      'Find an item with a broken chain, in the Shopping list or on its recipe card in the Edit item window.',
      'Tap the chain. A window shows the recipe the item will be linked to.',
      'Tap Confirm once the 3 second timer has run out. Changed your mind? Tap Undo in the banner.'
    ]
  },
  'v59':{
    title:'Swipe to add to Shopping list',
    alt:'A recipe tile is swiped to the left, a green cart button appears and the recipe is sent to the Shopping list.',
    demo:SC_SWIPE_ADD,
    steps:[
      'Open the Recipes tab.',
      'Swipe a recipe to the left. Go all the way across to continue at once.',
      'Stopped halfway? Tap the green button. A window opens where you choose the portions and ingredients.'
    ]
  },
  'v48':{
    title:'Swipe to delete in tiles',
    alt:'A tile is swiped to the left, a red trash button appears and the tile is deleted.',
    demo:SC_SWIPE_DEL,
    steps:[
      'Open the Shopping list and switch to the tile layout.',
      'Swipe a tile to the left. Go all the way across to delete it at once.',
      'Stopped halfway? Tap the red button. Deleted by mistake? Tap Undo in the banner.'
    ]
  },
  'v35':{
    title:'Swipe to delete',
    alt:'A list row is swiped to the left, a red trash pill grows from the right edge and the row is removed.',
    demo:SC_SWIPE_ROW,
    steps:[
      'Open the Shopping list, or open a recipe.',
      'Swipe an item to the left. Go past halfway across to delete it at once.',
      'Stopped halfway? Tap the red button. Tap Undo in the banner to bring the item back.'
    ]
  },
  'v70':{
    title:'Swipe to check off',
    alt:'A tile is swiped to the right, a green check button appears and the tile is checked off.',
    demo:SC_SWIPE_CHECK,
    steps:[
      'Open the Shopping list and switch to the tile layout.',
      'Swipe a tile to the right. Go all the way across to check it off at once.',
      'Stopped halfway? Tap the green button. Swipe a checked tile the same way to uncheck it.'
    ]
  }
};
