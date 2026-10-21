export type EmailPurpose = "verification" | "password-reset";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

export function accountEmail(purpose: EmailPurpose, url: string) {
  const action = purpose === "verification" ? "Verify Email" : "Reset Password";
  const notice = purpose === "verification"
    ? "If you did not create an account, ignore this email."
    : "If you did not request this reset, ignore this email. Your password has not changed.";
  return {
    subject: `ParcelOps AI — ${action}`,
    text: `ParcelOps AI\n\n${action}: ${url}\n\nThis link expires in 15 minutes and can be used once.\n${notice}`,
    html: `<h1>ParcelOps AI</h1><p><a href="${escapeHtml(url)}">${action}</a></p><p>This link expires in 15 minutes and can be used once.</p><p>${notice}</p>`,
  };
}

export function riderInvitationEmail(url: string) {
  const context = "An Operator from the ParcelOps AI team invited you to activate a Rider account. Choose your own password to get started.";
  const expiry = "This invitation expires in 24 hours and can be used once.";
  const notice = "If you were not expecting this invitation, ignore this email. No account is created until you activate it.";
  return {
    subject: "ParcelOps AI — Rider Invitation",
    text: `ParcelOps AI\n\n${context}\n\nActivate Account: ${url}\n\n${expiry}\n${notice}`,
    html: `<h1>ParcelOps AI</h1><p>${context}</p><p><a href="${escapeHtml(url)}">Activate Account</a></p><p>${expiry}</p><p>${notice}</p>`,
  };
}
