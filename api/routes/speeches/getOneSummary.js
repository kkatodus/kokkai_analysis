import { SPEECHES_UPPER_DIR, SPEECHES_LOWER_DIR } from "./constants.js";
import { readFileSync } from "fs";

const summary_lower_json_path = SPEECHES_LOWER_DIR + "summary.json";
const summary_upper_json_path = SPEECHES_UPPER_DIR + "summary.json";

export function getOneSummary(request, response) {
  const { house, reprName, party } = request.params;
  if (house === "lower") {
    var speech_summary_data = readFileSync(summary_lower_json_path);
  }
  if (house === "upper") {
    var speech_summary_data = readFileSync(summary_upper_json_path);
  }
  const speech_summary_file_json = JSON.parse(speech_summary_data);
  response.json(speech_summary_file_json.reprs[party][reprName]);
}
