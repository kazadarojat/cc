import { redirect } from "next/navigation";

// The simple cognitive task has been replaced by the merged NeuroCheck battery.
export default function TaskRedirect() {
  redirect("/patient/neurocheck");
}
