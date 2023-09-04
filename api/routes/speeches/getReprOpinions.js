import { SPEECHES_DATA_DIR } from "./constants.js";
import { readFileSync, readdirSync } from "fs";

export function getReprOpinions(request, response) {
  var { reprName, party, topic, idx } = request.params;
  var reprSpeechFilePath = `${SPEECHES_DATA_DIR}${party}/${reprName}/${topic}/${idx}.json`;
  const topicData = readFileSync(reprSpeechFilePath);
  const topicDataJson = JSON.parse(topicData);
  response.json(topicDataJson);
}
