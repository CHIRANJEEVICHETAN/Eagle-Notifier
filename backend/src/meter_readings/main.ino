#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ModbusMaster.h>

// ——— Wi‑Fi credentials ———
const char* ssid     = "Loginware_2";
const char* password = "........";

// ——— Your Express endpoint ———
const char* SERVER_URL = "http://192.168.31.256:3000/api/meter";

// ——— RS485 connection settings ———
#define MAX485_DE 5
#define RX_PIN    16
#define TX_PIN    17

ModbusMaster node;

// Modbus register addresses
#define REG_VOLTAGE   3034
#define REG_CURRENT   3008
#define REG_FREQUENCY 3108
#define REG_ENERGY    2698
#define REG_PF        3082
#define REG_POWER     3058

void preTransmission() { digitalWrite(MAX485_DE, HIGH); }
void postTransmission() { digitalWrite(MAX485_DE, LOW); }

void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected. IP = " + WiFi.localIP().toString());
}

float readFloatRegister(uint16_t regAddress) {
  uint8_t res = node.readHoldingRegisters(regAddress, 2);
  if (res == node.ku8MBSuccess) {
    uint16_t buf[2] = { node.getResponseBuffer(0),
                        node.getResponseBuffer(1) };
    uint32_t comb   = ((uint32_t)buf[1] << 16) | buf[0];
    float value;
    memcpy(&value, &comb, sizeof(value));
    return value;
  } else {
    Serial.printf("Modbus error @%u: %u\n", regAddress, res);
    return NAN;
  }
}

void setup() {
  pinMode(MAX485_DE, OUTPUT);
  digitalWrite(MAX485_DE, LOW);

  Serial.begin(115200);
  Serial2.begin(19200, SERIAL_8E1, RX_PIN, TX_PIN);

  node.begin(1, Serial2);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);

  connectWiFi();
}

void loop() {
  // 1) Read all values
  float voltage     = readFloatRegister(REG_VOLTAGE);
  float current     = readFloatRegister(REG_CURRENT);
  float frequency   = readFloatRegister(REG_FREQUENCY);
  float energy      = readFloatRegister(REG_ENERGY);
  float power       = readFloatRegister(REG_POWER);
  float powerFactor = readFloatRegister(REG_PF);

  // 2) Print locally
  Serial.println("----- Meter Readings -----");
  if (!isnan(voltage))     Serial.printf("Voltage (V): %.2f\n", voltage);
  if (!isnan(current))     Serial.printf("Current (A): %.2f\n", current);
  if (!isnan(frequency))   Serial.printf("Frequency (Hz): %.2f\n", frequency);
  if (!isnan(energy))      Serial.printf("Energy (kWh): %.2f\n", energy);
  if (!isnan(power))       Serial.printf("Power (kW): %.2f\n", power);
  if (!isnan(powerFactor)) Serial.printf("Power Factor: %.3f\n", powerFactor);
  Serial.println("--------------------------");

  // 3) Send to server if Wi‑Fi still connected
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");

    // build JSON
    StaticJsonDocument<256> doc;
    doc["voltage"]   = isnan(voltage)     ? nullptr : voltage;
    doc["current"]   = isnan(current)     ? nullptr : current;
    doc["frequency"] = isnan(frequency)   ? nullptr : frequency;
    doc["energy"]    = isnan(energy)      ? nullptr : energy;
    doc["power"]     = isnan(power)       ? nullptr : power;
    doc["pf"]        = isnan(powerFactor) ? nullptr : powerFactor;

    String payload;
    serializeJson(doc, payload);

    // post it
    int code = http.POST(payload);
    if (code > 0) {
      Serial.printf("→ HTTP %d\n", code);
      Serial.println(http.getString());
    } else {
      Serial.printf("POST failed: %s\n", http.errorToString(code).c_str());
    }
    http.end();
  } else {
    Serial.println("WiFi disconnected, skipping POST");
  }

  // 4) Wait before next cycle
  delay(5000);
}
