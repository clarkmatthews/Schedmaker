export const HELP_TOPICS = {
  companyVsTeam: {
    title: "Company and team",
    body: "A company is the workplace you schedule for. A team is a group inside that workplace with its own calendar — for example Front of House. You can have more than one team in the same company.",
  },
  weekVsDay: {
    title: "Week and day",
    body: "Week shows seven days across. Day shows one date as a timeline, with a per-hour footer so you can see who is on the floor at a given time. Click a day name in week view to jump there.",
  },
  viewBy: {
    title: "View by employee or job",
    body: "Employee view is a row per person. Job view is a row per position. The same shifts appear in both — only the grouping changes.",
  },
  publish: {
    title: "Publish",
    body: "New shifts start as drafts. Employees only see published shifts assigned to them. Publish day or week makes every shift in this view visible to staff. Unpublish hides them again.",
  },
  printWeek: {
    title: "Print week",
    body: "Opens a printer-friendly page in a new tab. Employees who open it only see their own published shifts.",
  },
  copyLastWeek: {
    title: "Copy last week",
    body: "Copies last week (or the same weekday last week) onto the dates you are looking at. This replaces what is already there — it does not merge. You will be asked to confirm first.",
  },
  hoursOt: {
    title: "Hours and overtime",
    body: "Hours are time on the clock after unpaid breaks. OT is overtime using this company’s rules — usually after 8 hours in a day or 40 in the week. Weekly overtime still uses the full workweek, even in day view.",
  },
  unassigned: {
    title: "Unassigned",
    body: "Open shifts with no person yet. Only managers see this row. Assign someone in the shift window when you know who will work it.",
  },
  laborOverview: {
    title: "Schedule overview",
    body: "Totals for the day or week you are looking at. Hours are on-clock time. Overtime uses the company’s rules. Estimated labor multiplies hours by each person’s rate, with overtime at 1.5×. Click a tile for the breakdown.",
  },
  laborWarnings: {
    title: "Rule warnings",
    body: "A red ! on a shift means a meal or minor-work rule looks off. Hover the mark to read why. Warnings do not block save — you can still publish and follow up.",
  },
  shiftBreaks: {
    title: "Breaks",
    body: "Unpaid time inside the shift, shown as a hatch on the bar. Breaks snap to 15 minutes, must stay inside the shift, and cannot overlap. On-clock hours and labor cost subtract this time.",
  },
  shiftPublish: {
    title: "Publish this shift",
    body: "Check this to make this one shift visible to the assigned person. You can also publish a whole day or week from the calendar toolbar.",
  },
  shiftResponsibilities: {
    title: "Responsibilities",
    body: "Optional duty labels for this shift, such as Closer. Turn the feature on and add labels under Company settings → Responsibilities.",
  },
  employeeRole: {
    title: "Role",
    body: "The role decides what this person can see and change in this company. You cannot change your own role. The company must keep at least one Administrator.",
  },
  employeeRate: {
    title: "Hourly rate",
    body: "Used only to estimate labor cost on the schedule. People without a rate still appear on the calendar; they just do not add to the dollar total. Overtime is costed at 1.5× this rate.",
  },
  employeeWaiver: {
    title: "Meal-break waiver",
    body: "When meal rules are on, this can hide the first-meal warning on shorter shifts (up to 6 hours in California). It does not remove the break from the shift.",
  },
  employeeDeactivated: {
    title: "Deactivated people",
    body: "Deactivating takes someone off the roster without deleting their account or past shifts. Their old shifts show as unassigned. Check this box to find them again and reactivate.",
  },
  settingsCompany: {
    title: "Company",
    body: "The workplace name, default time zone, and the weekday the workweek starts on. New teams inherit these. Each team can later use its own time zone and week start.",
  },
  settingsHours: {
    title: "Hours",
    body: "Templates that say when this workplace may be scheduled. Assign one template to the company. You can keep extras for holidays or seasonal weeks.",
  },
  settingsScheduling: {
    title: "Scheduling rules",
    body: "Lock past dates, pick a labor state for defaults, and tune meal, overtime, and minor-work rules. These drive the Hours/OT column and the warning marks on the calendar.",
  },
  settingsMms: {
    title: "MMS",
    body: "Optional picture-message of the week when you publish. Needs Twilio credentials. Staff still get email about published future shifts when this is off.",
  },
  settingsTeams: {
    title: "Teams",
    body: "Teams are the calendars in the menu. Each team has a name, time zone, week start, color, and jobs (positions) that color the shift bars.",
  },
  settingsResponsibilities: {
    title: "Responsibilities",
    body: "Optional duty labels you can attach to a shift. Turn the feature on here, then add labels. A label can be company-wide or limited to one team.",
  },
  settingsRoles: {
    title: "Roles",
    body: "Each role sets None, View, or Edit for Employees, Scheduling, and every settings section. Create extra roles if the three defaults are not enough.",
  },
  hoursWindows: {
    title: "Schedule window vs open hours",
    body: "Earliest in and latest out are the times you are allowed to save a shift. Business open and close only shade the “we are open” band on day view. You can allow a 6:00 AM prep shift even if the dining room opens at 10:00.",
  },
  permissionLevels: {
    title: "None, View, and Edit",
    body: "None hides that area. View can open it but not save. Edit can change it. Scheduling View is special: that person only sees their own published shifts.",
  },
  administratorLock: {
    title: "Administrator",
    body: "This role always has Edit on every area. You cannot weaken it or delete it. The company must keep at least one Administrator.",
  },
  icalFeed: {
    title: "Calendar feed",
    body: "A private link to your published shifts for Google Calendar, Apple Calendar, or Outlook. Anyone with the URL can see those shifts, so treat it like a password.",
  },
  historicalLock: {
    title: "Lock past dates",
    body: "When this is on, nobody can create, move, copy, delete, or publish shifts on today or any earlier date in the team’s time zone. Future dates still edit normally.",
  },
} as const;

export type HelpTopicId = keyof typeof HELP_TOPICS;

export const SETTINGS_HELP = {
  company: "settingsCompany",
  hours: "settingsHours",
  scheduling: "settingsScheduling",
  mms: "settingsMms",
  teams: "settingsTeams",
  responsibilities: "settingsResponsibilities",
  roles: "settingsRoles",
} as const satisfies Record<string, HelpTopicId>;
