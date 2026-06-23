#!/bin/bash
set -e

echo "==> Starting VPN Server Setup..."

# Generate self-signed cert if not exists
if [ ! -f /etc/ocserv/server-cert.pem ]; then
    echo "==> Generating self-signed certificate..."
    openssl req -x509 -newkey rsa:4096 \
        -keyout /etc/ocserv/server-key.pem \
        -out /etc/ocserv/server-cert.pem \
        -days 365 -nodes \
        -subj "/CN=VPN Server/O=MyVPN/C=US"
    echo "==> Certificate generated."
fi

# Create empty password file if not exists
if [ ! -f /etc/ocserv/ocpasswd ]; then
    echo "==> Creating empty password file..."
    touch /etc/ocserv/ocpasswd
fi

# Try NAT setup (may fail silently on Docker Desktop - that's OK)
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE 2>/dev/null || true
iptables -A FORWARD -i vpns+ -j ACCEPT 2>/dev/null || true
iptables -A FORWARD -o vpns+ -j ACCEPT 2>/dev/null || true

echo "==> Starting ocserv..."
exec ocserv --foreground --config /etc/ocserv/ocserv.conf