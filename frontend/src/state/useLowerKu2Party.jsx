import { atom, useAtom } from 'jotai';
import axios from 'axios';
import { shugiinEndpoint } from 'resource/resources';

const Ku2PartyAtom = atom(null);

export default function useLowerKu2Party() {
  const [Ku2LowerPartyDataState, setKu2LowerPartyState] = useAtom(Ku2PartyAtom);
  if (!Ku2LowerPartyDataState) {
    axios({
      method: 'get',
      url: `${shugiinEndpoint}repr`,
    }).then((res) => {
      const ku2LowerPartyDict = {};
      const ReprData = res.data.reprs;
      const parties = Object.keys(ReprData);
      parties.forEach((partyName) => {
        const partyReprs = ReprData[partyName];
        partyReprs.forEach((repr) => {
          const { name, yomikata, district, kaiha } = repr;
          ku2LowerPartyDict[district] = {
            name,
            yomikata,
            kaiha,
          };
        });
      });
      setKu2LowerPartyState(ku2LowerPartyDict);
    });
  }

  return [Ku2LowerPartyDataState, setKu2LowerPartyState];
}
