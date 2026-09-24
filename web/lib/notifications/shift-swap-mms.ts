import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { sendText, textConfigReady, type MmsConfig } from "@/lib/notifications/mms";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/secrets";

export type SwapNoticeCompany = {
  id: string;
  name: string;
  defaultTimezone: string;
  mmsEnabled: boolean;
  mmsAccountSid: string;
  mmsAuthToken: string;
  mmsFromNumber: string;
};

type Person = { id: string; phoneNumber: string | null };

function whenLabel(start: Date, stop: Date, timezone: string) {
  const date = formatInTimeZone(start, timezone, "EEE MMM d");
  const time = `${formatInTimeZone(start, timezone, "h:mm a")}–${formatInTimeZone(stop, timezone, "h:mm a")}`;
  return { date, time };
}

export function offerNotice(company: SwapNoticeCompany, jobName: string, start: Date, stop: Date) {
  const when = whenLabel(start, stop, company.defaultTimezone);
  return `${company.name}: ${jobName} on ${when.date} ${when.time} is available to claim. Open Shift Swap to request it.`;
}

export function approvedNotice(company: SwapNoticeCompany, jobName: string, start: Date, stop: Date) {
  const when = whenLabel(start, stop, company.defaultTimezone);
  return `${company.name}: Your shift swap was approved. ${jobName} ${when.date} ${when.time} is now yours.`;
}

export function deniedNotice(company: SwapNoticeCompany, jobName: string, start: Date, stop: Date) {
  const when = whenLabel(start, stop, company.defaultTimezone);
  return `${company.name}: A shift swap was denied for ${jobName} ${when.date} ${when.time}.`;
}

export function cancelledNotice(company: SwapNoticeCompany, jobName: string, start: Date, stop: Date) {
  const when = whenLabel(start, stop, company.defaultTimezone);
  return `${company.name}: The shift swap for ${jobName} ${when.date} ${when.time} was cancelled.`;
}

async function twilioConfig(company: SwapNoticeCompany): Promise<MmsConfig | null> {
  if (!company.mmsEnabled) return null;
  if (!textConfigReady(company)) {
    return null;
  }
  try {
    let authToken = company.mmsAuthToken;
    if (authToken && !isEncryptedSecret(authToken)) {
      const plain = authToken;
      await prisma.company.update({
        where: { id: company.id },
        data: { mmsAuthToken: encryptSecret(plain) },
      });
      authToken = plain;
    } else {
      authToken = decryptSecret(authToken);
    }
    return {
      accountSid: company.mmsAccountSid,
      authToken,
      fromNumber: company.mmsFromNumber,
    };
  } catch (error) {
    console.error("[mms] could not read Twilio token", error);
    return null;
  }
}

export async function textShiftSwap(company: SwapNoticeCompany, people: Person[], body: string) {
  const recipients = people.filter((person) => person.phoneNumber);
  if (!company.mmsEnabled || recipients.length === 0) return;

  const config = await twilioConfig(company);
  if (!config) {
    console.info(
      "[mms:dev]",
      body,
      recipients.map((person) => person.phoneNumber),
    );
    return;
  }

  await Promise.all(
    recipients.map(async (person) => {
      try {
        await sendText({ config, to: person.phoneNumber!, body });
      } catch (error) {
        console.error("[mms] shift swap text failed", person.id, error);
      }
    }),
  );
}
