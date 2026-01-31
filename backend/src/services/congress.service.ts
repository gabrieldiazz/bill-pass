import "dotenv/config";
import {
	type BillAction,
	BillActionsResponseSchema,
} from "../schemas/bill/actions.schema.js";
import {
	type BillCommittee,
	BillCommitteesResponseSchema,
} from "../schemas/bill/committees.schema.js";
import {
	type BillCosponsor,
	BillCosponsorsResponseSchema,
} from "../schemas/bill/cosponsors.schema.js";
import {
	type DetailedBill,
	DetailedBillResponseSchema,
} from "../schemas/bill/detailed.schema.js";
import {
	type RawBill,
	RawBillResponseSchema,
} from "../schemas/bill/raw.schema.js";
import {
	type BillSubjects,
	BillSubjectsResponseSchema,
} from "../schemas/bill/subjects.schema.js";
import {
	type SummarizedBill,
	SummarizedBillResponseSchema,
} from "../schemas/bill/summaries.schema.js";
import {
	type Member,
	MemberResponseSchema,
} from "../schemas/congress/members.schema.js";
import type { Bill } from "../types/bill.type.ts";
import { mapToBill } from "../utils/billMapper.util.js";
import { fetchEachPage } from "../utils/pagination.util.js";

const baseUrl = "https://api.congress.gov/v3/bill";

// example date: 2025-01-01T00:00:00z
export async function fetchRawBills(
	congress?: number,
	fromDateTime?: Date,
	toDateTime?: Date,
	limit = 100,
): Promise<RawBill[]> {
	const url = congress ? new URL(`${baseUrl}/${congress}`) : new URL(baseUrl);
	url.searchParams.append("api_key", process.env.API_KEY as string);
	url.searchParams.append("format", "json");
	url.searchParams.append("limit", limit.toString());
	fromDateTime
		? url.searchParams.append("fromDateTime", `${fromDateTime}`)
		: null;
	toDateTime ? url.searchParams.append("toDateTime", `${toDateTime}`) : null;
	return fetchEachPage<RawBill, "bills", typeof RawBillResponseSchema>(
		url.toString(),
		RawBillResponseSchema,
		"bills",
	);
}

export async function fetchBillDetails(
	congress: number,
	chamber: string,
	billId: string,
): Promise<DetailedBill> {
	const url = new URL(`${baseUrl}/${congress}/${chamber}/${billId}`);
	url.searchParams.set("api_key", process.env.API_KEY as string);
	url.searchParams.set("format", "json");

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Congress API error: ${response.status}`);
	}
	const data = await response.json();
	const parsedData = DetailedBillResponseSchema.parse(data);
	return parsedData.bill;
}

export async function fetchBillActions(
	congress: number,
	chamber: string,
	billId: string,
): Promise<BillAction[]> {
	const url = new URL(`${baseUrl}/${congress}/${chamber}/${billId}/actions`);
	url.searchParams.set("api_key", process.env.API_KEY as string);
	url.searchParams.set("format", "json");
	return fetchEachPage<BillAction, "actions", typeof BillActionsResponseSchema>(
		url.toString(),
		BillActionsResponseSchema,
		"actions",
	);
}

// for now & due to differing API response, just fetch subjects as a single request with a high limit since there usually aren't that many
export async function fetchBillSubjects(
	congress: number,
	chamber: string,
	billId: string,
): Promise<BillSubjects> {
	const url = new URL(`${baseUrl}/${congress}/${chamber}/${billId}/subjects`);
	url.searchParams.set("api_key", process.env.API_KEY as string);
	url.searchParams.set("format", "json");
	url.searchParams.set("limit", "200");

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Congress API error: ${response.status}`);
	}

	const data = await response.json();
	const parsedData = BillSubjectsResponseSchema.parse(data);
	return parsedData.subjects;
}

export async function fetchBillCosponsors(
	congress: number,
	chamber: string,
	billId: string,
): Promise<BillCosponsor[]> {
	const url = new URL(`${baseUrl}/${congress}/${chamber}/${billId}/cosponsors`);
	url.searchParams.set("api_key", process.env.API_KEY as string);
	url.searchParams.set("format", "json");
	return fetchEachPage<
		BillCosponsor,
		"cosponsors",
		typeof BillCosponsorsResponseSchema
	>(url.toString(), BillCosponsorsResponseSchema, "cosponsors");
}

export async function fetchBillSummaries(
	congress: number,
	chamber: string,
	billId: string,
): Promise<SummarizedBill[]> {
	const url = new URL(`${baseUrl}/${congress}/${chamber}/${billId}/summaries`);
	url.searchParams.set("api_key", process.env.API_KEY as string);
	url.searchParams.set("format", "json");
	return fetchEachPage<
		SummarizedBill,
		"summaries",
		typeof SummarizedBillResponseSchema
	>(url.toString(), SummarizedBillResponseSchema, "summaries");
}

export async function fetchBillCommittees(
	congress: number,
	chamber: string,
	billId: string,
): Promise<BillCommittee[]> {
	const url = new URL(`${baseUrl}/${congress}/${chamber}/${billId}/committees`);
	url.searchParams.set("api_key", process.env.API_KEY as string);
	url.searchParams.set("format", "json");
	return fetchEachPage<
		BillCommittee,
		"committees",
		typeof BillCommitteesResponseSchema
	>(url.toString(), BillCommitteesResponseSchema, "committees");
}

export async function fetchCongressMembers(
	congress: number,
): Promise<Member[]> {
	const url = new URL(
		`https://api.congress.gov/v3/member/congress/${congress}`,
	);
	url.searchParams.set("api_key", process.env.API_KEY as string);
	url.searchParams.set("format", "json");
	return fetchEachPage<Member, "members", typeof MemberResponseSchema>(
		url.toString(),
		MemberResponseSchema,
		"members",
	);
}

export async function fetchCompleteBill(
	congress: number,
	chamber: string,
	billId: string,
): Promise<Bill> {
	const [
		details,
		actions,
		subjects,
		cosponsors,
		summaries,
		committees,
		members,
	] = await Promise.all([
		fetchBillDetails(congress, chamber, billId),
		fetchBillActions(congress, chamber, billId),
		fetchBillSubjects(congress, chamber, billId),
		fetchBillCosponsors(congress, chamber, billId),
		fetchBillSummaries(congress, chamber, billId),
		fetchBillCommittees(congress, chamber, billId),
		fetchCongressMembers(congress),
	]);
	return mapToBill(
		details,
		actions,
		subjects,
		cosponsors,
		summaries,
		committees,
		members,
	);
}

export async function fetchAllBills(
	congress: number,
	fromDateTime?: Date,
	toDateTime?: Date,
	limit = 100,
): Promise<Bill[]> {
	const rawBills = await fetchRawBills(
		congress,
		fromDateTime,
		toDateTime,
		limit,
	);
	const completeBills = [];

	for (const rawBill of rawBills) {
		const congress = rawBill.congress;
		const chamber = rawBill.type;
		const billId = rawBill.number;

		try {
			const completeBill = await fetchCompleteBill(congress, chamber, billId);
			completeBills.push(completeBill);
		} catch (error) {
			console.error(
				`Failed to fetch complete bill for ${congress} ${chamber} ${billId}:`,
				error,
			);
		}
	}

	return completeBills;
}
