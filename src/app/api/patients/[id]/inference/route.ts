import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzePatient, loadBundle, runInference } from "@/lib/engine";
import { getSession } from "@/lib/session";

async function guard(patientId: string) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (s.role === "patient" && s.subjectId !== patientId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await guard(id);
  if (denied) return denied;
  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return NextResponse.json({ error: "not found" }, { status: 404 });
  const bundle = await loadBundle(id);
  return NextResponse.json(analyzePatient(patient, bundle));
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await guard(id);
  if (denied) return denied;
  const inferenceId = await runInference(id);
  return NextResponse.json({ inferenceId });
}
