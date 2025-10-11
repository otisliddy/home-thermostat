/* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT */

const { SFNClient, SendTaskSuccessCommand } = require('@aws-sdk/client-sfn');

const sfnClient = new SFNClient({ region: process.env.REGION });

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    if (!["INSERT", "MODIFY"].includes(record.eventName)) continue;

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) continue;

    const thingName = newImage.thingName?.S;
    const temperature = parseFloat(newImage.temperature?.N);
    const timestamp = parseInt(newImage.timestamp?.N, 10);

    if (isNaN(temperature) || !thingName) continue;

    console.log(
        `Processing record for ${thingName}: temperature=${temperature}, timestamp=${timestamp}`
    );

    // In production, you'd query your "scheduled-activity" table to find an active taskToken
    // Example: const taskToken = await getActiveTaskToken(thingName);
    const targetTemp = 45.0; // placeholder, normally retrieved from that table
    const taskToken = "PLACEHOLDER_TOKEN"; // replace with real lookup

    if (temperature >= targetTemp && taskToken !== "PLACEHOLDER_TOKEN") {
      console.log(`Target temperature reached (${temperature}°C). Sending success to Step Function.`);

      try {
        const command = new SendTaskSuccessCommand({
          taskToken,
          output: JSON.stringify({
            thingName,
            temperature,
            timestamp,
            reason: "target_reached",
          }),
        });
        await sfnClient.send(command);
        console.log("Sent Step Function success for", thingName);
      } catch (err) {
        console.error("Error sending Step Function success:", err);
      }
    } else if (temperature >= targetTemp) {
      console.warn(
          "Target reached but no active task token found — skipping Step Function callback."
      );
    }
  }

  return { status: "done" };
};
