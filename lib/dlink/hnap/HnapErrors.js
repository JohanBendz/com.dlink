'use strict';

class HnapError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    if (options.cause) this.cause = options.cause;
  }
}

class HnapNetworkError extends HnapError {}

class HnapHttpError extends HnapError {
  constructor(message, { statusCode, responseBody, cause } = {}) {
    super(message, { cause });
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

class HnapAuthenticationError extends HnapError {}

class HnapProtocolError extends HnapError {}

module.exports = {
  HnapError,
  HnapNetworkError,
  HnapHttpError,
  HnapAuthenticationError,
  HnapProtocolError,
};
