// Patch notes: the entries of the version history (footer button) of every version so far.
//
// To release a new version: run `npm version NN.0.0 --no-git-tag-version` and add a 'vNN' entry at the TOP of NOTES
// below (tag: new, better or fixed). The build fails if the entry for the version in package.json is missing.
// An optional entry in SHOWCASE (showcase.ts) is what is shown once, as a small demo, after the update.

export type NoteTag = 'new' | 'better' | 'fixed';
export interface NoteEntry { tag: NoteTag; title: string; text: string; demo?: string }
export interface NoteVersion { date: string; entries: NoteEntry[] }

export const NOTES: Record<string, NoteVersion> = {
  'v76':{date:'21 November 2026',entries:[
    {tag:'better',title:'Moved to TypeScript tooling',text:'Cauldron is now built with Vite and TypeScript under the hood. Nothing changes in how the app looks or works.'}
  ]},
  'v75':{date:'19 November 2026',entries:[
    {tag:'better',title:'Sync library updated',text:'The sync engine behind Cauldron was updated to the latest Firebase release, for better security and reliability. Nothing changes in how the app looks or works.'}
  ]},
  'v74':{date:'19 November 2026',entries:[
    {tag:'better',title:'Details under the name',text:'The Description window now shows the category, quantity and unit as a subheader below the item name, the same way recipe windows show portions and ingredients.'},
    {tag:'better',title:'Quantity and unit back in Edit item',text:'Quantity and unit are edited in the "Edit item" window again, next to name, brand and category. The Description window now only saves the description.'},
    {tag:'new',title:'Notebook lines',text:'List rows and recipe ingredients now have a soft red vertical line between the checkbox or drag handle and the item name, like the margin line in a notebook.'}
  ]},
  'v73':{date:'19 November 2026',entries:[
    {tag:'better',title:'New handwriting font',text:'Item names and recipe titles now use Playpen Sans instead of Caveat. Brand names are now shown in even bolder font.'}
  ]},
  'v72':{date:'17 November 2026',entries:[
    {tag:'new',title:'Item descriptions',text:'Tapping an item in the Shopping list now opens a new window with an input field where you can enter notes that are assigned to that item.'},
    {tag:'better',title:'Edit item behind the pencil',text:'The "Edit item" window now sits behind the pencil button in the Description window.'},
    {tag:'better',title:'Re-linking rules',text:'Re-linking has been overhauled to handle item renames, both in the Shopping list and in the Recipes. If a rename is done on an item that is already on the Shopping list, then you are presented with a window that lets you rename the already added item (without having to re-link it).'}
  ]},
  'v71':{date:'17 November 2026',entries:[
    {tag:'better',title:'Floating unlink button in tiles',demo:'v71',text:'In the tile layout, the broken chain icon is now a round button that sits in the bottom right corner of its tile. It stays tappable even when you swipe over a tile. Tap it to "re-link" an item.'},
    {tag:'better',title:'Firmer swipes in tiles',text:'In tile layout, swipe actions now require you to swipe a longer distance to avoid accidental swipes.'}
  ]},
  'v70':{date:'16 November 2026',entries:[
    {tag:'new',title:'Swipe right to check off',demo:'v70',text:'In the tile layout, swipe a tile to the right to check it off (or uncheck it). Swipe a little and tap the green button, or swipe all the way across.'},
    {tag:'better',title:'Tap a tile to edit it',text:'On a phone, tapping a tile now opens the Edit item window, like on recipe tiles. Pressing and holding is no longer needed, and accidental taps no longer check items off.'},
    {tag:'new',title:'Right click on computers',text:'On a computer, right click an item to edit it or a recipe to open it. In the tile layout, a left click on a tile now checks it off. The check button on hover is not needed anymore.'},
    {tag:'new',title:'Undo when checking off',text:'Checking off an item now shows a banner at the bottom with an Undo button, so a mistake can be reversed instantly.'}
  ]},
  'v69':{date:'16 November 2026',entries:[
    {tag:'fixed',title:'Long recipe names in tiles',text:'In the Shopping list tile layout sorted by recipe, recipe names longer than 20 characters are now cut off with \u201c...\u201d instead of shrinking to a tiny font.'},
    {tag:'better',title:'Portions first on recipe tiles',text:'Recipe tiles now show the portions before the ingredient count, matching the recipe window. When sorted by ingredients, the ingredient count still comes first.'}
  ]},
  'v68':{date:'15 November 2026',entries:[
    {tag:'new',title:'Unlinked icon in tiles',text:'Tiles in the tile layout now show the broken chain icon in the bottom right corner, next to the quantity, when an item was unlinked from its recipe.'},
    {tag:'better',title:'Re-link from the Edit window',text:'In the "Edit item" window, tapping or clicking the broken chain on a recipe card now opens the "Re-link to recipe" window (when re-linking is possible), instead of only showing a tooltip. On a computer the tooltip still appears on hover.'}
  ]},
  'v67':{date:'15 November 2026',entries:[
    {tag:'new',title:'Brand field',text:'Items now have an optional Brand field. In item names, the brand will always be hightlighted in a bold font.'}
  ]},
  'v66':{date:'14 November 2026',entries:[
    {tag:'new',title:'Cup and slice units',text:'You can now choose \u201ccup\u201d (a cup of yogurt) and \u201cslice\u201d (a slice of bread) as units when adding or editing items.'}
  ]},
  'v65':{date:'14 November 2026',entries:[
    {tag:'better',title:'Layout switch next to the chips',demo:'v65',text:'On a computer, the list and tile switch now sits on the right of the sorting chips in both the Shopping list and Recipes, at the same height. Phones are not affected by this change.'},
    {tag:'new',title:'Three tiles per row',text:'On a computer, all tile layouts now show three tiles per row instead of two. Phones keep two.'}
  ]},
  'v64':{date:'14 November 2026',entries:[
    {tag:'better',title:'Compact recipe info',text:'Recipe cards and the recipe window now show the ingredient count and the portions on one line, separated by a dot, which saves space.'}
  ]},
  'v63':{date:'14 November 2026',entries:[
    {tag:'fixed',title:'Tile text size on startup',text:'Long item and recipe names in tiles no longer start out too small and only grow after syncing. They now fit correctly as soon as the handwriting font has loaded.'}
  ]},
  'v62':{date:'13 November 2026',entries:[
    {tag:'new',title:'Checked items move to the bottom',text:'Items you tick off now fade out and reappear at the bottom of the Shopping list. In the list layout they land in their own \u201cChecked off\u201d section; in the tile layout they simply move to the end. Untick an item and it moves back up.'}
  ]},
  'v61':{date:'13 November 2026',entries:[
    {tag:'new',title:'Ingredient count in recipes',text:'The recipe window now shows how many ingredients the recipe has, just above the portions.'},
    {tag:'new',title:'Sort by ingredients',text:'In Recipes, a new Ingredients chip next to Portions sorts your recipes by number of ingredients. Tap it again to switch between fewest first and most first.'}
  ]},
  'v60':{date:'13 November 2026',entries:[
    {tag:'fixed',title:'Portions when adding a recipe twice',text:'Adding the same recipe to the Shopping list again now adds up the portions shown on the item, so the label matches the quantity.'},
    {tag:'new',title:'Already on your list',text:'When you add a recipe that is already on the Shopping list, the window now says so in an orange box.'}
  ]},
  'v59':{date:'13 November 2026',entries:[
    {tag:'new',title:'Swipe to \u201cadd to Shopping list\u201d',demo:'v59',text:'In Recipes, swipe a recipe to the left to add it to your Shopping list. Swipe a little and tap the green button, or swipe all the way across.'},
    {tag:'new',title:'Ingredient count',text:'Recipe cards and tiles now show how many ingredients each recipe has, just above the portions.'},
    {tag:'better',title:'Cleaner recipe cards',text:'The \u201cAdd to Shopping list\u201d button is gone from recipe cards and tiles. On a computer it appears when you hover over a recipe.'}
  ]},
  'v58':{date:'11 November 2026',entries:[
    {tag:'fixed',title:'Item names cut off in tiles',text:'The last letter of an item name, such as \u201cchicken breast\u201d, is no longer clipped on Shopping list tiles.'}
  ]},
  'v57':{date:'11 November 2026',entries:[
    {tag:'new',title:'Recipe slider',demo:'v57',text:'When an item comes from several recipes, the \u201cEdit item\u201d and \u201cUnlink from recipe\u201d windows show one recipe card at a time. Swipe left or right to see the others, or tap a dot to jump to one.'}
  ]},
  'v56':{date:'11 November 2026',entries:[
    {tag:'fixed',title:'\u201cUnlink\u201d icon rework',text:'The broken chain link icon now has more consistent spacing across the app.'},
    {tag:'better',title:'Handling of recipes from multiple sources',text:'Items that are added through multiple sources are merged carefully and maintain their link so tracing back the source is still possible.'},
    {tag:'better',title:'No re-linking of mixed items',text:'Items that were added through multiple sources can no longer be re-linked.'}
  ]},
  'v55':{date:'10 November 2026',entries:[
    {tag:'new',title:'Swipe windows away',text:'On a phone, swipe a window up to close it.'},
    {tag:'better',title:'No more \u00d7 buttons on phones',text:'Windows on touch screens no longer have a close button. Tap outside or swipe up instead. Warning windows use their \u201cCancel\u201d or \u201cNo\u201d buttons instead.'},
    {tag:'new',title:'Re-link to recipe',demo:'v55',text:'Tap the broken chain on an item you unlinked by changing its quantity or unit to re-link it. Its original quantity and unit are restored.'},
    {tag:'better',title:'Re-worked unlinking',text:'The \u201cUnlink from recipe\u201d window now has a 3 second timer on its confirm button, a Cancel button, and closes when you tap outside it, which returns you to the Edit item window.'}
  ]},
  'v54':{date:'10 November 2026',entries:[
    {tag:'better',title:'Streamlined, uniform colour scheme',text:'The colors for various windows and input fields have been updated, both in light and dark modes.'},
    {tag:'better',title:'No automatic focus',text:'The \u201cAdd item\u201d, \u201cAdd to recipe\u201d and \u201cAdd recipe\u201d windows no longer start with a field selected, so the keyboard stays closed until you tap a field.'},
    {tag:'fixed',title:'White dropdown arrows',text:'In dark mode, the up and down arrows on dropdown menus are now white instead of black.'}
  ]},
  'v53':{date:'10 November 2026',entries:[
    {tag:'better',title:'Colour changes to Recipe and \u201cAdd to Shopping list\u201d windows',text:'The colour schemes for these two windows have been changed for better visual clarity.'}
  ]},
  'v52':{date:'10 November 2026',entries:[
    {tag:'fixed',title:'Smoother swipe-to-delete',text:'Swiping on rows and tiles to delete items is now supported by better animation handling.'}
  ]},
  'v51':{date:'9 November 2026',entries:[
    {tag:'better',title:'Clear button only closes suggestions',text:'The \u00d7 in item name fields now only closes the suggestions list and keeps what you typed. Keep typing and the list returns whenever there is a match.'}
  ]},
  'v50':{date:'9 November 2026',entries:[
    {tag:'better',title:'Suggestions in recipes',text:'The \u201cAdd item\u201d window in Recipes now shows the same hint text in the item name field and a suggestions list that shows every match and scrolls at the edge of the screen.'},
    {tag:'new',title:'Clear button in recipes',text:'While suggestions are showing in the recipe \u201cAdd item\u201d window, a \u00d7 appears inside the field. Tap it to clear your input and close the suggestions.'},
    {tag:'new',title:'Suggestions when editing',text:'The \u201cEdit item\u201d windows in the Shopping list and in Recipes now have the same hint text, suggestions list and clear button.'},
    {tag:'fixed',title:'Add windows start empty',text:'Closing an \u201cAdd item\u201d or \u201cAdd recipe\u201d window without saving now clears what you typed.'}
  ]},
  'v49':{date:'9 November 2026',entries:[
    {tag:'better',title:'\u201cAdd item\u201d window stays full size',text:'The \u201cAdd item\u201d window no longer shrinks when the keyboard opens.'},
    {tag:'better',title:'Expanded suggestions list',text:'The list of item name suggestions now shows every match and scrolls when it reaches the edge of the screen.'},
    {tag:'new',title:'Clear button for suggestions list',text:'While suggestions are showing, a \u00d7 appears inside the field. Tap it to clear your input and close the suggestions.'}
  ]},
  'v48':{date:'8 November 2026',entries:[
    {tag:'new',title:'Swipe to delete in tiles',demo:'v48',text:'Swipe a tile to the left to delete it, just like in the list layout.'},
    {tag:'fixed',title:'Delete button removed',text:'Deleting from the Edit window is no longer an option. Swiping now fills that gap, both in list and tile view. With a mouse, deleting works through a Delete button that appears on hover.'}
  ]},
  'v47':{date:'7 November 2026',entries:[
    {tag:'better',title:'Locked while refreshing',text:'While a pull to refresh is running, only the tabs, the add buttons and search can be used. Everything else is paused until the refresh finishes.'}
  ]},
  'v46':{date:'7 November 2026',entries:[
    {tag:'better',title:'Smoother updates',text:'Sorting, layout and search buttons pause briefly while changes from the server animate in.'}
  ]},
  'v45':{date:'7 November 2026',entries:[
    {tag:'fixed',title:'Search highlighting in tiles',text:'Search now highlights text in recipe tiles again.'}
  ]},
  'v44':{date:'6 November 2026',entries:[
    {tag:'new',title:'Warning about conflicting units',text:'Adding an item that is already on the list with a unit that cannot be converted now gives a warning.'},
    {tag:'new',title:'Animated warning windows',text:'Warning windows now shake when they appear onto the screen.'}
  ]},
  'v43':{date:'5 November 2026',entries:[
    {tag:'new',title:'Pull to refresh',demo:'v43',text:'Pull lists down to update local data and ensure you are always in sync.'},
    {tag:'new',title:'More animations',text:'When lists are updated from server-side, these changes are now animated.'}
  ]},
  'v42':{date:'5 November 2026',entries:[
    {tag:'fixed',title:'Search bar placeholder text',text:'The text inside the search bar now displays correctly and is no longer cut off.'}
  ]},
  'v41':{date:'4 November 2026',entries:[
    {tag:'fixed',title:'Title cutoff and spacing in tile layout',text:'Titles are now correctly cut off in tiles, and spacing and font size are adjusted so the entire title fits. If a title still does not fit, it is shortened with \u201c...\u201d at the end.'},
    {tag:'fixed',title:'Search highlighting',text:'Special characters are treated as spaces so that searches return more results.'}
  ]},
  'v40':{date:'4 November 2026',entries:[
    {tag:'new',title:'Version history',text:'Tap the version button at the bottom to see the patch notes of every version so far.'},
    {tag:'new',title:'Footer in Recipes',text:'The Recipes view now shows the same footer as the Shopping list.'},
    {tag:'better',title:'Tidier footer',text:'The footer has been cleaned up and now includes the button for the version history.'},
    {tag:'better',title:'Bigger recipe titles',text:'On a computer, tile names are larger and can use up to 4 lines. Phones are not affected by this change.'}
  ]},
  'v39':{date:'4 November 2026',entries:[
    {tag:'fixed',title:'Search bar',text:'Fixed an issue where the search bar had inconsistent sizing.'}
  ]},
  'v38':{date:'4 November 2026',entries:[
    {tag:'new',title:'Tube and container units',text:'You can now choose \u201ctube\u201d and \u201ccontainer\u201d when adding items.'},
    {tag:'better',title:'Layout toggle for recipes',text:'In Recipes, the menu button is now a layout toggle (instead of a slider). Tap it to switch between list and tiles.'},
    {tag:'better',title:'No more dozen',text:'\u201cDozen\u201d is no longer offered as a unit. Items that already use it keep it.'},
    {tag:'fixed',title:'Recipe names on tiles',text:'The last letter of a recipe name is no longer cut off on tiles.'}
  ]},
  'v37':{date:'3 November 2026',entries:[
    {tag:'new',title:'Recipes as tiles',text:'Show your recipes as tiles, with a button on each one to add it to your Shopping list.'},
    {tag:'new',title:'Menu for recipes',text:'Recipes now have their own menu button with the layout switch.'},
    {tag:'better',title:'Tidier when empty',text:'With nothing in a list, the menu and search buttons are hidden in both views.'}
  ]},
  'v36':{date:'3 November 2026',entries:[
    {tag:'fixed',title:'Smoother last-item delete',text:'Deleting the last item in a list now flows straight into the empty message instead of shrinking away first.'}
  ]},
  'v35':{date:'2 November 2026',entries:[
    {tag:'new',title:'Swipe to delete',demo:'v35',text:'Swipe an item to the left to reveal a Delete button, or swipe all the way across to remove it. On a computer, hover over the item instead.'},
    {tag:'better',title:'No more \u00d7 buttons',text:'Items in the Shopping list and in recipe windows are tidier now that Delete sits behind the swipe.'}
  ]},
  'v34':{date:'2 November 2026',entries:[
    {tag:'better',title:'Simpler ingredient list',text:'The Add to shopping list window now shows 4 and a half ingredients, with the half row hinting that you can scroll.'}
  ]},
  'v33':{date:'2 November 2026',entries:[
    {tag:'better',title:'Recipes open in a window',text:'Tap a recipe to see and change its ingredients. Delete now sits with the other recipe buttons.'},
    {tag:'new',title:'Shopping list button on recipes',text:'Add a recipe to your shopping list straight from the list, without opening it.'},
    {tag:'better',title:'Banners stay in front',text:'Messages like \u201cItem added. Add another?\u201d now appear in front of open windows.'}
  ]},
  'v32':{date:'2 November 2026',entries:[
    {tag:'better',title:'Patch notes catch you up',text:'If you skip an update, you now see the changes from every version you missed in one window.'}
  ]},
  'v31':{date:'1 November 2026',entries:[
    {tag:'better',title:'Smoother search',text:'The search bar now opens and closes in step with the keyboard.'}
  ]},
  'v30':{date:'31 October 2026',entries:[
    {tag:'new',title:'Patch notes',text:'After an update you now see a short summary of what changed.'}
  ]}
};

export const TAGS: Record<string, string> = { new: 'New', better: 'Better', fixed: 'Fixed' };

/** "v76" -> 76 */
export function vnum(k: string): number { return parseInt(String(k).replace(/\D/g, ''), 10) || 0; }
