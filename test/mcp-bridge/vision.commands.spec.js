import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { dispatch } from '@/mcp-bridge/commands/registry';
import '@/mcp-bridge/commands/vision.commands';
import { makeShowDouble } from '../helpers/show-double';

/**
 * Unwraps a success envelope, failing loudly on an error envelope.
 *
 * @param {Object} envelope response envelope from dispatch
 * @return {*} the result payload
 */
function resultOf(envelope) {
  if (!envelope.ok) {
    throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
  }
  return envelope.result;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('screenshot_visualizer', () => {
  it('forces a render before reading the canvas', async () => {
    const show = makeShowDouble();
    const shot = resultOf(await dispatch(show, {
      id: 'v1', cmd: 'screenshot_visualizer', args: {},
    }));

    expect(show.visualizerHandle.render).toHaveBeenCalledTimes(1);
    expect(shot).toEqual({
      mimeType: 'image/png',
      width: 1280,
      height: 720,
      dataBase64: 'UE5HREFUQQ==',
    });
  });

  it('renders before, not after, reading the canvas', async () => {
    const show = makeShowDouble();
    const order = [];
    show.visualizerHandle.render = vi.fn(() => order.push('render'));
    show.visualizerHandle.renderer.domElement.toDataURL = vi.fn(() => {
      order.push('capture');
      return 'data:image/png;base64,QQ==';
    });

    await dispatch(show, { id: 'v2', cmd: 'screenshot_visualizer', args: {} });

    expect(order).toEqual(['render', 'capture']);
  });

  it('passes the requested mime type through to toDataURL', async () => {
    const show = makeShowDouble();
    show.visualizerHandle.renderer.domElement.toDataURL = vi.fn(
      () => 'data:image/jpeg;base64,SlBH',
    );

    const shot = resultOf(await dispatch(show, {
      id: 'v3', cmd: 'screenshot_visualizer', args: { mime_type: 'image/jpeg' },
    }));

    expect(show.visualizerHandle.renderer.domElement.toDataURL)
      .toHaveBeenCalledWith('image/jpeg');
    expect(shot.mimeType).toBe('image/jpeg');
    expect(shot.dataBase64).toBe('SlBH');
  });

  it('falls back to visualizerHandle.domElement when no renderer is attached', async () => {
    const show = makeShowDouble();
    show.visualizerHandle.renderer = null;
    show.visualizerHandle.domElement = {
      width: 800,
      height: 600,
      toDataURL: vi.fn(() => 'data:image/png;base64,RkFMTA=='),
    };

    const shot = resultOf(await dispatch(show, {
      id: 'v4', cmd: 'screenshot_visualizer', args: {},
    }));

    expect(shot).toEqual({
      mimeType: 'image/png',
      width: 800,
      height: 600,
      dataBase64: 'RkFMTA==',
    });
  });

  it('errors when the visualizer is not mounted yet', async () => {
    const show = makeShowDouble({ visualizerHandle: null });
    const envelope = await dispatch(show, {
      id: 'v5', cmd: 'screenshot_visualizer', args: {},
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.message).toContain('visualizer is not mounted');
  });

  it('errors when no canvas can be found on the handle', async () => {
    const show = makeShowDouble();
    show.visualizerHandle.renderer = null;
    const envelope = await dispatch(show, {
      id: 'v6', cmd: 'screenshot_visualizer', args: {},
    });
    expect(envelope.error.message).toContain('no WebGL canvas');
  });

  it('errors when the canvas returns something that is not a data URL', async () => {
    const show = makeShowDouble();
    show.visualizerHandle.renderer.domElement.toDataURL = vi.fn(() => '');
    const envelope = await dispatch(show, {
      id: 'v7', cmd: 'screenshot_visualizer', args: {},
    });
    expect(envelope.error.message).toContain('did not return an image');
  });

  it('rejects an unsupported mime type', async () => {
    const envelope = await dispatch(makeShowDouble(), {
      id: 'v8', cmd: 'screenshot_visualizer', args: { mime_type: 'image/gif' },
    });
    expect(envelope.error).toEqual({
      code: 'VALIDATION',
      message: 'screenshot_visualizer: Argument "mime_type" must be one of: '
        + 'image/png, image/jpeg',
    });
  });
});
