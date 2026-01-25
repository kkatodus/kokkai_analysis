/**
 * Type definitions for Parliament Explorer data structures
 */


export interface PersonIdeologyData {
	idx: number;
	x: number;
	y: number;
	repr: string;
	hiragana:string;
	party: string;
	color: string;
	ref_point: string;
	person_id:number|null;
}

export interface IdeologyData {
	data: {
		topic: string;
		sub_topics:{
			topic: string;
			sub_topic: string;
			"1d":{
				data: PersonIdeologyData[]
			}
			"2d": {
				data: PersonIdeologyData[]
			}
		}[]
	}[]
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
	// Flags are sparse in the JSONL: usually only present on the first speech of a segment.
	// Missing (undefined) means "no label here"; null means explicitly unknown.
	is_productive?: "True" | "False" | null;
	is_relevant?: "True" | "False" | null;
	quality_reason?: string | null;
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
	// null = explicitly "unknown / not labeled yet"
	// undefined = field not present in the payload (legacy)
	is_productive?: "True" | "False" | null;
	is_relevant?: "True" | "False" | null;
	quality_reason?: string | null;
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

export interface RelevanceAndProductivityData {
	speakerID: string;
	speakerGroup: string;
	R_True_P_True: number;
	R_True_P_False: number;
	R_False_P_True: number;
	R_False_P_False: number;
	Total_Count: number;
	person_id: number;
	prop_R_True_P_True: number;
	prop_R_True_P_False: number;
	prop_R_False_P_True: number;
	prop_R_False_P_False: number;
}
export type Modal = "donation" | "disclaimer"
