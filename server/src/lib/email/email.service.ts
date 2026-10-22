import { getMailTransport } from "../../config/mail";
import { env } from "../../config/env";
import {
  accountEmail,
  riderInvitationEmail,
  type EmailPurpose,
} from "./email.templates";

export async function sendAccountEmail(
  email: string,
  purpose: EmailPurpose,
  token: string,
) {
  const url = new URL(
    purpose === "verification" ? "/verify-email" : "/reset-password",
    env.FRONTEND_URL,
  );
  // Fragments stay out of HTTP request URLs and Referer headers. The frontend POSTs the token.
  url.hash = new URLSearchParams({ token }).toString();
  await getMailTransport().sendMail({
    from: env.SMTP_FROM,
    to: email,
    ...accountEmail(purpose, url.toString()),
  });
}

export async function sendRiderInvitationEmail(email: string, token: string) {
  const url = new URL("/activate-rider", env.FRONTEND_URL);
  url.hash = new URLSearchParams({ token }).toString();
  await getMailTransport().sendMail({
    from: env.SMTP_FROM,
    to: email,
    ...riderInvitationEmail(url.toString()),
  });
}
