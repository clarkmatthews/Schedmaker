export type MmsConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

export function mmsConfigReady(company: {
  mmsEnabled: boolean;
  mmsAccountSid: string;
  mmsAuthToken: string;
  mmsFromNumber: string;
  mmsManagerPhone: string;
}) {
  return Boolean(
    company.mmsEnabled &&
      company.mmsAccountSid &&
      company.mmsAuthToken &&
      company.mmsFromNumber &&
      company.mmsManagerPhone,
  );
}

export async function sendMms(params: {
  config: MmsConfig;
  to: string;
  body: string;
  mediaUrl: string;
}) {
  const form = new URLSearchParams();
  form.set("To", params.to);
  form.set("From", params.config.fromNumber);
  form.set("Body", params.body);
  form.set("MediaUrl", params.mediaUrl);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${params.config.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${params.config.accountSid}:${params.config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );

  if (!response.ok) {
    console.error("[mms] Twilio error", await response.text());
  }
}
