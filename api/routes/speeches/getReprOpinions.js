import { ALL_SPEECHES } from "./constants.js";
import { readFileSync } from "fs";

export function getReprOpinions(request, response) {
  var { reprName, topic, party } = request.params;
  var reprSpeechFilePath = `${ALL_SPEECHES}${party}/${reprName}/${topic}/opinions.json`;
  const topicData = readFileSync(reprSpeechFilePath);
  const topicDataJson = JSON.parse(topicData);
  response.json(topicDataJson);
}
