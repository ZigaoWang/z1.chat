export async function POST() {
  return Response.json(
    { error: "Registration is invite-only" },
    { status: 403 }
  );
}
