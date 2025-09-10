import { GEO_DATA_DIR } from "./constants.js";
import { readFileSync, readdirSync } from "fs";

export function getSenkyokuPolygonData(request, response) {
  const data_filename = readdirSync(GEO_DATA_DIR)[0];
  const pos_file_path = `${GEO_DATA_DIR}/${data_filename}`;
  const pos_file_data = readFileSync(pos_file_path);
  const pos_file_json = JSON.parse(pos_file_data);
  response.json(pos_file_json);
}
