import * as repository from "./user.repository";
import { AppError } from "../../lib/errors/app-error";

export async function getProfile(id: string) {
  const profile = await repository.findProfile(id);
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
  return profile;
}

export const updateProfile = repository.updateProfile;
