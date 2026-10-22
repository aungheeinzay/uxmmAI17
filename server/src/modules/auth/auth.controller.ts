
import * as service from "./auth.service";
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  verifyEmailSchema,
  emailRequestSchema,
  resetPasswordSchema,
} from "./auth.validation";
import * as emailService from "./auth.email.service";
import { asyncHandler } from "../../middleware/async-handler";

export const register = asyncHandler(async (req, res) => {
  const data = await service.register(registerSchema.parse(req.body));
  res.status(201).json({ success: true, data });
});
export const login = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.login(loginSchema.parse(req.body)),
  });
});
export const refresh = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.refresh(refreshSchema.parse(req.body).refreshToken),
  });
});
export const logout = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.logout(req.auth!.accessToken),
  });
});
export const verifyEmail = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await emailService.verifyEmail(
      verifyEmailSchema.parse(req.body).token,
    ),
  });
});
export const resendVerification = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await emailService.resendVerification(
      emailRequestSchema.parse(req.body).email,
    ),
  });
});
export const forgotPassword = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await emailService.forgotPassword(
      emailRequestSchema.parse(req.body).email,
    ),
  });
});
export const resetPassword = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.resetPassword(resetPasswordSchema.parse(req.body)),
  });
});
