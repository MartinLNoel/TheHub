// Tiny DOM helper. Text always goes in as text (never as HTML), so module data cannot inject markup.

/**
 * h('button', { class: 'btn', onclick: fn }, 'Label', childNode, ...)
 * Attributes starting with "on" become event listeners; null/false attributes are skipped.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'class') {
      el.className = value;
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** Replaces everything inside `parent` with the given children. */
export function mount(parent, ...children) {
  parent.replaceChildren();
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) parent.append(child);
  }
  return parent;
}
