import * as z from "zod";

export const MemberSchema = z.object({
	partyName: z.string(),
	terms: z.object({
		item: z.array(
			z.object({
				startYear: z.number().int().nonnegative(),
				endYear: z.number().int().nonnegative().optional(),
				chamber: z.string(),
			}),
		),
	}),
});

export const MemberResponseSchema = z.object({
	members: z.array(MemberSchema),
	pagination: z.object({
		count: z.number().int().nonnegative(),
		next: z.string().optional(),
	}),
});

export type Member = z.infer<typeof MemberSchema>;
