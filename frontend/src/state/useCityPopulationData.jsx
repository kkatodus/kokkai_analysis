import { atom, useAtom } from 'jotai';

const cityPopulationAtom = atom(null);

export default function useCityPopulationData() {
  const [cityPopulationDataState, setCityPopulation] =
    useAtom(cityPopulationAtom);

  const updateCityPopulationDataState = (newPopulation) => {
    setCityPopulation(newPopulation);
  };

  return { cityPopulationDataState, updateCityPopulationDataState };
}
