Stateless DNS Server [![Circle CI](https://circleci.com/gh/taskcluster/stateless-dns-server.svg?style=badge)](https://circleci.com/gh/taskcluster/stateless-dns-server)
====================
This is a stateless DNS server that returns `A` records for sub-domains, where
the sub-domain label encodes the IP-address, expiration date, a random salt and
an HMAC-SHA256 signature truncated to 128 bits.

This is allows for assigning temporary sub-domains names to nodes with a public
IP-address. The same problem can also be solved with dynamic DNS server, but
such entries often requires clean-up. The beauty of this approach is that the
DNS server is state-less, so there is no stale DNS records to discard.

In TaskCluster this is used to assign temporary sub-domain names to EC2 spot
nodes, such that we can host HTTPS resources, such as live logs, without
updating and cleaning up the state of the DNS server.

Notice, that with IP-address, expiration date, random salt and HMAC-SHA256
signature encoded in the sub-domain label, you cannot decide which sub-domain
label you wish to have. Hence, this is only useful in cases were the hostname
for your node is transmitted to clients by other means, for example in a message
over RabbitMQ or as temporary entry in a database. Further more, to serve HTTPS
content you'll need a wild-card SSL certificate, for domain managed by this
DNS server.

Note, this obviously doesn't have many applications, as the sub-domain label
is stateful. It's mostly for serving HTTPS content from nodes that come and go
quickly with minimal setup, where the hostname is transmitted by other means.
Generally, any case where you might consider using the default EC2 hostname.

Sub-domain Label Generation
---------------------------
The sub-domain label encodes the following parameters:
 * `ip`, address to which the `A` record returned should point,
 * `expires`, expiration of sub-domain as number of ms since epoch,
 * `salt`, random salt, allowing for generation of multiple sub-domain labels
    for each IP-address, and,
 * `signature`, HMAC-SHA256 signature of `ip`, `expires` and `salt` truncated
    to 128 bit.

The `expires` property is encoded as a big-endian 64 bit signed integer. The
`salt` property is encoded as bit-endian 16 bit unsigned integer. All properties
are concatenated and base32 (RFC 3548) encoded to form the sub-domain label.

Example pseudo code:
```
  ip        = a.b.c.d
  expires   = Date.now() + number of ms to expiration
  salt      = random 16 bit integer
  signature = HMAC-SHA256(ip + expires + salt).slice(0, 16);
  label     = ip + expires + salt + signature
  hostname  = label + '.' + DOMAIN
```

You can also load this npm package as a library and use it to generate
sub-domain labels. See example below:
```js
var statelessDNSServer = require('stateless-dns-server');

var ip        = [127, 0, 0, 1];
var expires   = new Date(Date.now() + 10 * 60 * 60 * 1000);   // 10 minutes
var secret    = '...';  // 256 bit randomness recommended
var domain    = 'taskcluster-worker.net';
var hostname  = statelessDNSServer.createHostname(ip, expires, secret, domain);
console.log(hostname);
// out: miy6hl7234h3kcycsqfhrxgnltaa2oc4owdlo5bnvbpa5mzd.taskcluster-worker.net
```

The resulting `hostname` in the example above will resolved to `127.0.0.1` for
the next 10 minutes, after which only cached DNS entries may stick around,
depend on the configured `TTL`.

Configuration
-------------
The docker image takes the following environment variables for configuration.
 * `PORT`, port to host DNS server on (defaults to `55553`),
 * `TTL`, time-to-live for DNS records returned in seconds (defaults to `600`),
 * `DOMAIN`, domain under which to manage sub-domains (**required**), and
 * `SECRET`, secret token for HMAC-SHA256 signature generation (**required**).

Development & Deployment
------------------------
As usual `npm test` will run tests over localhost. For deployment you can
build a docker image that is easy to deploy. There is a very simple makefile in
this repository with the following targets. You can set the environment variable
`REGISTRY` to overwrite the default registry.

 * `make image`, build docker image
 * `make test`, test docker image with `DOMAIN=test-domain.local` and
    `SECRET=no-secret` running on port `55553` of localhost.
 * `make push`, push the image to registry.

When running locally you can test the response from the DNS server using `dig`
under Linux. For example `dig @localhost -p 55553 <label>.test-domain.local`.
This is useful before deploying, or just after deployment to verify that
everything works.

Reporting Issues
----------------
Issues should be reported under the under the [Testing :: TaskCluster component at bugzilla.mozilla.org](https://bugzilla.mozilla.org/enter_bug.cgi?product=Testing&component=TaskCluster).
View issues with this [saved search](http://mzl.la/1GqNUDI).
