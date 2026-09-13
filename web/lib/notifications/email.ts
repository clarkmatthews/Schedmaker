export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;

  if (!apiKey || !domain) {
    console.info("[email:dev]", params.to, params.subject);
    return;
  }

  const body = new URLSearchParams();
  body.set("from", `ESP Scheduler <mailgun@${domain}>`);
  body.set("to", params.to);
  body.set("subject", params.subject);
  body.set("html", params.html);

  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
    },
    body,
  });

  if (!response.ok) {
    console.error("[email] Mailgun error", await response.text());
  }
}
