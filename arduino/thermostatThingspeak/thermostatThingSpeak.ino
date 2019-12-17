#include "ThingSpeak.h"
#include <ESP8266WiFi.h>

const char* SSID = "Tell My Wifi Love Her";
const char* PASSWORD = "Alanisgay99";
const char* SERVER_NAME = "api.thingspeak.com";

const char* API_WRITE_KEY = "QERCNNZO451W8OA3";
const unsigned long CHANNEL_ID = 879596;
const unsigned int F1_LIVE_TEMP = 1;
const unsigned int F2_MODE = 2;
const unsigned int F3_CONTROL_TEMP = 3;
const unsigned int F4_IS_HEATING_ON = 4;
const unsigned int MODE_OFF = 0;
const unsigned int MODE_ON = 1;
const unsigned int MODE_TEMP = 2;
const unsigned int uploadInterval = 600;

const int RELAY_PIN = D0;
const int TEMP_PIN = A0;

const double VCC = 3.3;             // NodeMCU on board 3.3v vcc
const double R2 = 10000;            // 10k ohm series resistor
const double ADC_RESOLUTION = 1023; // 10-bit adc

WiFiClient client;
int intervalElapsed = 0;
int controlMode = 0;
boolean isHeatingOn = false;

void setup() {
  Serial.begin(9600);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  pinMode(D4, OUTPUT);
  digitalWrite(D4, HIGH);
  setUpWiFi();
  ThingSpeak.begin(client);
}

void setUpWiFi(){
  WiFi.disconnect();
  delay(10);
  WiFi.begin(SSID, PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");
}

void loop() {
  double temp = readTemp();
  readControlMode();

  controlRelay(temp);
  
  if (intervalElapsed < uploadInterval){
    intervalElapsed +=2;
  } else {
    uploadToServer(temp);
    intervalElapsed = 0;
  }

  delay(2000);
}

double readTemp() {
  double adc_value = analogRead(TEMP_PIN);
  adc_value = isHeatingOn == false ? adc_value : adc_value / 1.102;
  
  double Vout = (adc_value * VCC) / ADC_RESOLUTION;
  double Rth = (VCC * R2 / Vout) - R2;

  /*  Steinhart-Hart Thermistor Equation */
  double tempKelvin = (1 / (0.001129148 + (0.000234125 * log(Rth)) + (0.0000000876741 * pow((log(Rth)),3))));
  
  double tempCelsius = tempKelvin - 273.15;  // Temperature in degree celsius
  Serial.println("Temperature: " + String(tempCelsius));
  return tempCelsius;
}

void readControlMode() {
  long startTime = millis();
  int reading = ThingSpeak.readFloatField(CHANNEL_ID, F2_MODE);
  Serial.println("Control Mode reading: " + String(reading));
  long timeTaken = millis() - startTime;
  Serial.println("Time taken: " + String(timeTaken));
  if (timeTaken < 5000){
    controlMode = reading;
  }
}

boolean controlRelay(double temp) {
  if (controlMode == 0){
    isHeatingOn = false;
  }
  else if (controlMode == 1){
    isHeatingOn = true;
  }
  else if (controlMode == 2){
    int controlTemp = ThingSpeak.readFloatField(CHANNEL_ID, F3_CONTROL_TEMP);
    Serial.println("Control Temp: " + String(controlTemp));
    if (temp < controlTemp) {
      isHeatingOn = true;
    } 
    else if (temp - 0.3 > controlTemp) {
      isHeatingOn = false;
    }
  }

  if (isHeatingOn == true) {
      digitalWrite(RELAY_PIN, HIGH);
  } else {
      digitalWrite(RELAY_PIN, LOW);
  }
}

void uploadToServer(double temp) {
  String isHeatingOnStr = isHeatingOn ? "1" : "0";
  ThingSpeak.setField(F1_LIVE_TEMP, String(temp));
  ThingSpeak.setField(F4_IS_HEATING_ON, isHeatingOnStr);
  int returnCode = ThingSpeak.writeFields(CHANNEL_ID, API_WRITE_KEY);
  if(returnCode == 200){
    Serial.println("Channel update successful.");
  }
  else{
    Serial.println("Problem updating channel. HTTP error code " + String(returnCode));
  }
}
