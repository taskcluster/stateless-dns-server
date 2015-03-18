var assert    = require('assert');
var crypto    = require('crypto');
var base32    = require('thirty-two');
var Writer    = require('buffer-write');

// Check that crypto has support for sha256
assert(crypto.getHashes().indexOf('sha256') !== -1,
       "crypto doesn't support sha256, please upgrade OpenSSL");

/**
 * Create a temporary hostname for ip, given as array of 4 ints, as sub-domain
 * under `domain` with an expiration set to `expires` given as `Date` object.
 */
var createHostname = function(ip, expires, secret, domain) {
  // Validate input
  assert(ip instanceof Array,       "Expected 'ip' to be array!");
  assert(typeof ip[0] == 'number',  "Expected 'ip[0]' to be integer!");
  assert(typeof ip[1] == 'number',  "Expected 'ip[1]' to be integer!");
  assert(typeof ip[2] == 'number',  "Expected 'ip[2]' to be integer!");
  assert(typeof ip[3] == 'number',  "Expected 'ip[3]' to be integer!");
  assert(expires instanceof Date,   "Expected `expires` to be a `Date` object");
  assert(typeof secret == 'string', "Expected `secret` to be a string");
  assert(typeof domain == 'string', "Expected `domain` to be a string");

  // Generate random salt
  var salt = crypto.randomBytes(2);

  // Create writer
  var writer = new Writer();

  // Write IP
  writer.writeUInt8(ip[0]);
  writer.writeUInt8(ip[1]);
  writer.writeUInt8(ip[2]);
  writer.writeUInt8(ip[3]);

  // Write expires
  writer.writeInt64BE(expires.getTime());

  // Write salt
  writer.write(salt);

  // Compute signature
  var signature = crypto.createHmac('sha256', secret)
                        .update(writer.toBuffer())
                        .digest()
                        .slice(0, 16);

  // Write signature
  writer.write(signature);

  // Convert to base32
  var label = base32.encode(writer.toBuffer()).toString('utf8').toLowerCase();

  // Return hostname
  return [label, domain].join('.');
};

// Export createHostname
exports.createHostname = createHostname;