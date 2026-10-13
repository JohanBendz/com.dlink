'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Pairing tests run without a Homey runtime. Only the Driver base class is mocked.
const originalLoad = Module._load;
let DchS220Driver;
let DspW215Driver;
try {
  Module._load = function load(request, parent, isMain) {
    if (request === 'homey') return { Driver: class {} };
    return originalLoad.call(this, request, parent, isMain);
  };
  DchS220Driver = require('../drivers/DCH-S220/driver');
  DspW215Driver = require('../drivers/DSP-W215/driver');
} finally {
  Module._load = originalLoad;
}

function setup(DriverClass) {
  const driver = new DriverClass();
  const logs = [];
  const errors = [];
  const views = [];
  const alerts = [];
  const handlers = new Map();

  driver.log = (...args) => logs.push(args.join(' '));
  driver.error = (...args) => errors.push(args.join(' '));
  driver.getDevices = () => [];
  driver.getDiscoveryStrategy = () => ({
    getDiscoveryResults: () => ({}),
  });

  const session = {
    setHandler: (event, handler) => handlers.set(event, handler),
    showView: async view => { views.push(view); },
    emit: async (event, value) => {
      if (event === 'alert') alerts.push(value);
    },
  };
  return { driver, logs, errors, views, alerts, handlers, session };
}

for (const [model, DriverClass] of [
  ['DCH-S220', DchS220Driver],
  ['DSP-W215', DspW215Driver],
]) {
  test(model + ': empty discovery and missing manual address are explained without leaking a PIN', async () => {
    const state = setup(DriverClass);
    await state.driver.onInit();
    await state.driver.onPair(state.session);

    await state.handlers.get('showView')('discover');
    assert.equal(state.views[0], 'add_by_ip');
    assert.ok(state.logs.some(line =>
      line.includes('discovery complete') && line.includes('"mdnsResults":0')));

    await state.handlers.get('showView')('add_by_ip');
    await state.handlers.get('showView')('authenticate');
    assert.equal(state.views.at(-1), 'add_by_ip');
    assert.match(state.errors.join('\n'), /no device selected before authentication/);
    assert.match(state.errors.join('\n'), /"manualAddressProvided":false/);
    assert.ok(state.alerts.some(message => message.includes('IP address')));

    await state.handlers.get('setManualAddress')('192.168.1.40');
    assert.ok(state.logs.some(line => line.includes('manual address updated')
      && line.includes('"provided":true')));

    assert.equal(await state.handlers.get('pincode')('123456'), false);
    assert.doesNotMatch([...state.logs, ...state.errors].join('\n'), /123456/);
  });
}
