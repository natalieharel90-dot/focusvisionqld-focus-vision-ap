import { initials } from "@/lib/bulk-push";
import { DoctorModal, type Doctor } from "./DoctorModal";

export function DoctorsTab({
  doctors,
  canEdit,
}: {
  doctors: Doctor[];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <div className="flex justify-end">
          <DoctorModal doctor={null} />
        </div>
      ) : null}

      {doctors.length === 0 ? (
        <p className="rounded-xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          No doctors yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {doctors.map((doctor) =>
            canEdit ? (
              <DoctorModal key={doctor.id} doctor={doctor} />
            ) : (
              <div
                key={doctor.id}
                className={`flex items-center gap-3 rounded-xl bg-fv-bg-card p-4 shadow-sm ${
                  doctor.active ? "" : "opacity-50"
                }`}
              >
                {doctor.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doctor.photo_url}
                    alt={doctor.name}
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fv-bg-soft text-sm font-semibold text-fv-text-secondary">
                    {initials(doctor.name)}
                  </span>
                )}
                <span>
                  <span className="block text-sm font-semibold text-fv-text-primary">
                    {doctor.name}
                  </span>
                  <span className="block text-xs text-fv-text-secondary">
                    {doctor.role}
                    {doctor.active ? "" : " · inactive"}
                  </span>
                </span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
