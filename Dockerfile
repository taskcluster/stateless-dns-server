FROM          node:0.12-onbuild
MAINTAINER    Jonas Finnemann Jensen <jopsen@gmail.com>

# Default Configuration
ENV           TTL               600
ENV           PORT              55553

# Exposed port 55553 UDP
EXPOSE        55553/udp