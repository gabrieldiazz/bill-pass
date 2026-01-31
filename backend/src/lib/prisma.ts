import { PrismaClient } from "../generated/prisma/client.js";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
	throw new Error("DATABASE_URL is not defined in your environment variables");
}

export const prisma =
	globalForPrisma.prisma ||
	new PrismaClient({
		accelerateUrl: dbUrl,
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
