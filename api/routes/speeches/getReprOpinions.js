import { SPEECHES_DATA_DIR } from "./constants.js";
import { readFileSync, readdirSync } from "fs";

export function getReprOpinions(request, response) {
  var reprName = request.params.reprName;
  var reprDirPath = SPEECHES_DATA_DIR + reprName;
  var topicFiles = readdirSync(reprDirPath);
  var topicsArray = [];
  topicFiles.forEach((topicFile) => {
    const topicFilePath = `${reprDirPath}/${topicFile}`;
    const topicData = readFileSync(topicFilePath);
    const topicDataJson = JSON.parse(topicData);
    const topicDict = { topic: topicFile.split(".")[0], data: topicDataJson };
    topicsArray.push(topicDict);
  });
  response.json({ reprName: reprName, opinions: topicsArray });
}
