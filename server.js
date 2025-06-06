var dns       = require('native-dns');
var _         = require('lodash');
var crypto    = require('crypto');
var base32    = require('thirty-two');
var Reader    = require('buffer-read');
var assert    = require('assert');

/** Fixed-time comparison of signatures */
var compareSignatures = function(s1, s2) {
  var mismatch = 0;
  for(var i = 0; i < 16; i++) {
    mismatch |= (s1[i] ^ s2[i]);
  }
  return mismatch === 0;
};

// native-dns doesn't expose those constants for some reason
const TYPE_TXT = 16;

/**
 * Create stateless DNS server
 *
 * options:
 * {
 *   port:     55553,    // UDP port listen on (default 55553)
 *   ttl:      600,      // DNS record time-to-live in seconds (default 10 min)
 *   domain:   '...',    // Domain for which we host DNS
 *   secrets:   '...'    // HMAC signing secrets that can be used in signatures
 * }
 */
var createServer = function(options) {
  options = _.defaults({}, options, {
    port:     55553,
    ttl:      600,
  });
  // Validate options
  assert(typeof options.port   == 'number', "Expected 'port' as number");
  assert(typeof options.ttl    == 'number', "Expected 'ttl' as number");
  assert(typeof options.domain == 'string', "Expected 'domain' as a string");
  assert(options.secrets instanceof Array, "Expected 'secrets' as an array");
  assert(options.secrets.length > 0, "Expected at least one secret");
  options.secrets.forEach(function(secret) {
    assert(typeof secret == 'string', "Expected 'secrets' to be strings");
  });
  assert(typeof options.txtRecords === 'object' && !Array.isArray(options.txtRecords),
    "Expected 'txtRecords' as an object with key:value")

  // Check that crypto has support for sha256
  assert(crypto.getHashes().indexOf('sha256') !== -1,
       "crypto doesn't support sha256, please upgrade OpenSSL");

  // Create DNS server
  server = dns.createServer();

  // Handle requests
  server.on('request', function (request, response) {
    console.log("Query from: '%s':", request.address.address);
    request.question.forEach(function(q) {
      console.log("  Question: '%s'", q.name, q.type);

      if (q.type === TYPE_TXT) {
        const subdomain = q.name.toLowerCase().replace(new RegExp(`\.?${options.domain}$`, 'i'), '');
        const txt = options.txtRecords[subdomain || '.'];
        if (txt) {
          response.answer.push(dns.TXT({
            name:     q.name,
            data:     [txt],
            ttl:      options.ttl,
          }));
        }
        return
      }

      // Find labels
      var labels = q.name.toLowerCase().split('.');
      // Make sure it ends with the domain configured
      if (labels.slice(1).join('.') !== options.domain.toLowerCase()) {
        return;
      }

      // Decode data
      var data;
      try {
        data = base32.decode(labels[0]);
      }
      catch (err) {
        // Ignore base32 decoding errors
        console.log("     Error: '%s'", err.message);
        return;
      }
      if (data.length !== 4 + 8 + 2 + 16) {
        return;
      }

      // Create reader
      var reader = new Reader(data);

      // Find IP
      var ip = [
        reader.readUInt8(),
        reader.readUInt8(),
        reader.readUInt8(),
        reader.readUInt8()
      ].join('.');

      // Find expires
      var expires = null;
      try {
        expires = reader.readInt64BE();
      }
      catch (err) {
        // Ignore int64 out of range errors
        console.log("     Error: '%s'", err.message);
        return;
      }
      if (expires < Date.now()) {
        return;
      }

      // Read salt
      var salt = reader.readUInt16BE();

      // Find signature
      var s1 = reader.slice(16);
      var valid = false;
      // Test each possible secret, always test both keys, just for good measure
      // who knows if an attacker could use this for a side-channel attack.
      options.secrets.forEach(function(secret) {
        var s2 = crypto.createHmac('sha256', secret)
          .update(data.slice(0, 4 + 8 + 2))
          .digest()
          .slice(0, 16);
        // Validate signature
        if (compareSignatures(s1, s2)) {
          valid = true;
        }
      });

      // Don't send an answer if the signature isn't valid
      if (!valid) {
        return;
      }

      console.log("    Answer: '%s'", ip);
      response.answer.push(dns.A({
        name:     q.name,
        address:  ip,
        ttl:      options.ttl
      }));
    });
    console.log("--");

    // Send response
    response.send();
  });

  // Log errors, this is what happens when we get a bad UDP datagram
  server.on('error', function (err, buff, req, res) {
    console.log(err.stack);
  });

  // Start server
  server.serve(options.port);

  // Return promise that server is listening
  return new Promise(function(resolve, reject) {
    server.once('listening', function() {
      console.log("DNS server now listening on port: %s", options.port);
      console.log("");
      resolve(server);
    });
    server.once('socketError', function (err) {
      reject(err);
    });
    server.once('close', reject);
  });
};

// Export createServer
module.exports = createServer;

// If server.js is executed start the server
if (!module.parent) {
  var secrets = [
    process.env.PRIMARY_SECRET,
    process.env.SECONDARY_SECRET
  ].filter(function(entry) { return entry != undefined; });
  createServer({
    port:       parseInt(process.env.PORT || 55553),
    ttl:        parseInt(process.env.TTL || 600),
    domain:     process.env.DOMAIN,
    secrets:    secrets,
    txtRecords: JSON.parse(process.env.TXT_RECORDS || '{}'),
  }).then(function(server) {
    // If the socket closes, there is no reason to stay alive
    server.once('close', function() {
      console.error("Socket closed, let's crash...");
      process.exit(1);
    });
  });
}
