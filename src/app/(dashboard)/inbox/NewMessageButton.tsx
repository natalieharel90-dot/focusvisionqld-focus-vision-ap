import { startThreadAction } from "./actions";

type PatientOption = { id: string; name: string };

// "New message" — a dropdown to pick a patient and open the conversation
// with them. The first message is then typed in the normal composer.
export function NewMessageButton({
  patients,
}: {
  patients: ReadonlyArray<PatientOption>;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
        New message
      </summary>
      <form
        action={startThreadAction}
        className="absolute right-0 z-10 mt-2 flex w-[300px] flex-col gap-3 rounded-xl border border-fv-bg-soft bg-fv-bg-card p-4 shadow-lg"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-fv-text-primary">Patient</span>
          <select
            name="patient_id"
            required
            defaultValue=""
            className="rounded-md border border-fv-border bg-fv-bg-app px-3 py-2 text-sm text-fv-text-primary"
          >
            <option value="" disabled>
              Select a patient…
            </option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-fv-text-secondary">
          This opens the conversation — type the first message there.
        </p>
        <button
          type="submit"
          className="rounded-md bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Open conversation
        </button>
      </form>
    </details>
  );
}
