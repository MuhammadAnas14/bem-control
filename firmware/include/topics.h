// MQTT topic scheme shared with the backend (backend/src/mqtt/topics.js and
// docs/mqtt-topics.md). Every device publishes/subscribes on a namespace
// scoped to its own orgId/deviceKey - the broker's ACL (see
// mosquitto/config/acl.conf.template) enforces that a device's credentials
// can only touch its own four topics, even though the backend's wildcard
// subscription can see every device's telemetry.

#pragma once

#include <Arduino.h>
#include "secrets.h"

inline String topicTelemetry() {
  return String("orgs/") + ORG_ID + "/devices/" + DEVICE_KEY + "/telemetry";
}

inline String topicStatus() {
  return String("orgs/") + ORG_ID + "/devices/" + DEVICE_KEY + "/status";
}

inline String topicCommands() {
  return String("orgs/") + ORG_ID + "/devices/" + DEVICE_KEY + "/commands";
}

inline String topicConfig() {
  return String("orgs/") + ORG_ID + "/devices/" + DEVICE_KEY + "/config";
}
