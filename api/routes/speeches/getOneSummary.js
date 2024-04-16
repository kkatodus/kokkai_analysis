import { ALL_SPEECHES } from "./constants.js";
import { readFileSync } from "fs";

const summary_json_path = ALL_SPEECHES + "summary.json";

export function getOneSummary(request, response) {
  const { reprName, party } = request.params;
  var speech_summary_data = readFileSync(summary_json_path);
  const speech_summary_file_json = JSON.parse(speech_summary_data);
  const one_summary = speech_summary_file_json.reprs.find(
    (repr) => repr.name === reprName && repr.party === party
  );
  response.json(one_summary);
}
