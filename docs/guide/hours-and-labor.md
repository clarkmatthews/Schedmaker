# Hours and labor

The calendar is built to show coverage and cost, not only names on a grid.

## The 15-minute grid

Every day is divided into 96 slots of 15 minutes, from midnight to midnight. Shift starts, ends, and breaks snap to that grid. You cannot schedule 10:07 — the next valid time is 10:00 or 10:15.

The hours template (in Company settings) sets:

- The **schedule window** — the earliest start and latest end you are allowed to save
- The **open hours** band — the shaded “we are open” range on day view
- **Closed** weekdays, which reject new shifts

## Hours and overtime on the grid

The **Hours/OT** column on week view totals each row for the week. Day totals appear under each date.

- **Hours** are on-clock time: shift length minus breaks.
- **OT** is overtime for that person, using the company’s overtime rules.

Overtime is calculated when you look at the page. It is not stored as a separate number. Daily overtime is typically time after 8 hours in a day. Weekly overtime is typically time after 40 hours in the workweek. A seventh consecutive day can count as overtime when that rule is on. These defaults follow California; you can change them under Scheduling rules.

Weekly overtime still uses the full workweek, even if you are looking at a single day. The workweek follows **Week starts** in Company settings. Changing that day redraws the calendar and recalculates weekly overtime.

People without an assigned shift user (unassigned bars) can show daily overtime only. They are not rolled into a weekly total.

## Schedule overview

Under the calendar, managers see a **Schedule overview** strip:

- Total on-clock hours
- Overtime hours
- Meal or minor-rule warnings
- Estimated labor in dollars

Click a tile to open the details. Employees do not see this panel.

### Estimated labor

Estimated labor is regular hours × hourly rate, plus overtime hours × rate × 1.5. Only people with an hourly rate above zero are included. If nobody has a rate, the dollar total stays at zero.

### Meal and minor warnings

When meal or minor rules are on, a shift that looks non-compliant gets a red **!** on the card. Hover the mark to read the reason.

Typical California meal rules:

- First meal after 5 hours, 30 minutes, starting by the end of the fifth hour
- Second meal after 10 hours
- A scheduled break long enough to count as the meal satisfies the rule
- A per-person **meal-break waiver** can suppress the first-meal warning on shorter shifts

Minor rules use the person’s birth date for age, daily and weekly hour caps, and curfew windows.

**Warnings do not block save.** You can still publish a schedule that needs a conversation. The mark is there so you notice.

## Historical lock

If **Lock historical schedule** is on in Scheduling rules, you cannot create, move, copy, delete, or publish shifts on today or any earlier date (in the team’s time zone). Future dates still edit normally. Turn this on when you want yesterday’s posted schedule to stay put.
