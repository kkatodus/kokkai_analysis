import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { POSITION_DATA_DIR } from "./constants.js";

function getCSVFile(path) {
  return new Promise((resolve, reject) => {
    const results = [];
    createReadStream(path)
      .pipe(parse({ delimiter: "\t" }))
      .on("data", (data) => results.push(data))
      .on("end", () => {
        resolve(results);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

export async function getCity2PosCSV(req, res) {
  try {
    const csvData = await getCSVFile(
      `${POSITION_DATA_DIR}japan_city_position.csv`
    );
    res.json(csvData);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
}
