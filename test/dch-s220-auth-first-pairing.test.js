'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const attempts = [];
let metadata = {
  ModelName: 'DCH-S220',
  VendorName: 'D-Link',
  DeviceName: 'Hall siren',
  DeviceMacId: '00:11:22:33:44:55',
  FirmwareVersion: 'V1.22b03',
};
let preAuthError = true;
let failLogin = false;
let failAuthedMetadata = false;

class FakeDchS220Client {
  constructor(opts) {
    this.opts = opts;
    this.loggedIn = false;
    attempts.push({ stage: 'constructor', address: opts.address });
  }
  async authenticate() {
    attempts.push({ stage: 'login' });
    if (failLogin) throw new Error('HNAP login rejected');
    this.loggedIn = true;
  }
  async getDeviceInfo() {
    attempts.push({ stage: 'metadata', authenticated: this.loggedIn });
    if (!this.loggedIn || failAuthedMetadata) throw new Error('GetDeviceSettings failed: ERROR');
    return metadata;
  }
  async isPlaying() {
    attempts.push({ stage: 'playing', authenticated: this.loggedIn });
    if (!this.loggedIn) throw new Error('Not authenticated');
    return false;
  }
}

const originalLoad = Module._load;
let DriverClass;
try {
  Module._load = function load(request, parent, isMain) {
    if (request === 'homey') return { Driver: class {} };
    if (request === '../../lib/dlink/devices/DchS220Client') return FakeDchS220Client;
    if (request === '../../lib/dlink/hnap/HnapDiscovery') {
      const { normalizeMac } = originalLoad.call(this, request, parent, isMain);
      return {
        normalizeMac,
        probeDiscoveryResult: async () => {
          attempts.push({ stage: 'unauth-probe' });
          if (preAuthError) throw new Error('GetDeviceSettings failed: ERROR');
          return {
            info: metadata,
            candidate: {
              name: 'Hall siren',
              data: { id: '00:11:22:33:44:55' },
              store: { discoveryId: 'mdns:siren', model: 'DCH-S220' },
            },
          };
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  DriverClass = require('../drivers/DCH-S220/driver');
} finally {
  Module._load = originalLoad;
}

function setup(discovery = {}, deviceIds = []) {
  attempts.length = 0;
  metadata = {
    ModelName: 'DCH-S220', VendorName: 'D-Link', DeviceName: 'Hall siren',
    DeviceMacId: '00:11:22:33:44:55', FirmwareVersion: 'V1.22b03',
  };
  preAuthError = true;
  failLogin = false;
  failAuthedMetadata = false;
  const handlers = new Map();
  const views = [];
  const errors = [];
  const logs = [];
  const alerts = [];
  const driver = new DriverClass();
  driver.log = (...args) => logs.push(args.join(' '));
  driver.error = (...args) => errors.push(args.join(' '));
  driver.getDevices = () => deviceIds.map(id => ({ getData: () => ({ id }) }));
  driver.getDiscoveryStrategy = () => ({ getDiscoveryResults: () => discovery });
  const session = {
    setHandler: (name, handler) => handlers.set(name, handler),
    showView: async view => views.push(view),
    emit: async (event, value) => { if (event === 'alert') alerts.push(value); },
  };
  return { driver, session, handlers, views, errors, logs, alerts };
}

test('DCH-S220 A2/V1.22b03: manual address does not probe until after PIN login', async () => {
  const s = setup();
  await s.driver.onPair(s.session);
  await s.handlers.get('showView')('discover');
  await s.handlers.get('setManualAddress')('192.168.1.42');
  await s.handlers.get('showView')('authenticate');
  assert.deepEqual(attempts, []);
  assert.equal(await s.handlers.get('pincode')('123456'), true);
  assert.deepEqual(attempts.map(x => x.stage), ['constructor', 'login', 'metadata', 'playing']);
  assert.equal(attempts[2].authenticated, true);
  assert.equal(s.views.at(-1), 'add_device');
  const device = await s.handlers.get('getDevice')();
  assert.equal(device.data.id, '00:11:22:33:44:55');
  assert.equal(device.store.manual, true);
  assert.equal(device.settings.manual_address, '192.168.1.42');
  assert.doesNotMatch([...s.errors, ...s.logs].join(' '), /123456/);
});

test('DCH-S220 A2/V1.22b03: PIN-gated mDNS candidate is verified after login', async () => {
  const s = setup({ 'mdns:siren': { id: 'mdns:siren', address: '192.168.1.44', port: 80 } });
  await s.driver.onPair(s.session);
  await s.handlers.get('showView')('discover');
  assert.equal(s.views.at(-1), 'list_devices');
  const offered = await s.handlers.get('list_devices')();
  assert.equal(offered.length, 1);
  assert.match(offered[0].name, /PIN required/);
  await s.handlers.get('list_devices_selection')(offered);
  await s.handlers.get('showView')('authenticate');
  assert.equal(await s.handlers.get('pincode')('123456'), true);
  const device = await s.handlers.get('getDevice')();
  assert.equal(device.data.id, '00:11:22:33:44:55');
  assert.equal(device.store.discoveryId, 'mdns:siren');
  assert.equal(device.settings.manual_address, '');
  assert.deepEqual(attempts.map(x => x.stage), ['unauth-probe', 'constructor', 'login', 'metadata', 'playing']);
});

test('DCH-S220: reject other HNAP models even with a valid PIN', async () => {
  const s = setup();
  metadata = { ModelName: 'DSP-W215', VendorName: 'D-Link', DeviceMacId: '00:11:22:33:44:55' };
  await s.driver.onPair(s.session);
  await s.handlers.get('setManualAddress')('192.168.1.44');
  await s.handlers.get('showView')('authenticate');
  assert.equal(await s.handlers.get('pincode')('123456'), false);
  assert.match(s.errors.join(' '), /not a D-Link DCH-S220/);
  await assert.rejects(s.handlers.get('getDevice')(), /Authenticate/);
});

test('DCH-S220: reject duplicate only after canonical ID is available', async () => {
  const s = setup({}, ['00:11:22:33:44:55']);
  await s.driver.onPair(s.session);
  await s.handlers.get('setManualAddress')('192.168.1.44');
  await s.handlers.get('showView')('authenticate');
  assert.equal(await s.handlers.get('pincode')('123456'), false);
  assert.match(s.errors.join(' '), /already paired/);
});

test('DCH-S220: firmware still rejecting authenticated metadata fails safely', async () => {
  const s = setup();
  failAuthedMetadata = true;
  await s.driver.onPair(s.session);
  await s.handlers.get('setManualAddress')('192.168.1.44');
  await s.handlers.get('showView')('authenticate');
  assert.equal(await s.handlers.get('pincode')('123456'), false);
  assert.deepEqual(attempts.map(x => x.stage), ['constructor', 'login', 'metadata']);
  assert.match(s.errors.join(' '), /GetDeviceSettings failed: ERROR/);
});

test('DCH-S220: invalid PIN is not logged or submitted', async () => {
  const s = setup();
  await s.driver.onPair(s.session);
  await s.handlers.get('setManualAddress')('192.168.1.44');
  await s.handlers.get('showView')('authenticate');
  assert.equal(await s.handlers.get('pincode')('bad-pin'), false);
  assert.deepEqual(attempts, []);
  assert.doesNotMatch([...s.errors, ...s.logs].join(' '), /bad-pin/);
});

test('DCH-S220: existing unauthenticated discovery path remains usable', async () => {
  const s = setup({ 'mdns:siren': { id: 'mdns:siren', address: '192.168.1.44', port: 80 } });
  preAuthError = false;
  await s.driver.onPair(s.session);
  await s.handlers.get('showView')('discover');
  const offered = await s.handlers.get('list_devices')();
  assert.equal(offered.length, 1);
  assert.equal(offered[0].name, 'Hall siren');
  await s.handlers.get('list_devices_selection')(offered);
  await s.handlers.get('showView')('authenticate');
  assert.equal(await s.handlers.get('pincode')('123456'), true);
  assert.equal((await s.handlers.get('getDevice')()).data.id, '00:11:22:33:44:55');
});
