import type * as z from "zod";

export async function fetchEachPage<
	// T is the type of the items being fetched
	T,
	// K is the key in the response that contains the array of items we want fetched
	K extends string,
	// S is a Zod schema type that describes the structure of the API response
	S extends z.ZodType<
		{
			[P in K]: T[];
		} & {
			pagination: {
				next?: string | undefined;
			};
		}
	>,
>(
	// schema is the Zod schema for the response, key is the key in the response containing the items
	initialUrl: string,
	schema: S,
	key: K,
	fetchFn: typeof fetch = fetch,
	maxResults?: number,
): Promise<T[]> {
	const results: T[] = [];
	let nextUrl: string | null = initialUrl;

	while (nextUrl) {
		const response = await fetchFn(nextUrl);

		if (!response.ok) {
			throw new Error(`Congress API error: ${response.status}`);
		}

		const data = await response.json();
		const parsedData = schema.parse(data);
		results.push(...parsedData[key]);

		if (maxResults !== undefined && results.length >= maxResults) {
			return results.slice(0, maxResults);
		}

		if (parsedData.pagination.next) {
			const temp = new URL(parsedData.pagination.next);
			temp.searchParams.set("api_key", process.env.API_KEY as string);
			nextUrl = temp.toString();
		} else {
			nextUrl = null;
		}
	}

	return results;
}
