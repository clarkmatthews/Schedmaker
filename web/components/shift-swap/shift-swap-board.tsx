"use client";

import { useActionState } from "react";
import {
  approveClaimAction,
  cancelOfferAction,
  claimShiftAction,
  denyClaimAction,
  offerShiftAction,
  withdrawOfferAction,
} from "@/lib/actions/shift-swaps";
import type { ApprovalCard, OfferCard } from "@/lib/shift-swap";

type BoardProps = {
  companyId: string;
  companyName: string;
  canOffer: boolean;
  canReview: boolean;
  canEdit: boolean;
  mine: OfferCard[];
  mineOffers: OfferCard[];
  claimable: OfferCard[];
  approvals: ApprovalCard[];
  unclaimedOffers: ApprovalCard[];
};

function SwapForm({
  action,
  label,
  fields,
  tone = "primary",
}: {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  label: string;
  fields: Record<string, string>;
  tone?: "primary" | "quiet" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const className =
    tone === "danger"
      ? "rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-60"
      : tone === "quiet"
        ? "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-60"
        : "rounded-md bg-teal px-3 py-1.5 text-sm text-white hover:bg-teal-dark disabled:opacity-60";
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={className} disabled={pending}>
        {pending ? "Saving…" : label}
      </button>
      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
    </form>
  );
}

function ShiftRow({
  card,
  action,
}: {
  card: OfferCard;
  action: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
      <div>
        <p className="font-medium text-ink">
          {card.jobName} · {card.teamName}
        </p>
        <p className="text-sm text-muted">{card.when}</p>
      </div>
      {action}
    </li>
  );
}

export function ShiftSwapBoard({
  companyId,
  companyName,
  canOffer,
  canReview,
  canEdit,
  mine,
  mineOffers,
  claimable,
  approvals,
  unclaimedOffers,
}: BoardProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Shift Swap</h1>
        <p className="mt-1 text-sm text-muted">
          {companyName}. A shift stays with its current owner until a manager approves the request.
        </p>
      </div>

      {canReview ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-ink">Approvals</h2>
          {approvals.length === 0 && unclaimedOffers.length === 0 ? (
            <p className="text-sm text-muted">No pending requests.</p>
          ) : null}
          <ul className="space-y-3">
            {approvals.map((card) => (
              <li key={card.claimId} className="space-y-2 rounded-md border border-border p-4">
                <p className="font-medium text-ink">
                  {card.claimerName} wants {card.jobName} · {card.teamName}
                </p>
                <p className="text-sm text-muted">{card.when}</p>
                <p className="text-sm text-ink">
                  {card.giverName ? `From ${card.giverName}` : "Unassigned"}
                </p>
                {card.claimerHours ? (
                  <p className="text-sm text-muted">
                    {card.claimerName} after approval: {card.claimerHours}
                  </p>
                ) : null}
                {card.giverName && card.giverHours ? (
                  <p className="text-sm text-muted">
                    {card.giverName} after giving it up: {card.giverHours}
                  </p>
                ) : null}
                {canEdit && card.claimId ? (
                  <div className="flex flex-wrap gap-2">
                    <SwapForm
                      action={approveClaimAction}
                      label="Approve"
                      fields={{ companyId, claimId: card.claimId }}
                    />
                    <SwapForm
                      action={denyClaimAction}
                      label="Deny"
                      tone="quiet"
                      fields={{ companyId, claimId: card.claimId }}
                    />
                    {card.offerId ? (
                      <SwapForm
                        action={cancelOfferAction}
                        label="Cancel offer"
                        tone="danger"
                        fields={{ companyId, offerId: card.offerId }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
            {unclaimedOffers.map((card) => (
              <li key={card.offerId} className="space-y-2 rounded-md border border-border p-4">
                <p className="font-medium text-ink">
                  {card.giverName} offered {card.jobName} · {card.teamName}
                </p>
                <p className="text-sm text-muted">{card.when}</p>
                <p className="text-sm text-muted">No one has requested it yet.</p>
                {canEdit && card.offerId ? (
                  <SwapForm
                    action={cancelOfferAction}
                    label="Cancel offer"
                    tone="danger"
                    fields={{ companyId, offerId: card.offerId }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canOffer ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-medium text-ink">Your shifts</h2>
            {mine.length === 0 && mineOffers.length === 0 ? (
              <p className="text-sm text-muted">You have no published shifts after today to offer.</p>
            ) : null}
            <ul className="space-y-2">
              {mineOffers.map((card) => (
                <ShiftRow
                  key={card.offerId}
                  card={card}
                  action={
                    <SwapForm
                      action={withdrawOfferAction}
                      label="Withdraw"
                      tone="quiet"
                      fields={{ companyId, offerId: card.offerId ?? "" }}
                    />
                  }
                />
              ))}
              {mine.map((card) => (
                <ShiftRow
                  key={card.shiftId}
                  card={card}
                  action={
                    <SwapForm
                      action={offerShiftAction}
                      label="Offer"
                      fields={{ companyId, shiftId: card.shiftId }}
                    />
                  }
                />
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-ink">Open shifts</h2>
            {claimable.length === 0 ? (
              <p className="text-sm text-muted">No shifts you can request right now.</p>
            ) : null}
            <ul className="space-y-2">
              {claimable.map((card) => (
                <ShiftRow
                  key={card.shiftId}
                  card={card}
                  action={
                    card.requested ? (
                      <span className="text-sm text-muted">Requested</span>
                    ) : (
                      <SwapForm
                        action={claimShiftAction}
                        label="Request"
                        fields={{ companyId, shiftId: card.shiftId }}
                      />
                    )
                  }
                />
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
