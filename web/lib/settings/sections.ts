export type SettingsSectionId =
  | "company"
  | "hours"
  | "scheduling"
  | "teams"
  | "responsibilities"
  | "people"
  | "account";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  adminOnly: boolean;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "company", label: "Company", adminOnly: true },
  { id: "hours", label: "Hours", adminOnly: true },
  { id: "scheduling", label: "Scheduling", adminOnly: true },
  { id: "teams", label: "Teams", adminOnly: true },
  { id: "responsibilities", label: "Responsibilities", adminOnly: true },
  { id: "people", label: "People", adminOnly: true },
  { id: "account", label: "Account", adminOnly: false },
];
