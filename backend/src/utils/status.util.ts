import type { BillAction } from "../schemas/bill/actions.schema";
import type { Status } from "../types/bill.type";

export function deriveBillStatus(actions: BillAction[]): Status {
	if (actions.length === 0) return "INTRODUCED";

	const validActions = actions.filter(
		(action) => action.actionCode !== undefined,
	);

	// Sort actions by date (oldest to newest)
	const sortedActions = [...validActions].sort(
		(a, b) =>
			new Date(`${a.actionDate}T${a.actionTime}`).getTime() -
			new Date(`${b.actionDate}T${b.actionTime}`).getTime(),
	);

	let status: Status = "INTRODUCED";

	for (const action of sortedActions) {
		switch (action.actionCode) {
			case "36000":
				status = "BECAME_LAW";
				break;
			case "39000": // Public Law enacted over veto
				status = "BECAME_LAW";
				break;
			case "31000":
				status = "VETOED";
				break;
			case "8000":
				status = "PASSED_HOUSE";
				break;
			case "17000":
				status = "PASSED_SENATE";
				break;
			case "20500": // senate actions: on website it says 20000, but actual data has 20500
				status = "RESOLVING_DIFFERENCES";
				break;
			case "19500": // house actions: on website it says 19000, but actual data has 19500
				status = "RESOLVING_DIFFERENCES";
				break;
			case "28000":
				status = "TO_PRESIDENT";
				break;
			case "33000": // Failed of passage in House over veto
				status = "FAILED_HOUSE";
				break;
			case "35000": // Failed of passage in Senate over veto
				status = "FAILED_SENATE";
				break;
			case "9000": // Failed of passage/not agreed to in House
				status = "FAILED_HOUSE";
				break;
			case "18000": // Failed of passage/not agreed to in Senate
				status = "FAILED_SENATE";
				break;
			case "1000": // Introduced in House
				status = "INTRODUCED";
				break;
			case "10000": // Introduced in Senate
				status = "INTRODUCED";
				break;
			// add more cases as needed
		}
	}

	return status;
}
