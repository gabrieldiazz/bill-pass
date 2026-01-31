import type { Member } from "../schemas/congress/members.schema.js";
import type { Congress } from "../types/congress.type.js";
import { currentCongressYear } from "./currentCongress.util.js";

// create a frequency map of party names to counts for a given chamber
export function findChamberPartyCount(
	members: Member[],
	chamber: "Senate" | "House of Representatives",
): Map<string, number> {
	const partyCount = new Map<string, number>();
	members
		.filter((member) => {
			return member.terms.item.some((term) => term.chamber === chamber);
		})
		.forEach((member) => {
			partyCount.set(
				member.partyName,
				(partyCount.get(member.partyName) || 0) + 1,
			);
		});
	return partyCount;
}

// find the party with the highest count and the margin over the second highest
export function findMajorityAndMargin(
	map: Map<string, number>,
): [string | null, number] {
	if (map.size === 0) {
		throw new Error("No parties found in the given chamber");
	}

	let majorityParty = null;
	let firstMax = -Infinity;
	let secondMax = -Infinity;
	for (const [party, count] of map.entries()) {
		if (count > firstMax) {
			secondMax = firstMax;
			firstMax = count;
			majorityParty = party;
		} else if (count > secondMax) {
			secondMax = count;
		}
	}

	// no majority party exists (tie)
	if (firstMax === secondMax) {
		return [null, 0];
	}
	return [majorityParty, firstMax - secondMax];
}

export function mapToCongress(
	members: Member[],
	introducedDate: Date,
): Congress {
	const partyCountSenate = findChamberPartyCount(members, "Senate");
	const [partySenate, partyMarginSenate] =
		findMajorityAndMargin(partyCountSenate);
	const partyCountHouse = findChamberPartyCount(
		members,
		"House of Representatives",
	);
	const [partyHouse, partyMarginHouse] = findMajorityAndMargin(partyCountHouse);

	const unifiedCongress = partySenate === partyHouse;

	return {
		number: currentCongressYear(introducedDate),
		partySenate,
		partyMarginSenate,
		partyHouse,
		partyMarginHouse,
		unifiedCongress,
	};
}
