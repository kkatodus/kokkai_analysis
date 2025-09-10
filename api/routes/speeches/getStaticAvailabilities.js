import { readFileSync } from "fs";
import { VISUALIZATION_DIR } from "./constants.js";

export function getStaticAvailabilities(request, response) {
  const visualization_path = VISUALIZATION_DIR + "static/available.json";
  const visualization_data = readFileSync(visualization_path);
  const visualization_json = JSON.parse(visualization_data);

  response.json(visualization_json);
}