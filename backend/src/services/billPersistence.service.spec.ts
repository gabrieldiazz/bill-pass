import { describe, expect, it, vi } from "vitest";

import type { Bill } from "../types/bill.type.js";
import type { BillPersistenceClient } from "./billPersistence.service.js";
import { isBillCurrent, persistBill } from "./billPersistence.service.js";

function bill(overrides: Partial<Bill> = {}): Bill {
	return {
		billNumber: "HR123",
		billType: "hr",
		congress: 118,
		congressMakeup: {
			number: 118,
			partySenate: "Democratic",
			partyMarginSenate: 2,
			partyHouse: "Republican",
			partyMarginHouse: 5,
			unifiedCongress: false,
		},
		title: "A test bill",
		status: "INTRODUCED",
		introducedDate: new Date("2023-01-03"),
		updateDate: new Date("2023-02-01"),
		policyArea: "Health",
		legislativeSubjects: [{ name: "Hospitals" }, { name: "Hospitals" }],
		introducedAtSessionDay: 0,
		totalCosponsors: 2,
		totalOriginalCosponsors: 1,
		bipartisanCosponsors: 1,
		sponsorIsMajority: true,
		committeeCount: 1,
		actions: [
			{
				text: "Introduced",
				type: "Introductory action",
				actionDate: new Date("2023-01-03"),
			},
		],
		billSponsors: [
			{
				fullName: "Jane Doe",
				firstName: "Jane",
				lastName: "Doe",
				party: "D",
				state: "NY",
				district: 7,
				role: "SPONSOR",
			},
		],
		committees: [
			{ name: "Judiciary", chamber: "House" },
			{ name: "Judiciary", chamber: "House" },
		],
		...overrides,
	};
}

function mockClient(existingBill?: {
	id: string;
	sponsors: { sponsorId: string }[];
}): BillPersistenceClient {
	const transaction = {
		bill: {
			findUnique: vi.fn().mockResolvedValue(existingBill ?? null),
			create: vi.fn().mockResolvedValue({ id: "bill-1" }),
			update: vi.fn().mockResolvedValue({ id: existingBill?.id ?? "bill-1" }),
		},
		action: {
			deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
			createMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		subject: {
			upsert: vi.fn().mockResolvedValue({ id: "subject-1" }),
		},
		billSubject: {
			deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
			createMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		committee: {
			upsert: vi.fn().mockResolvedValue({ id: "committee-1" }),
		},
		billCommittee: {
			deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
			createMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		sponsor: {
			create: vi.fn().mockResolvedValue({ id: "sponsor-1" }),
			createManyAndReturn: vi.fn().mockResolvedValue([{ id: "sponsor-1" }]),
			deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		billSponsor: {
			deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
			createMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
	};

	return {
		...transaction,
		$transaction: vi.fn((callback) => callback(transaction)),
	};
}

describe("billPersistence.service", () => {
	it("creates a new bill and its fetched relations", async () => {
		const client = mockClient();
		await persistBill(bill(), client);

		expect(client.bill.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				billNumber: 123,
				billType: "hr",
				congress: 118,
				title: "A test bill",
				status: "INTRODUCED",
				sponsorInMajority: true,
			}),
		});
		expect(client.action.createMany).toHaveBeenCalledWith({
			data: [
				{
					billId: "bill-1",
					text: "Introduced",
					type: "Introductory action",
					actionDate: new Date("2023-01-03"),
				},
			],
		});
		expect(client.subject.upsert).toHaveBeenCalledTimes(1);
		expect(client.committee.upsert).toHaveBeenCalledTimes(1);
		expect(client.sponsor.createManyAndReturn).toHaveBeenCalledWith({
			data: [
				expect.objectContaining({
					fullName: "Jane Doe",
					district: "7",
					role: "SPONSOR",
				}),
			],
			select: { id: true },
		});
	});

	it("updates an existing bill and refreshes fetched child records", async () => {
		const client = mockClient({
			id: "existing-bill",
			sponsors: [{ sponsorId: "old-sponsor" }],
		});
		await persistBill(bill({ title: "Updated title" }), client);

		expect(client.bill.update).toHaveBeenCalledWith({
			where: { id: "existing-bill" },
			data: expect.objectContaining({ title: "Updated title" }),
		});
		expect(client.action.deleteMany).toHaveBeenCalledWith({
			where: { billId: "existing-bill" },
		});
		expect(client.billSubject.deleteMany).toHaveBeenCalledWith({
			where: { billId: "existing-bill" },
		});
		expect(client.billCommittee.deleteMany).toHaveBeenCalledWith({
			where: { billId: "existing-bill" },
		});
		expect(client.billSponsor.deleteMany).toHaveBeenCalledWith({
			where: { billId: "existing-bill" },
		});
		expect(client.sponsor.deleteMany).toHaveBeenCalledWith({
			where: { id: { in: ["old-sponsor"] } },
		});
	});

	it("rejects bill numbers that cannot be stored as an integer", async () => {
		const client = mockClient();

		await expect(
			persistBill(bill({ billNumber: "not-a-number" }), client),
		).rejects.toThrow("Invalid bill number: not-a-number");
		expect(client.bill.create).not.toHaveBeenCalled();
	});

	it("reports a bill current when the stored update date matches the raw update date", async () => {
		const client = {
			bill: {
				findUnique: vi.fn().mockResolvedValue({
					updateDate: new Date("2023-02-01T00:00:00.000Z"),
				}),
			},
		};

		await expect(
			isBillCurrent(
				{
					billNumber: "HR123",
					billType: "hr",
					congress: 118,
					updateDate: new Date("2023-02-01T00:00:00.000Z"),
				},
				client,
			),
		).resolves.toBe(true);
	});

	it("reports a bill stale when the stored update date is older than the raw update date", async () => {
		const client = {
			bill: {
				findUnique: vi.fn().mockResolvedValue({
					updateDate: new Date("2023-01-31T00:00:00.000Z"),
				}),
			},
		};

		await expect(
			isBillCurrent(
				{
					billNumber: "HR123",
					billType: "hr",
					congress: 118,
					updateDate: new Date("2023-02-01T00:00:00.000Z"),
				},
				client,
			),
		).resolves.toBe(false);
	});

	it("reports a missing bill as stale", async () => {
		const client = {
			bill: {
				findUnique: vi.fn().mockResolvedValue(null),
			},
		};

		await expect(
			isBillCurrent(
				{
					billNumber: "HR123",
					billType: "hr",
					congress: 118,
					updateDate: new Date("2023-02-01T00:00:00.000Z"),
				},
				client,
			),
		).resolves.toBe(false);
	});
});
