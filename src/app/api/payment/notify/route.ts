import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentOrders, users, creditTransactions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifySign } from "@/lib/zpay";

export async function GET(req: NextRequest) {
  try {
    const params: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Verify sign
    if (!verifySign(params)) {
      console.error("ZPay notify: invalid sign", params);
      return new NextResponse("fail", { status: 400 });
    }

    const tradeStatus = params.trade_status;
    const outTradeNo = params.out_trade_no;
    const tradeNo = params.trade_no;

    if (tradeStatus !== "TRADE_SUCCESS") {
      return new NextResponse("success");
    }

    // Find the order
    const order = await db.query.paymentOrders.findFirst({
      where: eq(paymentOrders.outTradeNo, outTradeNo),
    });

    if (!order) {
      console.error("ZPay notify: order not found", outTradeNo);
      return new NextResponse("fail", { status: 404 });
    }

    // Already processed (idempotent)
    if (order.status === "paid") {
      return new NextResponse("success");
    }

    // Accept both "pending" and "expired" — if ZPay says paid, the user paid
    // (handles edge case where order expired locally but user completed payment)

    // Verify amount matches
    const notifiedMoney = params.money;
    if (parseFloat(notifiedMoney) !== parseFloat(order.amount)) {
      console.error("ZPay notify: amount mismatch", { notifiedMoney, orderAmount: order.amount });
      return new NextResponse("fail", { status: 400 });
    }

    // Update order status to paid
    await db
      .update(paymentOrders)
      .set({
        status: "paid",
        tradeNo: tradeNo || null,
        notifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));

    // Credit the user
    const creditAmount = order.creditAmount;

    await db
      .update(users)
      .set({
        creditBalance: sql`${users.creditBalance} + ${creditAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, order.userId));

    // Fetch updated balance for transaction record
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, order.userId),
      columns: { creditBalance: true },
    });

    // Record credit transaction
    await db.insert(creditTransactions).values({
      userId: order.userId,
      amount: creditAmount,
      balance: updatedUser?.creditBalance || "0",
      type: "purchase",
      description: `Alipay top-up \u00A5${order.amount}`,
    });

    return new NextResponse("success");
  } catch (error) {
    console.error("ZPay notify error:", error);
    return new NextResponse("fail", { status: 500 });
  }
}
