import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
const key = () => process.env.COGNICARE_ENABLE_DEMO_LOGIN === "1" && (process.env.COGNICARE_SESSION_SECRET?.length ?? 0) >= 32 ? process.env.COGNICARE_SESSION_SECRET! : null;
const sign = (payload: string, secret: string) => createHmac("sha256",secret).update(payload).digest("base64url");

// Prototype-only "session": a signed-in role plus an identity reference.
// Not real auth — it stands in for the two separate trust zones described in the PRD.

export type Role = "patient" | "clinician";

export type Session = {
  role: Role;
  // for patient: their own patientId; for clinician: their clinicianId
  subjectId: string;
  name: string;
};

const COOKIE = "cognicare_session";

export async function getSession(zone?: Role): Promise<Session | null> {
  // Static export (GitHub Pages) has no request cookies: every route is
  // prerendered, so the demo identity for each trust zone is resolved at
  // build time from the seeded database.
  if (process.env.NEXT_PUBLIC_STATIC_EXPORT === "1") {
    const { db } = await import("@/lib/db");
    if (zone === "patient") {
      const p = await db.patient.findFirst({ orderBy: { id: "asc" } });
      return p ? { role: "patient", subjectId: p.id, name: p.name } : null;
    }
    const c = await db.clinician.findFirst({ orderBy: { id: "asc" } });
    return c ? { role: "clinician", subjectId: c.id, name: c.name } : null;
  }
  const secret = key();
  if (!secret) return null;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, signature, extra] = raw.split(".");
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const s: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!s || typeof s !== "object") return null;
    const item = s as Record<string, unknown>;
    if ((item.role === "patient" || item.role === "clinician") &&
      typeof item.subjectId === "string" && item.subjectId.length > 0 &&
      typeof item.name === "string") return { role: item.role, subjectId: item.subjectId, name: item.name };
  } catch { return null; }
  return null;
}

export function encodeSession(s: Session): string {
  const secret = key();
  if (!secret) throw new Error("Demo authentication disabled");
  const payload = Buffer.from(JSON.stringify(s), "utf8").toString("base64url");
  return `${payload}.${sign(payload,secret)}`;
}

export const SESSION_COOKIE = COOKIE;
