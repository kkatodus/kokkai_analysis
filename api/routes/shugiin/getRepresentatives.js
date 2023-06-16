import { SHUGIIN_DATA_DIR } from "./constants.js";
import { readdirSync, readFileSync } from "fs";

const repr_dir = SHUGIIN_DATA_DIR + "/repr_list/";
const repr_files = readdirSync(repr_dir);
const repr_file_path = repr_dir + repr_files[0]

export function getRepresentatives(request, response){
	const repr_file_data = readFileSync(repr_file_path);
    const repr_file_json = JSON.parse(repr_file_data);
	response.json(repr_file_json);
}