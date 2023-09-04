import { SPEECHES_DATA_DIR } from "./constants.js";
import { readFileSync } from "fs";

const summary_json_path = SPEECHES_DATA_DIR + "summary.json";

export function getSpeechSummary(request, response) {
  const speech_summary_data = readFileSync(summary_json_path);
  const speech_summary_file_json = JSON.parse(speech_summary_data);
  response.json(speech_summary_file_json);
}
