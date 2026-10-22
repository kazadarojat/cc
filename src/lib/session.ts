import { cookies } from "next/headers";

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

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    if (parsed && (parsed.role === "patient" || parsed.role === "clinician")) {
      return parsed as Session;
    }
  } catch {
    return null;
  }
  return null;
}

export function encodeSession(s: Session): string {
  return Buffer.from(JSON.stringify(s), "utf8").toString("base64");
}

export const SESSION_COOKIE = COOKIE;
