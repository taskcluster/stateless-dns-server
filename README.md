TaskCluster Worker DNS Server
=============================

This is a simple DNS server that rewrites queries for sub-domains in a given
format into complicated multi-level sub-domains of another domain. We use this
to assign a sub-domain name to all EC2 nodes, under a domain for which we have
a wild-card SSL certificate.

Configuration
-------------
The docker image built with `make image` takes an environment variable
`MAPPINGS`. This variables is a list of mappings from source sub-domain suffixes
to target sub-domain suffixes. Written as `[source]=>[target]` separated by `,`
if you want more than one mapping.

This is best explained with an example, if `MAPPINGS` is set to
`-ec2.tc.net=>.ec2.aws.net`, then a query for `<prefix>-ec2.tc.net` will result
in a CNAME record:
```
IN  <prefix>-ec2.tc.net.   CNAME  <prefix-with-dots>.ec2.aws.net.
```
Where `<prefix-with-dots>` is `<prefix>` with `-dot-` replaced with `.`.

Using this DNS server it's possible to use
`ec2-<ip>-dot-<region>-ec2.taskcluster-worker.net` as hostname for our workers
on EC2, by mapping `-ec2.taskcluster-worker.net` to `.compute.amazonaws.com`.
No need for dynamic DNS, no setup, no cleanup, all we need is a wild-card SSL
certificate for `*.taskcluster-worker.net` baked into our AMI.

By default DNS records are given a 600 seconds to live, you can modify this
using the `TTL` environment variable.

Development
-----------
To make the docker image easy to work with there is a very simple makefile in
this repository with the following targets. You can set the environment variable
`REGISTRY` to overwrite the default registry.

 * `make image`, build docker image
 * `make test`, test docker image with the mapping `-ec2.tc.net=>.ec2.aws.net`
    running on port `55553` of localhost.
 * `make push`, push the image to registry.

When running locally you can test the response from the DNS server using `dig`
under linux. For example `dig @localhost -p 55553 level2-dot-level1-ec2.tc.net`.