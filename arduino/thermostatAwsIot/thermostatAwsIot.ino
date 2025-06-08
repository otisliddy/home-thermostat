#include <ESP8266WiFi.h>
#include <ArduinoMqttClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "certs.h"

const char* SSID = "Rambler's Lodge";
const char* PASSWORD = "qwertytreW1%";

const char* AWS_IOT_ENDPOINT = "a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com";
const char* MAIN_TOPIC_UPDATE = "home-thermostat/main/update";
const char* MAIN_SHADOW_TOPIC_GET = "$aws/things/ht-main/shadow/get";
const char* MAIN_SHADOW_TOPIC_GET_ACCEPTED = "$aws/things/ht-main/shadow/get/accepted";
const char* MAIN_SHADOW_TOPIC_UPDATE = "$aws/things/ht-main/shadow/update";
const char* MAIN_SHADOW_TOPIC_UPDATE_DELTA = "$aws/things/ht-main/shadow/update/delta";
const char* IMMERSION_TOPIC_UPDATE = "home-thermostat/main/update";
const char* IMMERSION_SHADOW_TOPIC_GET = "$aws/things/ht-immersion/shadow/name/ht-immersion_shadow/get";
const char* IMMERSION_SHADOW_TOPIC_GET_ACCEPTED = "$aws/things/ht-immersion/shadow/name/ht-immersion_shadow/get/accepted";
const char* IMMERSION_SHADOW_TOPIC_UPDATE = "$aws/things/ht-immersion/shadow/name/ht-immersion_shadow/update";
const char* IMMERSION_SHADOW_TOPIC_UPDATE_DELTA = "$aws/things/ht-immersion/shadow/name/ht-immersion_shadow/update/delta";

const int MAIN_RELAY_PIN = D6;
const int IMMERSION_RELAY_PIN = D7;
const int TEMP_PIN = D5;

boolean mainStateOn = false;
boolean immersionStateOn = false;

WiFiClientSecure wifiClient = WiFiClientSecure();
MqttClient mqttClient(wifiClient);

OneWire oneWire(TEMP_PIN);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(9600);
  pinMode(MAIN_RELAY_PIN, OUTPUT);
  pinMode(IMMERSION_RELAY_PIN, OUTPUT);
  digitalWrite(MAIN_RELAY_PIN, LOW);
  digitalWrite(IMMERSION_RELAY_PIN, LOW);
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
  setCurrentTime();
  wifiClient.setTrustAnchors(new BearSSL::X509List(Amazon_Root_CA_1_pem));
  wifiClient.setClientRSACert(new BearSSL::X509List(e6da39c342_certificate_pem_crt), new BearSSL::PrivateKey(e6da39c342_private_pem_key));
}

void setCurrentTime() {
  const long gmtOffset_sec = 0;
  const int daylightOffset_sec = 0;

  configTime(gmtOffset_sec, daylightOffset_sec, "europe.pool.ntp.org", "time.nist.gov");

  Serial.print("Waiting for NTP time sync");
  time_t now = time(nullptr);
  while (now < 1700000000) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println();

  struct tm* timeinfo = localtime(&now);
  char buffer[80];
  strftime(buffer, 80, "%Y/%m/%d %H:%M:%S", timeinfo);
  Serial.print("NTP time set: ");
  Serial.println(buffer);
}

void loop() {
  mqttLoop();
  sensors.requestTemperatures();
  float temperatureC = sensors.getTempCByIndex(0);

  Serial.print("Temperature: ");
  Serial.print(temperatureC);
  Serial.println(" °C");
  delay(2000);
}

void mqttLoop() {
  if (!mqttClient.connected()) {
    connectToAwsIot();
  }

  int messageSize = mqttClient.parseMessage();
  if (messageSize) {
    String topic = mqttClient.messageTopic();
    String message;
    while (mqttClient.available()) {
      message += (char)mqttClient.read();
    }
    Serial.print("Received message on topic "); Serial.print(topic); Serial.println(": ");
    Serial.println(message);

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (error) {
      Serial.print("Failed to parse message to JSON: ");
      Serial.println(error.c_str());
      return;
    }

    if (topic.equals(MAIN_SHADOW_TOPIC_GET_ACCEPTED)) {
      mainStateOn = doc["state"]["desired"]["on"].as<bool>();
    } else if (topic.equals(MAIN_SHADOW_TOPIC_UPDATE_DELTA)) {
      mainStateOn = doc["state"]["on"].as<bool>();
    }

    if (topic.equals(IMMERSION_SHADOW_TOPIC_GET_ACCEPTED)) {
      immersionStateOn = doc["state"]["desired"]["on"].as<bool>();
    } else if (topic.equals(IMMERSION_SHADOW_TOPIC_UPDATE_DELTA)) {
      immersionStateOn = doc["state"]["on"].as<bool>();
    }

    controlMainRelay();
    controlImmersionRelay();
  }
}

void connectToAwsIot() {
  String willPayload = "{\"state\":{\"reported\":{\"connected\":false}}}";
  mqttClient.beginWill(MAIN_TOPIC_UPDATE, willPayload.length(), true, 1);
  mqttClient.print(willPayload);
  mqttClient.endWill();
  mqttClient.beginWill(IMMERSION_TOPIC_UPDATE, willPayload.length(), true, 1);
  mqttClient.print(willPayload);
  mqttClient.endWill();

  Serial.print("MQTT client connecting to "); Serial.println(AWS_IOT_ENDPOINT);
  if (mqttClient.connect(AWS_IOT_ENDPOINT, 8883)) {
    Serial.println("Connected");
  } else {
    Serial.print("failed, error:"); Serial.println(mqttClient.connectError());
    return;
  }

  mqttClient.subscribe(MAIN_SHADOW_TOPIC_GET_ACCEPTED);
  mqttClient.subscribe(MAIN_SHADOW_TOPIC_UPDATE_DELTA);
  mqttClient.subscribe(IMMERSION_SHADOW_TOPIC_GET_ACCEPTED);
  mqttClient.subscribe(IMMERSION_SHADOW_TOPIC_UPDATE_DELTA);
  delay(500);
  publishMessage(MAIN_SHADOW_TOPIC_UPDATE, "{\"state\":{\"reported\":{\"connected\":true}}}");
  publishMessage(MAIN_SHADOW_TOPIC_GET, "{}");
  publishMessage(IMMERSION_SHADOW_TOPIC_UPDATE, "{\"state\":{\"reported\":{\"connected\":true}}}");
  publishMessage(IMMERSION_SHADOW_TOPIC_GET, "{}");
}

void controlMainRelay() {
  if (mainStateOn) {
    Serial.println("Setting main heating on");
    digitalWrite(MAIN_RELAY_PIN, HIGH);
    publishMessage(MAIN_SHADOW_TOPIC_UPDATE, "{\"state\":{\"reported\":{\"on\":true}}}");
  } else {
    Serial.println("Setting main heating off");
    digitalWrite(MAIN_RELAY_PIN, LOW);
    publishMessage(MAIN_SHADOW_TOPIC_UPDATE, "{\"state\":{\"reported\":{\"on\":false}}}");
  }
}

void controlImmersionRelay() {
  if (immersionStateOn) {
    Serial.println("Setting immersion on");
    digitalWrite(IMMERSION_RELAY_PIN, HIGH);
    publishMessage(IMMERSION_SHADOW_TOPIC_UPDATE, "{\"state\":{\"reported\":{\"on\":true}}}");
  } else {
    Serial.println("Setting immersion off");
    digitalWrite(IMMERSION_RELAY_PIN, LOW);
    publishMessage(IMMERSION_SHADOW_TOPIC_UPDATE, "{\"state\":{\"reported\":{\"on\":false}}}");
  }
}

void publishMessage(const char* topic, const char* message) {
  Serial.println(String("Publishing to '") + topic + "' message: " + message);
  mqttClient.beginMessage(topic);
  mqttClient.print(message);
  mqttClient.endMessage();
}