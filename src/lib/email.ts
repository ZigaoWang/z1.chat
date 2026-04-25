import "server-only";

const MAILTRAP_API_KEY = process.env.MAILTRAP_API_KEY!;
const FROM_EMAIL = "noreply@z1.chat";
const FROM_NAME = "z1.chat";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<boolean> {
  try {
    const res = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MAILTRAP_API_KEY}`,
      },
      body: JSON.stringify({
        from: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: to }],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ""),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Mailtrap error:", res.status, err);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Send error:", error);
    return false;
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: `${code} is your z1.chat verification code`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 24px;">Verify your email</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.5; margin: 0 0 24px;">Enter this code to finish signing up for z1.chat:</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; font-family: monospace;">${code}</span>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">This code expires in 10 minutes. If you didn't create an account on z1.chat, you can ignore this email.</p>
      </div>
    `,
    text: `Your z1.chat verification code is: ${code}\n\nThis code expires in 10 minutes.`,
  });
}
