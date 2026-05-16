import { redirect } from "next/navigation";

// Settings is a tabbed area — land on the first tab.
export default function SettingsIndexPage() {
  redirect("/settings/clinic");
}
