import type { Congress } from "./congress.type";

export type Status =
	| "INTRODUCED"
	| "PASSED_HOUSE"
	| "PASSED_SENATE"
	| "TO_PRESIDENT"
	| "VETOED"
	| "RESOLVING_DIFFERENCES"
	| "BECAME_LAW"
	| "FAILED_HOUSE"
	| "FAILED_SENATE";

export type SponsorRole = "SPONSOR" | "COSPONSOR";

export type Bill = {
	billNumber: string;
	billType: string;
	congress: number;
	congressMakeup: Congress;
	title: string;
	status: Status;
	introducedDate: Date;
	summary?: string;
	updateDate?: Date;
	policyArea: string;
	legislativeSubjects: Subject[];

	introducedAtSessionDay: number; // days since Congress session started
	totalCosponsors: number;
	totalOriginalCosponsors: number;
	bipartisanCosponsors: number;
	sponsorIsMajority: boolean;
	committeeCount: number;

	actions: Action[];
	billSponsors: Sponsor[];
	committees: Committee[];
};

export type Action = {
	text: string;
	type: string;
	actionDate: Date;
};

export type Sponsor = {
	fullName: string;
	firstName: string;
	lastName: string;
	party: string;
	state: string;
	district?: number;
	role: SponsorRole;
};

export type Committee = {
	name: string;
	chamber: string;
};

export type Subject = {
	name: string;
};
