var dns = require('native-dns');
var _   = require('lodash');

// Application port
var PORT    = parseInt(process.env.PORT || 55553);
// Default TTL
var TTL     = parseInt(process.env.TTL || 600);

// Mappings from query suffixes to CNAME answers suffixes
// delimited with ',' and expressed with [src]=>[dst], as e.g:
//    "-ec2.tc.net=>.ec2.aws.com"
// Will answer any query for <prefix>-ec2.tc.net with:
//   IN <prefix>-ec2.tc.net. CNAME <prefix-with-dots>.ec2.aws.com.
// where, <prefix-with-dots> is <prefix> but with "-dot-" substituted
// for '.'.
var MAPPINGS = process.env.MAPPINGS || '';

// Parse MAPPINGS
MAPPINGS = MAPPINGS.split(',').map(function(entry) {
  var opts = entry.split('=>');
  if (opts.length !== 2) {
    console.error("Entry '%s' in MAPPING is missing separator '=>'",
                  entry);
    process.exit(1);
  }
  return {
    source:   opts[0],
    target:   opts[1]
  };
});

// Create DNS server
server = dns.createServer();

// Handle requests
server.on('request', function (request, response) {
  console.log("Query from: '%s':", request.address.address);
  request.question.forEach(function(q) {
    console.log("  Question: '%s'", q.name);
    MAPPINGS.forEach(function(mapping) {
      if (_.endsWith(q.name, mapping.source) && q['class'] === 1) {
        var answer = q.name.substr(0, q.name.length - mapping.source.length)
                           .replace(/-dot-/g, '.') + mapping.target;
        console.log("    Answer: '%s'", answer);
        response.answer.push(dns.CNAME({
          name:   q.name,
          data:   answer,
          ttl:    TTL
        }));
      }
    });
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
server.serve(PORT);

// Print message that we started
server.once('listening', function() {
  console.log("DNS server now listening on port: %s", PORT);
  console.log("");
});

// If the socket closes, there is no reason to stay alive
server.once('close', function() {
  console.error("Socket closed, let's crash...");
  process.exit(1);
});