import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { paymentOrders } from "@/lib/db/schema";
import { createPaymentUrl, generateOutTradeNo, expireStaleOrders } from "@/lib/zpay";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const { amount } = await req.json();

    const cny = parseFloat(amount);
    if (!cny || cny < 1 || cny > 10000) {
      return NextResponse.json(
        { error: "Amount must be between \u00A51 and \u00A510,000" },
        { status: 400 }
      );
    }

    // Expire any stale pending orders first
    await expireStaleOrders(userId);

    // Round to 2 decimal places
    const amountStr = cny.toFixed(2);
    // Credits = CNY 1:1
    const creditAmount = amountStr;

    const outTradeNo = generateOutTradeNo();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const [order] = await db
      .insert(paymentOrders)
      .values({
        userId,
        outTradeNo,
        amount: amountStr,
        creditAmount,
        status: "pending",
        type: "alipay",
        name: `One AI Credits`,
      })
      .returning();

    const paymentUrl = createPaymentUrl({
      outTradeNo,
      money: amountStr,
      name: `One AI Credits`,
      notifyUrl: `${appUrl}/api/payment/notify`,
      returnUrl: `${appUrl}/api/payment/return`,
      type: "alipay",
    });

    return NextResponse.json({
      orderId: order.id,
      outTradeNo,
      paymentUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create payment";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Payment create error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
