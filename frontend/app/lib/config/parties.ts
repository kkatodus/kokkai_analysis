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
	中道: [190, 210, 40],    // olive-lime (kept apart from 無's purple)
	参政: [255, 170, 60],    // amber (kept apart from 立憲's orange and 維新's yellow)
	みらい: [0, 210, 180],   // teal
	みら: [0, 210, 180],     // teal (Sangiin short form of みらい)
	志士: [200, 200, 200],   // light grey
	保守: [170, 110, 60],    // brown
	社民: [255, 105, 180],   // hot pink
  };

  /** Districts whose party has no entry above are drawn in this colour (and listed as その他 in legends). */
  export const PARTY_FALLBACK_RGB: [number, number, number] = [255, 255, 255];