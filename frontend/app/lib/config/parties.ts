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
  
  /**
   * Party colours (frontend/DESIGN.md "Data colours", specs/design-system §7 "Party palette", approved 2026-11-11).
   * Keyed by the canonical short name; look colours up with `partyRgb()` so the aliases below resolve.
   */
  export const PARTY2RGBCOLOR: { [key: string]: [number, number, number] } = {
	自民: [224, 231, 255], // #e0e7ff periwinkle
	維新: [255, 230, 0], // #ffe600 yellow
	国民: [61, 135, 245], // #3d87f5 blue
	中道: [174, 155, 251], // #ae9bfb violet
	立憲: [238, 136, 87], // #ee8857 soft orange
	参政: [243, 179, 14], // #f3b30e gold
	公明: [244, 169, 204], // #f4a9cc light pink
	みらい: [11, 190, 139], // #0bbe8b green teal
	共産: [247, 40, 73], // #f72849 red
	無所属: [142, 151, 169], // #8e97a9 mid grey
	れ新: [44, 230, 117], // #2ce675 green
	沖縄: [93, 254, 209], // #5dfed1 mint
	社民: [224, 72, 216], // #e048d8 orchid
	保守: [172, 112, 47], // #ac702f brown
	志士: [149, 249, 125], // #95f97d light green
	// past sessions only; unchanged
	女子: [255, 0, 200],
	Ｎ党: [255, 0, 140],
	維教: [190, 255, 0],
	// aliases: the two houses' lists abbreviate some parties differently (one colour per party)
	民主: [61, 135, 245],
	無: [142, 151, 169],
	みら: [11, 190, 139],
	い党: [44, 230, 117],
  };

  /** Short names that mean the same group as another short name (colour and label lookups). */
  export const PARTY_ALIASES: { [key: string]: string } = {
	民主: "国民",
	無: "無所属",
	みら: "みらい",
	い党: "れ新", // the five former れ新 参議院 members, listed as い党 since 2026-10-15
  };

  /** The canonical short name for a short name from either house's list. */
  export function canonicalParty(party: string): string {
	return PARTY_ALIASES[party] ?? party;
  }

  /** Districts whose party has no entry above are drawn in this colour (and listed as その他 in legends). */
  export const PARTY_FALLBACK_RGB: [number, number, number] = [100, 116, 139]; // #64748b

  /** Colour for a party short name, via its alias, falling back to その他. */
  export function partyRgb(party: string | null | undefined): [number, number, number] {
	if (!party) return PARTY_FALLBACK_RGB;
	return PARTY2RGBCOLOR[canonicalParty(party)] ?? PARTY_FALLBACK_RGB;
  }

  /** CSS colour string for a party short name. */
  export function partyCss(party: string | null | undefined, alpha = 1): string {
	const [r, g, b] = partyRgb(party);
	return alpha === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
  }
