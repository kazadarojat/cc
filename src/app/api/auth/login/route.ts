import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/session";

function withSession(req: Request, target: string, payload: { role: Role; subjectId: string; name: string }) {
  const res = NextResponse.redirect(new URL(target, req.url), 303);
  res.cookies.set(SESSION_COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const role = String(form.get("role") ?? "") as Role;
  const requestedId = String(form.get("subjectId") ?? "");
  const bootstrap = String(form.get("bootstrap") ?? "") === "1";

  if (role !== "patient" && role !== "clinician") {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }

  const target = role === "clinician" ? "/clinician" : "/patient";
  const empty = NextResponse.redirect(new URL("/login?error=empty", req.url), 303);

  // The entry screen never lists the panel. A role-only sign-in resolves the
  // workspace subject server-side; an explicit subjectId (deep link, tests)
  // still takes precedence.
  if (role === "patient") {
    const patient = requestedId
      ? await db.patient.findUnique({ where: { id: requestedId } })
      : await db.patient.findFirst({ orderBy: { enrolledAt: "asc" } });
    if (!patient) return empty;
    return withSession(req, target, { role, subjectId: patient.id, name: patient.name });
  }

  const clinician = requestedId
    ? await db.clinician.findUnique({ where: { id: requestedId } })
    : await db.clinician.findFirst({ orderBy: { createdAt: "asc" } });
  if (clinician) {
    return withSession(req, target, { role, subjectId: clinician.id, name: clinician.name });
  }

  // Empty workspace: the first clinician is created from the first-run form.
  const name = String(form.get("name") ?? "").trim();
  if (!bootstrap || !name) return empty;

  const created = await db.clinician.create({
    data: {
      name,
      role: "memory_clinic",
      email: String(form.get("email") ?? "").trim() || `clinician${Date.now()}@local`,
      institution: String(form.get("institution") ?? "").trim(),
    },
  });
  return withSession(req, target, { role, subjectId: created.id, name: created.name });
}
