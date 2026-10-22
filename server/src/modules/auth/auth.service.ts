import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../lib/errors/app-error";
import { hashPassword, verifyPassword } from "./auth.password";
import * as repository from "./auth.repository";
import { deliverToken, tokenDigest } from "./auth.email.service";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const dummyHash = hashPassword(randomBytes(32).toString("hex"));
function credentials() {
  const accessToken = randomBytes(32).toString("base64url");
  const refreshToken = randomBytes(32).toString("base64url");
  return { accessToken, refreshToken, accessHash: digest(accessToken), refreshHash: digest(refreshToken),
    accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000), refreshExpiresAt: new Date(Date.now() + 30 * 86400000) };
}
type Account = NonNullable<Awaited<ReturnType<typeof repository.findAccount>>>;
function result(account: Account, tokens: ReturnType<typeof credentials>) {
  return { user: { id: account.id, email: account.email, profile: account.profile }, accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken, tokenType: "bearer", expiresIn: 900, expiresAt: Math.floor(tokens.accessExpiresAt.getTime() / 1000) };
}
async function issue(account: Account) {
  const tokens = credentials();
  const { accessToken, refreshToken, ...data } = tokens;
  if (!await repository.createSession({ accountId: account.id, ...data }, account.passwordHash)) {
    throw new AppError(401, "LOGIN_FAILED", "Please log in again with your current credentials after verifying your email.");
  }
  return result(account, tokens);
}
export async function register(input: { email: string; password: string }) {
  let account: Account;
  try { account = await repository.createAccount(input.email.toLowerCase(), await hashPassword(input.password)); }
  catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")
      throw new AppError(409, "REGISTRATION_FAILED", "Unable to register with these details.");
    throw error;
  }
  await deliverToken(account, "verification");
  return { confirmationRequired: true, message: "Check your email to verify your account before logging in." };
}
export async function login(input: { email: string; password: string }) {
  const account = await repository.findAccount(input.email.toLowerCase());
  const valid = await verifyPassword(input.password, account?.passwordHash ?? await dummyHash);
  if (!account || !valid) throw new AppError(401, "LOGIN_FAILED", "Invalid email or password.");
  if (!account.emailVerifiedAt) throw new AppError(403, "EMAIL_NOT_VERIFIED", "Verify your email before logging in.");
  if (account.profile.role === "RIDER" && account.profile.deactivatedAt) {
    throw new AppError(403, "ACCOUNT_DEACTIVATED", "This Rider account is inactive. Contact your Operator.");
  }
  return issue(account);
}
export async function authenticate(accessToken: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(accessToken)) throw new AppError(401, "UNAUTHORIZED", "Invalid or expired access token.");
  const session = await repository.findSession(digest(accessToken));
  if (!session || session.accessExpiresAt <= new Date() || !session.account.emailVerifiedAt
    || (session.account.profile.role === "RIDER" && session.account.profile.deactivatedAt)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired access token.");
  }
  return { id: session.account.id, email: session.account.email, role: session.account.profile.role, accessToken };
}
export async function refresh(refreshToken: string) {
  const tokens = credentials();
  const { accessToken, refreshToken: nextRefreshToken, ...data } = tokens;
  const account = await repository.rotateSession(digest(refreshToken), data);
  if (!account) throw new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token.");
  return result(account, tokens);
}
export async function logout(accessToken: string) {
  await repository.revokeSession(digest(accessToken));
  return { message: "Session ended." };
}

export async function resetPassword(input: { token: string; newPassword: string }) {
  const passwordHash = await hashPassword(input.newPassword);
  if (!await repository.resetAccountPassword(tokenDigest(input.token), passwordHash)) {
    throw new AppError(400, "INVALID_RESET_TOKEN", "Invalid or expired password reset token.");
  }
  return { message: "Password reset. Log in with your new password." };
}
