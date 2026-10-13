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
  async onInit() {
    this.log('[DCH-S220] Driver initialized');
  }

  async onPair(session) {
    this.log('[DCH-S220][pair] pairing started');
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
      this.log('[DCH-S220][pair] showView', view);
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
        const failures = probes.filter(x => x.status === 'rejected');
        if (failures.length) {
          this.log('[DCH-S220][pair] HNAP probes failed',
            failures.map(x => x.reason?.message || String(x.reason)));
        }
        this.log('[DCH-S220][pair] discovery complete', JSON.stringify({
          mdnsResults: results.length,
          compatibleDevices: choices.length,
          probeFailures: failures.length,
        }));
        await session.showView(choices.length ? 'list_devices' : 'add_by_ip');
      } else if (view === 'authenticate' && !selected && address) {
        try {
          endpoint = parseAddress(address);
          this.log('[DCH-S220][pair] probing manual endpoint', JSON.stringify(endpoint));
          const result = await probe({ id: 'manual:' + endpoint.address, ...endpoint });
          selected = result.candidate;
          if (existing.has(String(selected.data.id))) throw new Error('This DCH-S220 is already paired.');
          selected.store.manual = true;
          delete selected.store.discoveryId;
          selected.store.firmware = String(result.info.FirmwareVersion || '');
          this.log('[DCH-S220][pair] manual endpoint identified', JSON.stringify({
            address: endpoint.address,
            port: endpoint.port,
            model: selected.store.model,
            firmware: selected.store.firmware,
          }));
        } catch (error) {
          this.error('[DCH-S220][pair] manual probe failed',
            error?.name || 'Error', error?.message || String(error));
          endpoint = null;
          selected = null;
          await session.showView('add_by_ip');
          await session.emit('alert', error.message);
          return;
        }
      }
      if (view === 'authenticate' && (!selected || !endpoint)) {
        this.error('[DCH-S220][pair] no device selected before authentication',
          JSON.stringify({
            manualAddressProvided: Boolean(address),
            selectedDevice: Boolean(selected),
            hasEndpoint: Boolean(endpoint),
          }));
        await session.showView(choices.length ? 'list_devices' : 'add_by_ip');
        if (!choices.length && !address) {
          await session.emit('alert', 'Enter the local IP address or hostname of your DCH-S220.');
        }
        return;
      }
    });

    session.setHandler('list_devices', async () => choices);
    session.setHandler('list_devices_selection', async values => {
      const device = Array.isArray(values) ? values[values.length - 1] : null;
      if (!device) {
        this.log('[DCH-S220][pair] no discovered device selected');
        return;
      }
      selected = device;
      endpoint = found.get(String(device.data.id)) || null;
      this.log('[DCH-S220][pair] selected discovered device', JSON.stringify({
        id: selected.data.id,
        address: endpoint?.address || null,
        port: endpoint?.port || null,
      }));
    });
    session.setHandler('getManualAddress', async () => address);
    session.setHandler('setManualAddress', async value => {
      address = String(value || '').trim();
      selected = null;
      endpoint = null;
      this.log('[DCH-S220][pair] manual address updated',
        JSON.stringify({ provided: Boolean(address) }));
      return true;
    });
    session.setHandler('pincode', async code => {
      const pin = pinString(code).trim();
      if (!/^\d{6}$/.test(pin)) {
        this.log('[DCH-S220][pair] rejected malformed PIN');
        return false;
      }
      if (!selected || !endpoint) {
        this.error('[DCH-S220][pair] authentication requested without endpoint');
        return false;
      }
      try {
        const client = new DchS220Client({ ...endpoint, username: 'admin', password: pin });
        await client.authenticate();
        const playing = await client.isPlaying();
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
        this.log('[DCH-S220][pair] authentication successful', JSON.stringify({
          id: selected.data.id,
          model: selected.store.model,
          firmware: selected.store.firmware,
          initialState: playing,
        }));
        await session.showView('add_device');
        return true;
      } catch (error) {
        this.error('[DCH-S220][pair] authentication failed',
          error?.name || 'Error', error?.message || String(error));
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
