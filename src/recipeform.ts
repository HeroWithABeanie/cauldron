// The Add recipe window: the form that puts a new recipe at the top of the Recipes tab, and the window's close behaviour (Close button, tap on
// the backdrop, and clearing the fields whenever it closes). The code is the code that used to be in app.js (step 1c-8c); only the typing is new.
import type { Recipe } from './types';

/** What it needs from the app. */
export interface RecipeFormCtx {
  /** The recipes array of the store; new recipes are put in at the front, in place. */
  readonly recipes: Recipe[];
  saveR(): void;
  withAnim(kind: string, fn: () => void, lock?: boolean): void;
  renderRecipes(): void;
}

export interface RecipeForm {
  /** Opens the Add recipe window (the "+" button on the Recipes tab). */
  open(): void;
}

export function createRecipeForm(ctx: RecipeFormCtx): RecipeForm {
  const recipes = ctx.recipes;
  (document.getElementById('recipeForm') as HTMLFormElement).addEventListener('submit', function (ev) {
    ev.preventDefault();
    const inp = document.getElementById('recipeName') as HTMLInputElement, t = inp.value.trim();
    if (!t) return;
    const pEl = document.getElementById('recipePortions') as HTMLSelectElement, portions = parseInt(pEl.value, 10);
    if (!(portions > 0)) return;
    recipes.unshift({ id: Date.now(), name: t, portions: portions, items: [] });
    inp.value = ''; pEl.value = '';
    ctx.saveR();
    (document.getElementById('dlgRecipe') as HTMLDialogElement).close();
    setTimeout(function () { ctx.withAnim('recipes', ctx.renderRecipes); }, 340);
  });

  const dlgRecipe = document.getElementById('dlgRecipe') as HTMLDialogElement;
  (document.getElementById('dlgRecipeClose') as HTMLElement).addEventListener('click', function () { dlgRecipe.close(); });
  dlgRecipe.addEventListener('click', function (ev) { if (ev.target === dlgRecipe) dlgRecipe.close(); });
  dlgRecipe.addEventListener('close', function () {
    (document.getElementById('recipeName') as HTMLInputElement).value = ''; (document.getElementById('recipePortions') as HTMLSelectElement).value = '';
  });
  return {
    open(): void {
      dlgRecipe.showModal(); dlgRecipe.setAttribute('tabindex', '-1'); dlgRecipe.focus({ preventScroll: true });
    },
  };
}
