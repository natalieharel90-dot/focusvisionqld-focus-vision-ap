// Validates a post-sign-in "next" destination. Only same-origin,
// root-relative paths are allowed — this stops an attacker from crafting
// a sign-in link that bounces the user to an external phishing site.
// Rejects absolute URLs, protocol-relative ("//host") and backslash
// ("/\\host") tricks; anything invalid falls back to the dashboard home.
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
