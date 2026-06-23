FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    ocserv \
    openssl \
    iptables \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/ocserv/config-per-user

COPY ocserv.conf /etc/ocserv/ocserv.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 443/tcp
EXPOSE 443/udp

ENTRYPOINT ["/entrypoint.sh"]