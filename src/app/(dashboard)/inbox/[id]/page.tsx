import { redirect } from "next/navigation";

// The standalone thread view is now folded into the two-column inbox.
// Deep links (e.g. from Triage) resolve to the inbox with that thread open.
export default function StaffThreadRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/inbox?thread=${params.id}`);
}
