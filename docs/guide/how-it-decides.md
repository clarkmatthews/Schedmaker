# How it decides

This page is the “why did it do that?” list. The rules are the product, not hidden settings.

## One person, one time

A person cannot have two overlapping shifts. That check looks across **every team**, not only the calendar you are editing. If someone is already scheduled 4–10 elsewhere, you cannot also book them 5–9 here.

Unassigned shifts do not participate in that check, because they have no person yet.

## Closed days and hours windows

The assigned hours template is a hard stop on save. A closed weekday rejects the shift. A start or end outside the schedule window is rejected. The calendar also nudges new shifts to stay inside the window so you hit the error less often.

## Copy last week replaces

Copy last week (or copy the same weekday) **deletes** the target day or week, then writes the copied shifts. It is not a merge. Confirm only when you mean to replace what is there.

Copied shifts skip deactivated people. Jobs that were archived are cleared off the copies.

## Draft vs published

| | Managers (Scheduling Edit) | Employees (Scheduling View) |
|---|---|---|
| Draft shifts | Visible | Hidden |
| Published shifts | Visible | Own shifts only |
| Unassigned | Visible | Hidden |
| Labor overview | Visible | Hidden |
| Print | Full week | Own published shifts |

New shifts start unpublished. Publish day/week, or the publish checkbox on one shift, is what makes them real for staff.

Email goes out for **published, future, assigned** shifts when they are created, changed, unpublished, or deleted. Reassigning a published future shift notifies the old person and the new person.

## Historical lock

When the lock is on, any action that would change today or an earlier calendar date (in the company time zone) is refused — create, edit, drag, copy, delete, or publish. Tomorrow is still editable.

## Overtime math

Overtime is computed when the page loads.

- Group a person’s shifts by calendar day in the team time zone.
- Daily overtime is hours past the daily threshold (8 by default).
- If seventh-day overtime is on, a seventh consecutive workday can count as overtime.
- Weekly overtime is remaining hours past the weekly threshold (40 by default), applied after daily overtime, working backward through the workweek that starts on the company’s Week starts day.
- On a day with several shifts, overtime is split across those bars in proportion to their length.

Unassigned shifts only use the daily rule.

## Meal and minor marks

Meal and minor checks are warnings, not blockers. The red **!** is the notice. Saving and publishing still work.

A scheduled break that is at least as long as the required meal, and that starts in time, counts as that meal. The employee’s meal-break waiver can suppress the first-meal warning when the shift is short enough.

Minor warnings need a birth date on the person’s account.

## Labor dollars

Estimated labor only includes people with an hourly rate greater than zero. Overtime hours are costed at 1.5× that rate. Breaks are not paid in this estimate.

## iCal

Each account has a private calendar feed URL on My account. It lists that person’s **published** shifts about one month back and three months forward, across teams. The link does not expire unless you treat it as compromised and an administrator helps you rotate access. Do not post it publicly.

## Notifications

| What happened | What people get |
|---|---|
| Added to a company | Email invite, and a text if a phone number was saved |
| Published future shift created or changed | Email to the assigned person |
| Published future shift unpublished or deleted | Email to the assigned person |
| Published week (MMS on and configured) | Picture message of the week |
| Password changed or reset | Other sessions are signed out |

If email or text is not configured on the server, the app still saves the schedule. Messages may only show up in the server log.

## Things the app does not do (yet)

- Employees cannot submit availability or preferred hours. The hours template is the only window.
- There is no recurring “every Tuesday” shift template. Copy last week is the bulk shortcut.
- Break coverage (someone else watching the floor during a break) is not assigned in the shift window yet.
