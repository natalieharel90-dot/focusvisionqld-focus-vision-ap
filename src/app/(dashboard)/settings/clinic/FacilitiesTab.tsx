import { FacilityModal, type Facility } from "./FacilityModal";

export function FacilitiesTab({
  facilities,
  canEdit,
}: {
  facilities: Facility[];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <div className="flex justify-end">
          <FacilityModal facility={null} />
        </div>
      ) : null}

      {facilities.length === 0 ? (
        <p className="rounded-xl bg-fv-bg-card p-6 text-center text-sm text-fv-text-secondary shadow-sm">
          No partner facilities yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {facilities.map((facility) =>
            canEdit ? (
              <FacilityModal key={facility.id} facility={facility} />
            ) : (
              <div
                key={facility.id}
                className={`flex flex-col rounded-xl bg-fv-bg-card p-4 shadow-sm ${
                  facility.active ? "" : "opacity-50"
                }`}
              >
                <span className="text-sm font-semibold text-fv-text-primary">
                  {facility.name}
                  {facility.active ? "" : " · inactive"}
                </span>
                {facility.address ? (
                  <span className="text-xs text-fv-text-secondary">
                    {facility.address}
                  </span>
                ) : null}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
