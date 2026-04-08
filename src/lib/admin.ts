import "server-only";

import { getCurrentUser } from "./dal";
import type { User } from "./db/schema";

/**
 * Check if the current user is an admin.
 * Returns the user if admin, or a Response to return from the API route.
 */
export async function requireAdmin(): Promise<User | Response> {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return user;
}

export function isErrorResponse(result: User | Response): result is Response {
  return result instanceof Response;
}
