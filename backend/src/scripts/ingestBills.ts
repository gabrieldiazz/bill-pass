import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

import {
	isBillCurrent,
	persistBill,
} from "../services/billPersistence.service.js";
import {
	fetchCompleteBill,
	fetchCongressMembers,
	fetchRawBills,
} from "../services/congress.service.js";

const supportedBillTypes = new Set(["hr", "s"]);

for (const envPath of [resolve(".env"), resolve("../.env")]) {
	if (existsSync(envPath)) {
		config({ path: envPath });
	}
}

type IngestArgs = {
	congress: number;
	fromDateTime?: Date;
	toDateTime?: Date;
	limit: number;
	concurrency: number;
	force: boolean;
};

function isSupportedBillType(type: string): boolean {
	return supportedBillTypes.has(type.toLowerCase());
}

function readArg(name: string): string | undefined {
	const index = process.argv.indexOf(`--${name}`);
	return index === -1 ? undefined : process.argv[index + 1];
}

function hasFlag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

function parseOptionalDate(name: string): Date | undefined {
	const value = readArg(name);
	if (!value) {
		return undefined;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid --${name}: ${value}`);
	}
	return date;
}

function parseArgs(): IngestArgs {
	const congress = Number(readArg("congress"));
	const limit = Number(readArg("limit") ?? "25");
	const concurrency = Number(readArg("concurrency") ?? "3");
	const force = hasFlag("force");

	if (!Number.isInteger(congress) || congress <= 0) {
		throw new Error("Missing or invalid --congress");
	}
	if (!Number.isInteger(limit) || limit <= 0) {
		throw new Error("Invalid --limit");
	}
	if (!Number.isInteger(concurrency) || concurrency <= 0) {
		throw new Error("Invalid --concurrency");
	}
	if (!process.env.API_KEY) {
		throw new Error("API_KEY is not defined");
	}
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not defined");
	}

	const result: IngestArgs = {
		congress,
		limit,
		concurrency,
		force,
	};
	const fromDateTime = parseOptionalDate("from");
	const toDateTime = parseOptionalDate("to");

	if (fromDateTime) {
		result.fromDateTime = fromDateTime;
	}
	if (toDateTime) {
		result.toDateTime = toDateTime;
	}

	return result;
}

async function runWithConcurrency<T>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<void>,
): Promise<void> {
	let nextIndex = 0;
	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		async () => {
			while (nextIndex < items.length) {
				const item = items[nextIndex];
				nextIndex += 1;
				if (item) {
					await worker(item);
				}
			}
		},
	);

	await Promise.all(workers);
}

async function main(): Promise<void> {
	const args = parseArgs();
	console.log(
		`Fetching up to ${args.limit} raw bills from Congress ${args.congress}`,
	);
	const rawBills = await fetchRawBills(
		args.congress,
		args.fromDateTime,
		args.toDateTime,
		args.limit,
	);
	console.log(`Fetched ${rawBills.length} raw bills`);
	const supportedRawBills = rawBills.filter((rawBill) =>
		isSupportedBillType(rawBill.type),
	);
	const skipped = rawBills.length - supportedRawBills.length;
	if (skipped > 0) {
		console.log(`Skipped ${skipped} unsupported bills/resolutions`);
	}
	if (supportedRawBills.length === 0) {
		console.log(
			`Ingest complete: 0 persisted, 0 failed, ${skipped} skipped, ${rawBills.length} fetched`,
		);
		return;
	}

	console.log(
		`Processing ${supportedRawBills.length} supported bills with concurrency ${args.concurrency}`,
	);

	let persisted = 0;
	let failed = 0;
	let skippedCurrent = 0;
	let membersPromise: Promise<
		Awaited<ReturnType<typeof fetchCongressMembers>>
	> | null = null;

	function getMembers() {
		membersPromise ??= fetchCongressMembers(args.congress);
		return membersPromise;
	}

	await runWithConcurrency(
		supportedRawBills,
		args.concurrency,
		async (rawBill) => {
			const label = `${rawBill.congress} ${rawBill.type} ${rawBill.number}`;
			try {
				if (
					!args.force &&
					(await isBillCurrent({
						billNumber: rawBill.number,
						billType: rawBill.type,
						congress: rawBill.congress,
						updateDate: new Date(rawBill.updateDate),
					}))
				) {
					skippedCurrent += 1;
					console.log(`Skipped current bill ${label}`);
					return;
				}

				console.log(`Fetching complete bill ${label}`);
				const members = await getMembers();
				const bill = await fetchCompleteBill(
					rawBill.congress,
					rawBill.type,
					rawBill.number,
					members,
				);
				console.log(`Persisting ${label}`);
				const result = await persistBill(bill);
				persisted += 1;
				console.log(`Persisted ${label} as ${result.id}`);
			} catch (error) {
				failed += 1;
				console.error(`Failed to persist ${label}:`, error);
			}
		},
	);

	console.log(
		`Ingest complete: ${persisted} persisted, ${failed} failed, ${skippedCurrent} current skipped, ${skipped} unsupported skipped, ${rawBills.length} fetched`,
	);

	if (failed > 0) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
