/**
 * Type definitions for Parliament Explorer data structures
 */

export interface Ideology {
  econ: number; // Economic axis: -1 (left) to 1 (right)
  social: number; // Social axis: -1 (liberal) to 1 (conservative)
}

export interface TopicScores {
  defense?: number;
  welfare?: number;
  [key: string]: number | undefined;
}

export interface ParliamentMemberData {
  shugiin: {
	reprs: {
			name: string;
			yomikata: string;
			kaiha: string;
			district: string;
			number_of_terms_lower: string;
			number_of_terms_upper: string;
		}[]
  };
  sangiin: {
	reprs:
		{
			name:string;
			yomikata:string;
			kaiha:string;
			district:string;
			period:string;
			link:string;
		}[]
  };
}

export interface District {
  prefectureId: string;
  prefectureName: string;
  name: string;
}

export interface KeyPosition {
  topic: string;
  stance: string;
}

export interface CareerItem {
  period: string;
  role: string;
  note: string;
}

export type FactStatus = "accurate" | "misleading" | "false";

export interface Speech {
  id: string;
  date: string;
  topic: string;
  excerpt: string;
  factStatus: FactStatus;
  factNote?: string;
}

export interface Tweet {
  id: string;
  date: string;
  topic: string;
  content: string;
  url?: string;
  factStatus: FactStatus;
  factNote?: string;
}

export interface Comment {
  id: string;
  politicianId: string;
  targetType: "speech" | "tweet";
  targetId: string;
  userName: string;
  handle: string;
  text: string;
  createdAt: string;
}

export interface Politician {
  id: string;
  name: string;
  party: string;
  isMajor: boolean;
  ideology: Ideology;
  topicScores: TopicScores;
  trustScore: number; // 0-100
  trustLabel: string;
  factScore: number; // 0-100
  factLabel: string;
  district?: District;
  photoUrl?: string;
  summary: string;
  keyPositions: KeyPosition[];
  career: CareerItem[];
  speeches: Speech[];
  tweets: Tweet[];
}

export interface Topic {
  id: string;
  label: string;
  keyword: string;
  subtopics: Subtopic[];
}

export interface Subtopic {
  id: string;
  label: string;
  keyword: string;
}

export interface NetworkEdge {
  source: string; // Politician ID
  target: string; // Politician ID
  weight: number;
}

export interface Prefecture {
  id: string;
  name: string;
  path: string; // SVG path data
  labelX: number;
  labelY: number;
}

export type RankingMetric = "trust" | "fact" | "econ" | "social" | "topic";
export type Medium = "parliament" | "twitter";

export type Modal = "donation" | "disclaimer"
