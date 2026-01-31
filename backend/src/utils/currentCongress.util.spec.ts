import {
	congressStartDate,
	currentCongressYear,
} from "./currentCongress.util.js";

describe("currentCongressYear", () => {
	it("should return the correct congress year on an even year before Jan 3", () => {
		expect(currentCongressYear(new Date("2024-01-01"))).toBe(118);
	});
	it("should return the correct congress year on an even year on Jan 3", () => {
		expect(currentCongressYear(new Date("2024-01-03"))).toBe(118);
	});
	it("should return the correct congress year on an even year after Jan 3", () => {
		expect(currentCongressYear(new Date("2024-07-04"))).toBe(118);
	});
	it("should return the correct congress year on an odd year but before Jan 3", () => {
		expect(currentCongressYear(new Date("2025-01-02"))).toBe(118);
	});
	it("should return the correct congress year on an odd year on Jan 3", () => {
		expect(currentCongressYear(new Date("2025-01-03"))).toBe(119);
	});
	it("should return the correct congress year on an odd year after Jan 3", () => {
		expect(currentCongressYear(new Date("2025-07-04"))).toBe(119);
	});
});

describe("congressStartDate", () => {
	it("should return the correct start date for the 118th Congress", () => {
		const startDate = congressStartDate(118);
		expect(startDate.toISOString()).toBe("2023-01-03T00:00:00.000Z");
	});
	it("should return the correct start date for the 117th Congress", () => {
		const startDate = congressStartDate(117);
		expect(startDate.toISOString()).toBe("2021-01-03T00:00:00.000Z");
	});
	it("should return the correct start date for the 116th Congress", () => {
		const startDate = congressStartDate(116);
		expect(startDate.toISOString()).toBe("2019-01-03T00:00:00.000Z");
	});
});
