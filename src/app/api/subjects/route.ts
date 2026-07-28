import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { subjects } from "@/lib/db/schema";
import { handle, ok } from "@/lib/http";
import { newId } from "@/lib/ids";
import { currentUserId } from "@/lib/user";

export async function GET() {
  return handle(async () => {
    const userId = currentUserId();
    const rows = db
      .select()
      .from(subjects)
      .where(eq(subjects.userId, userId))
      .orderBy(asc(subjects.name))
      .all();
    return ok(rows);
  });
}

const CreateSubject = z.object({
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = CreateSubject.parse(await req.json());
    const userId = currentUserId();
    const row = {
      id: newId("sub"),
      userId,
      name: body.name.trim(),
      color: body.color ?? "#6366f1",
      createdAt: new Date().toISOString(),
    };
    db.insert(subjects).values(row).run();
    return ok(row, 201);
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
