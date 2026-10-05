'use strict';

const http = require('http');
const https = require('https');
const {
  HnapNetworkError,
  HnapHttpError,
} = require('./HnapErrors');

class HnapTransport {
  constructor({
    address,
    port,
    protocol = 'http',
    path = '/HNAP1/',
    timeout = 5000,
    maxResponseBytes = 512 * 1024,
  }) {
    this.path = path;
    this.timeout = timeout;
    this.maxResponseBytes = maxResponseBytes;
    this.protocol = String(protocol).replace(/:$/, '').toLowerCase();
    this.setEndpoint({ address, port, protocol: this.protocol });
  }

  setEndpoint({ address, port, protocol = this.protocol || 'http' }) {
    if (!address) throw new TypeError('HNAP address is required');

    this.address = address;
    this.protocol = String(protocol).replace(/:$/, '').toLowerCase();
    if (!['http', 'https'].includes(this.protocol)) {
      throw new TypeError('Unsupported HNAP protocol: ' + protocol);
    }

    this.port = Number(port || (this.protocol === 'https' ? 443 : 80));
  }

  async request({ body = '', headers = {}, method = 'POST' } = {}) {
    const client = this.protocol === 'https' ? https : http;
    const payload = Buffer.from(String(body), 'utf8');

    const requestHeaders = {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': payload.length,
      Connection: 'close',
      ...headers,
    };

    return new Promise((resolve, reject) => {
      let settled = false;
      const finishReject = error => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const finishResolve = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const req = client.request({
        hostname: this.address,
        port: this.port,
        path: this.path,
        method,
        headers: requestHeaders,
        agent: false,
      }, res => {
        const chunks = [];
        let bytes = 0;

        res.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > this.maxResponseBytes) {
            res.destroy(new HnapNetworkError('HNAP response exceeded maximum size'));
            return;
          }
          chunks.push(chunk);
        });

        res.on('error', error => {
          finishReject(error instanceof HnapNetworkError
            ? error
            : new HnapNetworkError('HNAP response failed', { cause: error }));
        });

        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          const statusCode = Number(res.statusCode || 0);

          if (statusCode < 200 || statusCode >= 300) {
            finishReject(new HnapHttpError(
              'HNAP request failed with HTTP ' + (statusCode || 'unknown'),
              { statusCode, responseBody },
            ));
            return;
          }

          finishResolve(responseBody);
        });
      });

      req.setTimeout(this.timeout, () => {
        req.destroy(new HnapNetworkError(
          'HNAP request timed out after ' + this.timeout + ' ms',
        ));
      });

      req.on('error', error => {
        finishReject(error instanceof HnapNetworkError
          ? error
          : new HnapNetworkError('Unable to connect to HNAP device', { cause: error }));
      });

      req.end(payload);
    });
  }
}

module.exports = HnapTransport;
