import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { onboarding } from "@/lib/db/schema";
import { handle, ok } from "@/lib/http";
import { computeHypothesis } from "@/lib/hypothesis";
import { newId } from "@/lib/ids";
import { currentUserId } from "@/lib/user";

export async function GET() {
  return handle(async () => {
    const userId = currentUserId();
    const row = db
      .select()
      .from(onboarding)
      .where(eq(onboarding.userId, userId))
      .orderBy(desc(onboarding.createdAt))
      .get();
    if (!row) return ok({ completed: false });
    return ok({
      completed: true,
      answers: JSON.parse(row.answers),
      hypothesis: JSON.parse(row.hypothesis),
      createdAt: row.createdAt,
    });
  });
}

const SaveOnboarding = z.object({
  answers: z.record(z.number().int().min(0)),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = SaveOnboarding.parse(await req.json());
    const hypothesis = computeHypothesis(body.answers);
    const row = {
      id: newId("onb"),
      userId: currentUserId(),
      answers: JSON.stringify(body.answers),
      hypothesis: JSON.stringify(hypothesis),
      createdAt: new Date().toISOString(),
    };
    db.insert(onboarding).values(row).run();
    return ok({ completed: true, hypothesis }, 201);
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
