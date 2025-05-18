import { readFileSync } from "fs";
import { VISUALIZATION_DIR } from "./constants.js";

export function getDiachronicAvailabilities(request, response) {
  const visualization_path = VISUALIZATION_DIR + "diachronic/available.json";
  const visualization_data = readFileSync(visualization_path);
  const visualization_json = JSON.parse(visualization_data);

  response.json(visualization_json);
}