'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const DspW215Client = require('../lib/dlink/devices/DspW215Client');

class FakeHnapClient {
  constructor(handler) {
    this.handler = handler;
    this.calls = [];
  }

  async request(action, body) {
    this.calls.push({ action, body });
    return this.handler(action, body, this.calls);
  }

  async getDeviceSettings() {
    return {
      VendorName: 'D-Link',
      ModelName: 'DSP-W215',
      DeviceMacId: 'AA:BB:CC:DD:EE:FF',
    };
  }

  async authenticate() {
    return { cookie: 'cookie', privateKey: 'private-key' };
  }

  setEndpoint() {}

  setCredentials() {}
}

function response(action, fields = {}, result = 'OK') {
  const body = Object.entries(fields)
    .map(([key, value]) => '<' + key + '>' + value + '</' + key + '>')
    .join('');

  return [
    '<soap:Envelope><soap:Body>',
    '<' + action + 'Response xmlns="http://purenetworks.com/HNAP1/">',
    '<' + action + 'Result>' + result + '</' + action + 'Result>',
    body,
    '</' + action + 'Response>',
    '</soap:Body></soap:Envelope>',
  ].join('');
}

test('reads DSP-W215 socket state from module 1', async () => {
  const fake = new FakeHnapClient((action, body) => {
    assert.equal(action, 'GetSocketSettings');
    assert.match(body, /<ModuleID>1<\/ModuleID>/);
    return response(action, {
      NickName: 'Desk Lamp',
      Description: 'Office',
      OPStatus: 'true',
    });
  });

  const client = new DspW215Client({ hnapClient: fake });
  assert.equal(await client.getState(), true);
});

test('preserves socket metadata when switching state', async () => {
  const fake = new FakeHnapClient((action, body) => {
    if (action === 'GetSocketSettings') {
      return response(action, {
        NickName: 'Lamp & Fan',
        Description: 'Office <north>',
        OPStatus: 'false',
      });
    }

    assert.equal(action, 'SetSocketSettings');
    assert.match(body, /<ModuleID>1<\/ModuleID>/);
    assert.match(body, /<NickName>Lamp &amp; Fan<\/NickName>/);
    assert.match(body, /<Description>Office &lt;north&gt;<\/Description>/);
    assert.match(body, /<OPStatus>true<\/OPStatus>/);
    return response(action);
  });

  const client = new DspW215Client({ hnapClient: fake });
  assert.equal(await client.setState(true), true);
});

test('retries SetSocketSettings with Controller=1 for legacy firmware', async () => {
  let setAttempts = 0;
  const fake = new FakeHnapClient((action, body) => {
    if (action === 'GetSocketSettings') {
      return response(action, {
        NickName: 'Socket 1',
        Description: 'Socket 1',
        OPStatus: 'false',
      });
    }

    setAttempts += 1;
    if (setAttempts === 1) {
      assert.doesNotMatch(body, /<Controller>/);
      return response(action, {}, 'ERROR');
    }

    assert.match(body, /<Controller>1<\/Controller>/);
    return response(action);
  });

  const client = new DspW215Client({ hnapClient: fake });
  assert.equal(await client.setState(true), true);
  assert.equal(setAttempts, 2);
});

test('uses B1 module ordering for power and temperature by default', async () => {
  const fake = new FakeHnapClient((action, body) => {
    if (action === 'GetCurrentPowerConsumption') {
      assert.match(body, /<ModuleID>2<\/ModuleID>/);
      return response(action, { CurrentConsumption: '17.25' });
    }

    assert.equal(action, 'GetCurrentTemperature');
    assert.match(body, /<ModuleID>3<\/ModuleID>/);
    return response(action, { CurrentTemperature: '41.5' });
  });

  const client = new DspW215Client({ hnapClient: fake });
  assert.equal(await client.getPower(), 17.25);
  assert.equal(await client.getTemperature(), 41.5);
});

test('learns reversed A1 power/temperature module ordering', async () => {
  const fake = new FakeHnapClient((action, body) => {
    const moduleId = /<ModuleID>(\d+)<\/ModuleID>/.exec(body)[1];

    if (action === 'GetCurrentPowerConsumption') {
      return moduleId === '3'
        ? response(action, { CurrentConsumption: '12.5' })
        : response(action, {}, 'ERROR');
    }

    if (action === 'GetCurrentTemperature') {
      return moduleId === '2'
        ? response(action, { CurrentTemperature: '38' })
        : response(action, {}, 'ERROR');
    }

    throw new Error('Unexpected action: ' + action);
  });

  const client = new DspW215Client({ hnapClient: fake });

  assert.equal(await client.getPower(), 12.5);
  assert.equal(client.moduleIds.power, 3);

  assert.equal(await client.getTemperature(), 38);
  assert.equal(client.moduleIds.temperature, 2);

  const callsBefore = fake.calls.length;
  assert.equal(await client.getPower(), 12.5);
  assert.equal(fake.calls.length, callsBefore + 1);
  assert.match(fake.calls.at(-1).body, /<ModuleID>3<\/ModuleID>/);
});
