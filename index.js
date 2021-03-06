'use strict';

var request = require('hyperquest'),
    tryParse = require('json-try-parse'),
    url = require('url'),
    bl = require('bl');

//
// Methods that require an `application/json` header.
//
var methods = ['POST', 'PUT'];

/**
 * Feedsme API client.
 *
 * @constructor
 * @param {String} base The root URL of the carpenter service
 * @api public
 */
function Feedsme(opts) {
  if (!this) new Feedsme(opts);

  if (typeof opts === 'string') {
    this.base = opts;
  } else if (opts.protocol && opts.href) {
    this.base = url.format(opts);
  } else if (opts.url || opts.uri) {
    this.base = opts.url || opts.uri;
  } else {
    throw new Error('Feedsme URL required');
  }

  //
  // Handle all possible cases
  //
  this.base = typeof this.base === 'object'
    ? url.format(this.base)
    : this.base;

  this.agent = opts.agent;
}

/**
 * Trigger a new build for a given environment
 *
 * @param {String} env Environment we trigger the change for.
 * @param {Object} options Configuration.
 * @param {Function} next Completion callback.
 * @api private
 */
Feedsme.prototype.change = function build(env, options, next) {
  return this.send(['change', env].join('/'), options, next);
};

/**
 * Internal API for sending data.
 *
 * @param {String} pathname Pathname we need to hit.
 * @param {Object} options Hyperquest options
 * @param {Function} next Completion callback.
 * @returns {Hyperquest}
 * @api private
 */
Feedsme.prototype.send = function send(pathname, options, next) {
  var base = url.parse(this.base),
      data = false,
      statusCode,
      req;

  if (typeof pathname === 'object') {
    options = pathname;
    pathname = null;
  }

  if (typeof options === 'function') {
    next = options;
    options = {};
  }

  options.agent = this.agent;
  options.headers = options.headers || {};
  base.pathname = pathname || options.pathname || '/';

  //
  // Setup options from method and optional data.
  //
  data = options.data;
  if (typeof data === 'object' || ~methods.indexOf(options.method)) {
    delete options.data;

    options.method = options.method || 'POST';
    options.headers['Content-Type'] = 'application/json';
  }

  //
  // Setup hyperquest to formatted URL.
  //
  req = request(url.format(base), options)
    .on('response', function (res) {
      statusCode = res.statusCode;
    });

  //
  // Write JSON data to the request.
  //
  if (typeof data === 'object') {
    try {
      req.end(JSON.stringify(data));
    } catch (error) {
      return next(error);
    }
  }


  return next ? req.pipe(bl(validateBody)) : req;

  //
  // If a callback is passed, validate the returned body
  //
  function validateBody(err, body) {
    body = tryParse(body);

    if (err || !body) {
      return next(err || new Error('Unparsable response with statusCode ' + statusCode));
    }

    if (statusCode !== 200) {
      return next(new Error(body.message || 'Invalid status code ' + statusCode));
    }

    next(null, body);
  }

};

//
// Expose the interface.
//
module.exports = Feedsme;
