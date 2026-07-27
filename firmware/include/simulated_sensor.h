// Stand-in for a real temperature/humidity sensor (e.g. a DHT22 or SHT31).
// Swapping this for real hardware means replacing readTemperature()/
// readHumidity() with the sensor library's calls - everything downstream
// (JSON payload shape, publish cadence, MQTT topic) stays the same, which is
// the point: firmware config/behavior is decoupled from the physical sensor.

#pragma once

#include <Arduino.h>

class SimulatedSensor {
 public:
  void begin() {
    temperature_ = 22.0f;
    humidity_ = 45.0f;
  }

  // Small random walk so successive readings look like a real, slowly
  // drifting environment rather than pure noise.
  float readTemperature() {
    temperature_ += randomStep(-0.3f, 0.3f);
    temperature_ = constrain(temperature_, 15.0f, 32.0f);
    return roundTo(temperature_, 1);
  }

  float readHumidity() {
    humidity_ += randomStep(-1.0f, 1.0f);
    humidity_ = constrain(humidity_, 30.0f, 70.0f);
    return roundTo(humidity_, 1);
  }

 private:
  float temperature_;
  float humidity_;

  static float randomStep(float lo, float hi) {
    return lo + (hi - lo) * (static_cast<float>(random(0, 1000)) / 1000.0f);
  }

  static float roundTo(float value, int decimals) {
    float factor = pow(10, decimals);
    return round(value * factor) / factor;
  }
};
