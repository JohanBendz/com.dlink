'use strict';

const Homey = require('homey');

const DspW215Client = require('../../lib/dlink/devices/DspW215Client');
const {
  matchesStoredDiscovery,
} = require('../../lib/dlink/hnap/HnapDiscovery');

const DEFAULT_STATE_POLL_SECONDS = 60;
const DEFAULT_TELEMETRY_POLL_SECONDS = 300;
const MAX_STATE_BACKOFF_SECONDS = 15 * 60;

function parseEndpoint(input) {
  const value = String(input || '').trim();
  if (!value) return null;

  let url;
  try {
    url = new URL(value.includes('://') ? value : 'http://' + value);
  } catch (error) {
    throw new Error('The Manual address is not valid.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP or HTTPS addresses are supported.');
  }

  return {
    address: url.hostname,
    port: url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80),
    protocol: url.protocol.replace(':', ''),
  };
}

class DspW215Device extends Homey.Device {

  async onInit() {
    this._client = null;
    this._endpoint = null;
    this._stateTimer = null;
    this._telemetryTimer = null;
    this._stateFailures = 0;
    this._uninitialized = false;
    this._lastModuleLayout = null;

    this.registerCapabilityListener('onoff', async value => {
      if (!this._client) {
        throw new Error('DSP-W215 is not connected.');
      }

      this._diag('command', { on: Boolean(value) });

      try {
        await this._client.setState(Boolean(value));
        await this.setCapabilityValue('onoff', Boolean(value));
        this._stateFailures = 0;
        await this.setAvailable();
      } catch (error) {
        this._logError('command_failed', error);
        throw error;
      }
    });

    await this.setUnavailable('Waiting for DSP-W215 connection...');

    const manualEndpoint = this._getManualEndpoint();
    if (manualEndpoint) {
      await this._connect(manualEndpoint, 'manual_setting');
      return;
    }

    const discoveryResult = this._getCurrentDiscoveryResult();
    if (discoveryResult) {
      await this._useDiscoveryResult(discoveryResult, 'startup_discovery');
    } else {
      this._diag('startup_waiting_for_discovery', {
        discoveryId: this.getStoreValue('discoveryId') || null,
      });
    }
  }

  onDiscoveryResult(discoveryResult) {
    if (this.getSetting('manual_address')) return false;
    return matchesStoredDiscovery(this, discoveryResult);
  }

  async onDiscoveryAvailable(discoveryResult) {
    if (this.getSetting('manual_address')) return;
    await this._useDiscoveryResult(discoveryResult, 'discovery_available');
  }

  async onDiscoveryAddressChanged(discoveryResult) {
    if (this.getSetting('manual_address')) return;
    await this._useDiscoveryResult(discoveryResult, 'discovery_address_changed');
  }

  async onDiscoveryLastSeenChanged(discoveryResult) {
    if (this.getSetting('manual_address')) return;

    this._diag('discovery_last_seen', {
      address: discoveryResult.address,
      port: discoveryResult.port || 80,
      lastSeen: discoveryResult.lastSeen || null,
    });
  }

  async onSettings({ newSettings, changedKeys }) {
    if (changedKeys.includes('manual_address') && newSettings.manual_address) {
      parseEndpoint(newSettings.manual_address);
    }

    const reconnectKeys = [
      'username',
      'pincode',
      'manual_address',
    ];

    const pollingKeys = [
      'poll_state_seconds',
      'poll_telemetry_seconds',
    ];

    if (changedKeys.some(key => reconnectKeys.includes(key))) {
      this._diag('settings_reconnect', { changedKeys });
      await this.restartConnection(newSettings);
      return;
    }

    if (changedKeys.some(key => pollingKeys.includes(key))) {
      this._diag('settings_polling_changed', {
        stateSeconds: newSettings.poll_state_seconds,
        telemetrySeconds: newSettings.poll_telemetry_seconds,
      });
      this._schedulePolling();
    }
  }

  async onUninit() {
    this._uninitialized = true;
    this._clearPolling();
    this._client = null;
    this._endpoint = null;
  }

  async restartConnection(settingsOverride = null) {
    this._clearPolling();
    this._client = null;
    this._endpoint = null;
    this._stateFailures = 0;

    const settings = settingsOverride || this.getSettings();
    const manualEndpoint = parseEndpoint(settings.manual_address);

    if (manualEndpoint) {
      await this._connect(
        manualEndpoint,
        'manual_reconnect',
        settings,
      );
      return;
    }

    const discoveryResult = this._getCurrentDiscoveryResult();
    if (discoveryResult) {
      await this._useDiscoveryResult(
        discoveryResult,
        'discovery_reconnect',
        settings,
      );
      return;
    }

    await this.setUnavailable('Waiting for DSP-W215 discovery...');
  }

  _getManualEndpoint() {
    return parseEndpoint(this.getSetting('manual_address'));
  }

  _getCurrentDiscoveryResult() {
    const discoveryId = this.getStoreValue('discoveryId');
    if (!discoveryId) return null;

    try {
      const strategy = this.getDriver().getDiscoveryStrategy();
      const results = Object.values(strategy.getDiscoveryResults());

      return results.find(
        result => String(result.id) === String(discoveryId),
      ) || null;
    } catch (error) {
      this._logError('discovery_lookup_failed', error);
      return null;
    }
  }

  async _useDiscoveryResult(discoveryResult, reason, settingsOverride = null) {
    const endpoint = {
      address: discoveryResult.address,
      port: discoveryResult.port || 80,
      protocol: 'http',
    };

    await this._connect(endpoint, reason, settingsOverride);
  }

  async _connect(endpoint, reason, settingsOverride = null) {
    if (this._uninitialized) return;

    const settings = settingsOverride || this.getSettings();
    const username = settings.username || 'admin';
    const pincode = settings.pincode || '';

    if (!pincode) {
      await this.setUnavailable('DSP-W215 PIN is missing. Use Repair.');
      return;
    }

    const endpointChanged = !this._endpoint
      || this._endpoint.address !== endpoint.address
      || this._endpoint.port !== endpoint.port
      || this._endpoint.protocol !== endpoint.protocol;

    if (endpointChanged || !this._client) {
      this._endpoint = { ...endpoint };
      this._client = new DspW215Client({
        ...endpoint,
        username,
        password: pincode,
        timeout: 6000,
      });

      this._diag('connect', {
        reason,
        address: endpoint.address,
        port: endpoint.port,
        protocol: endpoint.protocol,
        model: this.getStoreValue('model') || 'DSP-W215',
        firmware: this.getStoreValue('firmware') || null,
        hardware: this.getStoreValue('hardware') || null,
      });
    }

    try {
      await this._refreshState('connect');
      await this._refreshTelemetry('connect');
      this._schedulePolling();
    } catch (error) {
      this._handleStateFailure(error, 'connect');
      this._schedulePolling();
    }
  }

  _schedulePolling() {
    if (this._uninitialized) return;

    if (this._stateTimer) {
      this.homey.clearTimeout(this._stateTimer);
      this._stateTimer = null;
    }

    if (this._telemetryTimer) {
      this.homey.clearTimeout(this._telemetryTimer);
      this._telemetryTimer = null;
    }

    const stateSeconds = this._getPositiveNumberSetting(
      'poll_state_seconds',
      DEFAULT_STATE_POLL_SECONDS,
    );

    const telemetrySeconds = this._getPositiveNumberSetting(
      'poll_telemetry_seconds',
      DEFAULT_TELEMETRY_POLL_SECONDS,
    );

    this._scheduleStatePoll(stateSeconds);
    this._scheduleTelemetryPoll(telemetrySeconds);
  }

  _scheduleStatePoll(baseSeconds) {
    if (this._uninitialized) return;

    const backoffMultiplier = Math.pow(
      2,
      Math.max(0, Math.min(this._stateFailures - 1, 4)),
    );

    const delaySeconds = Math.min(
      baseSeconds * backoffMultiplier,
      MAX_STATE_BACKOFF_SECONDS,
    );

    this._stateTimer = this.homey.setTimeout(async () => {
      try {
        await this._refreshState('poll');
      } catch (error) {
        this._handleStateFailure(error, 'state_poll');
      } finally {
        if (!this._uninitialized) {
          this._scheduleStatePoll(baseSeconds);
        }
      }
    }, delaySeconds * 1000);
  }

  _scheduleTelemetryPoll(seconds) {
    if (this._uninitialized) return;

    this._telemetryTimer = this.homey.setTimeout(async () => {
      try {
        await this._refreshTelemetry('poll');
      } catch (error) {
        this._logError('telemetry_poll_failed', error);
      } finally {
        if (!this._uninitialized) {
          this._scheduleTelemetryPoll(seconds);
        }
      }
    }, seconds * 1000);
  }

  _clearPolling() {
    if (this._stateTimer) {
      this.homey.clearTimeout(this._stateTimer);
      this._stateTimer = null;
    }

    if (this._telemetryTimer) {
      this.homey.clearTimeout(this._telemetryTimer);
      this._telemetryTimer = null;
    }
  }

  async _refreshState(source) {
    if (!this._client) {
      throw new Error('DSP-W215 client is not initialized.');
    }

    const value = await this._client.getState();

    if (this.getCapabilityValue('onoff') !== value) {
      await this.setCapabilityValue('onoff', value);
      this._diag('state_changed', { source, on: value });
    }

    this._stateFailures = 0;
    await this.setAvailable();

    return value;
  }

  async _refreshTelemetry(source) {
    if (!this._client) return;

    const [powerResult, temperatureResult] = await Promise.allSettled([
      this._client.getPower(),
      this._client.getTemperature(),
    ]);

    if (powerResult.status === 'fulfilled') {
      await this.setCapabilityValue('measure_power', powerResult.value);
    } else {
      this._logError('power_read_failed', powerResult.reason);
    }

    if (temperatureResult.status === 'fulfilled') {
      await this.setCapabilityValue(
        'measure_temperature',
        temperatureResult.value,
      );
    } else {
      this._logError('temperature_read_failed', temperatureResult.reason);
    }

    const moduleLayout = JSON.stringify(this._client.moduleIds);
    if (moduleLayout !== this._lastModuleLayout) {
      this._lastModuleLayout = moduleLayout;
      this._diag('module_layout', {
        source,
        ...this._client.moduleIds,
      });
    }

    if (
      powerResult.status === 'fulfilled'
      || temperatureResult.status === 'fulfilled'
    ) {
      this._diag('telemetry', {
        source,
        power: powerResult.status === 'fulfilled'
          ? powerResult.value
          : null,
        temperature: temperatureResult.status === 'fulfilled'
          ? temperatureResult.value
          : null,
      });
    }
  }

  _handleStateFailure(error, source) {
    this._stateFailures += 1;

    this._logError(source + '_failed', error, {
      consecutiveFailures: this._stateFailures,
    });

    if (this._stateFailures >= 3) {
      this.setUnavailable(
        'Unable to communicate with DSP-W215. Homey will keep retrying.',
      ).catch(this.error);
    }
  }

  _getPositiveNumberSetting(id, fallback) {
    const value = Number(this.getSetting(id));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  _diag(event, details = {}) {
    if (!this.getSetting('diagnostic_logging')) return;

    this.log(
      '[DSP-W215][diag]',
      event,
      JSON.stringify(details),
    );
  }

  _logError(event, error, details = {}) {
    this.error(
      '[DSP-W215][diag]',
      event,
      JSON.stringify({
        ...details,
        errorName: error?.name || 'Error',
        errorMessage: error?.message || String(error),
        statusCode: error?.statusCode || null,
      }),
    );
  }

}

module.exports = DspW215Device;
