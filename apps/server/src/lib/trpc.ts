import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { treeifyError, ZodError } from "zod";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError:
					error.cause instanceof ZodError ? treeifyError(error.cause) : null,
			},
		};
	},
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
	const { session } = ctx;

	if (!session) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	return next({
		ctx: {
			...ctx,
			session,
		},
	});
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	const { session } = ctx;

	if (session.user.role === "admin") {
		return next({ ctx });
	}

	throw new TRPCError({ code: "FORBIDDEN" });
});
