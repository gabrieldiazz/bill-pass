export function currentCongressYear(today = new Date()): number {
	const year = today.getFullYear();
	const month = today.getMonth() + 1;
	const day = today.getDate();

	// Base formula
	let congress = Math.floor((year - 1789) / 2) + 1;

	// If it's an odd year but before Jan 3, still the previous Congress
	if (year % 2 === 1 && month === 1 && day < 3) {
		congress -= 1;
	}

	return congress;
}

export function congressStartDate(congress: number): Date {
	const startYear = 1789 + (congress - 1) * 2;
	return new Date(Date.UTC(startYear, 0, 3)); // January 3rd of the start year
}
