import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { withFallback } from "@/lib/llm";

const FeedbackReq = z.object({
  question: z.string().min(1),
  expected: z.string().default(""),
  answer: z.string().min(1),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = FeedbackReq.parse(await req.json());
    const { result, provider, fellBack } = await withFallback((p) =>
      p.feedback({ question: body.question, expected: body.expected, answer: body.answer }),
    );
    return ok({ feedback: result, provider, fellBack });
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
