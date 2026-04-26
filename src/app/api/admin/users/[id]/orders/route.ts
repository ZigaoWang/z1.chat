import { db } from "@/lib/db";
import { paymentOrders } from "@/lib/db/schema";
import { requireAdmin, isErrorResponse } from "@/lib/admin";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  try {
    const { id } = await params;

    const orders = await db
      .select({
        id: paymentOrders.id,
        outTradeNo: paymentOrders.outTradeNo,
        amount: paymentOrders.amount,
        creditAmount: paymentOrders.creditAmount,
        status: paymentOrders.status,
        type: paymentOrders.type,
        name: paymentOrders.name,
        createdAt: paymentOrders.createdAt,
      })
      .from(paymentOrders)
      .where(eq(paymentOrders.userId, id))
      .orderBy(desc(paymentOrders.createdAt))
      .limit(50);

    return Response.json(
      orders.map((o) => ({
        ...o,
        amount: Number(o.amount),
        creditAmount: Number(o.creditAmount),
      }))
    );
  } catch (error) {
    console.error("Admin user orders error:", error);
    return Response.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
