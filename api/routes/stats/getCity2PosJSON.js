import { POSITION_DATA_DIR } from "./constants.js";
import { readdirSync, readFileSync } from "fs";
const pos_file_path = POSITION_DATA_DIR + "japan_city_position.json";

export function getCity2PosJSON(request, response) {
  const pos_file_data = readFileSync(pos_file_path);
  const pos_file_json = JSON.parse(pos_file_data);
  response.json(pos_file_json);
}
