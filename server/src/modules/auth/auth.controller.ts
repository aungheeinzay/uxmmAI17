import { asyncHandler } from "../../lib/errors/error-handler";
import * as service from "./auth.service";
import { loginSchema, registerSchema, refreshSchema } from "./auth.validation";

export const register = asyncHandler(async (req, res) => {
  const data = await service.register(registerSchema.parse(req.body));
  res.status(201).json({ success: true, data });
});
export const login = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.login(loginSchema.parse(req.body)) });
});
export const refresh = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.refresh(refreshSchema.parse(req.body).refreshToken) });
});
export const logout = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.logout(req.auth!.accessToken) });
});
