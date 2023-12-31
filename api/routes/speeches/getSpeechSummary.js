import {
  SPEECHES_DATA_DIR,
  SPEECHES_LOWER_DIR,
  SPEECHES_UPPER_DIR,
} from "./constants.js";
import { readFileSync } from "fs";
const summary_json_path = SPEECHES_DATA_DIR + "summary.json";
const summary_lower_json_path = SPEECHES_LOWER_DIR + "summary.json";
const summary_upper_json_path = SPEECHES_UPPER_DIR + "summary.json";

export function getSpeechSummary(request, response) {
  const house = request.params.house;
  if (house === "lower") {
    const speech_summary_data = readFileSync(summary_lower_json_path);
    const speech_summary_file_json = JSON.parse(speech_summary_data);
    response.json(speech_summary_file_json);
    return;
  }
  if (house === "upper") {
    const speech_summary_data = readFileSync(summary_upper_json_path);
    const speech_summary_file_json = JSON.parse(speech_summary_data);
    response.json(speech_summary_file_json);
    return;
  }
  const speech_summary_data = readFileSync(summary_json_path);
  const speech_summary_file_json = JSON.parse(speech_summary_data);
  response.json(speech_summary_file_json);
}
