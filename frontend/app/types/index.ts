/**
 * Type definitions for Parliament Explorer data structures
 */


export interface PersonIdeologyData {
	idx: number;
	x: number;
	y: number;
	repr: string;
	hiragana:string;
	house?: string;
	party: string;
	party_full?: string | null;
	color: string;
	ref_point: string;
	person_id:number|null;
	/** v2 (topic-scaling-refresh): sitting member at publish time */
	current?: boolean;
	n_opinions?: number | null;
	n_speeches?: number | null;
	last_speech?: string | null;
}

export interface IdeologyWindow {
	from: string | null;
	to: string | null;
}

export interface IdeologySubTopic {
	topic: string;
	sub_topic: string;
	sub_topic_jp?: string;
	axis?: { pro: string; con: string };
	"1d":{
		data: PersonIdeologyData[]
	}
	"2d": {
		data: PersonIdeologyData[]
	}
	/** v2: UMAP layout fitted on current members only */
	"2d_current"?: {
		data: PersonIdeologyData[]
	}
}

export interface IdeologyTopic {
	topic: string;
	topic_en?: string;
	topic_jp?: string;
	window?: IdeologyWindow;
	n_scaled?: number;
	n_current?: number;
	sub_topics: IdeologySubTopic[];
}

export interface IdeologyData {
	version?: number;
	generated_at?: string;
	embed_model?: string;
	summary_model?: string;
	current_members_as_of?: string | null;
	data: IdeologyTopic[];
}


export interface AllParliamentMemberTableData {
	person_id: string;
	name_kanji: string;
	name_kana: string;
	election_signature: string
}


export interface ShugiinPolitician {
	name: string;
	yomikata: string;
	kaiha: string;
	district: string;
	person_id: string;
	number_of_terms_lower: string;
	number_of_terms_upper: string;
}

export interface SangiinPolitician {
	name: string;
	yomikata: string;
	kaiha: string;
	district: string;
	period: string;
	link: string;
	person_id: string;
}

export interface ParliamentMemberData {
  shugiin: {
	reprs: ShugiinPolitician[]
  };
  sangiin: {
	reprs: SangiinPolitician[]
  };
}

export interface speechMetaData{
	issueID: string;
	imageKind: string;
	searchObject: number;
	session: number;
	nameOfHouse: string;
	nameOfMeeting: string;
	issue: string;
	date: string;
	closing: string;
	pdfURL: string;
	nextRecordPosition: number | null;
}

export interface IssueMeta {
	issueID: string;
	imageKind: string;
	searchObject: number;
	session: number;
	nameOfHouse: string;
	nameOfMeeting: string;
	issue: string;
	date: string;
	closing: string | null;
	pdfURL: string;
	nextRecordPosition: number | null;
}

export interface IssueSpeechRecord {
	speechID: string;
	speechOrder: number;
	speaker: string;
	speakerYomi: string;
	speakerGroup: string;
	speakerPosition: string | null;
	speakerRole: string | null;
	speech: string;
	startPage: number;
	createTime: string;
	updateTime: string;
	speechURL: string;
	/** Exchange label on the first speech of a labelled exchange (specs/speech-quality-ui §2.3); absent elsewhere. */
	quality?: SpeechQuality | null;
}

export interface SpeechRecord {
	speechID: string;
	speechOrder: number;
	speaker: string;
	speakerYomi: string;
	speakerGroup: string;
	speakerPosition: string | null;
	speakerRole: string | null;
	speech: string;
	startPage: number;
	createTime: string;
	updateTime: string;
	speechURL: string;
	// NOTE: In our JSONL payloads, issueID is usually under `meta.issueID`.
	// Keep this optional for compatibility with any future/legacy shapes.
	issueID?: string;
	meta: speechMetaData;
}

export interface FirstPageOfAllTopics {
	first_pages_of_all_topics: Array<{
		topic: string;
		page: SpeechRecord[];
		number_of_pages?: number;
	}>;
}

export interface SpeechPageResponse {
	page_number: number;
	number_of_lines: number;
	total_pages: number;
	total_lines: number;
	page: SpeechRecord[];
}
export interface ElectionHistoryData {
	day: string;
	year: string;
	month: string;
	party: string;
	district: string;
	result: string;
	election_freq: string;
	election_name: string;

}

// --- Exchange quality labels (specs/speech-quality-labels §3, specs/speech-quality-ui §2) ---

export type QualityFunction = "legislation" | "oversight" | "policy" | "representation" | "procedural" | "none";
export type QualityContribution = "substantive" | "limited" | "none";
export type QualityIssueType =
	| "private_scandal"
	| "redundant"
	| "evasive"
	| "procedural_dispute"
	| "grandstanding"
	| "softball"
	| "personal_attack";
export type QualityResponsible = "questioner" | "answerer" | "both" | "neither";
export type QualityOutcome = "new_information" | "commitment" | "proposal";
export type QualitySide = "questioner" | "answerer" | "both";
export type QualityExtent = "part" | "most";

export interface QualityIssue {
	type: QualityIssueType;
	by: QualitySide;
	extent: QualityExtent;
}

/** The `quality` object written onto an exchange's first speech in `issues/{id}/speeches.jsonl`. */
export interface SpeechQuality {
	function: QualityFunction;
	contribution: QualityContribution;
	issues: QualityIssue[];
	responsible: QualityResponsible;
	outcomes: QualityOutcome[];
	topic: string;
	reason: string;
	model: string;
	prompt: string;
	speech_ids: string[];
}

export interface QualityIssueCounts {
	part: number;
	most: number;
}

export interface QualityFlagged {
	any: number;
	most: number;
}

/** A person's exchanges as questioner (or the whole corpus). */
export interface QualityCounts {
	n: number;
	first: string | null;
	last: string | null;
	function: Record<QualityFunction, number>;
	contribution: Record<QualityContribution, number>;
	issues: Record<QualityIssueType, QualityIssueCounts>;
	flagged: QualityFlagged;
	outcomes: Record<QualityOutcome, number>;
	topic: Record<string, number>;
	responsible: Record<QualityResponsible, number>;
}

/** A person's exchanges as answerer (minister, official, bill sponsor). */
export interface QualityAnswerCounts {
	n: number;
	first: string | null;
	last: string | null;
	issues: Record<QualityIssueType, QualityIssueCounts>;
	flagged: QualityFlagged;
	outcomes: { new_information: number; commitment: number };
}

export interface QualityPerson {
	person_id: number;
	name: string | null;
	group: string | null;
	as_questioner: QualityCounts | null;
	as_answerer: QualityAnswerCounts | null;
}

/** `speech_quality/aggregate.json`, served by `/speeches/quality/aggregate`. */
export interface QualityAggregate {
	version: number;
	generated_at: string;
	prompt_version: string;
	models: string[];
	coverage: { from: string | null; to: string | null; exchanges: number; meetings: number };
	totals: { as_questioner: QualityCounts; as_answerer: QualityAnswerCounts };
	persons: QualityPerson[];
}

/** One line of `speech_quality/persons/{person_id}.jsonl`, served by `/speeches/quality/person`. */
export interface QualityExchange {
	role: QualitySide;
	start_speech_id: string;
	issue_id: string;
	date: string;
	house: string | null;
	meeting: string | null;
	questioner: string;
	questioner_group: string | null;
	/** speechOrder of every speech in the exchange; speechID = `${issue_id}_${order padded to 3}` */
	orders: number[];
	function: QualityFunction;
	contribution: QualityContribution;
	issues: QualityIssue[];
	responsible: QualityResponsible;
	outcomes: QualityOutcome[];
	topic: string;
	reason: string;
	model: string;
}

export type Modal = "donation" | "disclaimer"
