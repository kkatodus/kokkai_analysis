const BASE_URL =
  process.env.REACT_APP_API_URL || 'https://sangiin-api.herokuapp.com';
export const sangiinEndpoint = `${BASE_URL}/sangiin/`;
export const shugiinEndpoint = `${BASE_URL}/shugiin/`;
export const speechEndpoint = `${BASE_URL}/speeches/`;
export const visualEndpoint = `${BASE_URL}/speeches/visualization`;
export const staticEndpoint = `${BASE_URL}/speeches/static`;
export const diachronicEndpoint = `${BASE_URL}/speeches/diachronic`;
export const statsEndpoint = `${BASE_URL}/stats/`;
export const geoEndpoint = `${BASE_URL}/geo/`;
export const reprsEndpoint = `${BASE_URL}/reprs/`;
export const paymentEndpoint = `${BASE_URL}/payment/`;
export const donorEndpoint = `${BASE_URL}/donors/`;
export const policyEndpoint = `${BASE_URL}/policy/`;
export const manifestoEndpoint = `${BASE_URL}/manifesto/`;

export const Party2Party = {
  自民: '自民',
  国民: '国民',
  民主: '国民',
  立憲: '立憲',
  公明: '公明',
  共産: '共産',
  維新: '維新',
  れ新: 'れ新',
  有志: '有志',
  沖縄: '沖縄',
  女子: '女子',
  保守: '保守',
  参政: '参政',
  無所属: '無',
  無: '無',
  N党: 'N党',
  LDP: '自民',
  NDP: '国民',
  CDP: '立憲',
  Komeito: '公明',
  JCP: '共産',
  JRP: '維新',
  Reiwa: 'れ新',
  Independents: '有志',
  Okinawa: '沖縄',
  Women: '女子',
  CPJ: '保守',
  Sansei: '参政',
  None: '無',
  'N Party': 'N党',
};

export const SangiinAbbrev2Kaiha = {
  自民: '自由民主党',
  公明: '公明党',
  立憲: '立憲民主・社民',
  維新: '日本維新の会',
  民主: '国民民主党・新緑風会',
  共産: '日本共産党',
  れ新: 'れいわ新選組',
  沖縄: '沖縄の風',
  女子: '政治家女子48党',
  無所属: '各派に属しない議員',
  無: '無所属',
  国民: '国民民主党',
  維教: '日本維新の会・教育無償化を実現する会',
  Ｎ党: 'ＮＨＫから国民を守る党',
};
export const Topic2Topic = {
  nuclear: '原発',
  defence: '防衛',
  economy: '経済対策',
  aging: '少子化',
  familyseparate: '夫婦別姓',
  mynumber: 'マイナンバー',
  onlinevoting: 'オンライン投票',
  livingcostandtax: '物価高対策・減税と賃上げ',
  pension: '年金制度改革・基礎年金底上げ',
  socialsecurity: '社会保障全般の見直し（医療・介護）',
  climatechange: '気候変動',
  lgbtq: 'LGBT',
  少子化: '少子化',
  原発: '原発',
  防衛: '防衛',
  経済対策: '経済対策',
  経済: '経済',
  夫婦別姓: '夫婦別姓',
  マイナンバー: 'マイナンバー',
  オンライン投票: 'オンライン投票',
  気候変動: '気候変動',
  '物価高対策・減税と賃上げ': '物価高対策・減税と賃上げ',
  '年金制度改革・基礎年金底上げ': '年金制度改革・基礎年金底上げ',
  '社会保障全般の見直し（医療・介護）': '社会保障全般の見直し（医療・介護）',
  LGBTQ: 'LGBT',
};
export const House2House = {
  lower: '衆院',
  upper: '参院',
  衆院: '衆院',
  参院: '参院',
};

export const SpeechAbbrev2Kaiha = {
  自民: '自由民主党',
  公明: '公明党',
  立憲: '立憲民主党',
  維新: '日本維新の会',
  民主: '国民民主党',
  共産: '日本共産党',
  れ新: 'れいわ新選組',
  沖縄: '沖縄の風',
  女子: '政治家女子48党',
  無所属: '各派に属しない議員',
  無: '無所属',
  国民: '国民民主党',
  維教: '日本維新の会・教育無償化を実現する会',
  Ｎ党: 'ＮＨＫから国民を守る党',
  LDP: '自由民主党',
  Komeito: '公明党',
  JCP: '日本共産党',
  Reiwa: 'れいわ新選組',
  Independents: '有志',
  Okinawa: '沖縄の風',
  Women: '政治家女子48党',
  CPJ: '保守',
  Sansei: '参政',
  None: '無所属',
  'N Party': 'Ｎ党',
  CDP: '立憲民主党',
};

export const Party2ColorList = [
  { party: '自民', color: 'black' },
  { party: '国民', color: 'blue' },
  { party: '立憲', color: 'orange' },
  { party: '公明', color: 'aqua' },
  { party: '共産', color: 'red' },
  { party: '維新', color: 'gold' },
  { party: 'れ新', color: 'green' },
  { party: '無', color: 'purple' },
  { party: '有志', color: 'grey' },
  //   { party: '維教', color: 'gold' },
  { party: 'Ｎ党', color: 'pink' },
  { party: '参政', color: 'brown' },
  { party: '沖縄', color: 'teal' },
];

export const Party2Color = Party2ColorList.reduce((acc, curr) => {
  acc[curr.party] = curr.color;
  return acc;
}, {});	

export const Party2RGBColor = {
  自民: [0, 0, 0],
  公明: [0, 191, 255],
  立憲: [255, 165, 0],
  維新: [255, 215, 0],
  民主: [0, 0, 255],
  共産: [255, 0, 0],
  れ新: [0, 128, 0],
  沖縄: [0, 255, 255],
  女子: [255, 0, 255],
  無所属: [128, 128, 128],
  無: [119, 0, 200],
  国民: [0, 0, 255],
  維教: [255, 215, 0],
  Ｎ党: [199, 21, 133],
};

export const getSangiinHoureiLink = (meetingNum) =>
  `https://www.shugiin.go.jp/internet/itdb_housei.nsf/html/housei/kaiji${meetingNum}_l.htm`;
