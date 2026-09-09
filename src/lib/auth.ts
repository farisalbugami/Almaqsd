import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { can, type Permission } from "./roles";

const COOKIE = "almaqsd_session";
const MAX_AGE = 60 * 60 * 8; // 8 ساعات

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET غير معرّف أو قصير جداً");
  return new TextEncoder().encode(s);
}

export type Session = {
  userId: string;
  name: string;
  role: string;
  ownerId: string | null;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      name: String(payload.name),
      role: String(payload.role),
      ownerId: payload.ownerId ? String(payload.ownerId) : null,
    };
  } catch {
    return null;
  }
}

/** يوقف الصفحة ويحوّل لتسجيل الدخول إن لم تكن هناك جلسة */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** يتطلب صلاحية محددة، وإلا يعيد التوجيه */
export async function requirePermission(permission: Permission): Promise<Session> {
  const s = await requireSession();
  if (!can(s.role, permission)) redirect("/denied");
  return s;
}

export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

export async function logAction(
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  summary: string,
) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, summary } });
}
