import { and, db, eq, jobs, lte } from "@beam/database";

export async function cleanupCompletedJobs(olderThanDays = 1): Promise<number> {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const deletedJobs = await db
    .delete(jobs)
    .where(and(eq(jobs.status, "completed"), lte(jobs.completedAt, cutoffDate)))
    .returning({ id: jobs.id });

  return deletedJobs.length || 0;
}
