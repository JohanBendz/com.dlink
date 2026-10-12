'use strict';

const HnapClient = require('../hnap/HnapClient');
const { HnapProtocolError } = require('../hnap/HnapErrors');
const {
  escapeXml,
  getActionResult,
  getTagText,
} = require('../hnap/HnapXml');

const SOCKET_MODULE_ID = 1;
const DEFAULT_POWER_MODULE_ID = 2;
const DEFAULT_TEMPERATURE_MODULE_ID = 3;

function moduleParameter(moduleId) {
  return '<ModuleID>' + Number(moduleId) + '</ModuleID>';
}

function parseBoolean(value, fieldName) {
  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'on'].includes(normalized)) return true;
  if (['false', '0', 'off'].includes(normalized)) return false;

  throw new HnapProtocolError(
    'Unexpected ' + fieldName + ' value: ' + value,
  );
}

function parseFiniteNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new HnapProtocolError(
      'Unexpected ' + fieldName + ' value: ' + value,
    );
  }
  return number;
}

function assertActionResult(xml, action) {
  const result = getActionResult(xml, action);
  if (result === null) return;

  const normalized = String(result).trim().toLowerCase();
  if (!['ok', 'success'].includes(normalized)) {
    throw new HnapProtocolError(action + ' failed: ' + result);
  }
}

class DspW215Client {
  constructor({
    hnapClient = null,
    address,
    port,
    protocol = 'http',
    username = 'admin',
    password = '',
    timeout = 5000,
  } = {}) {
    this.hnap = hnapClient || new HnapClient({
      address,
      port,
      protocol,
      username,
      password,
      timeout,
    });

    // Revisions differ in the order of the power and temperature modules.
    // B1/firmware 2.x commonly uses power=2, temperature=3.
    // A1/firmware 1.24 has been observed using the reverse order.
    this.moduleIds = {
      power: DEFAULT_POWER_MODULE_ID,
      temperature: DEFAULT_TEMPERATURE_MODULE_ID,
    };
  }

  setEndpoint(endpoint) {
    this.hnap.setEndpoint(endpoint);
  }

  setCredentials(credentials) {
    this.hnap.setCredentials(credentials);
  }

  async authenticate() {
    return this.hnap.authenticate();
  }

  async getDeviceInfo({ authenticated = false } = {}) {
    return this.hnap.getDeviceSettings({ authenticated });
  }

  async getSocketSettings() {
    const xml = await this.hnap.request(
      'GetSocketSettings',
      moduleParameter(SOCKET_MODULE_ID),
    );

    assertActionResult(xml, 'GetSocketSettings');

    const rawState = getTagText(xml, 'OPStatus');
    if (rawState === null) {
      throw new HnapProtocolError(
        'GetSocketSettings did not return OPStatus',
      );
    }

    return {
      on: parseBoolean(rawState, 'OPStatus'),
      nickname: getTagText(xml, 'NickName') || 'Socket 1',
      description: getTagText(xml, 'Description') || 'Socket 1',
    };
  }

  async getState() {
    return (await this.getSocketSettings()).on;
  }

  async setState(on) {
    const current = await this.getSocketSettings();
    const baseBody = [
      moduleParameter(SOCKET_MODULE_ID),
      '<NickName>' + escapeXml(current.nickname) + '</NickName>',
      '<Description>' + escapeXml(current.description) + '</Description>',
      '<OPStatus>' + (on ? 'true' : 'false') + '</OPStatus>',
    ];

    try {
      return await this._setSocketSettings(baseBody);
    } catch (error) {
      if (!(error instanceof HnapProtocolError)) throw error;

      // Some older firmware expects Controller=1. Retry once without
      // making that legacy field part of the common path.
      return this._setSocketSettings([
        ...baseBody,
        '<Controller>1</Controller>',
      ]);
    }
  }

  async _setSocketSettings(parts) {
    const xml = await this.hnap.request(
      'SetSocketSettings',
      parts.join(''),
    );

    assertActionResult(xml, 'SetSocketSettings');

    const result = getActionResult(xml, 'SetSocketSettings');
    if (result === null) {
      throw new HnapProtocolError(
        'SetSocketSettings did not return a result',
      );
    }

    return true;
  }

  async getPower() {
    return this._readNumericModuleValue({
      cacheKey: 'power',
      preferredModuleId: this.moduleIds.power,
      alternateModuleId: this.moduleIds.power === 2 ? 3 : 2,
      action: 'GetCurrentPowerConsumption',
      responseElement: 'CurrentConsumption',
    });
  }

  async getTemperature() {
    return this._readNumericModuleValue({
      cacheKey: 'temperature',
      preferredModuleId: this.moduleIds.temperature,
      alternateModuleId: this.moduleIds.temperature === 3 ? 2 : 3,
      action: 'GetCurrentTemperature',
      responseElement: 'CurrentTemperature',
    });
  }

  async _readNumericModuleValue({
    cacheKey,
    preferredModuleId,
    alternateModuleId,
    action,
    responseElement,
  }) {
    try {
      const value = await this._readNumericValue(
        action,
        responseElement,
        preferredModuleId,
      );
      this.moduleIds[cacheKey] = preferredModuleId;
      return value;
    } catch (error) {
      if (!(error instanceof HnapProtocolError)) throw error;
    }

    const value = await this._readNumericValue(
      action,
      responseElement,
      alternateModuleId,
    );
    this.moduleIds[cacheKey] = alternateModuleId;
    return value;
  }

  async _readNumericValue(action, responseElement, moduleId) {
    const xml = await this.hnap.request(
      action,
      moduleParameter(moduleId),
    );

    assertActionResult(xml, action);

    const rawValue = getTagText(xml, responseElement);
    if (rawValue === null || rawValue === '') {
      throw new HnapProtocolError(
        action + ' did not return ' + responseElement,
      );
    }

    return parseFiniteNumber(rawValue, responseElement);
  }
}

module.exports = DspW215Client;
