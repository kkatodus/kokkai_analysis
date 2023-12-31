import { SPEECHES_LOWER_DIR, SPEECHES_UPPER_DIR } from "./constants.js";
import { readFileSync } from "fs";

export function getReprOpinions(request, response) {
  var { house, reprName, party, topic } = request.params;
  if (house === "lower") {
    var reprSpeechFilePath = `${SPEECHES_LOWER_DIR}${party}/${reprName}/${topic}/opinions.json`;
  } else if (house === "upper") {
    var reprSpeechFilePath = `${SPEECHES_UPPER_DIR}${party}/${reprName}/${topic}/opinions.json`;
  }
  const topicData = readFileSync(reprSpeechFilePath);
  const topicDataJson = JSON.parse(topicData);
  response.json(topicDataJson);
}
