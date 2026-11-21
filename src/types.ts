export type Unit = string;
export interface RecipeSource { id: number | string; name: string; rp?: number; sp?: number }
export interface OrigValues { qty: number; unit: Unit; text?: string; brand?: string }
export interface Item {
  id: string; text: string; brand?: string; qty: number; unit: Unit; cat?: string; done: boolean;
  desc?: string; from?: RecipeSource[]; unlinked?: boolean; manual?: boolean; orig?: OrigValues;
}
export interface RecipeItem { text: string; brand?: string; qty: number; unit: Unit; cat?: string }
export interface Recipe { id: number | string; name: string; portions: number; items: RecipeItem[] }
export interface HistoryEntry { text: string; unit: Unit; cat: string; last: number }
export type Kind = 'items' | 'recipes' | 'history';
export interface KnownEntry { j: string; u: number; del: boolean }

declare global {
  interface Window {
    APP_VERSION: string;
    cauldronNotes: any;
  }
}
