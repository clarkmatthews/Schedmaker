export type SettingsSectionId =
  | "company"
  | "hours"
  | "scheduling"
  | "mms"
  | "teams"
  | "responsibilities"
  | "roles";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "company", label: "Company" },
  { id: "hours", label: "Hours" },
  { id: "scheduling", label: "Scheduling" },
  { id: "mms", label: "MMS" },
  { id: "teams", label: "Teams" },
  { id: "responsibilities", label: "Responsibilities" },
  { id: "roles", label: "Roles" },
];
