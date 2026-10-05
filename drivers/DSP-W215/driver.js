'use strict';

const Homey = require('homey');

const DspW215Client = require('../../lib/dlink/devices/DspW215Client');
const {
  probeDiscoveryResult,
} = require('../../lib/dlink/hnap/HnapDiscovery');

const MODEL_PATTERN = /DSP-W215/i;

function parseEndpoint(input) {
  const value = String(input || '').trim();
  if (!value) throw new Error('Enter an IP address or hostname.');

  let url;
  try {
    url = new URL(value.includes('://') ? value : 'http://' + value);
  } catch (error) {
    throw new Error('The IP address or hostname is not valid.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP or HTTPS addresses are supported.');
  }

  return {
    address: url.hostname,
    port: url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80),
    protocol: url.protocol.replace(':', ''),
    input: value,
  };
}

function pincodeToString(code) {
  if (Buffer.isBuffer(code)) return code.toString('utf8');
  if (Array.isArray(code)) return code.join('');
  return String(code || '');
}

class DspW215Driver extends Homey.Driver {

  async onInit() {
    this.log('[DSP-W215] Driver initialized');
  }

  async onPair(session) {
    const existingIds = new Set(
      this.getDevices().map(device => String(device.getData().id)),
    );

    const endpointByDeviceId = new Map();
    let devices = [];
    let pairingDevice = null;
    let pairingEndpoint = null;
    let pairingInfo = null;
    let manualAddress = '';

    const discoveryStrategy = this.getDiscoveryStrategy();

    session.setHandler('showView', async view => {
      this.log('[DSP-W215][pair] showView', view);

      if (view === 'discover') {
        const discoveryResults = Object.values(
          discoveryStrategy.getDiscoveryResults(),
        );

        const probes = await Promise.allSettled(
          discoveryResults.map(async result => {
            const probe = await probeDiscoveryResult(result, {
              timeout: 4000,
              logger: this,
            });

            const model = String(
              probe.info.ModelName
              || probe.info.ModelDescription
              || '',
            );

            if (!MODEL_PATTERN.test(model)) return null;
            if (existingIds.has(String(probe.candidate.data.id))) return null;

            endpointByDeviceId.set(String(probe.candidate.data.id), {
              address: result.address,
              port: result.port || 80,
              protocol: 'http',
            });

            probe.candidate.store.firmware = String(
              probe.info.FirmwareVersion || '',
            );
            probe.candidate.store.hardware = String(
              probe.info.HardwareVersion || '',
            );
            probe.candidate.store.hnapVersion = String(
              probe.info.HNAPVersion || '',
            );

            return probe.candidate;
          }),
        );

        devices = probes
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => result.value);

        const failed = probes.filter(result => result.status === 'rejected');
        if (failed.length > 0) {
          this.log(
            '[DSP-W215][pair] HNAP probes failed:',
            failed.map(result => result.reason?.message || String(result.reason)),
          );
        }

        this.log(
          '[DSP-W215][pair] discovery complete',
          JSON.stringify({
            mdnsResults: discoveryResults.length,
            compatibleDevices: devices.length,
            probeFailures: failed.length,
          }),
        );

        if (devices.length > 0) {
          await session.showView('list_devices');
        } else {
          await session.showView('add_by_ip');
        }
      }

      if (view === 'authenticate') {
        if (!pairingDevice && manualAddress) {
          try {
            const endpoint = parseEndpoint(manualAddress);
            const syntheticResult = {
              id: 'manual:' + endpoint.address + ':' + endpoint.port,
              address: endpoint.address,
              port: endpoint.port,
            };

            const probe = await probeDiscoveryResult(syntheticResult, {
              timeout: 5000,
              logger: this,
            });

            const model = String(
              probe.info.ModelName
              || probe.info.ModelDescription
              || '',
            );

            if (!MODEL_PATTERN.test(model)) {
              throw new Error(
                'The device at this address identifies as '
                + (model || 'an unknown model')
                + ', not DSP-W215.',
              );
            }

            pairingDevice = probe.candidate;
            delete pairingDevice.store.discoveryId;
            pairingDevice.store.manual = true;
            pairingDevice.store.firmware = String(
              probe.info.FirmwareVersion || '',
            );
            pairingDevice.store.hardware = String(
              probe.info.HardwareVersion || '',
            );
            pairingDevice.store.hnapVersion = String(
              probe.info.HNAPVersion || '',
            );

            pairingEndpoint = endpoint;
            pairingInfo = probe.info;

            this.log(
              '[DSP-W215][pair] manual endpoint identified',
              JSON.stringify({
                address: endpoint.address,
                port: endpoint.port,
                model,
                firmware: pairingDevice.store.firmware,
                hardware: pairingDevice.store.hardware,
              }),
            );
          } catch (error) {
            this.error('[DSP-W215][pair] manual probe failed', error);
            await session.showView('add_by_ip');
            await session.emit(
              'alert',
              error?.message || 'Unable to identify a DSP-W215 at this address.',
            );
          }
        }

        if (!pairingDevice || !pairingEndpoint) {
          this.error('[DSP-W215][pair] no device selected before authentication');
          await session.showView(
            devices.length > 0 ? 'list_devices' : 'add_by_ip',
          );
        }
      }
    });

    session.setHandler('list_devices', async () => devices);

    // This event is used by Athom's own Android TV LAN driver as well.
    session.setHandler('list_devices_selection', async selectedDevices => {
      const selected = Array.isArray(selectedDevices)
        ? selectedDevices[selectedDevices.length - 1]
        : null;

      if (!selected) return;

      pairingDevice = selected;
      pairingEndpoint = endpointByDeviceId.get(String(selected.data.id)) || null;

      this.log(
        '[DSP-W215][pair] selected discovered device',
        JSON.stringify({
          id: selected.data.id,
          name: selected.name,
          address: pairingEndpoint?.address || null,
          port: pairingEndpoint?.port || null,
        }),
      );
    });

    session.setHandler('getManualAddress', async () => manualAddress);

    session.setHandler('setManualAddress', async value => {
      manualAddress = String(value || '').trim();
      pairingDevice = null;
      pairingEndpoint = null;
      pairingInfo = null;
      return true;
    });

    session.setHandler('pincode', async code => {
      const pincode = pincodeToString(code).trim();

      if (!/^\d{6}$/.test(pincode)) {
        this.log('[DSP-W215][pair] rejected malformed PIN');
        return false;
      }

      if (!pairingDevice || !pairingEndpoint) {
        this.error('[DSP-W215][pair] authentication requested without endpoint');
        return false;
      }

      const username = 'admin';
      const client = new DspW215Client({
        address: pairingEndpoint.address,
        port: pairingEndpoint.port,
        protocol: pairingEndpoint.protocol || 'http',
        username,
        password: pincode,
        timeout: 6000,
      });

      try {
        await client.authenticate();
        const socket = await client.getSocketSettings();

        pairingDevice.settings = {
          username,
          pincode,
          manual_address: pairingDevice.store.manual
            ? manualAddress
            : '',
          poll_state_seconds: 60,
          poll_telemetry_seconds: 300,
          diagnostic_logging: true,
        };

        pairingDevice.store.firmware = String(
          pairingInfo?.FirmwareVersion
          || pairingDevice.store.firmware
          || '',
        );
        pairingDevice.store.hardware = String(
          pairingInfo?.HardwareVersion
          || pairingDevice.store.hardware
          || '',
        );

        this.log(
          '[DSP-W215][pair] authentication successful',
          JSON.stringify({
            id: pairingDevice.data.id,
            model: pairingDevice.store.model,
            firmware: pairingDevice.store.firmware,
            hardware: pairingDevice.store.hardware,
            initialState: socket.on,
          }),
        );

        await session.showView('add_device');
        return true;
      } catch (error) {
        this.error(
          '[DSP-W215][pair] authentication failed',
          error?.name || 'Error',
          error?.message || String(error),
        );
        return false;
      }
    });

    session.setHandler('getDevice', async () => {
      if (!pairingDevice) {
        throw new Error('No DSP-W215 has been selected.');
      }

      return pairingDevice;
    });
  }

  async onRepair(session, device) {
    let endpoint = null;
    let repairClient = null;

    const resolveEndpoint = () => {
      const settings = device.getSettings();
      if (settings.manual_address) {
        return parseEndpoint(settings.manual_address);
      }

      const discoveryId = device.getStoreValue('discoveryId');
      if (!discoveryId) return null;

      const results = Object.values(
        this.getDiscoveryStrategy().getDiscoveryResults(),
      );

      const result = results.find(
        item => String(item.id) === String(discoveryId),
      );

      if (!result) return null;

      return {
        address: result.address,
        port: result.port || 80,
        protocol: 'http',
      };
    };

    session.setHandler('showView', async view => {
      if (view !== 'repair_start') return;

      endpoint = resolveEndpoint();
      if (!endpoint) {
        throw new Error(
          'The DSP-W215 is not currently discoverable. '
          + 'Set a Manual address in Advanced settings and try Repair again.',
        );
      }

      repairClient = new DspW215Client({
        ...endpoint,
        username: device.getSetting('username') || 'admin',
        password: '',
        timeout: 6000,
      });

      await session.showView('authenticate');
    });

    session.setHandler('pincode', async code => {
      const pincode = pincodeToString(code).trim();
      if (!/^\d{6}$/.test(pincode) || !repairClient) return false;

      repairClient.setCredentials({
        username: device.getSetting('username') || 'admin',
        password: pincode,
      });

      try {
        await repairClient.authenticate();
        await repairClient.getSocketSettings();

        await device.setSettings({ pincode });
        if (typeof device.restartConnection === 'function') {
          await device.restartConnection();
        }

        this.log('[DSP-W215][repair] authentication successful');
        await session.done();
        return true;
      } catch (error) {
        this.error(
          '[DSP-W215][repair] authentication failed',
          error?.name || 'Error',
          error?.message || String(error),
        );
        return false;
      }
    });
  }

}

module.exports = DspW215Driver;
