---
title: Docker daemon ports vs forward container ports
date: 2024-01-04T19:38:44+0800
tags: [docker]
---
Docker daemon ports vs forward container ports 

# daemon ports 

> Docker daemon ports: add something like tcp://0.0.0.0:9999 in /etc/docker/daemon.json

It’s about the Docker daemon’s ability to accept commands (like starting/stopping containers, pulling images, etc.) over the network.

# forwarding container ports 

This is about exposing a specific port of a running container to the host or the outside world, allowing network traffic to reach the service running inside the container.

# summary 

In summary, setting the Docker daemon to listen on certain TCP ports is about remote management of the Docker engine itself, while forwarding ports for a container is about allowing external access to services running inside that container.