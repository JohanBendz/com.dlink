'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const DchS220Client = require('../lib/dlink/devices/DchS220Client');

function response(action, fields = '') {
  return '<' + action + 'Response><' + action + 'Result>OK</' + action + 'Result>'
    + fields + '</' + action + 'Response>';
}

test('DCH-S220: read sounding state without requiring an optional action result', async () => {
  const calls = [];
  const client = new DchS220Client({ hnapClient: {
    request: async (action, params) => {
      calls.push({ action, params });
      return '<GetSirenAlarmSettingsResponse><IsSounding>true</IsSounding></GetSirenAlarmSettingsResponse>';
    },
  } });
  assert.equal(await client.isPlaying(), true);
  assert.match(calls[0].params, /<Controller>1<\/Controller>/);
});

test('DCH-S220: sound payload selects sound, volume and duration', async () => {
  const calls = [];
  const client = new DchS220Client({ hnapClient: {
    request: async (action, params) => {
      calls.push({ action, params });
      return response(action);
    },
  } });
  assert.equal(await client.play({ sound: 6, volume: 20, duration: 3 }), true);
  assert.equal(calls[0].action, 'SetSoundPlay');
  assert.match(calls[0].params, /<SoundType>6<\/SoundType>/);
  assert.match(calls[0].params, /<Volume>20<\/Volume>/);
  assert.match(calls[0].params, /<Duration>3<\/Duration>/);
  assert.equal(await client.stop(), true);
  assert.equal(calls[1].action, 'SetAlarmDismissed');
});

test('DCH-S220: reject invalid sound/volume/duration without sending HNAP', async () => {
  let called = false;
  const client = new DchS220Client({ hnapClient: {
    request: async () => { called = true; return ''; },
  } });
  await assert.rejects(client.play({ sound: 7 }), RangeError);
  await assert.rejects(client.play({ volume: 200 }), RangeError);
  await assert.rejects(client.play({ duration: 99999 }), RangeError);
  assert.equal(called, false);
});

test('DCH-S220: reject an unsuccessful stop response', async () => {
  const client = new DchS220Client({ hnapClient: {
    request: async () => '<SetAlarmDismissedResponse><SetAlarmDismissedResult>ERROR</SetAlarmDismissedResult></SetAlarmDismissedResponse>',
  } });
  await assert.rejects(client.stop(), /failed/i);
});
