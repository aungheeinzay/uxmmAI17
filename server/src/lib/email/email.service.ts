import { getMailTransport } from "../../config/mail";
import { env } from "../../config/env";
import { accountEmail, type EmailPurpose } from "./email.templates";

export async function sendAccountEmail(email: string, purpose: EmailPurpose, token: string) {
  const url = new URL(purpose === "verification" ? "/verify-email" : "/reset-password", env.FRONTEND_URL);
  // Fragments stay out of HTTP request URLs and Referer headers. The frontend POSTs the token.
  url.hash = new URLSearchParams({ token }).toString();
  await getMailTransport().sendMail({ from: env.SMTP_FROM, to: email, ...accountEmail(purpose, url.toString()) });
}
