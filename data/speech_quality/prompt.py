"""Prompt v3 for exchange labels (specs/speech-quality-labels §3, §4.3).

`system_prompt()` holds the definitions; `exchange_prompt()` renders one
exchange with its meeting context; `SCHEMA` is the JSON the model must return.
Bump PROMPT_VERSION whenever the wording changes, so cached results stay apart.
"""
from __future__ import annotations

from typing import List

PROMPT_VERSION = "v3"

FUNCTIONS = ("legislation", "oversight", "policy", "representation", "procedural", "none")
ISSUES = ("private_scandal", "redundant", "evasive", "procedural_dispute", "grandstanding", "softball", "personal_attack")
CONTRIBUTIONS = ("substantive", "limited", "none")
RESPONSIBLE = ("questioner", "answerer", "both", "neither")
OUTCOMES = ("new_information", "commitment", "proposal")
BY = ("questioner", "answerer", "both")
EXTENT = ("part", "most")
# the site's topics (data/resource/experiment_config.json) plus "other"
TOPICS_JA = {
	"Defence": "防衛", "DecliningBirthrate": "少子化", "NuclearPower": "原発", "ClimateChange": "気候変動",
	"Economy": "経済対策", "LivingCostandTax": "物価高対策・減税と賃上げ", "SocialSecurity": "社会保障全般（医療・介護）",
	"Pension": "年金制度", "FamilySeparate": "夫婦別姓", "OnlineVoting": "オンライン投票", "MyNumber": "マイナンバー",
	"LGBT": "LGBT",
}
TOPICS = (*TOPICS_JA, "other")

MAX_EXCHANGE_CHARS = 24000

SCHEMA = {
	"type": "object",
	"properties": {
		"function": {"type": "string", "enum": list(FUNCTIONS)},
		"issues": {
			"type": "array",
			"items": {
				"type": "object",
				"properties": {
					"type": {"type": "string", "enum": list(ISSUES)},
					"by": {"type": "string", "enum": list(BY)},
					"extent": {"type": "string", "enum": list(EXTENT)},
				},
				"required": ["type", "by", "extent"],
			},
		},
		"contribution": {"type": "string", "enum": list(CONTRIBUTIONS)},
		"responsible": {"type": "string", "enum": list(RESPONSIBLE)},
		"outcomes": {"type": "array", "items": {"type": "string", "enum": list(OUTCOMES)}},
		"topic": {"type": "string", "enum": list(TOPICS)},
		"reason": {"type": "string"},
	},
	"required": ["function", "issues", "contribution", "responsible", "outcomes", "topic", "reason"],
}

SYSTEM = """あなたは日本の国会審議を評価する専門家です。委員会での一つの「やり取り」（ある委員の質問の持ち時間と、それに対する政府側などの答弁）を読み、下の基準でラベルを付けてください。
目的は、日本の政治を前に進めないやり取り（公務と無関係な私生活スキャンダルへの固執、同じ質問の繰り返し、答弁のはぐらかしなど）を見つけることです。党派によって基準を変えてはいけません。

## 基本原則: 疑わしきは本人に有利に
否定的なラベル（issues、contribution の limited/none）は、ラベルが公開されて議員や大臣の評判に関わるため、問題が明らかな場合にだけ付けてください。迷ったら付けない、迷ったら有利な方を選ぶ。質問者にも答弁者にも同じく適用します。

## function（何のためのやり取りか。良し悪しではなく種類）
- legislation: 法案の審査（内容、穴、修正）
- oversight: 政府の行為の監視（公金、権限行使、行政の失敗、公職や公金に関わる不祥事を含む）
- policy: 政府が何をすべきかの議論
- representation: 特定の集団・地域の具体的な問題を政府に伝える
- procedural: 議事運営（時間、順番、議事進行）
- none: いずれでもない（私生活スキャンダル、雑談など）
主たるものを一つ選ぶ。

## issues（問題点。該当するものをすべて。なければ空配列）
各問題に by（責任者: questioner/answerer/both）と extent を付ける。
- most: やり取りの大半（時間の半分以上）がその問題に費やされた
- part: 一部だけ（冒頭や締めの一言、途中の脱線、一問だけなど）。迷ったら part
一部に問題があっても、やり取り全体の評価は残りの部分で決まります。
- private_scandal（by=questioner）: 公務と無関係な私生活（個人の行状、家族、職務外の失言）。公金や公的権限に関わる不祥事は該当せず oversight。公職者の私的な趣味・行状を材料に不正をほのめかすのは該当する。公職者への脅迫・弱みの可能性は安全保障・監視の問題で該当しない。
- redundant（by=questioner）: この会議や会期中にすでに答弁された質問を、新しい角度や証拠なしに繰り返す。答弁がはぐらかされたので再質問するのは該当しない。複数の参考人に同じ質問をするのも該当しない。
- evasive（by=answerer）: 具体的な質問に対する明らかな答弁のはぐらかし。正当な理由のない「お答えは差し控える」、紋切り型の答弁の読み上げ、別の質問への回答。該当しない: 本当に法的な判断が場合による答弁、他省庁の所管だとして答えないこと、私人（被拘禁者、市民の医療情報など）を守るためのプライバシーを理由とする拒否。政府自身の行為についての質問を「個別の事案」「プライバシー」でかわすのは該当する。提案に対して「検討します」と答えるだけなのは、それ自体では該当しない。
- procedural_dispute（by=始めた側、双方なら both）: 時間をめぐる争い、発言撤回の要求、やじ、審議中断。
- grandstanding（by=questioner）: 実質的な質問のない演説、党の宣伝。
- softball（by=questioner）: 用意された好意的な答弁を引き出すだけの質問（称賛＋「御所見を」、「意義を説明してください」、他党攻撃の誘い、感謝ばかり）。党派ではなくやり取りで判断する。与党議員が自分の政府に厳しく問うのは該当しない。具体的な約束を引き出した質問も該当しない。持ち時間の大半が「決意をお聞かせください」「御所見を」「意義を御説明ください」と政府に用意された説明を述べさせるだけ、または答弁への称賛・感謝が中心なら extent=most。冒頭や締めの一問だけなら part。
  提案の形をとっていても、政府がすでに進めている施策や質問者の党の提言をなぞって「前向きな御答弁を」「決意を」と賛同を求め、政府が同意・称賛するだけなら softball（提案ではない）。政府から前向きな答弁を引き出したこと自体は成果ではない。見分け方: 質問者は政府がまだしていないこと・したくないことを求めたか、政府の説明の穴を突いたか。どちらもなければ softball の可能性が高い。
- personal_attack（by=行った側）: 政策ではなく人格・能力への攻撃。

## contribution（やり取り全体として）
- substantive: functionに照らして実質的な成果があった（事実が明らかになった、法案の問題点が検証された、具体的な約束が出た、質問者が政府のまだしていない具体的な政策・改善策を示して記録に残った）。そうした提案をしたのに答弁が紋切り型だった場合も substantive（答弁の不足は答弁者の問題で、はぐらかしが明らかなら evasive）
- limited: 一部に意味はあるが、成果は限られる（質問自体が一般的・散漫で掘り下げがない等）
- none: 政治を前に進める要素がほぼない

## responsible: 不足の原因を作った側。issues の by から導く（質問者側だけなら questioner、答弁者側だけなら answerer、両方なら both、issues がなければ neither）。

## outcomes（該当するものすべて）
- new_information: これまで公になっていなかった事実や数字が答弁で出た
- commitment: 「検討する」以上の約束（具体的なものに限る。単なる「検討します」は含めない）
- proposal: 政府がまだ採用していない具体的な政策・改善策を質問者が示した（既存の施策や政府方針の確認・後押しは含めない）

## topic: 政策分野。次のいずれかが主題なら選び、当てはまらなければ other: {topics}。

## reason: 判断の理由を日本語で一、二文。

JSONのみを返してください。"""


def system_prompt() -> str:
	return SYSTEM.replace("{topics}", "、".join(f"{k}（{v}）" for k, v in TOPICS_JA.items()))


def _truncate(text: str, limit: int) -> str:
	if len(text) <= limit:
		return text
	half = limit // 2
	return text[:half] + "\n\n（……中略……）\n\n" + text[-half:]


ROLE_JA = {"questioner": "質問者", "answerer": "答弁者", "chair": "委員長"}


def exchange_prompt(ex: dict) -> str:
	"""`ex`: a gold text row (date, house, meeting, questioner, questioner_group, earlier, turns)."""
	lines: List[str] = [
		f"会議: {ex['house']} {ex['meeting']}（{ex['date']}）",
		f"質問者: {ex['questioner']}（{ex.get('questioner_group') or '会派不明'}）",
	]
	if ex.get("earlier"):
		lines.append("\nこの会議でそれ以前にあったやり取り（冒頭の抜粋）:")
		lines += [f"- {e}" for e in ex["earlier"]]
	body = "\n\n".join(f"【{ROLE_JA.get(t['kind'], t['kind'])}】{t['speaker']}\n{t['text'].strip()}" for t in ex["turns"])
	lines.append("\n評価するやり取り:\n" + _truncate(body, MAX_EXCHANGE_CHARS))
	return "\n".join(lines)
