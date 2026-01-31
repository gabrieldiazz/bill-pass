import { deriveBillStatus } from "./status.util.js";

const mockAction = (
	actionCode: string,
	actionDate: string = "2026-01-01",
	actionTime: string = "00:00:00",
) => ({
	actionCode,
	actionDate,
	actionTime,
	text: "Mock action text",
	type: "Mock action type",
	sourceSystem: {
		name: "Mock Source",
	},
});

describe("deriveBillStatus", () => {
	it("should return INTRODUCED for no actions", () => {
		const result = deriveBillStatus([]);
		expect(result).toBe("INTRODUCED");
	});
	it("should return INTRODUCED when only introduction action codes 1000 is present", () => {
		const result = deriveBillStatus([mockAction("1000")]);
		expect(result).toBe("INTRODUCED");
	});
	it("should return INTRODUCED when only introduction action codes 10000 is present", () => {
		const result = deriveBillStatus([mockAction("10000")]);
		expect(result).toBe("INTRODUCED");
	});
	it("should return BECAME_LAW when actionCode 36000 is present", () => {
		const result = deriveBillStatus([mockAction("36000")]);
		expect(result).toBe("BECAME_LAW");
	});
	it("should return BECAME_LAW when actionCode 39000 is present", () => {
		const result = deriveBillStatus([mockAction("39000")]);
		expect(result).toBe("BECAME_LAW");
	});
	it("should return VETOED when actionCode 31000 is present", () => {
		const result = deriveBillStatus([mockAction("31000")]);
		expect(result).toBe("VETOED");
	});
	it("should return PASSED_HOUSE when actionCode 8000 is present", () => {
		const result = deriveBillStatus([mockAction("8000")]);
		expect(result).toBe("PASSED_HOUSE");
	});
	it("should return PASSED_SENATE when actionCode 17000 is present", () => {
		const result = deriveBillStatus([mockAction("17000")]);
		expect(result).toBe("PASSED_SENATE");
	});
	it("should return RESOLVING_DIFFERENCES when actionCode 20500 is present", () => {
		const result1 = deriveBillStatus([mockAction("20500")]);
		expect(result1).toBe("RESOLVING_DIFFERENCES");
	});
	it("should return RESOLVING_DIFFERENCES when actionCode 19500 is present", () => {
		const result2 = deriveBillStatus([mockAction("19500")]);
		expect(result2).toBe("RESOLVING_DIFFERENCES");
	});
	it("should return TO_PRESIDENT when actionCode 28000 is present", () => {
		const result = deriveBillStatus([mockAction("28000")]);
		expect(result).toBe("TO_PRESIDENT");
	});
	it("should return FAILED_HOUSE when actionCode 9000 is present", () => {
		const result = deriveBillStatus([mockAction("9000")]);
		expect(result).toBe("FAILED_HOUSE");
	});
	it("should return FAILED_SENATE when actionCode 18000 is present", () => {
		const result = deriveBillStatus([mockAction("18000")]);
		expect(result).toBe("FAILED_SENATE");
	});
	it("should return FAILED_HOUSE when actionCode 33000 is present", () => {
		const result = deriveBillStatus([mockAction("33000")]);
		expect(result).toBe("FAILED_HOUSE");
	});
	it("should return FAILED_SENATE when actionCode 35000 is present", () => {
		const result = deriveBillStatus([mockAction("35000")]);
		expect(result).toBe("FAILED_SENATE");
	});
	it("should process multiple actions and return the latest status", () => {
		const actions = [
			mockAction("1000", "2026-01-01", "08:00:00"), // INTRODUCED
			mockAction("8000", "2026-02-01", "10:30:00"), // PASSED_HOUSE
			mockAction("17000", "2026-03-01", "14:15:00"), // PASSED_SENATE
			mockAction("28000", "2026-04-01", "16:45:00"), // TO_PRESIDENT
		];
		const result = deriveBillStatus(actions);
		expect(result).toBe("TO_PRESIDENT");
	});
	it("should handle actions out of order by date", () => {
		const actions = [
			mockAction("28000", "2026-04-01", "16:45:00"), // TO_PRESIDENT
			mockAction("1000", "2026-01-01", "08:00:00"), // INTRODUCED
			mockAction("17000", "2026-03-01", "14:15:00"), // PASSED_SENATE
			mockAction("8000", "2026-02-01", "00:00:00"), // PASSED_HOUSE
		];
		const result = deriveBillStatus(actions);
		expect(result).toBe("TO_PRESIDENT");
	});
	it("should ignore unknown action codes and keep its current status", () => {
		const result = deriveBillStatus([mockAction("99999")]);
		expect(result).toBe("INTRODUCED");
		const result2 = deriveBillStatus([
			mockAction("1000"),
			mockAction("8000"),
			mockAction("99999"),
		]);
		expect(result2).toBe("PASSED_HOUSE");
	});
});
