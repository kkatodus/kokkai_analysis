export default function sortDataByPopulation(data, year) {
  const dataCopied = [...data];
  const yearnum = Number(year);
  return dataCopied.sort((a, b) => {
    const aPopulation = Number(a.populationByYear[yearnum]);
    const bPopulation = Number(b.populationByYear[yearnum]);
    if (!bPopulation || !aPopulation) {
      return -1;
    }
    return bPopulation - aPopulation;
  });
}
