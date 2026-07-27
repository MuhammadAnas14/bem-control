// Bem Control - ESP32 device firmware
//
// Responsibilities:
//   1. Join WiFi and keep a TLS (MQTTS) connection to the Bem Control broker,
//      authenticating with the per-device credentials issued at provisioning.
//   2. Publish simulated sensor telemetry on a configurable interval.
//   3. Subscribe to this device's command + config topics and act on them
//      (reboot, push a new publish interval, trigger an OTA update).
//   4. Reconnect gracefully - WiFi and MQTT drops are treated as expected,
//      not fatal, conditions for a field-deployed device.
//
// See docs/mqtt-topics.md for the full topic scheme this firmware implements.

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <time.h>

#include "secrets.h"
#include "ca_cert.h"
#include "topics.h"
#include "simulated_sensor.h"

// --- Globals -----------------------------------------------------------

WiFiClientSecure tlsClient;
PubSubClient mqttClient(tlsClient);
Preferences preferences;
SimulatedSensor sensor;

String kTopicTelemetry;
String kTopicStatus;
String kTopicCommands;
String kTopicConfig;

// Publish interval is persisted in NVS (flash) so a CONFIG_UPDATE command
// survives a reboot instead of resetting to the firmware default.
uint32_t publishIntervalMs = 30000;
unsigned long lastPublishAt = 0;

// Exponential backoff for MQTT reconnects, capped at 60s, so a device that
// loses its broker for an extended period doesn't hammer it with retries.
uint32_t reconnectBackoffMs = 1000;
unsigned long lastReconnectAttemptAt = 0;
const uint32_t kMaxReconnectBackoffMs = 60000;

// --- Time -----------------------------------------------------------------

bool timeIsSynced() {
  // Before NTP sync, time() returns a small number (seconds since boot-ish
  // epoch 0); a real synced clock is always well past this threshold.
  return time(nullptr) > 1700000000;
}

String currentTimestampIso8601() {
  time_t now = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// --- WiFi -----------------------------------------------------------------

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[wifi] connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[wifi] connected, IP=%s\n", WiFi.localIP().toString().c_str());
    // NTP sync matters here mainly so published readings carry a real
    // timestamp - the backend falls back to server-receive-time if absent,
    // so this is a nice-to-have, not a hard requirement to keep publishing.
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  } else {
    Serial.println("\n[wifi] connection attempt timed out, will retry");
  }
}

// --- MQTT command handling --------------------------------------------

void applyDesiredConfig(JsonObjectConst config) {
  if (config["publishIntervalSeconds"].is<int>()) {
    uint32_t seconds = config["publishIntervalSeconds"].as<uint32_t>();
    publishIntervalMs = seconds * 1000UL;
    preferences.putUInt("publishMs", publishIntervalMs);
    Serial.printf("[config] publish interval set to %us\n", seconds);
  }
}

void performOtaUpdate(const String& firmwareUrl) {
  Serial.printf("[ota] starting update from %s\n", firmwareUrl.c_str());

  // Reuses the same TLS trust anchor as MQTT - the firmware host is assumed
  // to sit behind the same CA in this dev/demo setup. In production this
  // would point at a CDN with a publicly-trusted certificate instead.
  httpUpdate.rebootOnUpdate(true);
  t_httpUpdate_return result = httpUpdate.update(tlsClient, firmwareUrl);

  switch (result) {
    case HTTP_UPDATE_FAILED:
      Serial.printf("[ota] failed (%d): %s\n", httpUpdate.getLastError(),
                    httpUpdate.getLastErrorString().c_str());
      break;
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("[ota] no update available");
      break;
    case HTTP_UPDATE_OK:
      Serial.println("[ota] update applied, rebooting");
      break;
  }
}

void handleCommand(JsonObjectConst command) {
  const char* type = command["type"] | "";

  if (strcmp(type, "REBOOT") == 0) {
    Serial.println("[command] REBOOT requested");
    mqttClient.publish(kTopicStatus.c_str(), "offline", true);
    delay(250);
    ESP.restart();
  } else if (strcmp(type, "CONFIG_UPDATE") == 0) {
    applyDesiredConfig(command["payload"].as<JsonObjectConst>());
  } else if (strcmp(type, "OTA_TRIGGER") == 0) {
    const char* url = command["payload"]["firmwareUrl"] | "";
    if (strlen(url) > 0) performOtaUpdate(String(url));
  } else {
    Serial.printf("[command] unrecognized type: %s\n", type);
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("[mqtt] failed to parse message on %s: %s\n", topic, err.c_str());
    return;
  }

  String topicStr(topic);
  if (topicStr == kTopicCommands) {
    handleCommand(doc.as<JsonObjectConst>());
  } else if (topicStr == kTopicConfig) {
    // Retained message delivered right after subscribing on (re)connect -
    // this is how a device picks up config changes made while it was offline.
    applyDesiredConfig(doc.as<JsonObjectConst>());
  }
}

// --- MQTT connection -----------------------------------------------------

bool connectMqtt() {
  Serial.printf("[mqtt] connecting to %s:%d as %s\n", MQTT_HOST, MQTT_PORT, MQTT_USERNAME);

  // Last Will and Testament: if this device disappears without a clean
  // disconnect (crash, power loss, WiFi drop), the broker publishes
  // "offline" on our behalf so the dashboard doesn't show a stale "online"
  // status forever.
  bool connected = mqttClient.connect(
      DEVICE_KEY,          // MQTT client ID
      MQTT_USERNAME,        // per-device username issued at provisioning
      MQTT_API_KEY,         // per-device password (the plaintext API key)
      kTopicStatus.c_str(), // will topic
      1,                     // will QoS
      true,                  // will retain
      "offline"              // will message
  );

  if (connected) {
    Serial.println("[mqtt] connected");
    mqttClient.publish(kTopicStatus.c_str(), "online", true);
    mqttClient.subscribe(kTopicCommands.c_str(), 1);
    mqttClient.subscribe(kTopicConfig.c_str(), 1);
    reconnectBackoffMs = 1000;
  } else {
    Serial.printf("[mqtt] connect failed, rc=%d\n", mqttClient.state());
  }
  return connected;
}

void maintainMqttConnection() {
  if (mqttClient.connected()) return;

  unsigned long now = millis();
  if (now - lastReconnectAttemptAt < reconnectBackoffMs) return;
  lastReconnectAttemptAt = now;

  if (!connectMqtt()) {
    reconnectBackoffMs = min(reconnectBackoffMs * 2, kMaxReconnectBackoffMs);
  }
}

// --- Telemetry --------------------------------------------------------

void publishTelemetry() {
  JsonDocument doc;
  doc["temperature"] = sensor.readTemperature();
  doc["humidity"] = sensor.readHumidity();
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  if (timeIsSynced()) {
    doc["ts"] = currentTimestampIso8601();
  }

  char buffer[256];
  size_t len = serializeJson(doc, buffer);
  mqttClient.publish(kTopicTelemetry.c_str(), reinterpret_cast<uint8_t*>(buffer), len, false);
  Serial.printf("[telemetry] published %s\n", buffer);
}

// --- Arduino entry points --------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(200);

  kTopicTelemetry = topicTelemetry();
  kTopicStatus = topicStatus();
  kTopicCommands = topicCommands();
  kTopicConfig = topicConfig();

  preferences.begin("bem-control", false);
  publishIntervalMs = preferences.getUInt("publishMs", 30000);

  sensor.begin();
  randomSeed(esp_random());

  connectWiFi();

  // TLS handshake: the broker presents a certificate signed by our dev CA
  // (embedded at build time in ca_cert.h, see scripts/generate-firmware-ca-header.sh).
  // setCACert() makes WiFiClientSecure verify that chain - without it,
  // PubSubClient would either fail the connection or (if misconfigured to
  // skip verification) accept any TLS endpoint, which defeats the point of
  // using MQTTS at all. Device *identity* is a separate layer on top of
  // this transport-level encryption: the broker only lets this connection
  // publish/subscribe on this device's own topics after it authenticates
  // with MQTT_USERNAME/MQTT_API_KEY below (enforced by the broker's ACL).
  tlsClient.setCACert(BEM_CONTROL_CA_CERT);

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(512);

  connectMqtt();
}

void loop() {
  connectWiFi();
  maintainMqttConnection();
  mqttClient.loop();

  unsigned long now = millis();
  if (mqttClient.connected() && now - lastPublishAt >= publishIntervalMs) {
    lastPublishAt = now;
    publishTelemetry();
  }
}
