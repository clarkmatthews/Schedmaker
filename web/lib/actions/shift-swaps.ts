"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ActionError, requireSession } from "@/lib/permissions";
import {
  approvedNotice,
  cancelledNotice,
  deniedNotice,
  offerNotice,
  textShiftSwap,
} from "@/lib/notifications/shift-swap-mms";
import {
  assertApprovalDay,
  assertCanParticipate,
  assertClaimEligible,
  assertEmployeeClaimDay,
  assertOfferDay,
  assertOpenClaimDay,
  dayKey,
  eligibleRecipients,
  loadOwnedShift,
  shiftSwapAccess,
} from "@/lib/shift-swap";

type Result = { error?: string };

function revalidate(companyId: string) {
  revalidatePath(`/app/companies/${companyId}/shift-swaps`);
  revalidatePath(`/app/companies/${companyId}`, "layout");
}

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function fail(error: unknown, fallback: string): Result {
  if (error instanceof ActionError) return { error: error.message };
  if (isUnique(error)) return { error: fallback };
  console.error(error);
  return { error: fallback };
}

async function people(ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, phoneNumber: true },
  });
}

export async function offerShiftAction(_prev: Result | null, formData: FormData): Promise<Result> {
  try {
    const actor = await requireSession();
    const companyId = String(formData.get("companyId") ?? "");
    const shiftId = String(formData.get("shiftId") ?? "");
    const access = await shiftSwapAccess(actor.id, companyId);
    if (!access.member) throw new ActionError("You do not have permission to do that.");
    await assertCanParticipate(actor.id, companyId);

    const shift = await prisma.$transaction(async (tx) => {
      const row = await loadOwnedShift(tx, companyId, shiftId);
      if (!row.published) throw new ActionError("Only published shifts can be offered.");
      if (row.userId !== actor.id) throw new ActionError("That shift is not yours.");
      const today = dayKey(new Date(), access.company.defaultTimezone);
      assertOfferDay(dayKey(row.start, access.company.defaultTimezone), today);
      await tx.shiftSwapOffer.create({
        data: {
          companyId,
          shiftId: row.id,
          offeredByUserId: actor.id,
          status: "open",
        },
      });
      return row;
    });

    if (shift.jobId) {
      const recipients = await eligibleRecipients(companyId, shift.jobId, shift, [actor.id]);
      await textShiftSwap(
        access.company,
        recipients,
        offerNotice(access.company, shift.job?.name || "Shift", shift.start, shift.stop),
      );
    }
    revalidate(companyId);
    return {};
  } catch (error) {
    return fail(error, "Could not offer that shift.");
  }
}

export async function claimShiftAction(_prev: Result | null, formData: FormData): Promise<Result> {
  try {
    const actor = await requireSession();
    const companyId = String(formData.get("companyId") ?? "");
    const shiftId = String(formData.get("shiftId") ?? "");
    const access = await shiftSwapAccess(actor.id, companyId);
    if (!access.member) throw new ActionError("You do not have permission to do that.");
    await assertCanParticipate(actor.id, companyId);
    const today = dayKey(new Date(), access.company.defaultTimezone);

    const result = await prisma.$transaction(async (tx) => {
      const shift = await loadOwnedShift(tx, companyId, shiftId);
      if (!shift.published) throw new ActionError("Only published shifts can be claimed.");
      if (shift.userId === actor.id) throw new ActionError("That shift is already yours.");
      const offer = await tx.shiftSwapOffer.findFirst({
        where: { shiftId: shift.id, status: "open" },
      });
      const day = dayKey(shift.start, access.company.defaultTimezone);
      if (offer) {
        if (offer.offeredByUserId === actor.id) throw new ActionError("You already offered this shift.");
        if (shift.userId !== offer.offeredByUserId) {
          throw new ActionError("That shift is no longer offered.");
        }
        assertEmployeeClaimDay(day, today);
      } else if (!shift.userId) {
        assertOpenClaimDay(day, today);
      } else {
        throw new ActionError("That shift is not on the board.");
      }
      await assertClaimEligible(tx, access.company, shift, actor.id);
      const prior = await tx.shiftSwapClaim.count({ where: { shiftId: shift.id } });
      await tx.shiftSwapClaim.create({
        data: {
          companyId,
          shiftId: shift.id,
          offerId: offer?.id ?? null,
          claimerUserId: actor.id,
          status: "pending",
        },
      });
      return { shift, offer, firstUnassigned: !offer && prior === 0 };
    });

    if (result.firstUnassigned && result.shift.jobId) {
      const recipients = await eligibleRecipients(companyId, result.shift.jobId, result.shift, [actor.id]);
      await textShiftSwap(
        access.company,
        recipients,
        offerNotice(access.company, result.shift.job?.name || "Shift", result.shift.start, result.shift.stop),
      );
    }
    revalidate(companyId);
    return {};
  } catch (error) {
    return fail(error, "Could not request that shift.");
  }
}

export async function withdrawOfferAction(_prev: Result | null, formData: FormData): Promise<Result> {
  try {
    const actor = await requireSession();
    const companyId = String(formData.get("companyId") ?? "");
    const offerId = String(formData.get("offerId") ?? "");
    const access = await shiftSwapAccess(actor.id, companyId);
    if (!access.member) throw new ActionError("You do not have permission to do that.");
    await assertCanParticipate(actor.id, companyId);

    await prisma.$transaction(async (tx) => {
      const offer = await tx.shiftSwapOffer.findFirst({
        where: { id: offerId, companyId, status: "open" },
      });
      if (!offer || offer.offeredByUserId !== actor.id) {
        throw new ActionError("That offer is no longer open.");
      }
      await tx.shiftSwapOffer.update({ where: { id: offer.id }, data: { status: "withdrawn" } });
      await tx.shiftSwapClaim.updateMany({
        where: { offerId: offer.id, status: "pending" },
        data: { status: "cancelled", decidedAt: new Date(), decidedByUserId: actor.id },
      });
    });
    revalidate(companyId);
    return {};
  } catch (error) {
    return fail(error, "Could not withdraw that offer.");
  }
}

export async function approveClaimAction(_prev: Result | null, formData: FormData): Promise<Result> {
  try {
    const actor = await requireSession();
    const companyId = String(formData.get("companyId") ?? "");
    const claimId = String(formData.get("claimId") ?? "");
    const access = await shiftSwapAccess(actor.id, companyId);
    if (!access.canEdit) throw new ActionError("You do not have permission to do that.");
    const today = dayKey(new Date(), access.company.defaultTimezone);

    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.shiftSwapClaim.findFirst({
        where: { id: claimId, companyId, status: "pending" },
      });
      if (!claim) throw new ActionError("That request is no longer pending.");
      const shift = await loadOwnedShift(tx, companyId, claim.shiftId);
      if (!shift.published) throw new ActionError("Only a published shift can be reassigned.");
      const offer = claim.offerId
        ? await tx.shiftSwapOffer.findUnique({ where: { id: claim.offerId } })
        : null;
      if (offer) {
        if (offer.status !== "open" || shift.userId !== offer.offeredByUserId) {
          throw new ActionError("That offer is no longer open.");
        }
      } else if (shift.userId) {
        throw new ActionError("That shift is no longer unassigned.");
      }
      assertApprovalDay(dayKey(shift.start, access.company.defaultTimezone), today, Boolean(shift.userId));
      await assertClaimEligible(tx, access.company, shift, claim.claimerUserId);
      const ownerId = shift.userId;
      await tx.shift.update({ where: { id: shift.id }, data: { userId: claim.claimerUserId } });
      const decidedAt = new Date();
      await tx.shiftSwapClaim.update({
        where: { id: claim.id },
        data: { status: "approved", decidedAt, decidedByUserId: actor.id },
      });
      if (offer) {
        await tx.shiftSwapOffer.update({ where: { id: offer.id }, data: { status: "filled" } });
      }
      const others = await tx.shiftSwapClaim.findMany({
        where: { shiftId: shift.id, status: "pending", id: { not: claim.id } },
        select: { claimerUserId: true },
      });
      await tx.shiftSwapClaim.updateMany({
        where: { shiftId: shift.id, status: "pending", id: { not: claim.id } },
        data: { status: "denied", decidedAt, decidedByUserId: actor.id },
      });
      return { shift, claimerId: claim.claimerUserId, ownerId, others };
    });

    const deniedIds = result.others.map((row) => row.claimerUserId);
    const [winner, denied] = await Promise.all([
      people([result.claimerId]),
      people(deniedIds),
    ]);
    const jobName = result.shift.job?.name || "Shift";
    await textShiftSwap(
      access.company,
      winner,
      approvedNotice(access.company, jobName, result.shift.start, result.shift.stop),
    );
    if (denied.length > 0) {
      await textShiftSwap(
        access.company,
        denied,
        deniedNotice(access.company, jobName, result.shift.start, result.shift.stop),
      );
    }
    revalidate(companyId);
    return {};
  } catch (error) {
    return fail(error, "Could not approve that request.");
  }
}

export async function denyClaimAction(_prev: Result | null, formData: FormData): Promise<Result> {
  try {
    const actor = await requireSession();
    const companyId = String(formData.get("companyId") ?? "");
    const claimId = String(formData.get("claimId") ?? "");
    const access = await shiftSwapAccess(actor.id, companyId);
    if (!access.canEdit) throw new ActionError("You do not have permission to do that.");

    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.shiftSwapClaim.findFirst({
        where: { id: claimId, companyId, status: "pending" },
      });
      if (!claim) throw new ActionError("That request is no longer pending.");
      const shift = await loadOwnedShift(tx, companyId, claim.shiftId);
      await tx.shiftSwapClaim.update({
        where: { id: claim.id },
        data: { status: "denied", decidedAt: new Date(), decidedByUserId: actor.id },
      });
      return { shift, claimerId: claim.claimerUserId, ownerId: shift.userId };
    });

    const notified = await people([result.ownerId, result.claimerId]);
    await textShiftSwap(
      access.company,
      notified,
      deniedNotice(access.company, result.shift.job?.name || "Shift", result.shift.start, result.shift.stop),
    );
    revalidate(companyId);
    return {};
  } catch (error) {
    return fail(error, "Could not deny that request.");
  }
}

export async function cancelOfferAction(_prev: Result | null, formData: FormData): Promise<Result> {
  try {
    const actor = await requireSession();
    const companyId = String(formData.get("companyId") ?? "");
    const offerId = String(formData.get("offerId") ?? "");
    const access = await shiftSwapAccess(actor.id, companyId);
    if (!access.canEdit) throw new ActionError("You do not have permission to do that.");

    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.shiftSwapOffer.findFirst({
        where: { id: offerId, companyId, status: "open" },
      });
      if (!offer) throw new ActionError("That offer is no longer open.");
      const shift = await loadOwnedShift(tx, companyId, offer.shiftId);
      const pending = await tx.shiftSwapClaim.findMany({
        where: { offerId: offer.id, status: "pending" },
        select: { claimerUserId: true },
      });
      await tx.shiftSwapOffer.update({ where: { id: offer.id }, data: { status: "cancelled" } });
      await tx.shiftSwapClaim.updateMany({
        where: { offerId: offer.id, status: "pending" },
        data: { status: "cancelled", decidedAt: new Date(), decidedByUserId: actor.id },
      });
      return { shift, posterId: offer.offeredByUserId, pending };
    });

    const notified = await people([
      result.posterId,
      ...result.pending.map((row) => row.claimerUserId),
    ]);
    await textShiftSwap(
      access.company,
      notified,
      cancelledNotice(
        access.company,
        result.shift.job?.name || "Shift",
        result.shift.start,
        result.shift.stop,
      ),
    );
    revalidate(companyId);
    return {};
  } catch (error) {
    return fail(error, "Could not cancel that offer.");
  }
}
