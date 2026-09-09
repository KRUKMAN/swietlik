/**
 * Test stub for `src/plugins/visualizer/controls.js`.
 *
 * The real module instantiates Three.js materials/geometries at import time and
 * exports a *singleton instance* as its default export
 * (`export default controlsInstance`). `src/models/DMX/fixture.model.js` uses it
 * as `Controls.attach(...)`, `Controls.detach()`, `Controls.detachAll()` and
 * `Controls.setFocus(false)` — so this stub keeps the default-export-singleton
 * import style and records every call.
 */

/**
 * Ordered log of every stubbed Controls call since the last `reset()`.
 * Each entry is `{ method, args }`.
 *
 * @type {Array<{method: String, args: Array}>}
 */
export const calls = [];

class ControlsStub {
  // eslint-disable-next-line class-methods-use-this
  attach(instance) {
    calls.push({ method: 'attach', args: [instance] });
  }

  // eslint-disable-next-line class-methods-use-this
  detach(...args) {
    calls.push({ method: 'detach', args });
  }

  // eslint-disable-next-line class-methods-use-this
  detachAll(...args) {
    calls.push({ method: 'detachAll', args });
  }

  // eslint-disable-next-line class-methods-use-this
  setFocus(state) {
    calls.push({ method: 'setFocus', args: [state] });
  }

  /**
   * Clears the recorded call log. Call from `beforeEach`.
   */
  // eslint-disable-next-line class-methods-use-this
  reset() {
    calls.length = 0;
  }
}

const controlsInstance = new ControlsStub();

export default controlsInstance;
