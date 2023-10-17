export const sangiinEndpoint = 'https://sangiin-api.herokuapp.com/sangiin/';
export const shugiinEndpoint = 'https://sangiin-api.herokuapp.com/shugiin/';
export const speechEndpoint = 'https://sangiin-api.herokuapp.com/speeches/';
export const statsEndpoint = 'https://sangiin-api.herokuapp.com/stats/';

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
};

export const getSangiinHoureiLink = (meetingNum) =>
  `https://www.shugiin.go.jp/internet/itdb_housei.nsf/html/housei/kaiji${meetingNum}_l.htm`;
