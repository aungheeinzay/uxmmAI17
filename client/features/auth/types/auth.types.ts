export type RegisterRequest = { email: string; password: string };
export type ResetPasswordRequest = { token: string; newPassword: string };
export type AuthUser = {
  id: string;
  role: "SME" | "OPERATOR" | "RIDER";
  fullName: string | null;
  phone: string | null;
  email?: string | null;
  providerId?: string | null;
  provider?: { id: string; name: string; isActive: boolean } | null;
};
export type RegisterResponse = {
  success: true;
  data: { confirmationRequired: true; message: string };
};
