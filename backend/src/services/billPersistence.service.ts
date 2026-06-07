import type { Bill, Committee, Sponsor, Subject } from "../types/bill.type.js";
import { fetchCompleteBill } from "./congress.service.js";

type PersistedBill = {
	id: string;
	sponsors: { sponsorId: string }[];
};

type BillCurrentnessKey = {
	billNumber: string;
	billType: string;
	congress: number;
	updateDate: Date;
};

type BillPersistenceTransaction = {
	bill: {
		findUnique(args: unknown): Promise<PersistedBill | null>;
		create(args: unknown): Promise<{ id: string }>;
		update(args: unknown): Promise<{ id: string }>;
	};
	action: {
		deleteMany(args: unknown): Promise<unknown>;
		createMany(args: unknown): Promise<unknown>;
	};
	subject: {
		upsert(args: unknown): Promise<{ id: string }>;
	};
	billSubject: {
		deleteMany(args: unknown): Promise<unknown>;
		createMany(args: unknown): Promise<unknown>;
	};
	committee: {
		upsert(args: unknown): Promise<{ id: string }>;
	};
	billCommittee: {
		deleteMany(args: unknown): Promise<unknown>;
		createMany(args: unknown): Promise<unknown>;
	};
	sponsor: {
		create(args: unknown): Promise<{ id: string }>;
		createManyAndReturn(args: unknown): Promise<{ id: string }[]>;
		deleteMany(args: unknown): Promise<unknown>;
	};
	billSponsor: {
		deleteMany(args: unknown): Promise<unknown>;
		createMany(args: unknown): Promise<unknown>;
	};
};

export type BillPersistenceClient = BillPersistenceTransaction & {
	$transaction<T>(
		callback: (transaction: BillPersistenceTransaction) => Promise<T>,
	): Promise<T>;
};

type BillLookupClient = {
	bill: {
		findUnique(args: unknown): Promise<{ updateDate: Date | null } | null>;
	};
};

function parseBillNumber(value: string): number {
	const billNumber = Number.parseInt(value.replace(/\D/g, ""), 10);
	if (!Number.isInteger(billNumber) || billNumber <= 0) {
		throw new Error(`Invalid bill number: ${value}`);
	}
	return billNumber;
}

function billUniqueWhere(
	bill: Pick<Bill, "billNumber" | "billType" | "congress">,
) {
	return {
		billNumber_billType_congress: {
			billNumber: parseBillNumber(bill.billNumber),
			billType: bill.billType,
			congress: bill.congress,
		},
	};
}

function billData(bill: Bill) {
	return {
		billNumber: parseBillNumber(bill.billNumber),
		billType: bill.billType,
		congress: bill.congress,
		title: bill.title,
		status: bill.status,
		introducedDate: bill.introducedDate,
		summary: bill.summary ?? null,
		updateDate: bill.updateDate ?? null,
		policyArea: bill.policyArea,
		introducedAtSessionDay: bill.introducedAtSessionDay,
		totalCosponsors: bill.totalCosponsors,
		bipartisanCosponsors: bill.bipartisanCosponsors,
		sponsorInMajority: bill.sponsorIsMajority,
		committeeCount: bill.committeeCount,
	};
}

function uniqueSubjects(subjects: Subject[]): Subject[] {
	return [
		...new Map(subjects.map((subject) => [subject.name, subject])).values(),
	];
}

function uniqueCommittees(committees: Committee[]): Committee[] {
	return [
		...new Map(
			committees.map((committee) => [
				`${committee.name}:${committee.chamber}`,
				committee,
			]),
		).values(),
	];
}

async function replaceActions(
	transaction: BillPersistenceTransaction,
	billId: string,
	bill: Bill,
): Promise<void> {
	await transaction.action.deleteMany({ where: { billId } });
	if (bill.actions.length === 0) {
		return;
	}

	await transaction.action.createMany({
		data: bill.actions.map((action) => ({
			billId,
			text: action.text,
			type: action.type,
			actionDate: action.actionDate,
		})),
	});
}

async function replaceSubjects(
	transaction: BillPersistenceTransaction,
	billId: string,
	bill: Bill,
): Promise<void> {
	await transaction.billSubject.deleteMany({ where: { billId } });
	const subjects = await Promise.all(
		uniqueSubjects(bill.legislativeSubjects).map((subject) =>
			transaction.subject.upsert({
				where: { name: subject.name },
				create: { name: subject.name },
				update: {},
			}),
		),
	);

	if (subjects.length === 0) {
		return;
	}

	await transaction.billSubject.createMany({
		data: subjects.map((subject) => ({
			billId,
			subjectsId: subject.id,
		})),
	});
}

async function replaceCommittees(
	transaction: BillPersistenceTransaction,
	billId: string,
	bill: Bill,
): Promise<void> {
	await transaction.billCommittee.deleteMany({ where: { billId } });
	const committees = await Promise.all(
		uniqueCommittees(bill.committees).map((committee) =>
			transaction.committee.upsert({
				where: {
					name_chamber: {
						name: committee.name,
						chamber: committee.chamber,
					},
				},
				create: {
					name: committee.name,
					chamber: committee.chamber,
				},
				update: {},
			}),
		),
	);

	if (committees.length === 0) {
		return;
	}

	await transaction.billCommittee.createMany({
		data: committees.map((committee) => ({
			billId,
			committeeId: committee.id,
		})),
	});
}

async function replaceSponsors(
	transaction: BillPersistenceTransaction,
	billId: string,
	bill: Bill,
	previousSponsors: { sponsorId: string }[],
): Promise<void> {
	await transaction.billSponsor.deleteMany({ where: { billId } });
	if (previousSponsors.length > 0) {
		await transaction.sponsor.deleteMany({
			where: {
				id: { in: previousSponsors.map((sponsor) => sponsor.sponsorId) },
			},
		});
	}

	if (bill.billSponsors.length === 0) {
		return;
	}

	const sponsors = await transaction.sponsor.createManyAndReturn({
		data: bill.billSponsors.map((sponsor: Sponsor) => ({
			fullName: sponsor.fullName,
			firstName: sponsor.firstName,
			lastName: sponsor.lastName,
			party: sponsor.party,
			state: sponsor.state,
			district: sponsor.district?.toString() ?? null,
			role: sponsor.role,
		})),
		select: { id: true },
	});

	await transaction.billSponsor.createMany({
		data: sponsors.map((sponsor) => ({
			billId,
			sponsorId: sponsor.id,
		})),
	});
}

async function persistBillWithTransaction(
	transaction: BillPersistenceTransaction,
	bill: Bill,
): Promise<{ id: string }> {
	const existingBill = await transaction.bill.findUnique({
		where: billUniqueWhere(bill),
		select: {
			id: true,
			sponsors: { select: { sponsorId: true } },
		},
	});
	const persistedBill = existingBill
		? await transaction.bill.update({
				where: { id: existingBill.id },
				data: billData(bill),
			})
		: await transaction.bill.create({ data: billData(bill) });

	await replaceActions(transaction, persistedBill.id, bill);
	await replaceSubjects(transaction, persistedBill.id, bill);
	await replaceCommittees(transaction, persistedBill.id, bill);
	await replaceSponsors(
		transaction,
		persistedBill.id,
		bill,
		existingBill?.sponsors ?? [],
	);

	return persistedBill;
}

export async function persistBill(
	bill: Bill,
	client?: BillPersistenceClient,
): Promise<{ id: string }> {
	const persistenceClient =
		client ??
		((await import("../lib/prisma.js"))
			.prisma as unknown as BillPersistenceClient);

	return persistenceClient.$transaction((transaction) =>
		persistBillWithTransaction(transaction, bill),
	);
}

export async function isBillCurrent(
	key: BillCurrentnessKey,
	client?: BillLookupClient,
): Promise<boolean> {
	const lookupClient =
		client ??
		((await import("../lib/prisma.js")).prisma as unknown as BillLookupClient);
	const existingBill = await lookupClient.bill.findUnique({
		where: billUniqueWhere(key),
		select: { updateDate: true },
	});

	return (
		existingBill?.updateDate !== null &&
		existingBill?.updateDate !== undefined &&
		existingBill.updateDate.getTime() >= key.updateDate.getTime()
	);
}

export async function fetchAndPersistBill(
	congress: number,
	chamber: string,
	billId: string,
	client?: BillPersistenceClient,
): Promise<{ id: string }> {
	const bill = await fetchCompleteBill(congress, chamber, billId);
	return persistBill(bill, client);
}
