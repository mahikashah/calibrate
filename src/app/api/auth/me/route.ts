import { authRequired } from "@/lib/auth/mode";
import { UnauthorizedError } from "@/lib/auth/errors";
import { handle, ok } from "@/lib/http";
import { DEFAULT_USER_ID, getCurrentUser } from "@/lib/user";

/** Who is signed in? Used by the sidebar. `mode: "local"` means no sign-in is in use. */
export async function GET() {
  return handle(async () => {
    if (!authRequired()) return ok({ authenticated: false, mode: "local" });
    try {
      const user = await getCurrentUser();
      return ok({
        authenticated: true,
        mode: "account",
        email: user.email,
        demo: user.id === DEFAULT_USER_ID,
      });
    } catch (err) {
      if (err instanceof UnauthorizedError) return ok({ authenticated: false, mode: "account" });
      throw err;
    }
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
