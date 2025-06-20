suite("Stateless DNS Server", function() {
  var createServer        = require('./server');
  var statelessDNSServer  = require('./');
  var dns                 = require('native-dns');

  // Configurations
  var port      = 55553;
  var secret    = 'no-secret';
  var domain    = 'test-domain.co.uk';

  // Server setup and teardown
  var server = null;
  setup(function() {
    return createServer({
      port:     port,
      ttl:      60,
      domain:   domain,
      secrets:  ["other secret", secret],
      txtRecords: {'.': 'TLD TXT', 'abc': 'abc TXT'},
    }).then(function(server_) {
      server = server_;
    });
  });
  teardown(function() {
    server.close();
  });

  // Utility function to fetch DNS query, assumes no reply if expectedIp isn't
  // given, otherwise it'll fail if not given in the reply
  var queryDNSServer = function(hostname, expectedIp, recordType = 'A') {
    var question = dns.Question({
      name:   hostname,
      type:   recordType,
    });

    var request = dns.Request({
      question:   question,
      server:     {address: '127.0.0.1', port: port, type: 'udp'},
      timeout:    1000,
    });

    // Send request and wait for timeout
    return new Promise(function(resolve, reject) {
      // Wait for a message
      request.on('message', function (err, msg) {
        if (err) {
          reject(err);
        }

        msg.answer.forEach(function (answer) {
          switch (recordType) {
            case 'A': {
              if (!expectedIp) {
                reject(new Error("Got unexpected answer: " + answer.address));
              }
              if (answer.address === expectedIp) {
                resolve();
              } else {
                reject(new Error("Got unexpected answer: " + answer.address));
              }
              break;
            }
            case 'TXT': {
              const [txt] = answer.data; // comes as array of strings
              if (!txt && !expectedIp) {
                resolve(); // nothing was expected
              }
              if (txt !== expectedIp) {
                reject(new Error("Got unexpected answer: " + txt));
              }
              resolve();
              break;
            }
            default: {
              reject(new Error("Got unexpected answer: " + answer.address));
            }
          }
        });
      });

      // if not resolved before timeout or end, then we have bug
      request.on('timeout', reject);
      request.on('end', function() {
        if (!expectedIp) {
          resolve();
        } else {
          reject(new Error("Didn't get the expected answer"));
        }
      });

      request.send();
    });
  };

  test("Resolve top-level TXT domain", async function() {
    return queryDNSServer(domain, 'TLD TXT', 'TXT')
  });

  test("Resolve subdomain TXT domain", async function() {
    return queryDNSServer(`abc.${domain}`, 'abc TXT', 'TXT')
  });

  test("Resolve subdomain TXT domain", async function() {
    return queryDNSServer(`no_records_known.${domain}`, null, 'TXT')
  });

  test("Resolve valid sub-domain", function() {
    var hostname  = statelessDNSServer.createHostname(
      [127, 0, 0, 1],
      new Date(Date.now() + 10 * 60 * 60 * 1000),
      secret, domain
    );

    return queryDNSServer(hostname, '127.0.0.1');
  });

  test("Resolve valid sub-domain in upper-case", function() {
    var hostname  = statelessDNSServer.createHostname(
      [127, 0, 0, 1],
      new Date(Date.now() + 10 * 60 * 60 * 1000),
      secret, domain
    ).toUpperCase();

    return queryDNSServer(hostname, '127.0.0.1');
  });

  test("Resolve valid sub-domain with different ip", function() {
    var hostname  = statelessDNSServer.createHostname(
      [124, 252, 123, 87],
      new Date(Date.now() + 10 * 60 * 60 * 1000),
      secret, domain
    );

    return queryDNSServer(hostname, [124, 252, 123, 87].join('.'));
  });

  test("Can't resolve invalid sub-domain", function() {
    var hostname  = statelessDNSServer.createHostname(
      [127, 0, 0, 1],
      new Date(Date.now() + 10 * 60 * 60 * 1000),
      secret, domain
    );

    return queryDNSServer('a' + hostname, null);
  });

  test("Can't resolve expired sub-domain", function() {
    var hostname  = statelessDNSServer.createHostname(
      [127, 0, 0, 1],
      new Date(Date.now() - 10 * 60 * 60 * 1000),
      secret, domain
    );

    return queryDNSServer(hostname, null);
  });

  test("Can't resolve sub-domain w. invalid signature", function() {
    var hostname  = statelessDNSServer.createHostname(
      [127, 0, 0, 1],
      new Date(Date.now() + 10 * 60 * 60 * 1000),
      'wrong secret', domain
    );

    return queryDNSServer(hostname, null);
  });

  test("Can't resolve sub-domain of wrong domain", function() {
    var hostname  = statelessDNSServer.createHostname(
      [127, 0, 0, 1],
      new Date(Date.now() + 10 * 60 * 60 * 1000),
      secret, "wrong-domain.local"
    );

    return queryDNSServer(hostname, null);
  });

  test("Can't resolve sub-domain of longer name", function() {
    var hostname  = statelessDNSServer.createHostname(
      [127, 0, 0, 1],
      new Date(Date.now() + 10 * 60 * 60 * 1000),
      secret, "my-test-domain.co.uk"
    );

    return queryDNSServer(hostname, null);
  });
});
