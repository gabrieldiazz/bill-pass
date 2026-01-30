import type { BillAction } from "../schemas/bill/actions.schema";
import type { BillCommittee } from "../schemas/bill/committees.schema";
import type { BillCosponsor } from "../schemas/bill/cosponsors.schema";
import type { DetailedBill } from "../schemas/bill/detailed.schema";
import type { BillSubjects } from "../schemas/bill/subjects.schema";
import type { SummarizedBill } from "../schemas/bill/summaries.schema";
import type { Member } from "../schemas/congress/members.schema";
import type { Bill, SponsorRole } from "../types/bill.type";
import {
	calculateBipartisanCosponsorsCount,
	calculateDaysSinceSessionStart,
	calculateTotalOriginalCosponsors,
	isSponsorInMajorityParty,
} from "./billAnalytics.util";
import { mapToCongress } from "./congressMapper.util";
import { deriveBillStatus } from "./status.util";

export function mapToActions(actions: BillAction[]): Bill["actions"] {
	return actions.map((action) => ({
		text: action.text,
		type: action.type,
		actionDate: new Date(action.actionDate),
	}));
}

export function mapSponsor(
	sponsor: DetailedBill["sponsors"][number] | BillCosponsor,
	role: SponsorRole,
): Bill["billSponsors"][number] {
	const result: Bill["billSponsors"][number] = {
		fullName: sponsor.fullName,
		firstName: sponsor.firstName,
		lastName: sponsor.lastName,
		party: sponsor.party,
		state: sponsor.state,
		role,
	};
	if (sponsor.district) {
		result.district = sponsor.district;
	}
	return result;
}

export function mapToSponsorsAndCosponsors(
	details: DetailedBill,
	cosponsors: BillCosponsor[],
): Bill["billSponsors"] {
	return [
		...details.sponsors.map((s) => mapSponsor(s, "SPONSOR")),
		...cosponsors.map((c) => mapSponsor(c, "COSPONSOR")),
	];
}

export function mapToCommittees(
	committees: BillCommittee[],
): Bill["committees"] {
	return committees.map((committee) => ({
		name: committee.name,
		chamber: committee.chamber,
	}));
}

// remember to include relevancy and explanation after adding AI scoring
export function mapToBill(
	details: DetailedBill,
	actions: BillAction[],
	subjects: BillSubjects,
	cosponsors: BillCosponsor[],
	summaries: SummarizedBill[],
	committees: BillCommittee[],
	members: Member[],
): Bill {
	const result: Bill = {
		billNumber: details.number,
		billType: details.type,
		congress: details.congress,
		congressMakeup: mapToCongress(members, new Date(details.introducedDate)),
		title: details.title,
		status: deriveBillStatus(actions),
		introducedDate: new Date(details.introducedDate),
		updateDate: new Date(details.updateDate),
		policyArea: details.policyArea.name,
		legislativeSubjects: subjects.legislativeSubjects.map((subj) => ({
			name: subj.name,
		})),

		// say something here
		introducedAtSessionDay: calculateDaysSinceSessionStart(details),
		totalCosponsors: cosponsors.length,
		totalOriginalCosponsors: calculateTotalOriginalCosponsors(cosponsors),
		bipartisanCosponsors: calculateBipartisanCosponsorsCount(
			details,
			cosponsors,
		),
		sponsorIsMajority: isSponsorInMajorityParty(details, members),
		committeeCount: committees.length,

		actions: mapToActions(actions),
		billSponsors: mapToSponsorsAndCosponsors(details, cosponsors),
		committees: mapToCommittees(committees),
	};

	const summary = summaries[summaries.length - 1]?.text;
	if (summary !== undefined) {
		result.summary = summary;
	}

	return result;
}
