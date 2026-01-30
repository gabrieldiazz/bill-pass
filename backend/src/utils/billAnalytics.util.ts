import type { BillCosponsor } from "../schemas/bill/cosponsors.schema";
import type { DetailedBill } from "../schemas/bill/detailed.schema";
import type { Member } from "../schemas/congress/members.schema";
import {
	findChamberPartyCount,
	findMajorityAndMargin,
} from "./congressMapper.util";
import { congressStartDate } from "./currentCongress.util";

export function calculateDaysSinceSessionStart(bill: DetailedBill): number {
	const sessionStart = congressStartDate(bill.congress);
	const introducedDate = new Date(bill.introducedDate);
	const diffInMs =
		Date.UTC(
			introducedDate.getUTCFullYear(),
			introducedDate.getUTCMonth(),
			introducedDate.getUTCDate(),
		) -
		Date.UTC(
			sessionStart.getUTCFullYear(),
			sessionStart.getUTCMonth(),
			sessionStart.getUTCDate(),
		);
	return Math.floor(diffInMs / (1000 * 60 * 60 * 24)); // convert ms to days
}

// this looks at the primary sponsor of the bill, not cosponsors.
// every API response shows that bill.sponsors[0] always has length of 1
export function isSponsorInMajorityParty(
	bill: DetailedBill,
	members: Member[],
): boolean {
	let chamber: "House of Representatives" | "Senate";

	if (bill.originChamber === "House") {
		chamber = "House of Representatives";
	} else {
		chamber = "Senate";
	}
	const partyCount = findChamberPartyCount(members, chamber);
	const [majorityParty] = findMajorityAndMargin(partyCount);
	if (!majorityParty) {
		return false;
	}

	const partyMap: Record<string, "D" | "R" | "I"> = {
		Democratic: "D",
		Republican: "R",
		Independent: "I",
	};

	const party = partyMap[majorityParty];

	const sponsorParty = bill.sponsors[0]?.party;
	if (!sponsorParty) {
		throw new Error("No primary sponsor found");
	}

	return sponsorParty === party;
}

export function calculateBipartisanCosponsorsCount(
	bill: DetailedBill,
	cosponsors: BillCosponsor[],
): number {
	let count = 0;
	cosponsors.forEach((cosponsor) => {
		if (cosponsor.party !== bill.sponsors[0]?.party) {
			count++;
		}
	});
	return count;
}

export function calculateTotalOriginalCosponsors(
	cosponsors: BillCosponsor[],
): number {
	let count = 0;
	cosponsors.forEach((cosponsor) => {
		if (cosponsor.isOriginalCosponsor) {
			count++;
		}
	});
	return count;
}
