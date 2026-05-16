import { redirect } from "next/navigation";

// Alert actions were merged into the routing rules page — keep the old
// route working for bookmarks and the folded settings tab.
export default function AlertActionsRedirect() {
  redirect("/settings/alert-thresholds");
}
