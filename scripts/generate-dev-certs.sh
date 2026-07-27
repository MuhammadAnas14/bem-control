#!/usr/bin/env bash
#
# Bootstraps local-dev TLS material for the Mosquitto broker and seeds the
# broker's auth files:
#   1. A self-signed CA + a server cert/key signed by it (for MQTTS/WSS).
#   2. mosquitto/certs/passwords.txt with the backend's service account.
#   3. mosquitto/certs/acl.conf from the template.
#
# The CA cert is also copied into backend/certs so the Node MQTT client can
# verify the broker's certificate chain. None of this material is meant for
# production use - it's throwaway, developer-machine-only trust material.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERTS_DIR="$ROOT_DIR/mosquitto/certs"
BACKEND_CERTS_DIR="$ROOT_DIR/backend/certs"
DAYS=825

mkdir -p "$CERTS_DIR" "$BACKEND_CERTS_DIR"

if [[ -f "$CERTS_DIR/ca.crt" ]]; then
  echo "Dev certs already exist in $CERTS_DIR - skipping generation."
  echo "Delete mosquitto/certs/*.crt/*.key to force regeneration."
else
  echo "==> Generating CA key + certificate"
  openssl genrsa -out "$CERTS_DIR/ca.key" 2048
  openssl req -x509 -new -nodes -key "$CERTS_DIR/ca.key" -sha256 -days "$DAYS" \
    -subj "/C=US/O=BemControlDev/CN=Bem Control Dev CA" \
    -out "$CERTS_DIR/ca.crt"

  echo "==> Generating broker (server) key + CSR + certificate"
  openssl genrsa -out "$CERTS_DIR/server.key" 2048
  openssl req -new -key "$CERTS_DIR/server.key" \
    -subj "/C=US/O=BemControlDev/CN=localhost" \
    -out "$CERTS_DIR/server.csr"
  openssl x509 -req -in "$CERTS_DIR/server.csr" \
    -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -CAcreateserial \
    -days "$DAYS" -sha256 \
    -extfile <(printf "subjectAltName=DNS:localhost,DNS:mosquitto,IP:127.0.0.1") \
    -out "$CERTS_DIR/server.crt"
  rm -f "$CERTS_DIR/server.csr"
  chmod 644 "$CERTS_DIR"/*.crt "$CERTS_DIR"/*.key
fi

echo "==> Copying CA cert to backend/certs (used to verify the broker's chain)"
cp "$CERTS_DIR/ca.crt" "$BACKEND_CERTS_DIR/ca.crt"

if [[ ! -f "$CERTS_DIR/acl.conf" ]]; then
  echo "==> Seeding ACL file from template"
  cp "$ROOT_DIR/mosquitto/config/acl.conf.template" "$CERTS_DIR/acl.conf"
fi
# NOTE: kept world-readable (not 0600) on purpose - the file is bind-mounted
# read-only into the mosquitto container, which runs as its own internal
# "mosquitto" uid that can't chown/chmod it. Mosquitto only warns about this
# (it doesn't yet refuse to load the file); tightening perms here breaks
# the container's ability to read it at all.

if [[ ! -f "$CERTS_DIR/passwords.txt" ]]; then
  echo "==> Seeding broker password file with the backend service account"
  BACKEND_MQTT_PASSWORD="${BACKEND_MQTT_PASSWORD:-$(openssl rand -hex 16)}"
  if command -v mosquitto_passwd >/dev/null 2>&1; then
    touch "$CERTS_DIR/passwords.txt"
    mosquitto_passwd -b "$CERTS_DIR/passwords.txt" bem-backend "$BACKEND_MQTT_PASSWORD"
  elif command -v docker >/dev/null 2>&1; then
    touch "$CERTS_DIR/passwords.txt"
    docker run --rm -v "$CERTS_DIR:/certs" eclipse-mosquitto:2.0 \
      mosquitto_passwd -b /certs/passwords.txt bem-backend "$BACKEND_MQTT_PASSWORD"
  else
    echo "ERROR: need either 'mosquitto_passwd' (mosquitto-clients package) or docker installed." >&2
    exit 1
  fi
  echo
  echo "Generated backend MQTT credentials:"
  echo "  MQTT_USERNAME=bem-backend"
  echo "  MQTT_PASSWORD=$BACKEND_MQTT_PASSWORD"
  echo "Add these to backend/.env (see backend/.env.example)."
fi

echo "==> Done. Dev TLS + auth material is ready in mosquitto/certs/"
