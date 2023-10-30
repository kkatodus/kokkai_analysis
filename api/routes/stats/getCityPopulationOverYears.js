import { POPULATION_DATA_DIR } from "./constants.js";
import { readFileSync } from "fs";
const population_file_path = POPULATION_DATA_DIR + "city_population_array.json";

export function getCityPopulationOverYears(request, response) {
  const population_data = readFileSync(population_file_path);
  const population_json = JSON.parse(population_data);
  response.json(population_json);
}
