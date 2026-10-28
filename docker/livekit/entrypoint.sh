#!/bin/sh
set -eu
if [ -z "${LIVEKIT_API_KEY:-}" ] || [ -z "${LIVEKIT_API_SECRET:-}" ]; then
  echo "LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required" >&2
  exit 1
fi
cat >/tmp/livekit.yaml <<EOF
port: 7880
bind_addresses:
  - ""
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: false
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
webhook:
  api_key: ${LIVEKIT_API_KEY}
  urls:
    - http://nest:3001/api/meet/webhook
room:
  max_participants: 14
  empty_timeout: 300
EOF
if [ -n "${LIVEKIT_NODE_IP:-}" ]; then
  exec /livekit-server --config /tmp/livekit.yaml --node-ip "${LIVEKIT_NODE_IP}"
fi
exec /livekit-server --config /tmp/livekit.yaml
