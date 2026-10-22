import nodemailer from "nodemailer";
import { env } from "./env";
import { AppError } from "../lib/errors/app-error";

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;
export function getMailTransport() {
  if (
    !env.SMTP_HOST ||
    !env.SMTP_USER ||
    !env.SMTP_PASSWORD ||
    !env.SMTP_FROM
  ) {
    throw new AppError(
      503,
      "EMAIL_DELIVERY_FAILED",
      "Email delivery is unavailable. Please try again later.",
    );
  }
  return (transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT !== 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
  }));
}
