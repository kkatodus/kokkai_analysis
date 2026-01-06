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
	issueID: string;
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
export type Modal = "donation" | "disclaimer"
