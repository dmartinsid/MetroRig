// The page element with this id, typed as the screen expects it
export function byId<T extends Element = HTMLElement>(id: string): T {
  return document.getElementById(id) as unknown as T;
}

// One option of a select, or of an optgroup
export function option(value: string, text: string): HTMLOptionElement {
  const opt = document.createElement('option');
  opt.value = value;
  opt.innerText = text;
  return opt;
}
