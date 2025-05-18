import { VISUALIZATION_DIR } from "./constants.js";
import { readFileSync } from "fs";

export function getStaticData(request, response) {
	const topic = request.params.topic;
	const axis = request.params.axis;
	const data_path_1d = VISUALIZATION_DIR + "static/" + topic + "/" + axis + "/gen_1d.json";
	const data_path_2d = VISUALIZATION_DIR + "static/" + topic + "/" + axis + "/gen_2d.json";
	const data_1d_data = readFileSync(data_path_1d);
	const data_2d_data = readFileSync(data_path_2d);
	const data_1d_json = JSON.parse(data_1d_data);
	const data_2d_json = JSON.parse(data_2d_data);
	const data_json = {
		"1d": data_1d_json,
		"2d": data_2d_json,
	}
	response.json(data_json);
}