import { describe, it, expect } from 'vitest';
import Channel from '@/models/DMX/channel.model';
import loadOFL from '../helpers/ofl';

const sharpy = loadOFL('clay-paky/sharpy');

const shutterChannelData = sharpy.availableChannels['Shutter / Strobe'];
const panChannelData = sharpy.availableChannels.Pan;
const dimmerChannelData = sharpy.availableChannels.Dimmer;

describe('Channel#setup -- building capabilities from real OFL channel data', () => {
  it('builds one Capability per entry for a multi-capability channel', () => {
    const channel = new Channel({
      id: 1,
      type: 'Shutter / Strobe',
      isFine: false,
      OFLData: shutterChannelData,
    });

    expect(channel.capabilities).toHaveLength(shutterChannelData.capabilities.length);
    expect(channel.capabilities[0].range).toEqual([0, 3]);
    expect(channel.capabilities[0].parameters.strobeEffect).toBe('Closed');
    expect(channel.capabilities[channel.capabilities.length - 1].range).toEqual([252, 255]);
  });

  it('builds a single Capability for a single-"capability" channel', () => {
    const channel = new Channel({
      id: 2,
      type: 'Pan',
      isFine: false,
      OFLData: panChannelData,
    });

    expect(channel.capabilities).toHaveLength(1);
    expect(channel.capabilities[0].entities.pan.start).toBe(0);
    expect(channel.capabilities[0].entities.pan.end).toBe(540);
  });

  it('derives the generic channel .type from the underlying capability type', () => {
    const shutter = new Channel({
      id: 1, type: 'Shutter / Strobe', isFine: false, OFLData: shutterChannelData,
    });
    expect(shutter.type).toBe('Shutter');

    const dimmer = new Channel({
      id: 3, type: 'Dimmer', isFine: false, OFLData: dimmerChannelData,
    });
    expect(dimmer.type).toBe('Dimmer');

    const pan = new Channel({
      id: 2, type: 'Pan', isFine: false, OFLData: panChannelData,
    });
    expect(pan.type).toBe('Pan');

    const panFine = new Channel({
      id: 2, type: 'Pan', isFine: true, OFLData: panChannelData,
    });
    expect(panFine.type).toBe('PanFine'); // isFine suffixes the derived type
  });
});

describe('Channel#value -- setter/getter on the real DMX value slot', () => {
  it('starts at the initialized default before anything is set', () => {
    const channel = new Channel({
      id: 1, type: 'Dimmer', isFine: false, OFLData: dimmerChannelData,
    });
    expect(channel.value).toEqual({ DMX: 0, model: 0 });
  });

  it('writes through to _value.DMX with NO clamping at this layer', () => {
    // Channel#value's setter is a plain passthrough (`this._value.DMX = value`).
    // Clamping to [0,255] happens one layer up, in Fixture#setChannel -- not
    // here. This test documents the real, unclamped behaviour of Channel itself.
    const channel = new Channel({
      id: 1, type: 'Dimmer', isFine: false, OFLData: dimmerChannelData,
    });

    channel.value = 128;
    expect(channel.value.DMX).toBe(128);

    channel.value = 500; // out of the nominal 0-255 range
    expect(channel.value.DMX).toBe(500);

    channel.value = -20;
    expect(channel.value.DMX).toBe(-20);
  });

  it('never populates _value.model -- nothing in the codebase writes it', () => {
    // `model` is initialized to 0 in the constructor and there is no setter
    // path (in Channel or anywhere else in src/) that ever assigns to it.
    const channel = new Channel({
      id: 1, type: 'Dimmer', isFine: false, OFLData: dimmerChannelData,
    });
    channel.value = 200;
    expect(channel.value.model).toBe(0);
  });
});

describe('Channel#getCapability -- selecting a capability at real dmxRange boundaries', () => {
  const channel = new Channel({
    id: 1, type: 'Shutter / Strobe', isFine: false, OFLData: shutterChannelData,
  });

  it('selects the Closed capability at the low boundary [0,3]', () => {
    expect(channel.getCapability(0).parameters.strobeEffect).toBe('Closed');
    expect(channel.getCapability(3).parameters.strobeEffect).toBe('Closed');
  });

  it('selects the neighbouring Strobe capability just past that boundary', () => {
    expect(channel.getCapability(4).parameters.strobeEffect).toBe('Strobe');
    expect(channel.getCapability(103).parameters.strobeEffect).toBe('Strobe');
  });

  it('selects the Open capability at [104,107] right after the strobe range', () => {
    expect(channel.getCapability(104).parameters.strobeEffect).toBe('Open');
    expect(channel.getCapability(107).parameters.strobeEffect).toBe('Open');
  });

  it('selects the final Open capability at the top boundary [252,255]', () => {
    expect(channel.getCapability(252).parameters.strobeEffect).toBe('Open');
    expect(channel.getCapability(255).parameters.strobeEffect).toBe('Open');
  });

  it('returns undefined for a DMX value outside every capability range', () => {
    expect(channel.getCapability(256)).toBeUndefined();
  });
});
