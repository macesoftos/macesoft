const assetByModuleId = Object.freeze({
  "my-workspace": "my-workspace",
  appointments: "appointments",
  clients: "clients",
  leads: "leads",
  pos: "pos",
  "card-view": "card-view",
  "room-view": "room-view",
  treatments: "treatments",
  services: "services",
  packages: "packages",
  booking: "online-booking",
  "staff-view": "staff-schedule",
  staff: "staff-management",
  "facetrack-attendance": "facetrack-attendance",
  branches: "branches",
  inventory: "inventory",
  expenses: "expenses",
  payroll: "payroll",
  reports: "reports",
  sms: "marketing",
  flipbooks: "flipbooks",
  settings: "settings",
  support: "support",
});

const componentByModuleId = new Map();

export function flatModuleIconFor(moduleId) {
  const asset = assetByModuleId[moduleId];
  if (!asset) return null;
  if (componentByModuleId.has(moduleId)) return componentByModuleId.get(moduleId);

  function FlatModuleIcon({ className = "", size = 24, ...props }) {
    const imageProps = { ...props };
    delete imageProps.color;
    delete imageProps.strokeWidth;
    return (
      <img
        {...imageProps}
        alt=""
        className={`flat-module-icon ${className}`.trim()}
        height={size}
        src={`/brand/icons/${asset}.svg`}
        width={size}
      />
    );
  }

  FlatModuleIcon.displayName = `${moduleId}-flat-module-icon`;
  componentByModuleId.set(moduleId, FlatModuleIcon);
  return FlatModuleIcon;
}

export const flatModuleIconIds = Object.freeze(Object.keys(assetByModuleId));
