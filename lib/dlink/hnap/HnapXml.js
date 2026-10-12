'use strict';

const { HnapProtocolError } = require('./HnapErrors');

const HNAP_NAMESPACE = 'http://purenetworks.com/HNAP1/';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
}

function getTagText(xml, tagName) {
  if (typeof xml !== 'string') return null;

  const tag = escapeRegExp(tagName);
  const prefix = '(?:[A-Za-z_][\\w.-]*:)?';
  const expression = new RegExp(
    '<' + prefix + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + prefix + tag + '\\s*>',
    'i',
  );
  const match = expression.exec(xml);

  if (!match) {
    const emptyExpression = new RegExp('<' + prefix + tag + '(?:\\s[^>]*)?\\s*\\/>', 'i');
    return emptyExpression.test(xml) ? '' : null;
  }

  return decodeXml(match[1].replace(/<[^>]+>/g, '').trim());
}

function getAllTagText(xml, tagName) {
  if (typeof xml !== 'string') return [];

  const tag = escapeRegExp(tagName);
  const prefix = '(?:[A-Za-z_][\\w.-]*:)?';
  const expression = new RegExp(
    '<' + prefix + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + prefix + tag + '\\s*>',
    'gi',
  );

  const values = [];
  let match;
  while ((match = expression.exec(xml)) !== null) {
    values.push(decodeXml(match[1].replace(/<[^>]+>/g, '').trim()));
  }
  return values;
}

function buildSoapEnvelope(action, innerXml = '') {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(action)) {
    throw new HnapProtocolError('Invalid HNAP action: ' + action);
  }

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ',
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ',
    'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    '<soap:Body>',
    '<' + action + ' xmlns="' + HNAP_NAMESPACE + '">',
    innerXml || '',
    '</' + action + '>',
    '</soap:Body>',
    '</soap:Envelope>',
  ].join('');
}

function buildLoginEnvelope(action, username, loginPassword = '') {
  return buildSoapEnvelope('Login', [
    '<Action>' + escapeXml(action) + '</Action>',
    '<Username>' + escapeXml(username) + '</Username>',
    '<LoginPassword>' + escapeXml(loginPassword) + '</LoginPassword>',
    '<Captcha/>',
  ].join(''));
}

function getActionResult(xml, action) {
  return getTagText(xml, action + 'Result');
}

function parseDeviceSettings(xml) {
  const fields = [
    'Type',
    'DeviceName',
    'VendorName',
    'ModelDescription',
    'ModelName',
    'DeviceMacId',
    'FirmwareVersion',
    'FirmwareRegion',
    'LatestFirmwareVersion',
    'HardwareVersion',
    'HNAPVersion',
    'PresentationURL',
    'CAPTCHA',
  ];

  const result = {};
  for (const field of fields) {
    const value = getTagText(xml, field);
    if (value !== null) result[field] = value;
  }

  result.SOAPActions = getAllTagText(xml, 'string')
    .filter(value => value.startsWith(HNAP_NAMESPACE));
  return result;
}

module.exports = {
  HNAP_NAMESPACE,
  escapeXml,
  decodeXml,
  getTagText,
  getAllTagText,
  buildSoapEnvelope,
  buildLoginEnvelope,
  getActionResult,
  parseDeviceSettings,
};
