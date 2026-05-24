export function isTestToolsEnabled(): boolean {
  return process.env.TEST_TOOLS_ENABLED === "true";
}

export function verifyWebhookSecret(request: Request): boolean {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-webhook-secret");
  return provided === expected;
}
