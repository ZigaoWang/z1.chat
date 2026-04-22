import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentOrders, users, creditTransactions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifySign, queryOrderFromZPay } from "@/lib/zpay";

export async function GET(req: NextRequest) {
  const params: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Verify sign from ZPay redirect
  if (!verifySign(params)) {
    return NextResponse.redirect(`${appUrl}/settings?payment=error`);
  }

  const outTradeNo = params.out_trade_no;
  if (!outTradeNo) {
    return NextResponse.redirect(`${appUrl}/settings?payment=error`);
  }

  // Find our order
  const order = await db.query.paymentOrders.findFirst({
    where: eq(paymentOrders.outTradeNo, outTradeNo),
  });

  if (!order) {
    return NextResponse.redirect(`${appUrl}/settings?payment=error`);
  }

  // Already credited
  if (order.status === "paid") {
    return NextResponse.redirect(`${appUrl}/settings?payment=success`);
  }

  // Actively verify with ZPay's query API (don't rely solely on notify_url)
  const zpayResult = await queryOrderFromZPay(outTradeNo);

  if (!zpayResult.success || zpayResult.status !== 1) {
    return NextResponse.redirect(`${appUrl}/settings?payment=pending`);
  }

  // Verify amount matches
  if (zpayResult.money && parseFloat(zpayResult.money) !== parseFloat(order.amount)) {
    console.error("ZPay return: amount mismatch", { zpayMoney: zpayResult.money, orderAmount: order.amount });
    return NextResponse.redirect(`${appUrl}/settings?payment=error`);
  }

  // Mark as paid
  await db
    .update(paymentOrders)
    .set({
      status: "paid",
      tradeNo: zpayResult.tradeNo || null,
      notifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentOrders.id, order.id));

  // Credit the user
  await db
    .update(users)
    .set({
      creditBalance: sql`${users.creditBalance} + ${order.creditAmount}`,
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
    amount: order.creditAmount,
    balance: updatedUser?.creditBalance || "0",
    type: "purchase",
    description: `Alipay top-up \u00A5${order.amount}`,
  });

  return NextResponse.redirect(`${appUrl}/settings?payment=success`);
}
