export const DEFAULT_TEAM_NAME = "Team";

export function firstTeamOptions(names: string[]) {
  const unique = [
    ...new Set(names.map((name) => name.trim()).filter(Boolean)),
  ];
  return unique.length > 0 ? unique : [DEFAULT_TEAM_NAME];
}
