import { randomBytes } from "node:crypto";
import type { Role } from "../../generated/prisma/enums";
import { AppError } from "../../lib/errors/app-error";
import { sendRiderInvitationEmail } from "../../lib/email/email.service";
import { hashPassword } from "../auth/auth.password";
import { tokenDigest } from "../auth/auth.email.service";
import * as repository from "./rider.repository";
import { isTransactionConflict } from "../../lib/errors/transaction-conflict";

const isUniqueConflict = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
const conflict = () => new AppError(409, "RIDER_INVITATION_CONFLICT", "An account or pending invitation already exists for this email.");

export async function inviteRider(actor: { id: string; role: Role }, input: { email: string; fullName?: string }) {
  if (actor.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may invite Riders.");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = tokenDigest(token);
  const email = input.email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  let invitation;
  try { invitation = await repository.reserveInvitation({ ...input, email, tokenHash, invitedById: actor.id, expiresAt }); }
  catch (error) { if (isUniqueConflict(error) || isTransactionConflict(error)) throw conflict(); throw error; }
  if (invitation.status === "forbidden") throw new AppError(403, "FORBIDDEN", "Only Operators may invite Riders.");
  if (invitation.status === "membership_required") throw new AppError(409, "PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured.");
  if (invitation.status === "conflict") throw conflict();
  try { await sendRiderInvitationEmail(email, token); }
  catch {
    await repository.invalidateInvitation(tokenHash);
    throw new AppError(503, "EMAIL_DELIVERY_FAILED", "Invitation delivery failed. You may try inviting this email again.");
  }
  return { invitation: { id: invitation.id, email, expiresAt: expiresAt.toISOString(), status: "pending" }, message: "Rider invitation sent." };
}

export async function activateRider(input: { token: string; password: string }) {
  const passwordHash = await hashPassword(input.password);
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { result = await repository.activateInvitation(tokenDigest(input.token), passwordHash); break; }
    catch (error) {
      // Re-read after a serialization conflict so a concurrently consumed invitation
      // retains the existing invalid-token behavior rather than creating a second account.
      if (isTransactionConflict(error) && attempt < 2) continue;
      if (isUniqueConflict(error) || isTransactionConflict(error)) throw conflict();
      throw error;
    }
  }
  if (result !== "activated") throw new AppError(400, "INVALID_INVITATION_TOKEN", "Invalid, expired, revoked or already used invitation.");
  return { message: "Rider account activated. You can now sign in." };
}
