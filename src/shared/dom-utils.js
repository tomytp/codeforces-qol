export const qs = (sel, ctx = document) => ctx.querySelector(sel);
export const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
export const on = (el, ev, fn, opts) => el.addEventListener(ev, fn, opts);

