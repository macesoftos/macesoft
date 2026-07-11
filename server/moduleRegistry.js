export const sidebarModules = [
  { id: "overview", label: "Overview", table: null, phase: "core", section: "Main" },
  { id: "appointments", label: "Appointments", table: "Appointment", phase: "core", section: "Main" },
  { id: "clients", label: "Clients", table: "Client", phase: "core", section: "Main" },
  { id: "leads", label: "Leads", table: "Lead", phase: "growth", section: "Main" },
  { id: "pos", label: "POS", table: "Sale", phase: "core", section: "Clinic Operations" },
  { id: "card-view", label: "Card View", table: "Appointment", phase: "operations", section: "Clinic Operations" },
  { id: "room-view", label: "Room View", table: "Room", phase: "operations", section: "Clinic Operations" },
  { id: "treatments", label: "Treatments", table: "Treatment", phase: "core", section: "Clinic Operations" },
  { id: "services", label: "Services", table: "Service", phase: "catalog", section: "Clinic Operations" },
  { id: "packages", label: "Packages", table: "ClinicPackage", phase: "revenue", section: "Clinic Operations" },
  { id: "booking", label: "Online Booking", table: "Appointment", phase: "growth", section: "Clinic Operations" },
  { id: "staff-view", label: "Staff Schedule", table: "StaffMember", phase: "operations", section: "Staff & Branches" },
  { id: "staff", label: "Staff Management", table: "StaffMember", phase: "admin", section: "Staff & Branches" },
  { id: "branches", label: "Branches", table: "Branch", phase: "admin", section: "Staff & Branches" },
  { id: "inventory", label: "Inventory", table: "InventoryItem", phase: "catalog", section: "Inventory & Finance" },
  { id: "expenses", label: "Expenses", table: "Expense", phase: "finance", section: "Inventory & Finance" },
  { id: "reports", label: "Reports", table: null, phase: "insights", section: "Inventory & Finance" },
  { id: "sms", label: "Marketing", table: "MarketingCampaign", phase: "growth", section: "Marketing" },
  { id: "settings", label: "Settings", table: null, phase: "admin", section: "System" },
  { id: "support", label: "Support", table: null, phase: "support", section: "Support" },
];

export const mvpModules = ["clients", "appointments", "treatments"];
