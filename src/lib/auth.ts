// In dev mode, we use a fixed user. In production, this would come from auth.
export const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

export function getCurrentUserId(): string {
  // TODO: Replace with real auth in production
  return DEV_USER_ID;
}
