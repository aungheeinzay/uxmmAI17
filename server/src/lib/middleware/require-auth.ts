import { authenticate } from "../../modules/auth/auth.service";
import { AppError } from "../errors/app-error";
import { asyncHandler } from "../errors/error-handler";
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "");
  if (!match) throw new AppError(401, "UNAUTHORIZED", "A Bearer access token is required.");
  req.auth = await authenticate(match[1]);
  next();
});
