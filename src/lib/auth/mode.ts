/**
 * Whether requests must carry a valid session cookie.
 *
 * Default: required in production builds, off in `next dev` and tests so local
 * development keeps working as a single-user app with no sign-in step.
 * Override with AUTH_REQUIRED=true (to test sign-in locally) or
 * AUTH_REQUIRED=false (a deliberate single-user production demo).
 */
export function authRequired(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.AUTH_REQUIRED === "true") return true;
  if (env.AUTH_REQUIRED === "false") return false;
  return env.NODE_ENV === "production";
}
