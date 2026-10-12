'use strict';

const Homey = require('homey');
const DchS220Client = require('../../lib/dlink/devices/DchS220Client');
const { probeDiscoveryResult } = require('../../lib/dlink/hnap/HnapDiscovery');

const MODEL = /DCH-S220/i;

function parseAddress(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('Enter a local IP address or hostname.');
  const url = new URL(text.includes('://') ? text : 'http://' + text);
  if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/'
    || url.search || url.hash) throw new Error('Enter only an HTTP IP address or hostname.');
  return { address: url.hostname, port: Number(url.port || 80) };
}

function pinString(value) {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (Array.isArray(value)) return value.join('');
  return String(value || '');
}

class DchS220Driver extends Homey.Driver {
  async onPair(session) {
    const existing = new Set(this.getDevices().map(device => String(device.getData().id)));
    const found = new Map();
    let choices = [];
    let selected = null;
    let endpoint = null;
    let address = '';

    async function probe(item) {
      const probeResult = await probeDiscoveryResult(item, { timeout: 5000 });
      const model = String(probeResult.info.ModelName || probeResult.info.ModelDescription || '');
      if (!MODEL.test(model)) throw new Error('The device is not a DCH-S220: ' + model);
      return probeResult;
    }

    session.setHandler('showView', async view => {
      if (view === 'discover') {
        const results = Object.values(this.getDiscoveryStrategy().getDiscoveryResults());
        const probes = await Promise.allSettled(results.map(async item => {
          const result = await probe(item);
          const id = String(result.candidate.data.id);
          if (existing.has(id)) return null;
          found.set(id, { address: item.address, port: item.port || 80 });
          result.candidate.store.firmware = String(result.info.FirmwareVersion || '');
          return result.candidate;
        }));
        choices = probes.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
        await session.showView(choices.length ? 'list_devices' : 'add_by_ip');
      } else if (view === 'authenticate' && !selected && address) {
        try {
          endpoint = parseAddress(address);
          const result = await probe({ id: 'manual:' + endpoint.address, ...endpoint });
          selected = result.candidate;
          if (existing.has(String(selected.data.id))) throw new Error('This DCH-S220 is already paired.');
          selected.store.manual = true;
          delete selected.store.discoveryId;
          selected.store.firmware = String(result.info.FirmwareVersion || '');
        } catch (error) {
          endpoint = null;
          selected = null;
          await session.showView('add_by_ip');
          await session.emit('alert', error.message);
          return;
        }
      }
      if (view === 'authenticate' && (!selected || !endpoint)) {
        await session.showView(choices.length ? 'list_devices' : 'add_by_ip');
      }
    });

    session.setHandler('list_devices', async () => choices);
    session.setHandler('list_devices_selection', async values => {
      const device = Array.isArray(values) ? values[values.length - 1] : null;
      if (!device) return;
      selected = device;
      endpoint = found.get(String(device.data.id)) || null;
    });
    session.setHandler('getManualAddress', async () => address);
    session.setHandler('setManualAddress', async value => {
      address = String(value || '').trim();
      selected = null;
      endpoint = null;
      return true;
    });
    session.setHandler('pincode', async code => {
      const pin = pinString(code).trim();
      if (!/^\d{6}$/.test(pin) || !selected || !endpoint) return false;
      try {
        const client = new DchS220Client({ ...endpoint, username: 'admin', password: pin });
        await client.authenticate();
        await client.isPlaying();
        selected.settings = {
          username: 'admin',
          pincode: pin,
          manual_address: selected.store.manual ? address : '',
          sound_type: '4',
          volume: 50,
          duration: 15,
          poll_seconds: 30,
          diagnostic_logging: false,
        };
        await session.showView('add_device');
        return true;
      } catch (error) {
        this.error('[DCH-S220] Pairing failed:', error.message);
        return false;
      }
    });
    session.setHandler('getDevice', async () => {
      if (!selected || !selected.settings) throw new Error('Authenticate the siren before adding it.');
      return selected;
    });
  }
}

module.exports = DchS220Driver;
