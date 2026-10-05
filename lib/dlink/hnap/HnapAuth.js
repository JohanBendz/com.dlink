'use strict';

const crypto = require('crypto');
const { HNAP_NAMESPACE } = require('./HnapXml');

function hmacMd5(key, value) {
  return crypto
    .createHmac('md5', String(key))
    .update(String(value))
    .digest('hex')
    .toUpperCase();
}

function createPrivateKey(publicKey, password, challenge) {
  return hmacMd5(String(publicKey) + String(password), challenge);
}

function createLoginPassword(privateKey, challenge) {
  return hmacMd5(privateKey, challenge);
}

function getSoapAction(action) {
  return '"' + HNAP_NAMESPACE + action + '"';
}

function createHnapAuth(privateKey, action, timestampSeconds = Math.floor(Date.now() / 1000)) {
  const time = String(Math.floor(Number(timestampSeconds)));
  const soapAction = getSoapAction(action);
  return hmacMd5(privateKey, time + soapAction) + ' ' + time;
}

module.exports = {
  hmacMd5,
  createPrivateKey,
  createLoginPassword,
  getSoapAction,
  createHnapAuth,
};
