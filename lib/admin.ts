export function isEmailInAdminAllowlist(email?: string | null) {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST || "";
  if (!raw.trim()) return false;

  const allowlist = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(email.toLowerCase());
}

export function hasAdminAccess(role?: string | null, email?: string | null) {
  return role === "admin" || isEmailInAdminAllowlist(email);
}

