import { GEO_DATA_DIR } from "./constants.js";
import { readFileSync } from "fs";
const pos_file_path = GEO_DATA_DIR + "senkyoku289polygon.json";

export function getSenkyokuPolygonData(request, response) {
  const pos_file_data = readFileSync(pos_file_path);
  const pos_file_json = JSON.parse(pos_file_data);
  response.json(pos_file_json);
}
