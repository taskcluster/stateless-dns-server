REGISTRY ?= tutum.co/taskcluster

all: image

image:
	docker build -t "$(REGISTRY)/taskcluster-worker-dns-server" \
							 --no-cache .

push:
	docker push "$(REGISTRY)/taskcluster-worker-dns-server"

test:
	docker run -ti --rm --name tc-dns-server -p 55553:55553/udp \
						 -e MAPPINGS='-ec2.tc.net=>.ec2.aws.net' \
						 "${REGISTRY}/taskcluster-worker-dns-server"

clean:
	-docker rm tc-dns-server

.PHONY: image push test clean