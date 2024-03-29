#include <ESP8266WiFi.h>
#include <ArduinoMqttClient.h>
#include <ArduinoJson.h>
#include "certs.h"

const char* SSID = "VODAFONE-5G_EXT_EXT";
const char* PASSWORD = "qwertytreW1%";

const char* AWS_IOT_ENDPOINT = "a1t0rh7vtg6i19-ats.iot.eu-west-1.amazonaws.com";
const char* AWS_IOT_DEVICE_NAME = "ht-main";
const char* AWS_IOT_TEMP_TOPIC = "$aws/rules/handleTempUpdate/$aws/things/ht-main/temp";
const char* TOPIC_UPDATE = "home-thermostat/main/update";
const char* SHADOW_TOPIC_GET = "$aws/things/ht-main/shadow/get";
const char* SHADOW_TOPIC_GET_ACCEPTED = "$aws/things/ht-main/shadow/get/accepted";
const char* SHADOW_TOPIC_UPDATE = "$aws/things/ht-main/shadow/update";
const char* SHADOW_TOPIC_UPDATE_DELTA = "$aws/things/ht-main/shadow/update/delta";

const int RELAY_PIN = D1;
const int TEMP_PIN = A0;
const double VCC = 3.3;             // NodeMCU on board 3.3v vcc
const double R2 = 10000;            // 10k ohm series resistor
const double ADC_RESOLUTION = 1023; // 10-bit adc

int intervalElapsed = 0;
boolean stateOn = false;

WiFiClientSecure wifiClient = WiFiClientSecure();
MqttClient mqttClient(wifiClient);

void setup() {
  Serial.begin(9600);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
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
  Serial.println("");
  Serial.println("WiFi connected");
}

void setupAws() {
  setCurrentTime();

  wifiClient.setCertificate(e6da39c342_certificate_pem_crt, e6da39c342_certificate_pem_crt_len);
  wifiClient.setPrivateKey(e6da39c342_private_pem_key, e6da39c342_private_pem_key_len);
  wifiClient.setCACert(Amazon_Root_CA_1_pem, Amazon_Root_CA_1_pem_len); // TODO use role cert
}

void setCurrentTime() {
  const long  gmtOffset_sec = 0;
  const int   daylightOffset_sec = 0;
  time_t now;
  configTime(gmtOffset_sec, daylightOffset_sec, "europe.pool.ntp.org");
  Serial.print("Waiting for NTP time sync... ");
  now = time(nullptr);
  
  struct tm* timeinfo; 
  timeinfo = localtime(&now); 
  char buffer[80];
  strftime(buffer, 80, "%Y/%m/%d %H:%M:%S",timeinfo); 
  Serial.println(buffer);
}

/*
* Loop 
*/

void loop() {
  mqttLoop();
  delay(2000);
}

void mqttLoop() {
  if (!mqttClient.connected()) {
    connectToAwsIot();
  }
  
  int messageSize = mqttClient.parseMessage();
  if (messageSize) {
    String topic = mqttClient.messageTopic();
    
    char message[512] = "";
    while (mqttClient.available()) {
      append(message, (char)mqttClient.read());
    }
    Serial.print("Received message on topic "); Serial.print(topic); Serial.println(": "); Serial.println(message);

    StaticJsonBuffer<512> jsonBuffer;
    JsonObject& messageJson = jsonBuffer.parseObject(message);
    if (!messageJson.success()) {
      Serial.print("Failed to parse message to JSON: "); Serial.println(message);
      return;
    }

    if (strcmp(toChars(topic), SHADOW_TOPIC_GET_ACCEPTED) == 0) {
      stateOn = messageJson["state"]["desired"]["on"];
    } else if (strcmp(toChars(topic), SHADOW_TOPIC_UPDATE_DELTA) == 0) {
      stateOn = messageJson["state"]["on"];
    }

    controlRelay();
  }
}


void connectToAwsIot() {
  String willPayload = "{\"state\":{\"reported\":{\"connected\":false}}}";
  mqttClient.beginWill(TOPIC_UPDATE, willPayload.length(), true, 1);
  mqttClient.print(willPayload);
  mqttClient.endWill();
  
  Serial.print("MQTT client connecting to "); Serial.println(AWS_IOT_ENDPOINT); 
  if (mqttClient.connect(AWS_IOT_ENDPOINT, 8883)) {
    Serial.println("Connected");
  } else {
    Serial.print("failed, error:"); Serial.print(mqttClient.connectError());
    return;
  }
  
  mqttClient.subscribe(SHADOW_TOPIC_GET_ACCEPTED);
  mqttClient.subscribe(SHADOW_TOPIC_UPDATE_DELTA);
  delay(500);
  publishMessage(SHADOW_TOPIC_UPDATE, "{\"state\":{\"reported\":{\"connected\":true}}}");
  publishMessage(SHADOW_TOPIC_GET, "{}");
}

boolean controlRelay() {
  if (stateOn == true) {
    Serial.println("Setting on");
    digitalWrite(RELAY_PIN, HIGH);
    publishMessage(SHADOW_TOPIC_UPDATE, "{\"state\":{\"reported\":{\"on\":true}}}");
  } else {
    Serial.println("Setting off");
    digitalWrite(RELAY_PIN, LOW);
    publishMessage(SHADOW_TOPIC_UPDATE, "{\"state\":{\"reported\":{\"on\":false}}}");
  }
}


double readTemp() {
  double adc_value = analogRead(TEMP_PIN);
  Serial.println("adc_value1 " + String(adc_value));
  adc_value = adc_value / 1.18;
  Serial.println("adc_value2 " + String(adc_value));
  
  double Vout = (adc_value * VCC) / ADC_RESOLUTION;
  double Rth = (VCC * R2 / Vout) - R2;

  /*  Steinhart-Hart Thermistor Equation */
  double tempKelvin = (1 / (0.001129148 + (0.000234125 * log(Rth)) + (0.0000000876741 * pow((log(Rth)),3))));
  
  double tempCelsius = tempKelvin - 273.15;  // Temperature in degree celsius
  Serial.println("Temperature: " + String(tempCelsius));
  return tempCelsius;
}

void publishMessage(const char* topic, char* message) {
  Serial.print("Publishing message: "); Serial.println(message);
  mqttClient.beginMessage(topic);
  mqttClient.print(message);
  mqttClient.endMessage();
}

void append(char* s, char c) {
        int len = strlen(s);
        s[len] = c;
        s[len+1] = '\0';
}

char* toChars(String s){
    char topicChars[s.length()+1];
    s.toCharArray(topicChars, s.length()+1);
    return topicChars;
}
