REGISTRY ?= tutum.co/taskcluster

all: image

image:
	docker build -t "$(REGISTRY)/stateless-dns-server" \
							 --no-cache .

push:
	docker push "$(REGISTRY)/stateless-dns-server"

test:
	docker run -ti --rm --name tc-dns-server -p 55553:55553/udp \
						 -e DOMAIN='test-domain.local' \
						 -e PRIMARY_SECRET='no-secret' \
						 "${REGISTRY}/stateless-dns-server"

clean:
	-docker rm tc-dns-server

.PHONY: image push test clean
