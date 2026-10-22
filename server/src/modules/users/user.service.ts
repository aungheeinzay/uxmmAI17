import * as repository from "./user.repository";
import { AppError } from "../../lib/errors/app-error";

export async function getProfile(id: string) {
  const profile = await repository.findProfile(id);
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
  return serialize(profile);
}

function serialize(profile: NonNullable<Awaited<ReturnType<typeof repository.findProfile>>>) {
  const { account, ...rest } = profile;
  return { ...rest, email: account?.email ?? null, providerId: profile.providerId ?? null, provider: profile.provider ?? null };
}
export async function updateProfile(id: string, input: { fullName?: string | null; phone?: string | null }) {
  // Explicit allowlist is also enforced here for callers outside the HTTP controller.
  const data = { ...(input.fullName === undefined ? {} : { fullName: input.fullName }), ...(input.phone === undefined ? {} : { phone: input.phone }) };
  return serialize(await repository.updateProfile(id, data));
}
