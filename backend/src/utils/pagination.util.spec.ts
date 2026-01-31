import { z } from "zod";
import { fetchEachPage } from "./pagination.util.js";

// define simple zod schemas for testing
type TestItem = z.infer<typeof TestItemSchema>;

const TestItemSchema = z.object({ id: z.number() });

const TestResponseSchema = z.object({
	items: z.array(TestItemSchema),
	pagination: z.object({
		next: z.string().optional(),
	}),
});

// helper to create mock fetch responses
const mockPage = (items: TestItem[], next?: string) =>
	({
		ok: true,
		json: async () => ({ items, pagination: { next } }),
	}) as unknown as Response;

const mockInvalidPage = (response: unknown) =>
	({
		ok: true,
		json: async () => response,
	}) as unknown as Response;

describe("fetchEachPage", () => {
	let fetchMock: jest.MockedFunction<typeof fetch>;
	beforeEach(() => {
		jest.clearAllMocks();
		fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
		global.fetch = fetchMock;
	});

	it("should fetch all results from a single page", async () => {
		fetchMock.mockResolvedValueOnce(
			mockPage([{ id: 1 }, { id: 2 }], undefined),
		);

		expect(
			await fetchEachPage<TestItem, "items", typeof TestResponseSchema>(
				"https://myurl.gov",
				TestResponseSchema,
				"items",
				fetchMock,
			),
		).toEqual([{ id: 1 }, { id: 2 }]);
	});

	it("should fetch all results across multiple pages", async () => {
		fetchMock.mockResolvedValueOnce(
			mockPage([{ id: 1 }, { id: 2 }], "https://myurl.gov?page=2"),
		);

		fetchMock.mockResolvedValueOnce(
			mockPage([{ id: 3 }, { id: 4 }], undefined),
		);

		expect(
			await fetchEachPage<TestItem, "items", typeof TestResponseSchema>(
				"https://myurl.gov",
				TestResponseSchema,
				"items",
				fetchMock,
			),
		).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
	});
	it("should return an empty array when no items are present", async () => {
		fetchMock.mockResolvedValueOnce(mockPage([], undefined));
		expect(
			await fetchEachPage<TestItem, "items", typeof TestResponseSchema>(
				"https://myurl.gov",
				TestResponseSchema,
				"items",
				fetchMock,
			),
		).toEqual([]);
	});

	it("should throw when data doesn't match the Zod schema", async () => {
		fetchMock.mockResolvedValueOnce(
			mockInvalidPage({ items: "wrong", pagination: { next: undefined } }),
		);

		await expect(
			fetchEachPage<TestItem, "items", typeof TestResponseSchema>(
				"https://myurl.gov",
				TestResponseSchema,
				"items",
				fetchMock,
			),
		).rejects.toThrow();
	});

	it("should throw when the response schema is missing the pagination field", async () => {
		fetchMock.mockResolvedValueOnce(
			mockInvalidPage({ items: [{ id: 1 }, { id: 2 }] }),
		);
		await expect(
			fetchEachPage<TestItem, "items", typeof TestResponseSchema>(
				"https://myurl.gov",
				TestResponseSchema,
				"items",
				fetchMock,
			),
		).rejects.toThrow();
	});
});
