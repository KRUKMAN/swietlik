import { afterEach } from 'vitest';

/**
 * jsdom ships neither ResizeObserver nor matchMedia, and its rAF timing is not
 * something the models should depend on. Shim the minimum surface the Świetlik
 * models and components touch so importing them under Vitest never throws.
 */

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
    }

    // eslint-disable-next-line class-methods-use-this
    observe() {}

    // eslint-disable-next-line class-methods-use-this
    unobserve() {}

    // eslint-disable-next-line class-methods-use-this
    disconnect() {}
  };
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Deterministic-ish ~60fps animation frame shim backed by timers.
globalThis.requestAnimationFrame = (callback) => setTimeout(
  () => callback(Date.now()),
  16,
);
globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);

if (typeof window !== 'undefined') {
  window.requestAnimationFrame = globalThis.requestAnimationFrame;
  window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
}

afterEach(() => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
