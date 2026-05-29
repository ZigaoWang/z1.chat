import crypto from "crypto";
import { db } from "./db";
import { paymentOrders } from "./db/schema";
import { eq, and, lt } from "drizzle-orm";

const ZPAY_PID = process.env.ZPAY_PID!;
const ZPAY_KEY = process.env.ZPAY_KEY!;
const ZPAY_GATEWAY = process.env.ZPAY_GATEWAY || "https://zpayz.cn";
const ZPAY_CHANNEL_ID = process.env.ZPAY_CHANNEL_ID;

/** Orders expire after 30 minutes */
const ORDER_TTL_MS = 30 * 60 * 1000;

/**
 * Sort params by key (ASCII a-z), exclude sign/sign_type/empty values,
 * then join as URL key-value pairs: a=b&c=d&e=f
 */
function buildSignString(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

/**
 * Generate MD5 sign: md5(sortedParams + KEY)
 */
export function generateSign(params: Record<string, string>): string {
  const str = buildSignString(params);
  return crypto
    .createHash("md5")
    .update(str + ZPAY_KEY)
    .digest("hex");
}

/**
 * Verify sign from ZPay callback
 */
export function verifySign(params: Record<string, string>): boolean {
  const receivedSign = params.sign;
  if (!receivedSign) return false;
  const expectedSign = generateSign(params);
  const a = Buffer.from(receivedSign.toLowerCase());
  const b = Buffer.from(expectedSign.toLowerCase());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Generate a unique order number: YYYYMMDDHHmmss + 6 random digits
 */
export function generateOutTradeNo(): string {
  const now = new Date();
  const ts = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  const rand = Math.floor(100000 + Math.random() * 900000);
  return ts + rand;
}

interface CreatePaymentParams {
  outTradeNo: string;
  money: string;
  name: string;
  notifyUrl: string;
  returnUrl: string;
  type?: "alipay" | "wxpay";
}

/**
 * Build the full ZPay payment URL for frontend redirect
 */
export function createPaymentUrl(opts: CreatePaymentParams): string {
  const params: Record<string, string> = {
    pid: ZPAY_PID,
    type: opts.type || "alipay",
    out_trade_no: opts.outTradeNo,
    notify_url: opts.notifyUrl,
    return_url: opts.returnUrl,
    name: opts.name,
    money: opts.money,
    sitename: "z1.chat",
  };

  if (ZPAY_CHANNEL_ID) {
    params.cid = ZPAY_CHANNEL_ID;
  }

  const sign = generateSign(params);

  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  return `${ZPAY_GATEWAY}/submit.php?${query}&sign=${sign}&sign_type=MD5`;
}

/**
 * Expire all pending orders older than ORDER_TTL_MS for a given user.
 * Called before listing orders and before creating new ones.
 */
export async function expireStaleOrders(userId: string) {
  const cutoff = new Date(Date.now() - ORDER_TTL_MS);
  await db
    .update(paymentOrders)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(paymentOrders.userId, userId),
        eq(paymentOrders.status, "pending"),
        lt(paymentOrders.createdAt, cutoff)
      )
    );
}

/**
 * Query ZPay API to check if an order has been paid.
 * Returns the order status from ZPay's side.
 */
export async function queryOrderFromZPay(outTradeNo: string): Promise<{
  success: boolean;
  status: number; // 1 = paid, 0 = unpaid
  tradeNo?: string;
  money?: string;
}> {
  const url = `${ZPAY_GATEWAY}/api.php?act=order&pid=${ZPAY_PID}&key=${ZPAY_KEY}&out_trade_no=${outTradeNo}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      success: data.code === 1,
      status: data.status ?? 0,
      tradeNo: data.trade_no,
      money: data.money,
    };
  } catch (error) {
    console.error("ZPay query order error:", error);
    return { success: false, status: 0 };
  }
}
