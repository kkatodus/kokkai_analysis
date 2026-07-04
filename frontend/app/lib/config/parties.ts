export const PARTIES = [
	"日本共産党",
	"日本維新の会",
	"無所属連合",
	"日本保守党",
	"立憲民主党",
	"参政党",
	"国民民主党",
	"チームみらい",
	"日本誠真会",
	"社会民主党",
	"れいわ新選組",
	"日本改革党",
	"自由民主党",
	"再生の道",
	"公明党",
	"中道改革連合",
	"NHK党"
]

export const PARTY_COLORS: { [key: string]: string } = {
	"日本共産党": "red-600",
	"日本維新の会": "blue-600",
	"無所属連合": "green-600",
	"日本保守党": "yellow-500",
	"立憲民主党": "purple-600",
	"参政党": "orange-600",
	"国民民主党": "pink-600",
	"チームみらい": "amber-700",
	"日本誠真会": "gray-600",
	"社会民主党": "teal-600",
	"れいわ新選組": "lime-600",
	"日本改革党": "cyan-600",
	"自由民主党": "gray-900",
	"再生の道": "red-500",
	"公明党": "blue-500",
	"NHK党": "green-500",
	"中道改革連合": "purple-500",
}


export const PARTY2PARTY: { [key: string]: string } = {
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
	中道: '中道',
	無所属: '無',
	無: '無',
	N党: 'N党',
	LDP: '自民',
	NDP: '国民',
	CRA: '中道',
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
  
  export const SANGIINABBREV2KAIHA: { [key: string]: string } = {
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
	参政: '参政党',
	保守: '日本保守党',
  };
  export const TOPIC2TOPIC: { [key: string]: string } = {
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
  export const HOUSE2HOUSE: { [key: string]: string } = {
	lower: '衆院',
	upper: '参院',
	衆院: '衆院',
	参院: '参院',
  };
  
  export const SPEECHABBREV2KAIHA: { [key: string]: string } = {
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
	中道: '中道改革連合',
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
	CRA: '中道改革連合',
  };
  
  export const PARTY2COLORLIST: { party: string; color: string }[] = [
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
	{ party: '中道', color: 'purple' },
  ];
  
  export const PARTY2COLOR: { [key: string]: string } = PARTY2COLORLIST.reduce((acc: { [key: string]: string }, curr: { party: string; color: string }) => {
	acc[curr.party] = curr.color;
	return acc;
  }, {});
  
  export const PARTY2RGBCOLOR: { [key: string]: [number, number, number] } = {
	// Neon palette for the site's dark navy background (#111827 → #020617).
	自民: [224, 231, 255],   // neon periwinkle (stands out vs dark, still "neutral-ish")
	公明: [0, 255, 255],     // neon cyan
	立憲: [255, 140, 0],     // neon orange
	維新: [255, 230, 0],     // neon yellow
	民主: [0, 160, 255],     // electric blue
	共産: [255, 45, 85],     // neon red/pink
	れ新: [0, 255, 140],     // neon green
	沖縄: [0, 255, 200],     // aqua-mint
	女子: [255, 0, 200],     // hot magenta
	無所属: [180, 190, 210], // bright slate
	無: [176, 0, 255],       // electric purple
	国民: [0, 110, 255],     // vivid blue
	維教: [190, 255, 0],     // lime neon
	Ｎ党: [255, 0, 140],     // neon fuchsia
	中道: [128, 0, 128],     // purple
  };