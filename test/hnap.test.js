'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPrivateKey,
  createLoginPassword,
  createHnapAuth,
} = require('../lib/dlink/hnap/HnapAuth');
const {
  buildSoapEnvelope,
  buildLoginEnvelope,
  getTagText,
  getAllTagText,
  parseDeviceSettings,
} = require('../lib/dlink/hnap/HnapXml');
const {
  normalizeMac,
} = require('../lib/dlink/hnap/HnapDiscovery');

test('D-Link HNAP challenge response is deterministic', () => {
  const privateKey = createPrivateKey('PUBLICKEY', '123456', 'CHALLENGE');
  assert.equal(privateKey, '43D769C2100C352E9AECAF1E105FF3FD');

  const loginPassword = createLoginPassword(privateKey, 'CHALLENGE');
  assert.equal(loginPassword, '53830B28DCACF407FE6F2D182D91F403');

  assert.equal(
    createHnapAuth(privateKey, 'GetDeviceSettings', 1700000000),
    '7DDFF222DC2B1187448BB2F274F8A1D9 1700000000',
  );
});

test('SOAP envelopes escape credentials and reject invalid action names', () => {
  const xml = buildLoginEnvelope('login', 'Admin&User', '12<34');
  assert.match(xml, /Admin&amp;User/);
  assert.match(xml, /12&lt;34/);
  assert.throws(() => buildSoapEnvelope('Bad/Action'), /Invalid HNAP action/);
});

test('HNAP XML helpers parse namespaced and default-namespace responses', () => {
  const xml = [
    '<?xml version="1.0"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    '<soap:Body>',
    '<GetDeviceSettingsResponse xmlns="http://purenetworks.com/HNAP1/">',
    '<GetDeviceSettingsResult>OK</GetDeviceSettingsResult>',
    '<VendorName>D-Link</VendorName>',
    '<ModelName>DCH-S220</ModelName>',
    '<DeviceName>Hall Siren</DeviceName>',
    '<DeviceMacId>1c:5f:2b:bf:56:c4</DeviceMacId>',
    '<SOAPActions>',
    '<string>http://purenetworks.com/HNAP1/GetSirenAlarmSettings</string>',
    '<string>http://purenetworks.com/HNAP1/SetSoundPlay</string>',
    '</SOAPActions>',
    '</GetDeviceSettingsResponse>',
    '</soap:Body>',
    '</soap:Envelope>',
  ].join('');

  assert.equal(getTagText(xml, 'ModelName'), 'DCH-S220');
  assert.deepEqual(getAllTagText(xml, 'string'), [
    'http://purenetworks.com/HNAP1/GetSirenAlarmSettings',
    'http://purenetworks.com/HNAP1/SetSoundPlay',
  ]);

  const info = parseDeviceSettings(xml);
  assert.equal(info.VendorName, 'D-Link');
  assert.equal(info.DeviceMacId, '1c:5f:2b:bf:56:c4');
  assert.equal(info.SOAPActions.length, 2);
});

test('MAC normalization produces a stable Homey device ID', () => {
  assert.equal(normalizeMac('1c-5f-2b-bf-56-c4'), '1C:5F:2B:BF:56:C4');
  assert.equal(normalizeMac('not-a-mac'), null);
});
