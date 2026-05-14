import { createSupabaseServerClient } from "@/lib/supabase-server";
import { saveAlertActionsAction } from "./actions";

export const dynamic = "force-dynamic";

type LevelStyle = { container: string; label: string };
const LEVEL_STYLES: Record<"yellow" | "orange" | "red", LevelStyle> = {
  yellow: {
    container: "bg-yellow-50 border-yellow-300",
    label: "text-yellow-900",
  },
  orange: {
    container: "bg-orange-50 border-orange-300",
    label: "text-orange-900",
  },
  red: {
    container: "bg-red-50 border-red-300",
    label: "text-red-900",
  },
};

const DESC: Record<"yellow" | "orange" | "red", string> = {
  yellow: "Review within 4 hours. Used for non-urgent flags.",
  orange: "Contact the patient today. Triage queue priority.",
  red: "Urgent. Patient sees Orange screen — never sees Red.",
};

type Row = {
  alert_level: "yellow" | "orange" | "red";
  email_clinic: boolean;
  inapp_to_all: boolean;
  push_to_oncall: boolean;
  sms_oncall: boolean;
  autocall_oncall: boolean;
  additional_email: string | null;
  oncall_number: string | null;
};

export default async function AlertActionsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("zone_alert_actions")
    .select("*");
  const byLevel = new Map<string, Row>(
    (rows ?? []).map((r) => [
      r.alert_level,
      r as Row,
    ])
  );
  const levels: ReadonlyArray<"yellow" | "orange" | "red"> = [
    "yellow",
    "orange",
    "red",
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fv-text-primary">
          Alert actions
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          What happens when a check-in (or manual flag) routes to each
          level. Red triggers staff-only urgent paths; the patient experience
          is unchanged.
        </p>
      </div>

      {searchParams.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      <div className="space-y-4">
        {levels.map((level) => {
          const row = byLevel.get(level);
          if (!row) return null;
          const style = LEVEL_STYLES[level];
          return (
            <form
              key={level}
              action={saveAlertActionsAction}
              className={`rounded-xl border-l-4 p-5 ${style.container}`}
            >
              <input type="hidden" name="alert_level" value={level} />
              <div className="mb-3 flex items-baseline justify-between">
                <h2
                  className={`text-base font-semibold capitalize ${style.label}`}
                >
                  {level}
                </h2>
                <span className={`text-xs ${style.label} opacity-75`}>
                  {DESC[level]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Toggle
                  name="email_clinic"
                  label="Email clinic inbox"
                  defaultChecked={row.email_clinic}
                />
                <Toggle
                  name="inapp_to_all"
                  label="In-app notify all staff"
                  defaultChecked={row.inapp_to_all}
                />
                <Toggle
                  name="push_to_oncall"
                  label="Push to on-call"
                  defaultChecked={row.push_to_oncall}
                />
                <Toggle
                  name="sms_oncall"
                  label="SMS to on-call"
                  defaultChecked={row.sms_oncall}
                />
                <Toggle
                  name="autocall_oncall"
                  label="Auto-call on-call number"
                  defaultChecked={row.autocall_oncall}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-fv-text-secondary">
                    Additional email
                  </span>
                  <input
                    type="email"
                    name="additional_email"
                    defaultValue={row.additional_email ?? ""}
                    placeholder="optional"
                    className="rounded-md border border-fv-bg-soft bg-white px-3 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-fv-text-secondary">
                    On-call number
                  </span>
                  <input
                    type="tel"
                    name="oncall_number"
                    defaultValue={row.oncall_number ?? ""}
                    placeholder="+61..."
                    className="rounded-md border border-fv-bg-soft bg-white px-3 py-1.5"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white"
                >
                  Save {level}
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </main>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-fv-bg-soft"
      />
      <span className="text-fv-text-primary">{label}</span>
    </label>
  );
}
