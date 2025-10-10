#include <ESP8266WiFi.h>
#include <ArduinoMqttClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "certs.h"

const char* SSID = "Rambler's Lodge";
const char* PASSWORD = "qwertytreW1%";

const char* AWS_IOT_ENDPOINT = "a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com";
const char* SHADOW_TOPIC_UPDATE = "$aws/things/ht-dhw-temp/shadow/name/ht-dhw-temp_shadow/update";

const int TEMP_PIN = D2;
const unsigned long publishInterval = 60000; // 1 minute in milliseconds

OneWire oneWire(TEMP_PIN);
DallasTemperature sensors(&oneWire);

WiFiClientSecure wifiClient = WiFiClientSecure();
MqttClient mqttClient(wifiClient);

void setup() {
  Serial.begin(9600);

  // Initialize temperature sensor
  sensors.begin();

  setUpWiFi();
  setupAws();
}

void setUpWiFi(){
  WiFi.disconnect();
  delay(10);
  WiFi.begin(SSID, PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(200);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi connected");
}

void setupAws() {
  wifiClient.setTrustAnchors(new BearSSL::X509List(Amazon_Root_CA_1_pem));
  wifiClient.setClientRSACert(new BearSSL::X509List(e6da39c342_certificate_pem_crt), new BearSSL::PrivateKey(e6da39c342_private_pem_key));
}

void loop() {
  mqttLoop();
  delay(publishInterval);
}

void mqttLoop() {
  if (!mqttClient.connected()) {
    connectToAwsIot();
  }

  publishTemperature();
}

void connectToAwsIot() {
  Serial.print("MQTT client connecting to "); Serial.println(AWS_IOT_ENDPOINT);
  if (mqttClient.connect(AWS_IOT_ENDPOINT, 8883)) {
    Serial.println("Connected");
  } else {
    Serial.print("failed, error:"); Serial.println(mqttClient.connectError());
    return;
  }
}

void publishTemperature() {
  sensors.requestTemperatures();
  float temperatureC = sensors.getTempCByIndex(0);

  if (temperatureC == DEVICE_DISCONNECTED_C) {
    Serial.println("Error: Could not read temperature data");
    return;
  }

  // Create JSON payload
  StaticJsonDocument<200> doc;
  JsonObject state = doc.createNestedObject("state");
  JsonObject reported = state.createNestedObject("reported");
  reported["temperature"] = temperatureC;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  publishMessage(SHADOW_TOPIC_UPDATE, jsonPayload.c_str());
}

void publishMessage(const char* topic, const char* message) {
  Serial.println(String("Publishing to '") + topic + "' message: " + message);
  mqttClient.beginMessage(topic);
  mqttClient.print(message);
  mqttClient.endMessage();
}