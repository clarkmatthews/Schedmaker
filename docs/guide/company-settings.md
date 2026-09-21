# Company settings

Open **Company settings** from the hamburger menu. The page is a stack of sections. Click a section name to open it. What you can see or change depends on your role.

![Company settings](../screenshots/settings-company.png)

## Company

The company name, default time zone, and the weekday the workweek starts on. Changing week starts updates every team’s calendar. New teams also inherit this day.

## Hours

Hours templates define when the workplace may be scheduled.

![Hours templates](../screenshots/settings-hours.png)

You can keep more than one template (for example a regular week and a holiday week). One template is **assigned** to the company at a time. The first template you create is assigned automatically.

For each weekday:

- **Closed** — no shifts that day
- **Schedule start / end** — the earliest start and latest end you can save
- **Business start / end** — the open-hours shading on day view (what guests would think of as “we are open”)

Schedule window and open hours are not the same thing. You might allow a 6:00 AM prep shift even though the dining room opens at 10:00.

## Scheduling rules

![Scheduling rules](../screenshots/settings-scheduling.png)

- **Lock historical schedule** — blocks edits on today and earlier. See [Hours and labor](hours-and-labor.md).
- **Labor state** — picks default meal, overtime, and minor-rule presets. California is fully filled in.
- **Meal, overtime, and minor rules** — turn each set on or off and adjust the numbers. These drive the warnings and OT column on the calendar.

## Teams

Create and rename teams, set each team’s time zone, week start, and color. Teams are the calendars in the menu. A team week start can still be changed on its own; a later company week-start save overwrites all teams again.

**Jobs** live on a team. Give a job a name and color. Archived jobs disappear from the shift picker but stay on shifts that already used them.

## Responsibilities

Optional duty labels you can attach to a shift (for example “Closer” or “Bar backup”). Turn the feature on here, then add labels. A responsibility can be company-wide or limited to one team.

Archived labels cannot be added to new shifts. Shifts that already have them keep them.

## MMS

Optional text-message picture of the week when you publish. You will need Twilio credentials, a from-number, and a manager phone. If MMS is on but not fully configured, Schedmaker logs the message instead of sending it.

Employees still get email about published future shifts even when MMS is off.
