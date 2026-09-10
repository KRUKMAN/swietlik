import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

// eslint-disable-next-line import/first
import axios from 'axios';
// eslint-disable-next-line import/first
import { fetchOFL, clearOFLCache } from '@/mcp-bridge/ofl';

beforeEach(() => {
  clearOFLCache();
  axios.get.mockReset();
});

describe('fetchOFL', () => {
  it('fetches the per-fixture OFL JSON from the static fixtures path', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Sharpy', modes: [] } });

    const data = await fetchOFL('clay-paky', 'sharpy');

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toMatch(/fixtures\/clay-paky\/sharpy\.json$/);
    expect(data).toEqual({ name: 'Sharpy', modes: [] });
  });

  it('tolerates a model name that already carries the .json suffix', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Sharpy' } });
    await fetchOFL('clay-paky', 'sharpy.json');
    expect(axios.get.mock.calls[0][0]).toMatch(/fixtures\/clay-paky\/sharpy\.json$/);
  });

  it('memoises per manufacturer/model so a second patch costs no request', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Sharpy' } });

    await fetchOFL('clay-paky', 'sharpy');
    await fetchOFL('clay-paky', 'sharpy');

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('hands out an independent deep copy each call', async () => {
    axios.get.mockResolvedValue({ data: { modes: [{ name: 'Standard', channels: ['Dimmer'] }] } });

    const first = await fetchOFL('clay-paky', 'sharpy');
    first.modes[0].channels.push('MUTATED');
    const second = await fetchOFL('clay-paky', 'sharpy');

    expect(second.modes[0].channels).toEqual(['Dimmer']);
  });

  it('does not cache a failed fetch', async () => {
    axios.get.mockRejectedValueOnce(new Error('404'));
    await expect(fetchOFL('nope', 'nope')).rejects.toThrow(
      'Could not load OFL definition for nope/nope: 404',
    );

    axios.get.mockResolvedValue({ data: { name: 'Later' } });
    await expect(fetchOFL('nope', 'nope')).resolves.toEqual({ name: 'Later' });
  });

  it('rejects a response with no usable payload', async () => {
    axios.get.mockResolvedValue({ data: null });
    await expect(fetchOFL('clay-paky', 'sharpy')).rejects.toThrow(
      'Could not load OFL definition for clay-paky/sharpy: empty response',
    );
  });

  it('clearOFLCache forces a refetch', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Sharpy' } });
    await fetchOFL('clay-paky', 'sharpy');
    clearOFLCache();
    await fetchOFL('clay-paky', 'sharpy');
    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});
