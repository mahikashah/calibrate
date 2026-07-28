import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { materials } from "@/lib/db/schema";
import { handle, ok } from "@/lib/http";
import { newId } from "@/lib/ids";
import { currentUserId } from "@/lib/user";

export async function GET(req: Request) {
  return handle(async () => {
    const userId = currentUserId();
    const subjectId = new URL(req.url).searchParams.get("subjectId");
    const rows = db
      .select()
      .from(materials)
      .where(
        subjectId
          ? and(eq(materials.userId, userId), eq(materials.subjectId, subjectId))
          : eq(materials.userId, userId),
      )
      .orderBy(desc(materials.createdAt))
      .all();
    return ok(rows);
  });
}

const CreateMaterial = z.object({
  subjectId: z.string().min(1),
  title: z.string().min(1).max(160),
  content: z.string().min(1),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = CreateMaterial.parse(await req.json());
    const row = {
      id: newId("mat"),
      userId: currentUserId(),
      subjectId: body.subjectId,
      title: body.title.trim(),
      content: body.content,
      createdAt: new Date().toISOString(),
    };
    db.insert(materials).values(row).run();
    return ok(row, 201);
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
