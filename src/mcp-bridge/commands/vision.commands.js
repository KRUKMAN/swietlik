import { registerCommand } from './registry';

/**
 * Visualizer capture -- the command that lets an agent SEE the rig.
 *
 * The Three.js renderer is built without `preserveDrawingBuffer`, so the WebGL
 * colour buffer is gone by the time an external caller asks for it. A forced
 * `render()` immediately before `toDataURL` is what makes the capture non-blank.
 *
 * @module mcp-bridge/commands/vision.commands
 */

/**
 * Locates the renderer canvas on a visualizer handle.
 *
 * @param {Object} handle visualizer instance
 * @return {Object|null} canvas element, or null when none is attached
 * @private
 */
function findCanvas(handle) {
  if (handle.renderer && handle.renderer.domElement) {
    return handle.renderer.domElement;
  }
  if (handle.domElement && typeof handle.domElement.toDataURL === 'function') {
    return handle.domElement;
  }
  return null;
}

registerCommand('screenshot_visualizer', {
  description: 'Captures the 3D visualizer viewport as a PNG or JPEG image. '
    + 'Forces a render first, so the frame is current.',
  args: {
    mime_type: {
      type: 'string',
      enum: ['image/png', 'image/jpeg'],
      default: 'image/png',
    },
  },
  handler: (show, args) => {
    const handle = show.visualizerHandle;
    if (!handle) {
      throw new Error('The visualizer is not mounted yet -- open the app and '
        + 'wait for the 3D viewport before taking a screenshot.');
    }
    const canvas = findCanvas(handle);
    if (!canvas) {
      throw new Error('The visualizer handle exposes no WebGL canvas to capture.');
    }
    if (typeof handle.render === 'function') {
      handle.render();
    }
    const dataUrl = canvas.toDataURL(args.mime_type);
    const commaIndex = typeof dataUrl === 'string' ? dataUrl.indexOf(',') : -1;
    if (commaIndex < 0) {
      throw new Error('The visualizer canvas did not return an image data URL.');
    }
    return {
      mimeType: args.mime_type,
      width: canvas.width,
      height: canvas.height,
      dataBase64: dataUrl.slice(commaIndex + 1),
    };
  },
});
