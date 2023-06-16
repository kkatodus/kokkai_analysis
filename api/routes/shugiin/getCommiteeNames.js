import { SHUGIIN_DATA_DIR } from "./constants.js";
import { readdirSync, readFileSync } from "fs";

const commitee_dir = SHUGIIN_DATA_DIR + "/commitee/";
const commitee_names = readdirSync(commitee_dir);
const commitee_file_path = commitee_dir + commitee_names[0]

export function getCommiteeNames(request, response){
	const commitee_file_data = readFileSync(commitee_file_path);
    const commitee_file_json = JSON.parse(commitee_file_data);
	response.json(commitee_file_json);
}