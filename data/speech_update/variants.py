"""Name normalisation for comparing an NDL `speaker` with `person.name_kanji`.

Old character forms (旧字体) and common name variants (異体字) map to the modern
form, and small kana map to full-size, so 宮澤喜一 == 宮沢喜一 and 淡谷悠藏 ==
淡谷悠蔵. Only spelling variants of the *same* character belong here: 雄/男 or
正/昌 are different characters, and a name that differs that way needs review.
"""
from __future__ import annotations

import re
import unicodedata

# old/variant form → modern form
_PAIRS = (
	"亞亜 惡悪 壓圧 圍囲 爲為 醫医 壹壱 隱隠 營営 榮栄 衞衛 驛駅 圓円 鹽塩 艷艶 奧奥 應応 歐欧 毆殴 櫻桜 "
	"假仮 價価 畫画 會会 囘回 壞壊 懷懐 繪絵 擴拡 殼殻 覺覚 學学 嶽岳 樂楽 渴渇 卷巻 陷陥 寬寛 關関 歡歓 觀観 "
	"巖巌 顏顔 歸帰 氣気 龜亀 僞偽 戲戯 犧犠 舊旧 據拠 擧挙 峽峡 挾挟 狹狭 曉暁 區区 驅駆 勳勲 薰薫 徑径 莖茎 "
	"惠恵 溪渓 經経 繼継 輕軽 螢蛍 鷄鶏 藝芸 缺欠 儉倹 劍剣 圈圏 檢検 權権 獻献 縣県 險険 顯顕 驗験 嚴厳 效効 "
	"廣広 恆恒 鑛鉱 號号 國国 黑黒 濟済 碎砕 齋斎 齊斉 劑剤 雜雑 參参 慘惨 棧桟 蠶蚕 贊賛 殘残 絲糸 齒歯 兒児 "
	"辭辞 濕湿 實実 舍舎 寫写 釋釈 壽寿 收収 從従 澁渋 獸獣 縱縦 肅粛 處処 緖緒 敍叙 將将 稱称 涉渉 燒焼 證証 "
	"奬奨 條条 狀状 乘乗 淨浄 剩剰 疊畳 孃嬢 讓譲 釀醸 觸触 囑嘱 眞真 寢寝 愼慎 盡尽 圖図 粹粋 醉酔 隨随 髓髄 "
	"數数 樞枢 聲声 靜静 齋斎 攝摂 竊窃 專専 淺浅 戰戦 踐践 錢銭 潛潜 纖繊 禪禅 雙双 壯壮 爭争 莊荘 搜捜 插挿 "
	"巢巣 總総 聰聡 藏蔵 臟臓 續続 墮堕 對対 帶帯 滯滞 臺台 瀧滝 擇択 澤沢 單単 擔担 膽胆 團団 彈弾 斷断 遲遅 "
	"晝昼 蟲虫 鑄鋳 廳庁 聽聴 敕勅 鎭鎮 遞逓 鐵鉄 轉転 點点 傳伝 黨党 盜盗 燈灯 當当 鬪闘 德徳 獨独 讀読 屆届 "
	"繩縄 貳弐 腦脳 霸覇 廢廃 拜拝 賣売 麥麦 發発 髮髪 拔抜 蠻蛮 祕秘 濱浜 甁瓶 拂払 佛仏 竝並 變変 邊辺 邉辺 "
	"辯弁 瓣弁 辨弁 舖舗 寶宝 豐豊 沒没 飜翻 每毎 萬万 滿満 默黙 彌弥 藥薬 譯訳 豫予 餘余 與与 譽誉 搖揺 樣様 "
	"謠謡 來来 賴頼 亂乱 覽覧 龍竜 兩両 獵猟 綠緑 壘塁 淚涙 勵励 禮礼 隸隷 靈霊 齡齢 戀恋 爐炉 勞労 樓楼 錄録 "
	"灣湾 曾曽 禰祢 嶋島 嶌島 髙高 﨑崎 冨富 濵浜 渕淵 煕熙 舩船 堯尭 穗穂 稻稲 槇槙 檜桧 籠篭 "
	"舘館 邨村 苅刈 埜野 栁柳 濶闊 峯峰 曻昇 桒桑 卽即 祿禄 晉晋"
)
VARIANTS = {pair[0]: pair[1] for pair in _PAIRS.split() if len(pair) == 2}

# small kana → full size (ッ/ツ etc. differ between NDL and `person`)
_SMALL_KANA = str.maketrans("ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ", "あいうえおつやゆよわアイウエオツヤユヨワカケ")
_SPACES = re.compile(r"[\s　]+")
_KANA = re.compile(r"[ぁ-ゖァ-ヺー]")
_REPEAT = re.compile(r"(.)々")


def normalise_name(name: str | None) -> str:
	"""Comparable form of a name: NFKC, no spaces, modern characters, full-size kana."""
	name = unicodedata.normalize("NFKC", name or "")
	name = _REPEAT.sub(r"\1\1", _SPACES.sub("", name))  # 佐々 → 佐佐
	return "".join(VARIANTS.get(ch, ch) for ch in name).translate(_SMALL_KANA)


def has_kana(name: str | None) -> bool:
	return bool(_KANA.search(name or ""))


def same_name(speaker: str | None, name_kanji: str | None) -> bool:
	return normalise_name(speaker) == normalise_name(name_kanji)


def same_reading(a: str | None, b: str | None) -> bool:
	return bool(a) and bool(b) and normalise_name(a) == normalise_name(b)
