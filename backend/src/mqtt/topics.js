// Bem Control MQTT topic scheme (documented in full at docs/mqtt-topics.md)
//
//   orgs/{orgId}/devices/{deviceKey}/telemetry   device -> backend, QoS 1
//   orgs/{orgId}/devices/{deviceKey}/status      device -> backend, retained, LWT
//   orgs/{orgId}/devices/{deviceKey}/commands    backend -> device, QoS 1
//   orgs/{orgId}/devices/{deviceKey}/config      backend -> device, retained
//
// orgId is embedded (rather than relying on ACLs alone) so the backend's
// single wildcard subscription can route an incoming message to the right
// tenant without a DB lookup keyed only on deviceKey.

const TELEMETRY_SUFFIX = 'telemetry';
const STATUS_SUFFIX = 'status';
const COMMANDS_SUFFIX = 'commands';
const CONFIG_SUFFIX = 'config';

const telemetryTopic = (orgId, deviceKey) => `orgs/${orgId}/devices/${deviceKey}/${TELEMETRY_SUFFIX}`;
const statusTopic = (orgId, deviceKey) => `orgs/${orgId}/devices/${deviceKey}/${STATUS_SUFFIX}`;
const commandsTopic = (orgId, deviceKey) => `orgs/${orgId}/devices/${deviceKey}/${COMMANDS_SUFFIX}`;
const configTopic = (orgId, deviceKey) => `orgs/${orgId}/devices/${deviceKey}/${CONFIG_SUFFIX}`;

const TELEMETRY_WILDCARD = `orgs/+/devices/+/${TELEMETRY_SUFFIX}`;
const STATUS_WILDCARD = `orgs/+/devices/+/${STATUS_SUFFIX}`;

/** Parses `orgs/{orgId}/devices/{deviceKey}/{suffix}` into its parts, or null if it doesn't match. */
function parseDeviceTopic(topic) {
  const match = topic.match(/^orgs\/([^/]+)\/devices\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  const [, orgId, deviceKey, suffix] = match;
  return { orgId, deviceKey, suffix };
}

module.exports = {
  telemetryTopic,
  statusTopic,
  commandsTopic,
  configTopic,
  TELEMETRY_WILDCARD,
  STATUS_WILDCARD,
  parseDeviceTopic,
};
