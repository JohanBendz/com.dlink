'use strict';

const HnapTransport = require('./HnapTransport');
const {
  HnapAuthenticationError,
  HnapHttpError,
  HnapProtocolError,
} = require('./HnapErrors');
const {
  buildLoginEnvelope,
  buildSoapEnvelope,
  getActionResult,
  getTagText,
  parseDeviceSettings,
} = require('./HnapXml');
const {
  createPrivateKey,
  createLoginPassword,
  createHnapAuth,
  getSoapAction,
} = require('./HnapAuth');

class HnapClient {
  constructor({
    address,
    port,
    protocol = 'http',
    username = 'Admin',
    password = '',
    timeout = 5000,
    logger = null,
  }) {
    this.username = username;
    this.password = password;
    this.logger = logger;
    this.transport = new HnapTransport({ address, port, protocol, timeout });
    this.session = null;
  }

  setEndpoint({ address, port, protocol }) {
    this.transport.setEndpoint({ address, port, protocol });
    this.session = null;
  }

  setCredentials({ username = this.username, password = this.password } = {}) {
    this.username = username;
    this.password = password;
    this.session = null;
  }

  async authenticate() {
    const challengeBody = buildLoginEnvelope(
      'request',
      String(this.username).toLowerCase(),
    );

    const challengeXml = await this.transport.request({
      body: challengeBody,
      headers: { SOAPAction: getSoapAction('Login') },
    });

    const challenge = getTagText(challengeXml, 'Challenge');
    const cookie = getTagText(challengeXml, 'Cookie');
    const publicKey = getTagText(challengeXml, 'PublicKey');

    if (!challenge || !cookie || !publicKey) {
      throw new HnapProtocolError('HNAP login challenge is incomplete');
    }

    const privateKey = createPrivateKey(publicKey, this.password, challenge);
    const loginPassword = createLoginPassword(privateKey, challenge);
    const loginBody = buildLoginEnvelope('login', this.username, loginPassword);

    const loginXml = await this.transport.request({
      body: loginBody,
      headers: {
        SOAPAction: getSoapAction('Login'),
        HNAP_AUTH: createHnapAuth(privateKey, 'Login'),
        Cookie: 'uid=' + cookie,
      },
    });

    const loginResult = String(getTagText(loginXml, 'LoginResult') || '').toLowerCase();
    if (loginResult !== 'success') {
      throw new HnapAuthenticationError(
        'HNAP authentication failed' + (loginResult ? ': ' + loginResult : ''),
      );
    }

    this.session = { privateKey, cookie };
    return this.session;
  }

  async request(action, innerXml = '', {
    authenticated = true,
    retryAuthentication = true,
  } = {}) {
    const body = buildSoapEnvelope(action, innerXml);

    if (!authenticated) {
      return this.transport.request({
        body,
        headers: { SOAPAction: getSoapAction(action) },
      });
    }

    if (!this.session) await this.authenticate();

    try {
      return await this.transport.request({
        body,
        headers: {
          SOAPAction: getSoapAction(action),
          HNAP_AUTH: createHnapAuth(this.session.privateKey, action),
          Cookie: 'uid=' + this.session.cookie,
        },
      });
    } catch (error) {
      const shouldRetry = retryAuthentication
        && error instanceof HnapHttpError
        && [401, 403, 500].includes(error.statusCode);

      if (!shouldRetry) throw error;

      this.session = null;
      await this.authenticate();
      return this.request(action, innerXml, {
        authenticated: true,
        retryAuthentication: false,
      });
    }
  }

  async getDeviceSettings({ authenticated = false } = {}) {
    const xml = await this.request(
      'GetDeviceSettings',
      '',
      { authenticated },
    );
    const result = getActionResult(xml, 'GetDeviceSettings');

    if (result && String(result).toUpperCase() !== 'OK') {
      throw new HnapProtocolError('GetDeviceSettings failed: ' + result);
    }

    return parseDeviceSettings(xml);
  }

  clearSession() {
    this.session = null;
  }
}

module.exports = HnapClient;
