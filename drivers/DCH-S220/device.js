'use strict';

const Homey = require('homey');
const DchS220Client = require('../../lib/dlink/devices/DchS220Client');
const { matchesStoredDiscovery } = require('../../lib/dlink/hnap/HnapDiscovery');

function endpointFromAddress(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const url = new URL(text.includes('://') ? text : 'http://' + text);
  if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/'
    || url.search || url.hash) throw new Error('Invalid manual HTTP address.');
  return { address: url.hostname, port: Number(url.port || 80) };
}

class DchS220Device extends Homey.Device {
  async onInit() {
    this._client = null;
    this._endpoint = null;
    this._timer = null;
    this._closed = false;
    this._failures = 0;

    this.registerCapabilityListener('onoff', async value => {
      if (!this._client) throw new Error('Siren is not connected.');
      if (value) {
        await this.playSound(this.getSetting('sound_type') || '4');
      } else {
        await this.stopSound();
      }
    });
    await this.setUnavailable('Connecting to DCH-S220...');
    await this.restartConnection();
  }

  onDiscoveryResult(result) {
    if (this.getSetting('manual_address')) return false;
    return matchesStoredDiscovery(this, result);
  }

  async onDiscoveryAvailable(result) {
    if (!this.getSetting('manual_address')) await this._connect({ address: result.address, port: result.port || 80 });
  }

  async onDiscoveryAddressChanged(result) {
    if (!this.getSetting('manual_address')) await this._connect({ address: result.address, port: result.port || 80 });
  }

  async onSettings({ newSettings, changedKeys }) {
    if (changedKeys.includes('manual_address') && newSettings.manual_address) {
      endpointFromAddress(newSettings.manual_address);
    }
    if (changedKeys.some(key => ['manual_address', 'pincode', 'username'].includes(key))) {
      await this.restartConnection(newSettings);
    } else if (changedKeys.includes('poll_seconds')) {
      this._schedule();
    }
  }

  async onUninit() {
    this._closed = true;
    this._clearTimer();
    this._client = null;
  }

  _clearTimer() {
    if (this._timer) this.homey.clearTimeout(this._timer);
    this._timer = null;
  }

  _discoveredEndpoint() {
    const id = this.getStoreValue('discoveryId');
    if (!id) return null;
    try {
      const results = Object.values(this.driver.getDiscoveryStrategy().getDiscoveryResults());
      const entry = results.find(r => String(r.id) === String(id));
      return entry ? { address: entry.address, port: entry.port || 80 } : null;
    } catch (error) {
      this.error('[DCH-S220] Discovery lookup failed:', error.message);
      return null;
    }
  }

  async restartConnection(settings = this.getSettings()) {
    this._clearTimer();
    this._client = null;
    this._endpoint = null;
    const endpoint = endpointFromAddress(settings.manual_address) || this._discoveredEndpoint();
    if (!endpoint) {
      await this.setUnavailable('Waiting for discovery; set a manual IP address if needed.');
      return;
    }
    await this._connect(endpoint, settings);
  }

  async _connect(endpoint, settings = this.getSettings()) {
    if (this._closed) return;
    if (!settings.pincode) {
      await this.setUnavailable('DCH-S220 PIN missing; enter it in advanced settings.');
      return;
    }
    const changed = !this._endpoint
      || this._endpoint.address !== endpoint.address || this._endpoint.port !== endpoint.port;
    if (changed || !this._client) {
      this._endpoint = { ...endpoint };
      this._client = new DchS220Client({
        ...endpoint, username: settings.username || 'admin',
        password: settings.pincode, timeout: 6000,
      });
    }
    try {
      await this._updateState();
    } catch (error) {
      await this._onFailure(error);
    } finally {
      this._schedule();
    }
  }

  _schedule() {
    this._clearTimer();
    if (this._closed || !this._client) return;
    const configured = Number(this.getSetting('poll_seconds'));
    const period = Number.isFinite(configured) ? Math.min(3600, Math.max(10, configured)) : 30;
    this._timer = this.homey.setTimeout(async () => {
      try {
        await this._updateState();
      } catch (error) {
        await this._onFailure(error);
      } finally {
        this._schedule();
      }
    }, period * 1000);
  }

  async _updateState() {
    if (!this._client) throw new Error('DCH-S220 client unavailable.');
    const playing = await this._client.isPlaying();
    if (this.getCapabilityValue('onoff') !== playing) {
      await this.setCapabilityValue('onoff', playing);
    }
    this._failures = 0;
    await this.setAvailable();
    return playing;
  }

  async _onFailure(error) {
    this._failures++;
    this.error('[DCH-S220] HNAP error:', error?.message || String(error));
    if (this._failures >= 3) await this.setUnavailable('Unable to reach DCH-S220; retrying.');
  }

  async playSound(sound) {
    if (!this._client) throw new Error('DCH-S220 unavailable.');
    await this._client.play({
      sound: Number(sound),
      volume: Number(this.getSetting('volume') ?? 50),
      duration: Number(this.getSetting('duration') ?? 15),
    });
    await this.setCapabilityValue('onoff', true);
    await this.setAvailable();
    return true;
  }

  async stopSound() {
    if (!this._client) throw new Error('DCH-S220 unavailable.');
    await this._client.stop();
    await this.setCapabilityValue('onoff', false);
    return true;
  }
}

module.exports = DchS220Device;
