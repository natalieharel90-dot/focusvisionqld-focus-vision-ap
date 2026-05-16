import { initials } from "@/lib/bulk-push";
import { AddRoleModal } from "./AddRoleModal";
import { DoctorModal, type Doctor } from "./DoctorModal";
import {
  deleteDoctorAction,
  saveDoctorAction,
  saveDoctorVideoAction,
} from "./actions";

const fieldLabel =
  "text-[11px] font-semibold uppercase tracking-wide text-fv-text-secondary";
const fieldInput =
  "mt-1 w-full rounded-lg border border-fv-bg-soft bg-fv-bg-app px-3 py-2 text-sm focus:border-fv-accent focus:outline-none";

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-red-600",
];

function gradientFor(seed: string): string {
  let h = 0;
  for (const c of seed) h += c.charCodeAt(0);
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]!;
}

export function DoctorsTab({
  doctors,
  roles,
  canEdit,
}: {
  doctors: Doctor[];
  roles: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const roleNames = roles.map((r) => r.name);
  return (
    <section className="rounded-2xl border border-fv-bg-soft bg-fv-bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-fv-text-primary">
            Staff
          </h2>
          <p className="mt-0.5 text-xs text-fv-text-secondary">
            Clinical and admin staff. Each can optionally upload a welcome
            video that plays for their patients on the patient app.
          </p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 flex-col items-stretch gap-2">
            <DoctorModal doctor={null} roles={roleNames} />
            <AddRoleModal roles={roles} />
          </div>
        ) : null}
      </div>

      {doctors.length === 0 ? (
        <p className="mt-4 rounded-xl bg-fv-bg-soft/50 p-6 text-center text-sm text-fv-text-secondary">
          No doctors yet.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className={`rounded-xl bg-fv-bg-soft/40 p-4 ${
                doctor.active ? "" : "opacity-60"
              }`}
            >
              {/* Name / role / email — inline editable */}
              <form action={saveDoctorAction}>
                <input type="hidden" name="id" value={doctor.id} />
                <input type="hidden" name="phone" value={doctor.phone ?? ""} />
                <input
                  type="hidden"
                  name="photo_url"
                  value={doctor.photo_url ?? ""}
                />
                <div className="flex flex-wrap items-start gap-4">
                  <label
                    title={
                      canEdit
                        ? "Choose a photo, then Save"
                        : undefined
                    }
                    className={`mt-5 block h-12 w-12 shrink-0 overflow-hidden rounded-full ${
                      canEdit ? "cursor-pointer" : ""
                    }`}
                  >
                    {doctor.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={doctor.photo_url}
                        alt={doctor.name}
                        className="h-12 w-12 object-cover"
                      />
                    ) : (
                      <span
                        className={`grid h-12 w-12 place-items-center bg-gradient-to-br text-sm font-semibold text-white ${gradientFor(
                          doctor.name
                        )}`}
                      >
                        {initials(doctor.name)}
                      </span>
                    )}
                    {canEdit ? (
                      <input
                        type="file"
                        name="photo"
                        accept="image/*"
                        className="sr-only"
                      />
                    ) : null}
                  </label>
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                    <label>
                      <span className={fieldLabel}>Name</span>
                      <input
                        name="name"
                        required
                        defaultValue={doctor.name}
                        disabled={!canEdit}
                        className={fieldInput}
                      />
                    </label>
                    <label>
                      <span className={fieldLabel}>Role</span>
                      <select
                        name="role"
                        defaultValue={doctor.role}
                        disabled={!canEdit}
                        className={fieldInput}
                      >
                        {roleNames.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className={fieldLabel}>Email</span>
                      <input
                        name="email"
                        type="email"
                        defaultValue={doctor.email ?? ""}
                        disabled={!canEdit}
                        className={fieldInput}
                      />
                    </label>
                  </div>
                  {canEdit ? (
                    <button
                      type="submit"
                      className="mt-5 rounded-lg bg-fv-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Save
                    </button>
                  ) : null}
                </div>
                {canEdit ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-fv-accent-strong">
                      Edit bio
                    </summary>
                    <textarea
                      name="bio"
                      rows={3}
                      defaultValue={doctor.bio ?? ""}
                      placeholder="Short bio shown to patients…"
                      className={`${fieldInput} sm:max-w-md`}
                    />
                  </details>
                ) : null}
              </form>

              {/* Welcome video — its own form (forms cannot nest) */}
              {canEdit ? (
                <form
                  action={saveDoctorVideoAction}
                  className={`mt-3 rounded-lg p-3 ${
                    doctor.welcome_video_url
                      ? "border border-green-300 bg-green-50"
                      : "border border-dashed border-fv-border"
                  }`}
                >
                  <input type="hidden" name="id" value={doctor.id} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-fv-text-primary">
                      🎬 <strong>Welcome video</strong>
                      {doctor.welcome_video_url
                        ? " — uploaded · plays for this doctor's patients"
                        : " — not uploaded · optional"}
                    </span>
                    <div className="flex items-center gap-2">
                      {doctor.welcome_video_url ? (
                        <a
                          href={doctor.welcome_video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-fv-border px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft"
                        >
                          Preview
                        </a>
                      ) : null}
                      <label className="cursor-pointer rounded-md border border-fv-border bg-fv-bg-card px-3 py-1.5 text-xs font-semibold text-fv-text-primary hover:bg-fv-bg-soft">
                        Choose video
                        <input
                          type="file"
                          name="video"
                          accept="video/*"
                          required
                          className="sr-only"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded-md bg-fv-accent-strong px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        {doctor.welcome_video_url ? "Replace" : "Upload"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : doctor.welcome_video_url ? (
                <p className="mt-3 text-xs text-fv-text-secondary">
                  🎬 Welcome video uploaded.
                </p>
              ) : null}

              {canEdit ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-red-600">
                    Remove from roster
                  </summary>
                  <form action={deleteDoctorAction} className="mt-1.5">
                    <input type="hidden" name="id" value={doctor.id} />
                    <button
                      type="submit"
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Yes, remove {doctor.name}
                    </button>
                  </form>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
