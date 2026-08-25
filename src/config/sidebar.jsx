import {
  LayoutDashboard,
  LayoutGrid,
} from "lucide-react";
import { flatModuleIconFor } from "../components/FlatModuleIcon.jsx";

export const navItems = [
  { id: "my-workspace", path: "/my-workspace", label: "My Workspace", icon: flatModuleIconFor("my-workspace"), section: "main" },
  { id: "overview", path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { id: "applications", path: "/applications", label: "Applications", icon: LayoutGrid, section: "main" },
  { id: "appointments", path: "/appointments", label: "Appointments", icon: flatModuleIconFor("appointments"), section: "main" },
  { id: "clients", path: "/clients", label: "Clients", icon: flatModuleIconFor("clients"), section: "main" },
  { id: "leads", path: "/leads", label: "Leads", icon: flatModuleIconFor("leads"), section: "main" },
  { id: "pos", path: "/pos", label: "POS", icon: flatModuleIconFor("pos"), section: "clinic-operations" },
  { id: "card-view", path: "/card-view", label: "Card View", icon: flatModuleIconFor("card-view"), section: "clinic-operations" },
  { id: "room-view", path: "/room-view", label: "Room View", icon: flatModuleIconFor("room-view"), section: "clinic-operations" },
  { id: "treatments", path: "/treatments", label: "Treatments", icon: flatModuleIconFor("treatments"), section: "clinic-operations" },
  { id: "services", path: "/services", label: "Services", icon: flatModuleIconFor("services"), section: "clinic-operations" },
  { id: "packages", path: "/packages", label: "Packages", icon: flatModuleIconFor("packages"), section: "clinic-operations" },
  { id: "booking", path: "/online-booking", label: "Online Booking", icon: flatModuleIconFor("booking"), section: "clinic-operations" },
  { id: "staff-view", path: "/staff-schedule", label: "Staff Schedule", icon: flatModuleIconFor("staff-view"), section: "staff-branches" },
  { id: "staff", path: "/staff", label: "Staff Management", icon: flatModuleIconFor("staff"), section: "staff-branches" },
  { id: "facetrack-attendance", path: "/attendance", label: "FaceTrack Attendance", icon: flatModuleIconFor("facetrack-attendance"), section: "staff-branches" },
  { id: "branches", path: "/branches", label: "Branches", icon: flatModuleIconFor("branches"), section: "staff-branches" },
  { id: "inventory", path: "/inventory", label: "Inventory", icon: flatModuleIconFor("inventory"), section: "inventory-finance" },
  { id: "expenses", path: "/expenses", label: "Expenses", icon: flatModuleIconFor("expenses"), section: "inventory-finance" },
  { id: "payroll", path: "/payroll", label: "Payroll", icon: flatModuleIconFor("payroll"), section: "inventory-finance" },
  { id: "reports", path: "/reports", label: "Reports", icon: flatModuleIconFor("reports"), section: "inventory-finance" },
  { id: "sms", path: "/marketing", label: "Marketing", icon: flatModuleIconFor("sms"), section: "marketing" },
  { id: "flipbooks", path: "/flipbooks", label: "Flipbooks", icon: flatModuleIconFor("flipbooks"), section: "marketing" },
  { id: "settings", path: "/settings", label: "Settings", icon: flatModuleIconFor("settings"), section: "system" },
  { id: "support", path: "/support", label: "Support", icon: flatModuleIconFor("support"), section: "support" },
];

export const navSections = [
  { id: "main", label: "Main" },
  { id: "clinic-operations", label: "Clinic Operations" },
  { id: "staff-branches", label: "Staff & Branches" },
  { id: "inventory-finance", label: "Inventory & Finance" },
  { id: "marketing", label: "Marketing" },
  { id: "system", label: "System" },
  { id: "support", label: "Support" },
].map((section) => ({
  ...section,
  items: navItems.filter((item) => item.section === section.id),
}));

export const coreClinicModules = ["clients", "appointments", "treatments"];
