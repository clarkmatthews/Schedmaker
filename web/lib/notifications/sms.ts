import { phoneToE164 } from "@/lib/phone";

export async function sendSms(params: { to: string; body: string }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.info("[sms:dev]", params.to, params.body);
    return;
  }

  const body = new URLSearchParams();
  body.set("To", phoneToE164(params.to) ?? params.to);
  body.set("From", from);
  body.set("Body", params.body);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    console.error("[sms] Twilio error", await response.text());
  }
}
