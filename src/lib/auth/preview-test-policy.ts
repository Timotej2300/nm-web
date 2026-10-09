const previewTestPermissions = new Set([
  "ninjamelonweb.staff",
  "ninjamelonweb.dashboard",
  "ninjamelonweb.team",
  "ninjamelonweb.forum",
  "ninjamelonweb.tickets",
  "ninjamelonweb.recruitment",
  "ninjamelonweb.news",
  "ninjamelonweb.pages",
  "ninjamelonweb.maintenance",
  "ninjamelonweb.audit",
]);

type PreviewTestConfig = {
  vercelEnv: string | undefined;
  enabled: string | undefined;
  testUserId: string | undefined;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function previewTestModeActive(config: PreviewTestConfig): boolean {
  return (
    config.vercelEnv === "preview" &&
    config.enabled === "true" &&
    typeof config.testUserId === "string" &&
    uuidPattern.test(config.testUserId)
  );
}

export function previewTestPermissionAllowed(
  userId: string,
  permission: string,
  config: PreviewTestConfig,
): boolean {
  return (
    previewTestModeActive(config) &&
    config.testUserId?.toLowerCase() === userId.toLowerCase() &&
    previewTestPermissions.has(permission)
  );
}