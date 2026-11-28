// VERBATIM copy of the Add recipe window code as it was in src/app.js before step 1c-8c (the file as it was after step 1c-8b): lines 107-118
// (the form's submit handler) and 138-143 (the window's close handlers). Wrapped in a factory because in app.js these are statements of the
// big closure; recipes, saveR, withAnim and renderRecipes are passed in. Generated with sed from the old file, see the test.
// @ts-nocheck
export function makeOldRecipeForm(env) {
  var recipes=env.recipes,saveR=env.saveR,withAnim=env.withAnim,renderRecipes=env.renderRecipes;
  document.getElementById('recipeForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var inp=document.getElementById('recipeName'),t=inp.value.trim();
    if(!t)return;
    var pEl=document.getElementById('recipePortions'),portions=parseInt(pEl.value,10);
    if(!(portions>0))return;
    recipes.unshift({id:Date.now(),name:t,portions:portions,items:[]});
    inp.value='';pEl.value='';
    saveR();
    document.getElementById('dlgRecipe').close();
    setTimeout(function(){withAnim('recipes',renderRecipes);},340);
  });
  var dlgRecipe=document.getElementById('dlgRecipe');
  document.getElementById('dlgRecipeClose').addEventListener('click',function(){dlgRecipe.close();});
  dlgRecipe.addEventListener('click',function(ev){if(ev.target===dlgRecipe)dlgRecipe.close();});
  dlgRecipe.addEventListener('close',function(){
    document.getElementById('recipeName').value='';document.getElementById('recipePortions').value='';
  });
  return {dlgRecipe:dlgRecipe};
}
