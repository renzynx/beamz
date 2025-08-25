import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError, treeifyError } from "zod";
import { auth } from "../lib/auth";

type TRPCContext = {
  headers: Headers;
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

const t = initTRPC.context<TRPCContext>().create({
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
  const { headers } = ctx;

  const session = await auth.api.getSession({ headers });

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      ...session,
    },
  });
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { user } = ctx;

  if (user.role === "admin") {
    return next({ ctx });
  }

  throw new TRPCError({ code: "FORBIDDEN" });
});
