import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { paymentOrders } from "@/lib/db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import { expireStaleOrders } from "@/lib/zpay";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    // Auto-expire stale pending orders
    await expireStaleOrders(userId);

    const orderId = req.nextUrl.searchParams.get("orderId");

    if (orderId) {
      const order = await db.query.paymentOrders.findFirst({
        where: and(
          eq(paymentOrders.id, orderId),
          eq(paymentOrders.userId, userId)
        ),
      });
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      return NextResponse.json({
        id: order.id,
        status: order.status,
        amount: order.amount,
        creditAmount: order.creditAmount,
      });
    }

    // Return recent orders (only paid — expired are noise)
    const orders = await db.query.paymentOrders.findMany({
      where: and(
        eq(paymentOrders.userId, userId),
        eq(paymentOrders.status, "paid")
      ),
      orderBy: [desc(paymentOrders.createdAt)],
      limit: 10,
    });

    return NextResponse.json(
      orders.map((o) => ({
        id: o.id,
        outTradeNo: o.outTradeNo,
        amount: o.amount,
        creditAmount: o.creditAmount,
        status: o.status,
        type: o.type,
        createdAt: o.createdAt,
      }))
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check status";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
