'use strict';

const HnapClient = require('../hnap/HnapClient');
const { HnapProtocolError } = require('../hnap/HnapErrors');
const { getTagText, getActionResult } = require('../hnap/HnapXml');

const SOUNDS = Object.freeze({
  EMERGENCY: 1,
  FIRE: 2,
  AMBULANCE: 3,
  POLICE: 4,
  DOOR_CHIME: 5,
  BEEP: 6,
});

const PARAMETERS = '<ModuleID>1</ModuleID><Controller>1</Controller>';

function assertResult(xml, action) {
  const result = getActionResult(xml, action);
  if (!result || !['ok', 'success'].includes(result.toLowerCase())) {
    throw new HnapProtocolError(action + ' failed: ' + (result || 'no result'));
  }
}

function boundedInteger(value, minimum, maximum, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new RangeError(name + ' must be between ' + minimum + ' and ' + maximum);
  }
  return number;
}

class DchS220Client {
  constructor({ hnapClient = null, address, port = 80, username = 'admin', password = '', timeout = 6000 } = {}) {
    this.hnap = hnapClient || new HnapClient({ address, port, username, password, timeout });
  }

  async authenticate() {
    return this.hnap.authenticate();
  }

  async getDeviceInfo() {
    return this.hnap.getDeviceSettings({ authenticated: false });
  }

  setCredentials({ username, password }) {
    this.hnap.setCredentials({ username, password });
  }

  async isPlaying() {
    const xml = await this.hnap.request('GetSirenAlarmSettings', PARAMETERS);
    if (getActionResult(xml, 'GetSirenAlarmSettings') !== null) {
      assertResult(xml, 'GetSirenAlarmSettings');
    }
    const value = getTagText(xml, 'IsSounding');
    if (!['true', 'false', '1', '0'].includes(String(value).toLowerCase())) {
      throw new HnapProtocolError('Invalid IsSounding state: ' + value);
    }
    return ['true', '1'].includes(String(value).toLowerCase());
  }

  async play({ sound = SOUNDS.POLICE, volume = 50, duration = 15 } = {}) {
    const safeSound = boundedInteger(sound, 1, 6, 'Sound');
    const safeVolume = boundedInteger(volume, 1, 100, 'Volume');
    const safeDuration = boundedInteger(duration, 1, 300, 'Duration');
    const inner = PARAMETERS
      + '<SoundType>' + safeSound + '</SoundType>'
      + '<Volume>' + safeVolume + '</Volume>'
      + '<Duration>' + safeDuration + '</Duration>';
    const xml = await this.hnap.request('SetSoundPlay', inner);
    assertResult(xml, 'SetSoundPlay');
    return true;
  }

  async stop() {
    const xml = await this.hnap.request('SetAlarmDismissed', PARAMETERS);
    assertResult(xml, 'SetAlarmDismissed');
    return true;
  }
}

module.exports = DchS220Client;
module.exports.SOUNDS = SOUNDS;
