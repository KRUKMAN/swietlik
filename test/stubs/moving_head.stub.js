/**
 * Test stub for `src/plugins/visualizer/moving_head.js`.
 *
 * The real MovingHead builds Three.js instanced meshes, buffer attributes and
 * spotlights at module scope, none of which survive jsdom. This stub reproduces
 * only the surface that `src/models/DMX/fixture.model.js` actually touches:
 *
 *   - `new MovingHead(options)` with the OFL-derived option bag
 *     (minAngle/maxAngle/minTilt/maxTilt/minPan/maxPan/colorTemp/intensity/
 *      pan/tilt/colorWheel/goboWheel)
 *   - `.position` / `.rotation` assignment
 *   - `.highlighted` read + write
 *   - `.colorIntensity`, `.colorPreset`, `.colorWheelSlot` writes
 *   - arbitrary `this._3DModel[key] = value` writes from capability values
 *   - `.setSinglyHighlighted(state)`
 *   - `MovingHead.deleteInstance(instance)`
 */

/**
 * Every MovingHead stub instance created since the last `reset()`.
 *
 * @type {Array<MovingHead>}
 */
export const created = [];

let instanceCount = 0;

class MovingHead {
  constructor(options = {}) {
    Object.assign(this, options);

    this.options = options;
    this.id = instanceCount++;

    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };

    this.highlighted = false;
    this.singlyHighlighted = false;

    this.colorIntensity = null;
    this.colorPreset = null;
    this.colorWheelSlot = null;

    this.deleted = false;

    created.push(this);
  }

  /**
   * Mirrors the real instance method used by `Fixture.highlightSingle`.
   *
   * @param {Boolean} state singly-highlighted state
   */
  setSinglyHighlighted(state) {
    this.singlyHighlighted = state;
  }

  /**
   * Mirrors `MovingHead.deleteInstance` used by `Fixture.deleteInstance`.
   *
   * @param {MovingHead} instance instance handle
   */
  static deleteInstance(instance) {
    if (instance) {
      instance.deleted = true;
    }
  }

  /**
   * Clears the recorded instance list. Call from `beforeEach`.
   */
  static reset() {
    created.length = 0;
    instanceCount = 0;
  }
}

export default MovingHead;
