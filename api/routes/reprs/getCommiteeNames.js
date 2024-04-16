import { SHUGIIN_DATA_DIR, SANGIIN_DATA_DIR } from "./constants.js";
import { readdirSync, readFileSync } from "fs";

const lower_repr_dir = SHUGIIN_DATA_DIR + "/repr_list/";
const upper_repr_dir = SANGIIN_DATA_DIR + "/repr_list/";

export function getDistrctReprs(request, response) {
  const { district_name } = request.params;
  const raw_district_name = district_name.replace(/区/g, "");
  const prefecture = raw_district_name.replace(/[0-9]/g, "");
  const upper_repr_file_name = readdirSync(upper_repr_dir)[0];
  const lower_repr_file_name = readdirSync(lower_repr_dir)[0];
  const upper_repr_file_path = upper_repr_dir + upper_repr_file_name;
  const lower_repr_file_path = lower_repr_dir + lower_repr_file_name;
  const upper_repr_file_data = readFileSync(upper_repr_file_path);
  const lower_repr_file_data = readFileSync(lower_repr_file_path);
  const upper_repr_file_json = JSON.parse(upper_repr_file_data);
  const lower_repr_file_json = JSON.parse(lower_repr_file_data);
  const upper_parties = Object.keys(upper_repr_file_json["reprs"]);
  const lower_parties = Object.keys(lower_repr_file_json["reprs"]);
  const upper_match_reprs = [];
  const lower_match_reprs = [];

  for (const party of upper_parties) {
    for (const repr of upper_repr_file_json["reprs"][party]) {
      if (repr["district"].includes(prefecture)) {
        upper_match_reprs.push(repr);
      }
    }
  }
  for (const party of lower_parties) {
    for (const repr of lower_repr_file_json["reprs"][party]) {
      if (repr["district"] === raw_district_name) {
        lower_match_reprs.push(repr);
      }
    }
  }
  response.json({
    upper_reprs: upper_match_reprs,
    lower_reprs: lower_match_reprs,
  });
}
