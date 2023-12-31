import { readFileSync } from "fs";
import { VISUALIZATION_DIR } from "./constants.js";

export function getTopicVisualization(request, response) {
  const topic = request.params.topic;
  const visualization_path_1d = VISUALIZATION_DIR + topic + "_1d.json";
  const visualization_path_2d = VISUALIZATION_DIR + topic + "_2d.json";
  const visualization_1d_data = readFileSync(visualization_path_1d);
  const visualization_2d_data = readFileSync(visualization_path_2d);
  const visualization_1d_json = JSON.parse(visualization_1d_data);
  const visualization_2d_json = JSON.parse(visualization_2d_data);
  const visualization_json = {
    "1d": visualization_1d_json,
    "2d": visualization_2d_json,
  };

  response.json(visualization_json);
}
