'use strict';

const HnapClient = require('./HnapClient');
const { HnapProtocolError } = require('./HnapErrors');

function normalizeMac(value) {
  if (!value) return null;
  const hex = String(value).replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g).join(':');
}

function matchesStoredDiscovery(device, discoveryResult) {
  if (!device || !discoveryResult) return false;

  const storedDiscoveryId = typeof device.getStoreValue === 'function'
    ? device.getStoreValue('discoveryId')
    : null;

  return storedDiscoveryId != null
    && String(storedDiscoveryId) === String(discoveryResult.id);
}

async function probeDiscoveryResult(discoveryResult, {
  timeout = 4000,
  logger = null,
} = {}) {
  if (!discoveryResult || !discoveryResult.address) {
    throw new TypeError('A Homey discovery result with an address is required');
  }

  const client = new HnapClient({
    address: discoveryResult.address,
    port: discoveryResult.port || 80,
    protocol: 'http',
    timeout,
    logger,
  });

  const info = await client.getDeviceSettings({ authenticated: false });
  const vendor = String(info.VendorName || '');

  if (vendor && !/d-?link/i.test(vendor)) {
    throw new HnapProtocolError('Discovered HNAP device is not D-Link: ' + vendor);
  }

  const mac = normalizeMac(info.DeviceMacId);
  const model = info.ModelName || info.ModelDescription || 'D-Link HNAP device';
  const name = info.DeviceName || model;

  return {
    client,
    info,
    candidate: {
      name,
      data: {
        id: mac || 'hnap:' + discoveryResult.id,
      },
      store: {
        discoveryId: String(discoveryResult.id),
        transport: 'hnap',
        model: String(info.ModelName || ''),
        mac: mac || '',
      },
    },
  };
}

module.exports = {
  normalizeMac,
  matchesStoredDiscovery,
  probeDiscoveryResult,
};
