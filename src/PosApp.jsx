import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Boxes,
  CalendarDays,
  Check,
  CircleDollarSign,
  CreditCard,
  Download,
  Edit3,
  FileText,
  HandCoins,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Minus,
  Package,
  PackagePlus,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tags,
  Trash2,
  Truck,
  Undo2,
  UserCog,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const APP_KEY = "stayprime-retail-pos-v2";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const roles = ["Admin", "Manager", "Cashier"];
const paymentMethods = ["Cash", "Card", "E-Wallet", "Bank Transfer", "Gift Card"];
const refundReasons = ["Customer return", "Damaged item", "Wrong item", "Price correction", "Manager exception"];
const adjustmentReasons = ["Stock in", "Stock out", "Damaged", "Returned", "Expired", "Manual correction"];

const seedUsers = [
  { id: "usr-admin", name: "Admin User", email: "admin@example.com", password: "admin123", role: "Admin", status: "Active" },
  { id: "usr-manager", name: "Manager User", email: "manager@example.com", password: "manager123", role: "Manager", status: "Active" },
  { id: "usr-cashier", name: "Cashier User", email: "cashier@example.com", password: "cashier123", role: "Cashier", status: "Active" },
];

const seedCategories = [
  { id: "cat-skincare", name: "Skin Care", description: "Daily retail products", status: "Active" },
  { id: "cat-wellness", name: "Wellness", description: "Supplements and wellness kits", status: "Active" },
  { id: "cat-devices", name: "Devices", description: "Beauty tools and device care", status: "Active" },
  { id: "cat-supplies", name: "Supplies", description: "Store supplies and consumables", status: "Active" },
];

const seedProducts = [
  {
    id: "prd-cleanser",
    name: "Gentle Cleanser",
    sku: "SKN-CLN-100",
    barcode: "480000100001",
    categoryId: "cat-skincare",
    brand: "MACE Skin",
    unit: "bottle",
    cost: 280,
    price: 690,
    taxRate: 12,
    discount: 0,
    stock: 42,
    reorderLevel: 10,
    supplierId: "sup-skinlab",
    image: "/brand/result-1.jpg",
    status: "Active",
  },
  {
    id: "prd-sunscreen",
    name: "Daily Shield SPF 50",
    sku: "SKN-SPF-050",
    barcode: "480000100002",
    categoryId: "cat-skincare",
    brand: "MACE Skin",
    unit: "tube",
    cost: 390,
    price: 950,
    taxRate: 12,
    discount: 0,
    stock: 7,
    reorderLevel: 12,
    supplierId: "sup-skinlab",
    image: "/brand/result-2.jpg",
    status: "Active",
  },
  {
    id: "prd-postcream",
    name: "Post-care Cream",
    sku: "SKN-PCC-030",
    barcode: "480000100003",
    categoryId: "cat-skincare",
    brand: "MACE Skin",
    unit: "tube",
    cost: 420,
    price: 1200,
    taxRate: 12,
    discount: 0,
    stock: 34,
    reorderLevel: 14,
    supplierId: "sup-skinlab",
    image: "/brand/clinic.jpg",
    status: "Active",
  },
  {
    id: "prd-glowkit",
    name: "Glow Travel Kit",
    sku: "WEL-GLW-010",
    barcode: "480000100004",
    categoryId: "cat-wellness",
    brand: "MACE Wellness",
    unit: "kit",
    cost: 680,
    price: 1500,
    taxRate: 12,
    discount: 50,
    stock: 21,
    reorderLevel: 8,
    supplierId: "sup-wellness",
    image: "/brand/mace-logo.png",
    status: "Active",
  },
  {
    id: "prd-mask",
    name: "Recovery Sheet Mask",
    sku: "SKN-MSK-001",
    barcode: "480000100005",
    categoryId: "cat-skincare",
    brand: "MACE Skin",
    unit: "piece",
    cost: 75,
    price: 180,
    taxRate: 12,
    discount: 0,
    stock: 120,
    reorderLevel: 30,
    supplierId: "sup-skinlab",
    image: "/brand/clinic-davao.jpg",
    status: "Active",
  },
  {
    id: "prd-device",
    name: "Mini Facial Roller",
    sku: "DEV-FRL-001",
    barcode: "480000100006",
    categoryId: "cat-devices",
    brand: "Device Care",
    unit: "piece",
    cost: 520,
    price: 1350,
    taxRate: 12,
    discount: 0,
    stock: 10,
    reorderLevel: 5,
    supplierId: "sup-device",
    image: "/brand/dr-mace.jpg",
    status: "Active",
  },
];

const seedSuppliers = [
  { id: "sup-skinlab", name: "MACE Skin Lab", contact: "Lara Cruz", phone: "0917 111 2211", email: "orders@skinlab.test", address: "Taguig", notes: "Weekly retail replenishment", status: "Active" },
  { id: "sup-wellness", name: "Wellness Supply PH", contact: "Ivan Go", phone: "0917 222 3311", email: "sales@wellness.test", address: "Makati", notes: "Supplements and kits", status: "Active" },
  { id: "sup-device", name: "Device Care PH", contact: "Nina Lim", phone: "0917 333 4411", email: "care@device.test", address: "Davao", notes: "Device retail and consumables", status: "Active" },
];

const seedCustomers = [
  { id: "cus-walkin", name: "Walk-in Customer", phone: "", email: "", address: "", loyaltyPoints: 0, status: "Active" },
  { id: "cus-celine", name: "Celine Hernandez", phone: "0917 443 2210", email: "celine@example.com", address: "BGC, Taguig", loyaltyPoints: 340, status: "Active" },
  { id: "cus-andrea", name: "Andrea Lee", phone: "0916 092 8821", email: "andrea@example.com", address: "Davao City", loyaltyPoints: 210, status: "Active" },
];

const seedSales = [
  {
    id: "sale-001",
    receiptNo: "SP-260703-0001",
    date: "2026-07-03",
    time: "10:15",
    cashierId: "usr-cashier",
    cashierName: "Cashier User",
    customerId: "cus-celine",
    customerName: "Celine Hernandez",
    shiftId: "shift-seed",
    items: [
      { productId: "prd-cleanser", name: "Gentle Cleanser", sku: "SKN-CLN-100", qty: 2, unitPrice: 690, cost: 280, lineDiscount: 0, taxRate: 12, tax: 147.86, lineTotal: 1380, returnedQty: 0 },
      { productId: "prd-mask", name: "Recovery Sheet Mask", sku: "SKN-MSK-001", qty: 5, unitPrice: 180, cost: 75, lineDiscount: 0, taxRate: 12, tax: 96.43, lineTotal: 900, returnedQty: 0 },
    ],
    subtotal: 2280,
    itemDiscount: 0,
    cartDiscount: 0,
    tax: 244.29,
    total: 2280,
    paid: 2300,
    change: 20,
    payments: [{ method: "Cash", amount: 2300 }],
    status: "Paid",
    refundStatus: "None",
    refundTotal: 0,
    notes: "",
  },
  {
    id: "sale-002",
    receiptNo: "SP-260702-0001",
    date: "2026-07-02",
    time: "16:40",
    cashierId: "usr-manager",
    cashierName: "Manager User",
    customerId: "cus-andrea",
    customerName: "Andrea Lee",
    shiftId: "",
    items: [
      { productId: "prd-postcream", name: "Post-care Cream", sku: "SKN-PCC-030", qty: 1, unitPrice: 1200, cost: 420, lineDiscount: 0, taxRate: 12, tax: 128.57, lineTotal: 1200, returnedQty: 0 },
      { productId: "prd-sunscreen", name: "Daily Shield SPF 50", sku: "SKN-SPF-050", qty: 1, unitPrice: 950, cost: 390, lineDiscount: 0, taxRate: 12, tax: 101.79, lineTotal: 950, returnedQty: 0 },
    ],
    subtotal: 2150,
    itemDiscount: 0,
    cartDiscount: 100,
    tax: 219.64,
    total: 2050,
    paid: 2050,
    change: 0,
    payments: [{ method: "E-Wallet", amount: 2050 }],
    status: "Paid",
    refundStatus: "None",
    refundTotal: 0,
    notes: "VIP courtesy discount",
  },
];

const seedRefunds = [];

const seedInventoryMovements = [
  { id: "mov-001", date: "2026-07-03", productId: "prd-cleanser", productName: "Gentle Cleanser", qty: -2, reason: "Sold on SP-260703-0001", user: "Cashier User" },
  { id: "mov-002", date: "2026-07-02", productId: "prd-sunscreen", productName: "Daily Shield SPF 50", qty: -1, reason: "Sold on SP-260702-0001", user: "Manager User" },
];

const seedPurchases = [
  {
    id: "po-001",
    number: "PO-260701-001",
    supplierId: "sup-skinlab",
    supplierName: "MACE Skin Lab",
    date: "2026-07-01",
    status: "Received",
    items: [
      { productId: "prd-sunscreen", name: "Daily Shield SPF 50", qty: 12, cost: 390, tax: 561.6, total: 5241.6 },
      { productId: "prd-mask", name: "Recovery Sheet Mask", qty: 50, cost: 75, tax: 450, total: 4200 },
    ],
    subtotal: 8430,
    tax: 1011.6,
    total: 9441.6,
  },
];

const seedShifts = [
  {
    id: "shift-seed",
    cashierId: "usr-cashier",
    cashierName: "Cashier User",
    openedAt: "2026-07-03T08:55:00.000Z",
    closedAt: "",
    startingCash: 2000,
    countedCash: 0,
    expectedCash: 0,
    difference: 0,
    adjustments: [{ id: "adj-seed", type: "Cash in", amount: 500, reason: "Petty cash top-up", time: "09:20" }],
    status: "Open",
  },
];

const seedSettings = {
  storeName: "Stayprime Retail POS",
  address: "Bonifacio Global City, Taguig",
  phone: "0917 109 8462",
  email: "hello@stayprime.test",
  currency: "PHP",
  taxRate: 12,
  lowStockThreshold: 8,
  allowOverselling: false,
  receiptPrefix: "SP",
  receiptFooter: "Thank you for shopping with us.",
};

const moduleDefs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "Manager"] },
  { id: "pos", label: "Sales POS", icon: WalletCards, roles: roles },
  { id: "products", label: "Products", icon: Package, roles: ["Admin", "Manager"] },
  { id: "categories", label: "Categories", icon: Tags, roles: ["Admin", "Manager"] },
  { id: "inventory", label: "Inventory", icon: Boxes, roles: ["Admin", "Manager"] },
  { id: "suppliers", label: "Suppliers", icon: Truck, roles: ["Admin", "Manager"] },
  { id: "purchases", label: "Purchases", icon: PackagePlus, roles: ["Admin", "Manager"] },
  { id: "customers", label: "Customers", icon: Users, roles: ["Admin", "Manager"] },
  { id: "staff", label: "Users", icon: UserCog, roles: ["Admin"] },
  { id: "transactions", label: "Transactions", icon: ReceiptText, roles: roles },
  { id: "refunds", label: "Refunds", icon: Undo2, roles: ["Admin", "Manager"] },
  { id: "reports", label: "Reports", icon: BarChart3, roles: ["Admin", "Manager"] },
  { id: "shifts", label: "Cash Shifts", icon: HandCoins, roles: roles },
  { id: "settings", label: "Settings", icon: Settings, roles: ["Admin"] },
];

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentTime() {
  return new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function numberValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function useStoredState(key, initialValue) {
  const storageKey = `${APP_KEY}:${key}`;
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Local demo mode keeps working even when storage is unavailable.
    }
  }, [storageKey, value]);

  return [value, setValue];
}

function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename, rows, columns) {
  const header = columns.map((column) => column.label).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const raw = column.value ? column.value(row) : row[column.key];
          return `"${String(raw ?? "").replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
  downloadText(filename, `${header}\n${body}`, "text/csv;charset=utf-8");
}

function paymentRevenue(payments, change = 0) {
  let remainingChange = Number(change || 0);
  return payments.map((payment) => {
    let amount = Number(payment.amount || 0);
    if (payment.method === "Cash" && remainingChange > 0) {
      const applied = Math.min(amount, remainingChange);
      amount -= applied;
      remainingChange -= applied;
    }
    return { ...payment, amount };
  });
}

function calculateCart(cart, settings, cartDiscountInput = 0) {
  const prepared = cart.map((item) => {
    const qty = Math.max(1, numberValue(item.qty));
    const price = Math.max(0, numberValue(item.price));
    const lineSubtotal = price * qty;
    const lineDiscount = Math.min(Math.max(0, numberValue(item.lineDiscount)), lineSubtotal);
    const afterItemDiscount = lineSubtotal - lineDiscount;
    return { ...item, qty, price, lineSubtotal, lineDiscount, afterItemDiscount };
  });
  const subtotal = prepared.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const itemDiscount = prepared.reduce((sum, item) => sum + item.lineDiscount, 0);
  const discountableBase = prepared.reduce((sum, item) => sum + item.afterItemDiscount, 0);
  const cartDiscount = Math.min(Math.max(0, numberValue(cartDiscountInput)), discountableBase);
  const lines = prepared.map((item) => {
    const cartShare = discountableBase > 0 ? (item.afterItemDiscount / discountableBase) * cartDiscount : 0;
    const taxable = Math.max(0, item.afterItemDiscount - cartShare);
    const taxRate = numberValue(item.taxRate ?? settings.taxRate);
    const tax = taxable * (taxRate / 100);
    const lineTotal = taxable + tax;
    return { ...item, cartShare, taxable, tax, lineTotal };
  });
  const tax = lines.reduce((sum, item) => sum + item.tax, 0);
  const total = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  return { lines, subtotal, itemDiscount, cartDiscount, tax, total };
}

function canManage(role) {
  return role === "Admin" || role === "Manager";
}

function receiptText(sale, settings) {
  if (!sale) return "";
  return [
    settings.storeName,
    settings.address,
    `${settings.phone} | ${settings.email}`,
    "",
    `Receipt: ${sale.receiptNo}`,
    `Date: ${sale.date} ${sale.time}`,
    `Cashier: ${sale.cashierName}`,
    `Customer: ${sale.customerName}`,
    "",
    ...sale.items.map((item) => `${item.qty} x ${item.name} @ ${money.format(item.unitPrice)} = ${money.format(item.lineTotal)}`),
    "",
    `Subtotal: ${money.format(sale.subtotal)}`,
    `Discount: -${money.format(sale.itemDiscount + sale.cartDiscount)}`,
    `Tax: ${money.format(sale.tax)}`,
    `Total: ${money.format(sale.total)}`,
    `Paid: ${money.format(sale.paid)}`,
    `Change: ${money.format(sale.change)}`,
    `Payment: ${sale.payments.map((payment) => `${payment.method} ${money.format(payment.amount)}`).join(", ")}`,
    "",
    settings.receiptFooter,
  ].join("\n");
}

export default function PosApp() {
  const [session, setSession] = useStoredState("session", null);
  const [activeModule, setActiveModule] = useStoredState("active-module", "dashboard");
  const [users, setUsers] = useStoredState("users", seedUsers);
  const [categories, setCategories] = useStoredState("categories", seedCategories);
  const [products, setProducts] = useStoredState("products", seedProducts);
  const [suppliers, setSuppliers] = useStoredState("suppliers", seedSuppliers);
  const [customers, setCustomers] = useStoredState("customers", seedCustomers);
  const [sales, setSales] = useStoredState("sales", seedSales);
  const [refunds, setRefunds] = useStoredState("refunds", seedRefunds);
  const [movements, setMovements] = useStoredState("inventory-movements", seedInventoryMovements);
  const [purchases, setPurchases] = useStoredState("purchases", seedPurchases);
  const [shifts, setShifts] = useStoredState("cash-shifts", seedShifts);
  const [settings, setSettings] = useStoredState("settings", seedSettings);
  const [cart, setCart] = useStoredState("cart", []);
  const [heldSales, setHeldSales] = useStoredState("held-sales", []);
  const [globalSearch, setGlobalSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);

  const visibleModules = useMemo(
    () => (session ? moduleDefs.filter((item) => item.roles.includes(session.role)) : []),
    [session],
  );

  useEffect(() => {
    if (!session) return;
    const allowed = moduleDefs.find((item) => item.id === activeModule)?.roles.includes(session.role);
    if (!allowed) {
      setActiveModule(moduleDefs.find((item) => item.roles.includes(session.role))?.id ?? "pos");
    }
  }, [activeModule, session, setActiveModule]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function notify(message, tone = "success") {
    setToast({ id: createId("toast"), message, tone });
  }

  function productById(id) {
    return products.find((product) => product.id === id);
  }

  function categoryName(id) {
    return categories.find((category) => category.id === id)?.name ?? "Uncategorized";
  }

  function activeShiftFor(userId = session?.id) {
    return shifts.find((shift) => shift.cashierId === userId && shift.status === "Open");
  }

  function signIn(email, password) {
    const user = users.find((item) => normalize(item.email) === normalize(email) && item.password === password && item.status === "Active");
    if (!user) {
      notify("Invalid demo credentials or inactive user.", "error");
      return false;
    }
    const { password: _password, ...safeUser } = user;
    setSession(safeUser);
    notify(`Welcome, ${user.name}.`);
    return true;
  }

  function addToCart(product) {
    if (product.status !== "Active") return notify("Product is inactive.", "error");
    const existingQty = cart.find((item) => item.productId === product.id)?.qty ?? 0;
    if (!settings.allowOverselling && existingQty + 1 > Number(product.stock)) {
      notify(`${product.name} has insufficient stock.`, "error");
      return;
    }
    setCart((current) => {
      const found = current.find((item) => item.productId === product.id);
      if (found) {
        return current.map((item) => (item.productId === product.id ? { ...item, qty: item.qty + 1 } : item));
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          categoryId: product.categoryId,
          price: product.price,
          cost: product.cost,
          taxRate: product.taxRate,
          lineDiscount: Number(product.discount || 0),
          qty: 1,
        },
      ];
    });
  }

  function updateCartQty(productId, qty) {
    const product = productById(productId);
    const nextQty = Math.max(0, numberValue(qty));
    if (nextQty === 0) {
      setCart((current) => current.filter((item) => item.productId !== productId));
      return;
    }
    if (product && !settings.allowOverselling && nextQty > Number(product.stock)) {
      notify(`Only ${product.stock} ${product.unit} available for ${product.name}.`, "error");
      return;
    }
    setCart((current) => current.map((item) => (item.productId === productId ? { ...item, qty: nextQty } : item)));
  }

  function updateCartDiscount(productId, value) {
    setCart((current) => current.map((item) => (item.productId === productId ? { ...item, lineDiscount: Math.max(0, numberValue(value)) } : item)));
  }

  function saveProduct(values) {
    const category = categories.find((item) => item.id === values.categoryId);
    const generatedSku = `${(category?.name ?? "SKU").slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const record = {
      ...values,
      id: values.id || createId("prd"),
      sku: values.sku || generatedSku,
      barcode: values.barcode || String(Date.now()).slice(-12),
      cost: numberValue(values.cost),
      price: numberValue(values.price),
      taxRate: numberValue(values.taxRate),
      discount: numberValue(values.discount),
      stock: numberValue(values.stock),
      reorderLevel: numberValue(values.reorderLevel),
      image: values.image || "/brand/mace-logo.png",
    };
    setProducts((current) => (values.id ? current.map((item) => (item.id === values.id ? record : item)) : [record, ...current]));
    notify(values.id ? "Product updated." : "Product added.");
  }

  function deleteProduct(id) {
    const product = productById(id);
    if (!product || !window.confirm(`Delete ${product.name}?`)) return;
    setProducts((current) => current.filter((item) => item.id !== id));
    setCart((current) => current.filter((item) => item.productId !== id));
    notify("Product deleted.", "warning");
  }

  function adjustStock({ productId, qty, direction, reason }) {
    const product = productById(productId);
    if (!product || !qty) return notify("Choose a product and quantity.", "error");
    const signedQty = direction === "out" ? -Math.abs(numberValue(qty)) : Math.abs(numberValue(qty));
    if (!settings.allowOverselling && Number(product.stock) + signedQty < 0) {
      notify("Stock adjustment would make inventory negative.", "error");
      return;
    }
    setProducts((current) => current.map((item) => (item.id === productId ? { ...item, stock: Number(item.stock) + signedQty } : item)));
    setMovements((current) => [
      {
        id: createId("mov"),
        date: todayDate(),
        productId,
        productName: product.name,
        qty: signedQty,
        reason,
        user: session?.name ?? "System",
      },
      ...current,
    ]);
    notify("Inventory movement saved.");
  }

  function completeSale({ customerId, cartDiscount, payments, notes }) {
    const activeShift = activeShiftFor();
    if (session.role === "Cashier" && !activeShift) {
      notify("Open a cash shift before checkout.", "error");
      setActiveModule("shifts");
      return false;
    }
    if (!cart.length) return notify("Cart is empty.", "error");
    const stockError = cart.find((item) => {
      const product = productById(item.productId);
      return product && !settings.allowOverselling && Number(item.qty) > Number(product.stock);
    });
    if (stockError) return notify(`${stockError.name} has insufficient stock.`, "error");

    const totals = calculateCart(cart, settings, cartDiscount);
    const paid = payments.reduce((sum, payment) => sum + numberValue(payment.amount), 0);
    if (paid + 0.01 < totals.total) return notify("Payment is less than the total due.", "error");

    const customer = customers.find((item) => item.id === customerId) ?? customers[0];
    const receiptNo = `${settings.receiptPrefix}-${todayDate().slice(2).replace(/-/g, "")}-${String(sales.length + 1).padStart(4, "0")}`;
    const saleItems = totals.lines.map((item) => ({
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      qty: item.qty,
      unitPrice: item.price,
      cost: numberValue(item.cost),
      lineDiscount: item.lineDiscount + item.cartShare,
      taxRate: item.taxRate,
      tax: item.tax,
      lineTotal: item.lineTotal,
      returnedQty: 0,
    }));
    const change = Math.max(0, paid - totals.total);
    const sale = {
      id: createId("sale"),
      receiptNo,
      date: todayDate(),
      time: currentTime(),
      cashierId: session.id,
      cashierName: session.name,
      customerId: customer?.id ?? "cus-walkin",
      customerName: customer?.name ?? "Walk-in Customer",
      shiftId: activeShift?.id ?? "",
      items: saleItems,
      subtotal: totals.subtotal,
      itemDiscount: totals.itemDiscount,
      cartDiscount: totals.cartDiscount,
      tax: totals.tax,
      total: totals.total,
      paid,
      change,
      payments,
      status: "Paid",
      refundStatus: "None",
      refundTotal: 0,
      notes,
    };

    setProducts((current) =>
      current.map((product) => {
        const sold = saleItems.find((item) => item.productId === product.id);
        return sold ? { ...product, stock: Number(product.stock) - Number(sold.qty) } : product;
      }),
    );
    setMovements((current) => [
      ...saleItems.map((item) => ({
        id: createId("mov"),
        date: todayDate(),
        productId: item.productId,
        productName: item.name,
        qty: -Number(item.qty),
        reason: `Sold on ${receiptNo}`,
        user: session.name,
      })),
      ...current,
    ]);
    setCustomers((current) =>
      current.map((item) =>
        item.id === sale.customerId ? { ...item, loyaltyPoints: Number(item.loyaltyPoints || 0) + Math.floor(sale.total / 100) } : item,
      ),
    );
    setSales((current) => [sale, ...current]);
    setReceiptSale(sale);
    setCart([]);
    notify(`Sale ${receiptNo} completed.`);
    return true;
  }

  function voidSale(sale) {
    if (!canManage(session.role)) return notify("Only managers and admins can void transactions.", "error");
    if (sale.status === "Void") return;
    if (!window.confirm(`Void ${sale.receiptNo}? Inventory will be restored for non-refunded quantities.`)) return;
    const restockLines = sale.items
      .map((item) => ({ ...item, qtyToRestore: Math.max(0, Number(item.qty) - Number(item.returnedQty || 0)) }))
      .filter((item) => item.qtyToRestore > 0);
    setProducts((current) =>
      current.map((product) => {
        const restock = restockLines.find((item) => item.productId === product.id);
        return restock ? { ...product, stock: Number(product.stock) + Number(restock.qtyToRestore) } : product;
      }),
    );
    setMovements((current) => [
      ...restockLines.map((item) => ({
        id: createId("mov"),
        date: todayDate(),
        productId: item.productId,
        productName: item.name,
        qty: Number(item.qtyToRestore),
        reason: `Void ${sale.receiptNo}`,
        user: session.name,
      })),
      ...current,
    ]);
    setSales((current) => current.map((item) => (item.id === sale.id ? { ...item, status: "Void" } : item)));
    notify("Transaction voided and inventory restored.", "warning");
  }

  function approveRefund({ sale, quantities, reason, method, restock }) {
    if (!canManage(session.role)) return notify("Only managers and admins can approve refunds.", "error");
    const lines = sale.items
      .map((item) => {
        const maxQty = Number(item.qty) - Number(item.returnedQty || 0);
        const qty = Math.min(maxQty, Math.max(0, numberValue(quantities[item.productId])));
        const unitRefund = Number(item.lineTotal) / Number(item.qty || 1);
        return { ...item, qty, refundTotal: unitRefund * qty };
      })
      .filter((item) => item.qty > 0);
    if (!lines.length) return notify("Choose at least one item to refund.", "error");
    const refundTotal = lines.reduce((sum, item) => sum + item.refundTotal, 0);
    const refund = {
      id: createId("ref"),
      number: `RF-${todayDate().slice(2).replace(/-/g, "")}-${String(refunds.length + 1).padStart(3, "0")}`,
      saleId: sale.id,
      receiptNo: sale.receiptNo,
      date: todayDate(),
      time: currentTime(),
      customerName: sale.customerName,
      approvedBy: session.name,
      method,
      reason,
      restock,
      items: lines.map((item) => ({ productId: item.productId, name: item.name, qty: item.qty, total: item.refundTotal })),
      total: refundTotal,
    };
    const updatedItems = sale.items.map((item) => {
      const refunded = lines.find((line) => line.productId === item.productId);
      return refunded ? { ...item, returnedQty: Number(item.returnedQty || 0) + Number(refunded.qty) } : item;
    });
    const allReturned = updatedItems.every((item) => Number(item.returnedQty || 0) >= Number(item.qty));
    setSales((current) =>
      current.map((item) =>
        item.id === sale.id
          ? {
              ...item,
              items: updatedItems,
              refundStatus: allReturned ? "Full" : "Partial",
              refundTotal: Number(item.refundTotal || 0) + refundTotal,
            }
          : item,
      ),
    );
    setRefunds((current) => [refund, ...current]);
    if (restock) {
      setProducts((current) =>
        current.map((product) => {
          const returned = lines.find((item) => item.productId === product.id);
          return returned ? { ...product, stock: Number(product.stock) + Number(returned.qty) } : product;
        }),
      );
      setMovements((current) => [
        ...lines.map((item) => ({
          id: createId("mov"),
          date: todayDate(),
          productId: item.productId,
          productName: item.name,
          qty: Number(item.qty),
          reason: `Refund ${refund.number}`,
          user: session.name,
        })),
        ...current,
      ]);
    }
    notify(`Refund ${refund.number} approved.`);
    return refund;
  }

  function savePurchase({ supplierId, status, items }) {
    if (!items.length) return notify("Add at least one purchase item.", "error");
    const supplier = suppliers.find((item) => item.id === supplierId);
    const prepared = items.map((item) => {
      const product = productById(item.productId);
      const qty = numberValue(item.qty);
      const cost = numberValue(item.cost);
      const tax = qty * cost * (numberValue(settings.taxRate) / 100);
      return { productId: item.productId, name: product?.name ?? "Product", qty, cost, tax, total: qty * cost + tax };
    });
    const subtotal = prepared.reduce((sum, item) => sum + item.qty * item.cost, 0);
    const tax = prepared.reduce((sum, item) => sum + item.tax, 0);
    const purchase = {
      id: createId("po"),
      number: `PO-${todayDate().slice(2).replace(/-/g, "")}-${String(purchases.length + 1).padStart(3, "0")}`,
      supplierId,
      supplierName: supplier?.name ?? "Supplier",
      date: todayDate(),
      status,
      items: prepared,
      subtotal,
      tax,
      total: subtotal + tax,
    };
    setPurchases((current) => [purchase, ...current]);
    if (status === "Received") {
      setProducts((current) =>
        current.map((product) => {
          const received = prepared.find((item) => item.productId === product.id);
          return received ? { ...product, stock: Number(product.stock) + Number(received.qty), cost: Number(received.cost) } : product;
        }),
      );
      setMovements((current) => [
        ...prepared.map((item) => ({
          id: createId("mov"),
          date: todayDate(),
          productId: item.productId,
          productName: item.name,
          qty: Number(item.qty),
          reason: `Purchase received ${purchase.number}`,
          user: session.name,
        })),
        ...current,
      ]);
    }
    notify(status === "Received" ? "Purchase received and inventory updated." : "Purchase order saved.");
  }

  function updatePurchaseStatus(id, status) {
    const purchase = purchases.find((item) => item.id === id);
    if (!purchase) return;
    if (purchase.status !== "Received" && status === "Received") {
      setProducts((current) =>
        current.map((product) => {
          const received = purchase.items.find((item) => item.productId === product.id);
          return received ? { ...product, stock: Number(product.stock) + Number(received.qty), cost: Number(received.cost) } : product;
        }),
      );
      setMovements((current) => [
        ...purchase.items.map((item) => ({
          id: createId("mov"),
          date: todayDate(),
          productId: item.productId,
          productName: item.name,
          qty: Number(item.qty),
          reason: `Purchase received ${purchase.number}`,
          user: session.name,
        })),
        ...current,
      ]);
    }
    setPurchases((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
    notify(`Purchase marked ${status}.`);
  }

  function openShift(startingCash) {
    if (activeShiftFor()) return notify("You already have an open shift.", "error");
    setShifts((current) => [
      {
        id: createId("shift"),
        cashierId: session.id,
        cashierName: session.name,
        openedAt: new Date().toISOString(),
        closedAt: "",
        startingCash: numberValue(startingCash),
        countedCash: 0,
        expectedCash: 0,
        difference: 0,
        adjustments: [],
        status: "Open",
      },
      ...current,
    ]);
    notify("Cash shift opened.");
  }

  function addCashAdjustment(shiftId, adjustment) {
    setShifts((current) =>
      current.map((shift) =>
        shift.id === shiftId
          ? {
              ...shift,
              adjustments: [
                { id: createId("adj"), type: adjustment.type, amount: numberValue(adjustment.amount), reason: adjustment.reason, time: currentTime() },
                ...shift.adjustments,
              ],
            }
          : shift,
      ),
    );
    notify("Cash adjustment recorded.");
  }

  function closeShift(shiftId, countedCash) {
    const shift = shifts.find((item) => item.id === shiftId);
    if (!shift) return;
    const expected = calculateShiftExpected(shift, sales);
    const counted = numberValue(countedCash);
    setShifts((current) =>
      current.map((item) =>
        item.id === shiftId
          ? {
              ...item,
              countedCash: counted,
              expectedCash: expected,
              difference: counted - expected,
              closedAt: new Date().toISOString(),
              status: "Closed",
            }
          : item,
      ),
    );
    notify("Cash shift closed.");
  }

  function resetDemoData() {
    if (!window.confirm("Reset all demo POS data?")) return;
    Object.keys(localStorage)
      .filter((key) => key.startsWith(`${APP_KEY}:`))
      .forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  }

  if (!session) {
    return <LoginScreen users={users} onLogin={signIn} settings={settings} />;
  }

  const active = moduleDefs.find((item) => item.id === activeModule) ?? moduleDefs[0];
  const lowStock = products.filter((product) => Number(product.stock) <= Math.max(Number(product.reorderLevel), Number(settings.lowStockThreshold)));

  return (
    <div className="retail-shell">
      <aside className="retail-sidebar">
        <div className="retail-brand">
          <img src="/brand/mace-logo.png" alt={settings.storeName} />
          <div>
            <strong>{settings.storeName}</strong>
            <span>{session.role}</span>
          </div>
        </div>
        <nav className="retail-nav" aria-label="POS modules">
          {visibleModules.map((item) => {
            const Icon = item.icon;
            return (
              <button className={activeModule === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setActiveModule(item.id)}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="retail-workspace">
        <header className="retail-topbar">
          <div>
            <p className="eyebrow">Point of Sale</p>
            <h1>{active.label}</h1>
          </div>
          <div className="retail-topbar-actions">
            <label className="retail-search">
              <Search size={17} aria-hidden="true" />
              <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search records" />
            </label>
            <button className="secondary-button small" type="button" onClick={() => setActiveModule("shifts")}>
              <HandCoins size={16} /> {activeShiftFor() ? "Shift open" : "Open shift"}
            </button>
            <button className="icon-button" type="button" title="Logout" onClick={() => setSession(null)}>
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {lowStock.length > 0 && (
          <div className="alert-strip">
            <AlertCircle size={17} />
            <span>{lowStock.length} product{lowStock.length === 1 ? "" : "s"} at or below reorder level.</span>
          </div>
        )}

        {activeModule === "dashboard" && (
          <DashboardModule
            sales={sales}
            refunds={refunds}
            products={products}
            customers={customers}
            purchases={purchases}
            settings={settings}
            setActiveModule={setActiveModule}
            categoryName={categoryName}
          />
        )}
        {activeModule === "pos" && (
          <POSModule
            cart={cart}
            setCart={setCart}
            products={products}
            categories={categories}
            customers={customers}
            settings={settings}
            heldSales={heldSales}
            setHeldSales={setHeldSales}
            globalSearch={globalSearch}
            addToCart={addToCart}
            updateCartQty={updateCartQty}
            updateCartDiscount={updateCartDiscount}
            completeSale={completeSale}
            categoryName={categoryName}
            activeShift={activeShiftFor()}
            session={session}
          />
        )}
        {activeModule === "products" && (
          <ProductsModule products={products} categories={categories} suppliers={suppliers} globalSearch={globalSearch} saveProduct={saveProduct} deleteProduct={deleteProduct} categoryName={categoryName} />
        )}
        {activeModule === "categories" && <CategoriesModule categories={categories} setCategories={setCategories} products={products} notify={notify} />}
        {activeModule === "inventory" && <InventoryModule products={products} movements={movements} adjustStock={adjustStock} categoryName={categoryName} globalSearch={globalSearch} />}
        {activeModule === "suppliers" && <SuppliersModule suppliers={suppliers} setSuppliers={setSuppliers} products={products} notify={notify} globalSearch={globalSearch} />}
        {activeModule === "purchases" && (
          <PurchasesModule purchases={purchases} suppliers={suppliers} products={products} savePurchase={savePurchase} updatePurchaseStatus={updatePurchaseStatus} globalSearch={globalSearch} />
        )}
        {activeModule === "customers" && <CustomersModule customers={customers} setCustomers={setCustomers} sales={sales} globalSearch={globalSearch} notify={notify} />}
        {activeModule === "staff" && <StaffModule users={users} setUsers={setUsers} currentUser={session} notify={notify} globalSearch={globalSearch} />}
        {activeModule === "transactions" && (
          <TransactionsModule sales={sales} customers={customers} session={session} globalSearch={globalSearch} voidSale={voidSale} setReceiptSale={setReceiptSale} />
        )}
        {activeModule === "refunds" && <RefundsModule sales={sales} refunds={refunds} approveRefund={approveRefund} setReceiptSale={setReceiptSale} />}
        {activeModule === "reports" && (
          <ReportsModule sales={sales} refunds={refunds} products={products} purchases={purchases} customers={customers} users={users} settings={settings} categoryName={categoryName} />
        )}
        {activeModule === "shifts" && (
          <ShiftsModule shifts={shifts} sales={sales} session={session} openShift={openShift} addCashAdjustment={addCashAdjustment} closeShift={closeShift} />
        )}
        {activeModule === "settings" && <SettingsModule settings={settings} setSettings={setSettings} resetDemoData={resetDemoData} />}
      </main>

      {receiptSale && <ReceiptDrawer sale={receiptSale} settings={settings} onClose={() => setReceiptSale(null)} />}
      {toast && <Toast toast={toast} />}
    </div>
  );
}

function LoginScreen({ users, onLogin, settings }) {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");

  function submit(event) {
    event.preventDefault();
    onLogin(email, password);
  }

  function fill(user) {
    setEmail(user.email);
    setPassword(user.password);
  }

  return (
    <main className="retail-login">
      <section className="retail-login-panel">
        <div className="retail-login-brand">
          <img src="/brand/mace-logo.png" alt={settings.storeName} />
          <p className="eyebrow">{settings.storeName}</p>
          <h1>Retail POS</h1>
          <p>{settings.address}</p>
        </div>
        <form className="retail-login-card" onSubmit={submit}>
          <div>
            <p className="eyebrow">Demo Login</p>
            <h2>Sign in</h2>
          </div>
          <label>
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <button className="primary-button full" type="submit">
            <LockKeyhole size={17} /> Sign in
          </button>
          <div className="demo-account-grid">
            {users.slice(0, 3).map((user) => (
              <button type="button" key={user.id} onClick={() => fill(user)}>
                <strong>{user.role}</strong>
                <span>{user.email}</span>
              </button>
            ))}
          </div>
        </form>
      </section>
    </main>
  );
}

function DashboardModule({ sales, refunds, products, customers, purchases, settings, setActiveModule, categoryName }) {
  const today = todayDate();
  const paidSales = sales.filter((sale) => sale.status !== "Void");
  const todaysSales = paidSales.filter((sale) => sale.date === today);
  const netRevenue = paidSales.reduce((sum, sale) => sum + Number(sale.total || 0) - Number(sale.refundTotal || 0), 0);
  const dailyRevenue = todaysSales.reduce((sum, sale) => sum + Number(sale.total || 0) - Number(sale.refundTotal || 0), 0);
  const profit = paidSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + (Number(item.unitPrice) - Number(item.cost)) * Number(item.qty), 0), 0) - refunds.reduce((sum, refund) => sum + Number(refund.total || 0), 0);
  const lowStock = products.filter((product) => Number(product.stock) <= Math.max(Number(product.reorderLevel), Number(settings.lowStockThreshold)));
  const productSales = tallyProductSales(paidSales);

  return (
    <section className="retail-stack">
      <div className="summary-grid">
        <Metric icon={CircleDollarSign} label="Daily sales" value={money.format(dailyRevenue)} tone="wine" />
        <Metric icon={ReceiptText} label="Orders today" value={todaysSales.length} tone="blue" />
        <Metric icon={WalletCards} label="Revenue" value={money.format(netRevenue)} tone="green" />
        <Metric icon={Activity} label="Profit estimate" value={money.format(profit)} tone="amber" />
      </div>

      <section className="retail-grid two-one">
        <div className="surface-panel">
          <SectionHeader icon={BarChart3} title="Sales Trend" action="Last 7 days" />
          <MiniBars values={lastSevenDays(paidSales).map((row) => row.total)} />
          <div className="button-row">
            <button className="primary-button" type="button" onClick={() => setActiveModule("pos")}>
              <ShoppingBag size={17} /> New sale
            </button>
            <button className="secondary-button" type="button" onClick={() => setActiveModule("purchases")}>
              <PackagePlus size={17} /> Receive stock
            </button>
            <button className="secondary-button" type="button" onClick={() => setActiveModule("reports")}>
              <Download size={17} /> Reports
            </button>
          </div>
        </div>
        <div className="surface-panel">
          <SectionHeader icon={AlertCircle} title="Low Stock" action={`${lowStock.length} alerts`} />
          <div className="compact-list">
            {lowStock.slice(0, 6).map((product) => (
              <article key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <span>{categoryName(product.categoryId)} / reorder {product.reorderLevel}</span>
                </div>
                <b>{product.stock}</b>
              </article>
            ))}
            {!lowStock.length && <EmptyState title="Inventory healthy" copy="No product has reached its reorder level." />}
          </div>
        </div>
      </section>

      <section className="retail-grid three">
        <div className="surface-panel">
          <SectionHeader icon={Package} title="Top Products" />
          <RankList rows={productSales.slice(0, 5)} formatter={(value) => `${value} sold`} />
        </div>
        <div className="surface-panel">
          <SectionHeader icon={ReceiptText} title="Recent Transactions" />
          <div className="compact-list">
            {paidSales.slice(0, 5).map((sale) => (
              <article key={sale.id}>
                <div>
                  <strong>{sale.receiptNo}</strong>
                  <span>{sale.customerName} / {sale.cashierName}</span>
                </div>
                <b>{money.format(sale.total - Number(sale.refundTotal || 0))}</b>
              </article>
            ))}
          </div>
        </div>
        <div className="surface-panel">
          <SectionHeader icon={Store} title="Store Snapshot" />
          <div className="mini-metrics vertical">
            <RecordPill label="Products" value={products.length} />
            <RecordPill label="Customers" value={customers.length} />
            <RecordPill label="Purchases" value={purchases.length} />
            <RecordPill label="Refunds" value={refunds.length} />
          </div>
        </div>
      </section>
    </section>
  );
}

function POSModule({
  cart,
  setCart,
  products,
  categories,
  customers,
  settings,
  heldSales,
  setHeldSales,
  globalSearch,
  addToCart,
  updateCartQty,
  updateCartDiscount,
  completeSale,
  categoryName,
  activeShift,
  session,
}) {
  const [customerId, setCustomerId] = useState("cus-walkin");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("All");
  const [cartDiscount, setCartDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [payments, setPayments] = useState([{ method: "Cash", amount: 0 }]);
  const totals = useMemo(() => calculateCart(cart, settings, cartDiscount), [cart, cartDiscount, settings]);
  const paid = payments.reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const change = Math.max(0, paid - totals.total);
  const activeQuery = normalize(`${query} ${globalSearch}`.trim());
  const visibleProducts = products.filter((product) => {
    const matchesCategory = categoryId === "All" || product.categoryId === categoryId;
    const matchesSearch = normalize(`${product.name} ${product.sku} ${product.barcode} ${product.brand} ${categoryName(product.categoryId)}`).includes(activeQuery);
    return product.status === "Active" && matchesCategory && matchesSearch;
  });
  const stockErrors = cart.filter((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return product && !settings.allowOverselling && Number(item.qty) > Number(product.stock);
  });

  useEffect(() => {
    if (payments.length === 1 && payments[0].amount === 0 && totals.total > 0) {
      setPayments([{ method: payments[0].method, amount: Number(totals.total.toFixed(2)) }]);
    }
  }, [totals.total]);

  function quickPay(method) {
    setPayments([{ method, amount: Number(totals.total.toFixed(2)) }]);
  }

  function addSplitPayment() {
    setPayments((current) => [...current, { method: "E-Wallet", amount: 0 }]);
  }

  function updatePayment(index, patch) {
    setPayments((current) => current.map((payment, itemIndex) => (itemIndex === index ? { ...payment, ...patch } : payment)));
  }

  function holdSale() {
    if (!cart.length) return;
    setHeldSales((current) => [
      { id: createId("hold"), label: `${customers.find((item) => item.id === customerId)?.name ?? "Walk-in"} / ${currentTime()}`, customerId, cart, cartDiscount, notes },
      ...current,
    ]);
    setCart([]);
    setCartDiscount(0);
    setNotes("");
  }

  function resumeSale(held) {
    setCustomerId(held.customerId);
    setCart(held.cart);
    setCartDiscount(held.cartDiscount);
    setNotes(held.notes);
    setHeldSales((current) => current.filter((item) => item.id !== held.id));
  }

  function postSale() {
    const ok = completeSale({ customerId, cartDiscount, payments, notes });
    if (ok) {
      setCartDiscount(0);
      setNotes("");
      setPayments([{ method: "Cash", amount: 0 }]);
    }
  }

  return (
    <section className="pos-workflow">
      <div className="surface-panel pos-catalog">
        <div className="pos-header compact">
          <div>
            <p className="eyebrow">Cashier</p>
            <h2>Product catalog</h2>
            <span>{visibleProducts.length} products available</span>
          </div>
          <label className="catalog-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, SKU, barcode, category" />
          </label>
        </div>

        <div className="pos-category-list">
          <button type="button" className={categoryId === "All" ? "active" : ""} onClick={() => setCategoryId("All")}>All</button>
          {categories.map((category) => (
            <button type="button" key={category.id} className={categoryId === category.id ? "active" : ""} onClick={() => setCategoryId(category.id)}>
              {category.name}
            </button>
          ))}
        </div>

        <div className="product-grid">
          {visibleProducts.map((product) => {
            const inCart = cart.find((item) => item.productId === product.id);
            const disabled = !settings.allowOverselling && Number(product.stock) <= 0;
            return (
              <button className={`product-tile ${inCart ? "in-cart" : ""}`} type="button" key={product.id} onClick={() => addToCart(product)} disabled={disabled}>
                <img src={product.image} alt={product.name} />
                <span>{categoryName(product.categoryId)}</span>
                <strong>{product.name}</strong>
                <small>{product.sku} / {product.stock} {product.unit}</small>
                <b>{money.format(product.price)}</b>
                {inCart && <em>{inCart.qty}</em>}
              </button>
            );
          })}
          {!visibleProducts.length && <EmptyState title="No products found" copy="Adjust the search or category filter." />}
        </div>
      </div>

      <aside className="surface-panel checkout-panel pos-checkout">
        <div className="invoice-header">
          <div>
            <p className="eyebrow">Current Cart</p>
            <h2>{cart.length} item{cart.length === 1 ? "" : "s"}</h2>
            <span>{session.role === "Cashier" ? activeShift ? "Shift open" : "No open shift" : "Manager checkout"}</span>
          </div>
        </div>

        <div className="invoice-fields">
          <label className="stacked-field">
            <span>Customer</span>
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              {customers.filter((customer) => customer.status === "Active").map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="cart-list">
          {cart.map((item) => (
            <article className="cart-row pos-line" key={item.productId}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.sku} / {categoryName(item.categoryId)}</span>
              </div>
              <div className="quantity-stepper">
                <button type="button" onClick={() => updateCartQty(item.productId, Number(item.qty) - 1)}><Minus size={14} /></button>
                <span>{item.qty}</span>
                <button type="button" onClick={() => updateCartQty(item.productId, Number(item.qty) + 1)}><Plus size={14} /></button>
              </div>
              <label className="line-discount">
                <span>Discount</span>
                <input type="number" min="0" value={item.lineDiscount} onChange={(event) => updateCartDiscount(item.productId, event.target.value)} />
              </label>
              <b>{money.format(Number(item.price) * Number(item.qty))}</b>
              <button type="button" onClick={() => updateCartQty(item.productId, 0)}><Trash2 size={16} /></button>
            </article>
          ))}
          {!cart.length && <EmptyState title="Cart is empty" copy="Add products from the catalog." />}
        </div>

        {stockErrors.length > 0 && (
          <div className="inline-state error">
            <AlertCircle size={17} />
            <span>{stockErrors[0].name} exceeds available stock.</span>
          </div>
        )}

        <div className="invoice-fields">
          <label className="stacked-field">
            <span>Cart discount</span>
            <input type="number" min="0" value={cartDiscount} onChange={(event) => setCartDiscount(event.target.value)} />
          </label>
          <label className="stacked-field">
            <span>Notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>

        <div className="checkout-summary-card">
          <div><span>Subtotal</span><strong>{money.format(totals.subtotal)}</strong></div>
          <div><span>Discount</span><strong>-{money.format(totals.itemDiscount + totals.cartDiscount)}</strong></div>
          <div><span>Tax</span><strong>{money.format(totals.tax)}</strong></div>
          <div className="due-row"><span>Total</span><strong>{money.format(totals.total)}</strong></div>
        </div>

        <div className="payment-options">
          <button type="button" onClick={() => quickPay("Cash")}><CircleDollarSign size={16} /> Cash</button>
          <button type="button" onClick={() => quickPay("Card")}><CreditCard size={16} /> Card</button>
          <button type="button" onClick={() => quickPay("E-Wallet")}><WalletCards size={16} /> E-Wallet</button>
          <button type="button" onClick={addSplitPayment}><HandCoins size={16} /> Split</button>
        </div>

        <div className="payment-list compact-payments">
          {payments.map((payment, index) => (
            <div className="payment-row" key={`${payment.method}-${index}`}>
              <select value={payment.method} onChange={(event) => updatePayment(index, { method: event.target.value })}>
                {paymentMethods.map((method) => <option key={method}>{method}</option>)}
              </select>
              <input type="number" min="0" value={payment.amount} onChange={(event) => updatePayment(index, { amount: event.target.value })} />
              {payments.length > 1 && <button type="button" onClick={() => setPayments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={15} /></button>}
            </div>
          ))}
        </div>
        <div className="checkout-summary-card slim">
          <div><span>Paid</span><strong>{money.format(paid)}</strong></div>
          <div><span>Change</span><strong>{money.format(change)}</strong></div>
        </div>

        <button className="primary-button full" type="button" onClick={postSale} disabled={!cart.length || stockErrors.length > 0}>
          <Check size={17} /> Checkout
        </button>
        <div className="split-actions">
          <button className="ghost-button" type="button" onClick={holdSale} disabled={!cart.length}>Hold</button>
          <button className="ghost-button" type="button" onClick={() => window.confirm("Cancel current sale?") && setCart([])} disabled={!cart.length}>Cancel</button>
        </div>

        {heldSales.length > 0 && (
          <div className="held-sales">
            <strong>Held sales</strong>
            {heldSales.map((held) => (
              <button type="button" key={held.id} onClick={() => resumeSale(held)}>{held.label}</button>
            ))}
          </div>
        )}
      </aside>
    </section>
  );
}

function ProductsModule({ products, categories, suppliers, globalSearch, saveProduct, deleteProduct, categoryName }) {
  const emptyProduct = {
    name: "",
    sku: "",
    barcode: "",
    categoryId: categories[0]?.id ?? "",
    brand: "",
    unit: "piece",
    cost: 0,
    price: 0,
    taxRate: 12,
    discount: 0,
    stock: 0,
    reorderLevel: 5,
    supplierId: suppliers[0]?.id ?? "",
    image: "/brand/mace-logo.png",
    status: "Active",
  };
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const rows = products.filter((product) => normalize(`${product.name} ${product.sku} ${product.barcode} ${product.brand} ${categoryName(product.categoryId)}`).includes(normalize(globalSearch)));

  function submit(event) {
    event.preventDefault();
    if (!form.name || !form.categoryId || Number(form.price) < 0) return;
    saveProduct(form);
    setEditing(null);
    setForm(emptyProduct);
  }

  function edit(product) {
    setEditing(product.id);
    setForm(product);
  }

  return (
    <section className="retail-grid two-one">
      <form className="surface-panel entity-form" onSubmit={submit}>
        <SectionHeader icon={Package} title={editing ? "Edit Product" : "Add Product"} action={editing ? "Editing" : "New"} />
        <div className="form-grid">
          <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label><span>SKU</span><input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Auto if blank" /></label>
          <label><span>Barcode</span><input value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} /></label>
          <label><span>Category</span><select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label><span>Brand</span><input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label>
          <label><span>Unit</span><input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label>
          <label><span>Cost</span><input type="number" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} /></label>
          <label><span>Price</span><input type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <label><span>Tax %</span><input type="number" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} /></label>
          <label><span>Discount</span><input type="number" value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} /></label>
          <label><span>Stock</span><input type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label>
          <label><span>Reorder</span><input type="number" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} /></label>
          <label><span>Supplier</span><select value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
          <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>
        </div>
        <div className="button-row">
          <button className="primary-button" type="submit"><Check size={17} /> Save product</button>
          {editing && <button className="ghost-button" type="button" onClick={() => { setEditing(null); setForm(emptyProduct); }}>Cancel edit</button>}
        </div>
      </form>
      <div className="surface-panel wide">
        <SectionHeader icon={Package} title="Product List" action={`${rows.length} records`} />
        <DataTable
          rows={rows}
          columns={[
            { key: "name", label: "Product" },
            { key: "sku", label: "SKU" },
            { key: "categoryId", label: "Category", render: (row) => categoryName(row.categoryId) },
            { key: "stock", label: "Stock", render: (row) => `${row.stock} ${row.unit}` },
            { key: "price", label: "Price", render: (row) => money.format(row.price) },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => edit(row)}><Edit3 size={15} /> Edit</button>
                  <button type="button" onClick={() => deleteProduct(row.id)}><Trash2 size={15} /> Delete</button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function CategoriesModule({ categories, setCategories, products, notify }) {
  const empty = { name: "", description: "", status: "Active" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!form.name) return;
    const record = { ...form, id: editingId || createId("cat") };
    setCategories((current) => (editingId ? current.map((item) => (item.id === editingId ? record : item)) : [record, ...current]));
    setForm(empty);
    setEditingId("");
    notify("Category saved.");
  }

  function remove(category) {
    if (products.some((product) => product.categoryId === category.id)) return notify("Category is linked to products.", "error");
    if (!window.confirm(`Delete ${category.name}?`)) return;
    setCategories((current) => current.filter((item) => item.id !== category.id));
    notify("Category deleted.", "warning");
  }

  return (
    <section className="retail-grid two-one">
      <form className="surface-panel entity-form" onSubmit={submit}>
        <SectionHeader icon={Tags} title={editingId ? "Edit Category" : "Add Category"} />
        <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>
        <div className="button-row">
          <button className="primary-button" type="submit"><Check size={17} /> Save category</button>
          {editingId && <button className="ghost-button" type="button" onClick={() => { setEditingId(""); setForm(empty); }}>Cancel</button>}
        </div>
      </form>
      <div className="surface-panel wide">
        <SectionHeader icon={Tags} title="Categories" action={`${categories.length} records`} />
        <DataTable
          rows={categories}
          columns={[
            { key: "name", label: "Name" },
            { key: "description", label: "Description" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "count", label: "Products", render: (row) => products.filter((product) => product.categoryId === row.id).length },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => { setEditingId(row.id); setForm(row); }}><Edit3 size={15} /> Edit</button>
                  <button type="button" onClick={() => remove(row)}><Trash2 size={15} /> Delete</button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function InventoryModule({ products, movements, adjustStock, categoryName, globalSearch }) {
  const [form, setForm] = useState({ productId: products[0]?.id ?? "", qty: 1, direction: "in", reason: "Stock in" });
  const rows = products.filter((product) => normalize(`${product.name} ${product.sku} ${categoryName(product.categoryId)}`).includes(normalize(globalSearch)));
  const lowStock = products.filter((product) => Number(product.stock) <= Number(product.reorderLevel));

  function submit(event) {
    event.preventDefault();
    adjustStock(form);
    setForm((current) => ({ ...current, qty: 1 }));
  }

  return (
    <section className="retail-grid two-one">
      <div className="surface-panel wide">
        <SectionHeader icon={Boxes} title="Stock Levels" action={`${lowStock.length} low stock`} />
        <DataTable
          rows={rows}
          columns={[
            { key: "name", label: "Product" },
            { key: "sku", label: "SKU" },
            { key: "categoryId", label: "Category", render: (row) => categoryName(row.categoryId) },
            { key: "stock", label: "Stock", render: (row) => `${row.stock} ${row.unit}` },
            { key: "reorderLevel", label: "Reorder" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={Number(row.stock) <= Number(row.reorderLevel) ? "Reorder" : "Healthy"} /> },
          ]}
        />
      </div>
      <form className="surface-panel entity-form" onSubmit={submit}>
        <SectionHeader icon={RefreshCw} title="Stock Adjustment" />
        <label><span>Product</span><select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label><span>Direction</span><select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })}><option value="in">Stock in</option><option value="out">Stock out</option></select></label>
        <label><span>Quantity</span><input type="number" min="1" value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} /></label>
        <label><span>Reason</span><select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}>{adjustmentReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
        <button className="primary-button" type="submit"><Check size={17} /> Save movement</button>
      </form>
      <div className="surface-panel full-span">
        <SectionHeader icon={FileText} title="Movement History" action={`${movements.length} records`} />
        <DataTable
          rows={movements}
          pageSize={8}
          columns={[
            { key: "date", label: "Date" },
            { key: "productName", label: "Product" },
            { key: "qty", label: "Qty" },
            { key: "reason", label: "Reason" },
            { key: "user", label: "User" },
          ]}
        />
      </div>
    </section>
  );
}

function SuppliersModule({ suppliers, setSuppliers, products, notify, globalSearch }) {
  const empty = { name: "", contact: "", phone: "", email: "", address: "", notes: "", status: "Active" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState("");
  const rows = suppliers.filter((supplier) => normalize(`${supplier.name} ${supplier.contact} ${supplier.phone} ${supplier.email}`).includes(normalize(globalSearch)));

  function submit(event) {
    event.preventDefault();
    if (!form.name) return;
    const record = { ...form, id: editingId || createId("sup") };
    setSuppliers((current) => (editingId ? current.map((item) => (item.id === editingId ? record : item)) : [record, ...current]));
    setForm(empty);
    setEditingId("");
    notify("Supplier saved.");
  }

  function remove(supplier) {
    if (products.some((product) => product.supplierId === supplier.id)) return notify("Supplier is linked to products.", "error");
    if (!window.confirm(`Delete ${supplier.name}?`)) return;
    setSuppliers((current) => current.filter((item) => item.id !== supplier.id));
    notify("Supplier deleted.", "warning");
  }

  return (
    <section className="retail-grid two-one">
      <form className="surface-panel entity-form" onSubmit={submit}>
        <SectionHeader icon={Truck} title={editingId ? "Edit Supplier" : "Add Supplier"} />
        <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label><span>Contact person</span><input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label>
        <label><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label><span>Address</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        <label><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>
        <div className="button-row">
          <button className="primary-button" type="submit"><Check size={17} /> Save supplier</button>
          {editingId && <button className="ghost-button" type="button" onClick={() => { setEditingId(""); setForm(empty); }}>Cancel</button>}
        </div>
      </form>
      <div className="surface-panel wide">
        <SectionHeader icon={Truck} title="Suppliers" action={`${rows.length} records`} />
        <DataTable
          rows={rows}
          columns={[
            { key: "name", label: "Supplier" },
            { key: "contact", label: "Contact" },
            { key: "phone", label: "Phone" },
            { key: "email", label: "Email" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => { setEditingId(row.id); setForm(row); }}><Edit3 size={15} /> Edit</button>
                  <button type="button" onClick={() => remove(row)}><Trash2 size={15} /> Delete</button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function PurchasesModule({ purchases, suppliers, products, savePurchase, updatePurchaseStatus, globalSearch }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [status, setStatus] = useState("Received");
  const [line, setLine] = useState({ productId: products[0]?.id ?? "", qty: 1, cost: products[0]?.cost ?? 0 });
  const [items, setItems] = useState([]);
  const rows = purchases.filter((purchase) => normalize(`${purchase.number} ${purchase.supplierName} ${purchase.status}`).includes(normalize(globalSearch)));

  function addItem() {
    const product = products.find((item) => item.id === line.productId);
    if (!product) return;
    setItems((current) => [...current, { ...line, cost: numberValue(line.cost || product.cost), qty: numberValue(line.qty) }]);
    setLine({ productId: products[0]?.id ?? "", qty: 1, cost: products[0]?.cost ?? 0 });
  }

  function submit(event) {
    event.preventDefault();
    savePurchase({ supplierId, status, items });
    setItems([]);
  }

  const subtotal = items.reduce((sum, item) => sum + numberValue(item.qty) * numberValue(item.cost), 0);
  const tax = subtotal * 0.12;

  return (
    <section className="retail-grid two-one">
      <form className="surface-panel entity-form" onSubmit={submit}>
        <SectionHeader icon={PackagePlus} title="Purchase Receiving" />
        <label><span>Supplier</span><select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>Draft</option><option>Ordered</option><option>Received</option><option>Cancelled</option></select></label>
        <div className="purchase-line">
          <label><span>Product</span><select value={line.productId} onChange={(event) => {
            const product = products.find((item) => item.id === event.target.value);
            setLine({ ...line, productId: event.target.value, cost: product?.cost ?? 0 });
          }}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label><span>Qty</span><input type="number" min="1" value={line.qty} onChange={(event) => setLine({ ...line, qty: event.target.value })} /></label>
          <label><span>Cost</span><input type="number" min="0" value={line.cost} onChange={(event) => setLine({ ...line, cost: event.target.value })} /></label>
          <button className="secondary-button" type="button" onClick={addItem}><Plus size={16} /> Add</button>
        </div>
        <div className="compact-list purchase-draft">
          {items.map((item, index) => {
            const product = products.find((productItem) => productItem.id === item.productId);
            return (
              <article key={`${item.productId}-${index}`}>
                <div><strong>{product?.name}</strong><span>{item.qty} x {money.format(item.cost)}</span></div>
                <button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={15} /></button>
              </article>
            );
          })}
        </div>
        <div className="checkout-summary-card slim">
          <div><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>
          <div><span>Tax</span><strong>{money.format(tax)}</strong></div>
          <div><span>Total</span><strong>{money.format(subtotal + tax)}</strong></div>
        </div>
        <button className="primary-button" type="submit"><Check size={17} /> Save purchase</button>
      </form>
      <div className="surface-panel wide">
        <SectionHeader icon={PackagePlus} title="Purchase History" action={`${rows.length} records`} />
        <DataTable
          rows={rows}
          columns={[
            { key: "number", label: "PO" },
            { key: "date", label: "Date" },
            { key: "supplierName", label: "Supplier" },
            { key: "total", label: "Total", render: (row) => money.format(row.total) },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="inline-actions">
                  {row.status !== "Received" && <button type="button" onClick={() => updatePurchaseStatus(row.id, "Received")}><Check size={15} /> Receive</button>}
                  {row.status !== "Cancelled" && <button type="button" onClick={() => updatePurchaseStatus(row.id, "Cancelled")}><X size={15} /> Cancel</button>}
                </div>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function CustomersModule({ customers, setCustomers, sales, globalSearch, notify }) {
  const empty = { name: "", phone: "", email: "", address: "", loyaltyPoints: 0, status: "Active" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState("");
  const rows = customers.filter((customer) => normalize(`${customer.name} ${customer.phone} ${customer.email}`).includes(normalize(globalSearch)));

  function submit(event) {
    event.preventDefault();
    if (!form.name) return;
    const record = { ...form, id: editingId || createId("cus"), loyaltyPoints: numberValue(form.loyaltyPoints) };
    setCustomers((current) => (editingId ? current.map((item) => (item.id === editingId ? record : item)) : [record, ...current]));
    setForm(empty);
    setEditingId("");
    notify("Customer saved.");
  }

  return (
    <section className="retail-grid two-one">
      <form className="surface-panel entity-form" onSubmit={submit}>
        <SectionHeader icon={Users} title={editingId ? "Edit Customer" : "Add Customer"} />
        <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label><span>Address</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        <label><span>Loyalty points</span><input type="number" value={form.loyaltyPoints} onChange={(event) => setForm({ ...form, loyaltyPoints: event.target.value })} /></label>
        <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>
        <div className="button-row">
          <button className="primary-button" type="submit"><Check size={17} /> Save customer</button>
          {editingId && <button className="ghost-button" type="button" onClick={() => { setEditingId(""); setForm(empty); }}>Cancel</button>}
        </div>
      </form>
      <div className="surface-panel wide">
        <SectionHeader icon={Users} title="Customers" action={`${rows.length} records`} />
        <DataTable
          rows={rows}
          columns={[
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "email", label: "Email" },
            { key: "loyaltyPoints", label: "Points" },
            { key: "history", label: "Purchases", render: (row) => sales.filter((sale) => sale.customerId === row.id && sale.status !== "Void").length },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => { setEditingId(row.id); setForm(row); }}><Edit3 size={15} /> Edit</button>
                  {row.id !== "cus-walkin" && <button type="button" onClick={() => window.confirm(`Delete ${row.name}?`) && setCustomers((current) => current.filter((item) => item.id !== row.id))}><Trash2 size={15} /> Delete</button>}
                </div>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function StaffModule({ users, setUsers, currentUser, notify, globalSearch }) {
  const empty = { name: "", email: "", password: "", role: "Cashier", status: "Active" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState("");
  const rows = users.filter((user) => normalize(`${user.name} ${user.email} ${user.role}`).includes(normalize(globalSearch)));

  function submit(event) {
    event.preventDefault();
    if (!form.name || !form.email || !form.password) return notify("Name, email, and password are required.", "error");
    const duplicate = users.some((user) => user.email === form.email && user.id !== editingId);
    if (duplicate) return notify("Email already exists.", "error");
    const record = { ...form, id: editingId || createId("usr") };
    setUsers((current) => (editingId ? current.map((item) => (item.id === editingId ? record : item)) : [record, ...current]));
    setEditingId("");
    setForm(empty);
    notify("User saved.");
  }

  return (
    <section className="retail-grid two-one">
      <form className="surface-panel entity-form" onSubmit={submit}>
        <SectionHeader icon={UserCog} title={editingId ? "Edit User" : "Add User"} />
        <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
        <label><span>Password</span><input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
        <label><span>Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>
        <div className="button-row">
          <button className="primary-button" type="submit"><Check size={17} /> Save user</button>
          {editingId && <button className="ghost-button" type="button" onClick={() => { setEditingId(""); setForm(empty); }}>Cancel</button>}
        </div>
      </form>
      <div className="surface-panel wide">
        <SectionHeader icon={ShieldCheck} title="Users and Roles" action={`${rows.length} records`} />
        <DataTable
          rows={rows}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => { setEditingId(row.id); setForm(row); }}><Edit3 size={15} /> Edit</button>
                  {row.id !== currentUser.id && <button type="button" onClick={() => window.confirm(`Delete ${row.name}?`) && setUsers((current) => current.filter((item) => item.id !== row.id))}><Trash2 size={15} /> Delete</button>}
                </div>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function TransactionsModule({ sales, customers, session, globalSearch, voidSale, setReceiptSale }) {
  const [filters, setFilters] = useState({ from: "", to: "", method: "All", status: "All", customer: "All" });
  const visibleSales = sales.filter((sale) => {
    const roleMatches = session.role === "Cashier" ? sale.cashierId === session.id : true;
    const dateMatches = (!filters.from || sale.date >= filters.from) && (!filters.to || sale.date <= filters.to);
    const methodMatches = filters.method === "All" || sale.payments.some((payment) => payment.method === filters.method);
    const statusMatches = filters.status === "All" || sale.status === filters.status || sale.refundStatus === filters.status;
    const customerMatches = filters.customer === "All" || sale.customerId === filters.customer;
    const searchMatches = normalize(`${sale.receiptNo} ${sale.customerName} ${sale.cashierName} ${sale.status}`).includes(normalize(globalSearch));
    return roleMatches && dateMatches && methodMatches && statusMatches && customerMatches && searchMatches;
  });

  return (
    <section className="surface-panel">
      <SectionHeader icon={ReceiptText} title="Sales History" action={`${visibleSales.length} transactions`} />
      <div className="report-filters transaction-filters">
        <label><span>From</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
        <label><span>To</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
        <label><span>Payment</span><select value={filters.method} onChange={(event) => setFilters({ ...filters, method: event.target.value })}><option>All</option>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label><span>Status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option>All</option><option>Paid</option><option>Void</option><option>Partial</option><option>Full</option></select></label>
        <label><span>Customer</span><select value={filters.customer} onChange={(event) => setFilters({ ...filters, customer: event.target.value })}><option>All</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
      </div>
      <DataTable
        rows={visibleSales}
        pageSize={8}
        columns={[
          { key: "receiptNo", label: "Receipt" },
          { key: "date", label: "Date", render: (row) => `${row.date} ${row.time}` },
          { key: "customerName", label: "Customer" },
          { key: "cashierName", label: "Cashier" },
          { key: "total", label: "Total", render: (row) => money.format(row.total) },
          { key: "refundStatus", label: "Refund", render: (row) => <StatusBadge status={row.refundStatus} /> },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="inline-actions">
                <button type="button" onClick={() => setReceiptSale(row)}><Printer size={15} /> Receipt</button>
                {row.status !== "Void" && canManage(session.role) && <button type="button" onClick={() => voidSale(row)}><Trash2 size={15} /> Void</button>}
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}

function RefundsModule({ sales, refunds, approveRefund, setReceiptSale }) {
  const [query, setQuery] = useState("");
  const [saleId, setSaleId] = useState("");
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState(refundReasons[0]);
  const [method, setMethod] = useState("Cash");
  const [restock, setRestock] = useState(true);
  const matchingSales = sales.filter((sale) => sale.status !== "Void" && normalize(`${sale.receiptNo} ${sale.customerName}`).includes(normalize(query)));
  const sale = sales.find((item) => item.id === saleId) ?? matchingSales[0];
  const refundableItems = sale?.items.map((item) => ({ ...item, maxQty: Number(item.qty) - Number(item.returnedQty || 0) })) ?? [];
  const refundTotal = refundableItems.reduce((sum, item) => {
    const qty = Math.min(item.maxQty, numberValue(quantities[item.productId]));
    return sum + (Number(item.lineTotal) / Number(item.qty || 1)) * qty;
  }, 0);

  function submit(event) {
    event.preventDefault();
    if (!sale) return;
    const refund = approveRefund({ sale, quantities, reason, method, restock });
    if (refund) {
      setQuantities({});
      setQuery("");
      setSaleId("");
    }
  }

  return (
    <section className="retail-grid two-one">
      <form className="surface-panel entity-form" onSubmit={submit}>
        <SectionHeader icon={Undo2} title="Return and Refund" action={sale?.receiptNo ?? "Search"} />
        <label><span>Receipt or customer</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search receipt number" /></label>
        <label><span>Transaction</span><select value={sale?.id ?? ""} onChange={(event) => setSaleId(event.target.value)}>{matchingSales.map((item) => <option key={item.id} value={item.id}>{item.receiptNo} - {item.customerName}</option>)}</select></label>
        {sale && (
          <div className="refund-items">
            {refundableItems.map((item) => (
              <label key={item.productId}>
                <span>{item.name} ({item.maxQty} available)</span>
                <input type="number" min="0" max={item.maxQty} value={quantities[item.productId] ?? 0} onChange={(event) => setQuantities({ ...quantities, [item.productId]: event.target.value })} />
              </label>
            ))}
          </div>
        )}
        <label><span>Reason</span><select value={reason} onChange={(event) => setReason(event.target.value)}>{refundReasons.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Method</span><select value={method} onChange={(event) => setMethod(event.target.value)}>{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="checkbox-field compact"><input type="checkbox" checked={restock} onChange={(event) => setRestock(event.target.checked)} /><span>Restock returned items</span></label>
        <div className="checkout-summary-card slim"><div><span>Refund total</span><strong>{money.format(refundTotal)}</strong></div></div>
        <button className="primary-button" type="submit" disabled={!sale || refundTotal <= 0}><Check size={17} /> Approve refund</button>
      </form>
      <div className="surface-panel wide">
        <SectionHeader icon={Undo2} title="Refund History" action={`${refunds.length} records`} />
        <DataTable
          rows={refunds}
          columns={[
            { key: "number", label: "Refund" },
            { key: "date", label: "Date" },
            { key: "receiptNo", label: "Receipt" },
            { key: "customerName", label: "Customer" },
            { key: "total", label: "Total", render: (row) => money.format(row.total) },
            { key: "approvedBy", label: "Approved by" },
            { key: "actions", label: "Actions", render: (row) => <button type="button" onClick={() => setReceiptSale(sales.find((sale) => sale.id === row.saleId))}><ReceiptText size={15} /> Sale</button> },
          ]}
        />
      </div>
    </section>
  );
}

function ReportsModule({ sales, refunds, products, purchases, customers, users, settings, categoryName }) {
  const [month, setMonth] = useState(todayDate().slice(0, 7));
  const filteredSales = sales.filter((sale) => sale.status !== "Void" && sale.date.startsWith(month));
  const filteredRefunds = refunds.filter((refund) => refund.date.startsWith(month));
  const revenue = filteredSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0) - filteredRefunds.reduce((sum, refund) => sum + Number(refund.total || 0), 0);
  const profit = filteredSales.reduce((sum, sale) => sum + sale.items.reduce((lineSum, item) => lineSum + (Number(item.unitPrice) - Number(item.cost)) * Number(item.qty), 0), 0) - filteredRefunds.reduce((sum, refund) => sum + Number(refund.total || 0), 0);
  const productRows = tallyProductSales(filteredSales).map((row) => {
    const product = products.find((item) => item.name === row.name);
    return { ...row, category: product ? categoryName(product.categoryId) : "Product" };
  });
  const paymentRows = tallyPayments(filteredSales);
  const cashierRows = users.map((user) => {
    const userSales = filteredSales.filter((sale) => sale.cashierId === user.id);
    return { id: user.id, name: user.name, role: user.role, orders: userSales.length, sales: userSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0) };
  }).filter((row) => row.orders > 0);
  const purchaseRows = purchases.filter((purchase) => purchase.date.startsWith(month)).map((purchase) => ({ ...purchase, itemsCount: purchase.items.length }));
  const lowStockRows = products.filter((product) => Number(product.stock) <= Math.max(Number(product.reorderLevel), Number(settings.lowStockThreshold)));

  return (
    <section className="retail-stack">
      <div className="surface-panel">
        <SectionHeader icon={BarChart3} title="Reports" action={month} />
        <div className="report-filters">
          <label><span>Month</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
          <button className="secondary-button small" type="button" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <button className="secondary-button small" type="button" onClick={() => downloadCsv(`sales-${month}.csv`, filteredSales, [{ key: "receiptNo", label: "Receipt" }, { key: "date", label: "Date" }, { key: "customerName", label: "Customer" }, { key: "total", label: "Total" }])}><Download size={16} /> CSV</button>
        </div>
        <div className="summary-grid">
          <Metric icon={CircleDollarSign} label="Net sales" value={money.format(revenue)} tone="wine" />
          <Metric icon={ReceiptText} label="Orders" value={filteredSales.length} tone="blue" />
          <Metric icon={Activity} label="Profit" value={money.format(profit)} tone="green" />
          <Metric icon={Undo2} label="Refunds" value={money.format(filteredRefunds.reduce((sum, refund) => sum + Number(refund.total || 0), 0))} tone="amber" />
        </div>
      </div>

      <section className="retail-grid two">
        <ReportPanel title="Product Sales" icon={Package} rows={productRows} columns={[{ key: "name", label: "Product" }, { key: "category", label: "Category" }, { key: "count", label: "Qty" }]} />
        <ReportPanel title="Payment Methods" icon={CreditCard} rows={paymentRows} columns={[{ key: "name", label: "Method" }, { key: "count", label: "Amount", render: (row) => money.format(row.count) }]} />
        <ReportPanel title="Cashier Performance" icon={UserCog} rows={cashierRows} columns={[{ key: "name", label: "Cashier" }, { key: "orders", label: "Orders" }, { key: "sales", label: "Sales", render: (row) => money.format(row.sales) }]} />
        <ReportPanel title="Low Stock" icon={AlertCircle} rows={lowStockRows} columns={[{ key: "name", label: "Product" }, { key: "stock", label: "Stock" }, { key: "reorderLevel", label: "Reorder" }]} />
        <ReportPanel title="Supplier Purchases" icon={Truck} rows={purchaseRows} columns={[{ key: "number", label: "PO" }, { key: "supplierName", label: "Supplier" }, { key: "itemsCount", label: "Items" }, { key: "total", label: "Total", render: (row) => money.format(row.total) }]} />
        <ReportPanel title="Customers" icon={Users} rows={customers} columns={[{ key: "name", label: "Customer" }, { key: "phone", label: "Phone" }, { key: "loyaltyPoints", label: "Points" }]} />
      </section>
    </section>
  );
}

function ShiftsModule({ shifts, sales, session, openShift, addCashAdjustment, closeShift }) {
  const activeShift = shifts.find((shift) => shift.cashierId === session.id && shift.status === "Open");
  const visibleShifts = canManage(session.role) ? shifts : shifts.filter((shift) => shift.cashierId === session.id);
  const [startingCash, setStartingCash] = useState(2000);
  const [adjustment, setAdjustment] = useState({ type: "Cash in", amount: 0, reason: "" });
  const [countedCash, setCountedCash] = useState(0);

  return (
    <section className="retail-grid two-one">
      <div className="surface-panel entity-form">
        <SectionHeader icon={HandCoins} title="Current Shift" action={activeShift ? "Open" : "Closed"} />
        {activeShift ? (
          <>
            <div className="record-grid compact">
              <RecordItem label="Opened" value={new Date(activeShift.openedAt).toLocaleString("en-PH")} />
              <RecordItem label="Starting cash" value={money.format(activeShift.startingCash)} />
              <RecordItem label="Expected cash" value={money.format(calculateShiftExpected(activeShift, sales))} />
              <RecordItem label="Cash sales" value={money.format(calculateShiftCashSales(activeShift, sales))} />
            </div>
            <div className="purchase-line">
              <label><span>Type</span><select value={adjustment.type} onChange={(event) => setAdjustment({ ...adjustment, type: event.target.value })}><option>Cash in</option><option>Cash out</option></select></label>
              <label><span>Amount</span><input type="number" value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} /></label>
              <label><span>Reason</span><input value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} /></label>
              <button className="secondary-button" type="button" onClick={() => addCashAdjustment(activeShift.id, adjustment)}><Plus size={16} /> Add</button>
            </div>
            <div className="purchase-line">
              <label><span>Counted cash</span><input type="number" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} /></label>
              <button className="primary-button" type="button" onClick={() => closeShift(activeShift.id, countedCash)}><Check size={17} /> Close shift</button>
            </div>
          </>
        ) : (
          <div className="purchase-line">
            <label><span>Starting cash</span><input type="number" value={startingCash} onChange={(event) => setStartingCash(event.target.value)} /></label>
            <button className="primary-button" type="button" onClick={() => openShift(startingCash)}><Check size={17} /> Open shift</button>
          </div>
        )}
      </div>
      <div className="surface-panel wide">
        <SectionHeader icon={CalendarDays} title="Shift Reports" action={`${visibleShifts.length} records`} />
        <DataTable
          rows={visibleShifts}
          columns={[
            { key: "cashierName", label: "Cashier" },
            { key: "openedAt", label: "Opened", render: (row) => new Date(row.openedAt).toLocaleString("en-PH") },
            { key: "startingCash", label: "Start", render: (row) => money.format(row.startingCash) },
            { key: "expected", label: "Expected", render: (row) => money.format(row.status === "Open" ? calculateShiftExpected(row, sales) : row.expectedCash) },
            { key: "countedCash", label: "Counted", render: (row) => row.status === "Closed" ? money.format(row.countedCash) : "-" },
            { key: "difference", label: "Diff", render: (row) => row.status === "Closed" ? money.format(row.difference) : "-" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </div>
    </section>
  );
}

function SettingsModule({ settings, setSettings, resetDemoData }) {
  const [form, setForm] = useState(settings);

  function submit(event) {
    event.preventDefault();
    setSettings({
      ...form,
      taxRate: numberValue(form.taxRate),
      lowStockThreshold: numberValue(form.lowStockThreshold),
      allowOverselling: Boolean(form.allowOverselling),
    });
  }

  return (
    <section className="retail-grid two-one">
      <form className="surface-panel entity-form" onSubmit={submit}>
        <SectionHeader icon={Settings} title="Store Settings" />
        <label><span>Store name</span><input value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} /></label>
        <label><span>Address</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        <label><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label><span>Email</span><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label><span>Receipt prefix</span><input value={form.receiptPrefix} onChange={(event) => setForm({ ...form, receiptPrefix: event.target.value })} /></label>
        <label><span>Tax rate</span><input type="number" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} /></label>
        <label><span>Low stock threshold</span><input type="number" value={form.lowStockThreshold} onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })} /></label>
        <label><span>Receipt footer</span><textarea value={form.receiptFooter} onChange={(event) => setForm({ ...form, receiptFooter: event.target.value })} /></label>
        <label className="checkbox-field compact"><input type="checkbox" checked={Boolean(form.allowOverselling)} onChange={(event) => setForm({ ...form, allowOverselling: event.target.checked })} /><span>Allow overselling</span></label>
        <button className="primary-button" type="submit"><Check size={17} /> Save settings</button>
      </form>
      <div className="surface-panel">
        <SectionHeader icon={ShieldCheck} title="Demo Data" />
        <div className="record-grid compact">
          <RecordItem label="Currency" value={settings.currency} />
          <RecordItem label="Tax" value={`${settings.taxRate}%`} />
          <RecordItem label="Overselling" value={settings.allowOverselling ? "Allowed" : "Blocked"} />
          <RecordItem label="Receipt prefix" value={settings.receiptPrefix} />
        </div>
        <button className="secondary-button danger-button" type="button" onClick={resetDemoData}><RefreshCw size={16} /> Reset demo data</button>
      </div>
    </section>
  );
}

function ReportPanel({ title, icon: Icon, rows, columns }) {
  return (
    <div className="surface-panel">
      <SectionHeader icon={Icon} title={title} action={`${rows.length} rows`} />
      <DataTable rows={rows} columns={columns} pageSize={5} />
    </div>
  );
}

function ReceiptDrawer({ sale, settings, onClose }) {
  return (
    <div className="modal-backdrop receipt-backdrop" role="dialog" aria-modal="true">
      <aside className="receipt-drawer">
        <div className="receipt-actions">
          <button className="secondary-button small" type="button" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <button className="secondary-button small" type="button" onClick={() => downloadText(`${sale.receiptNo}.txt`, receiptText(sale, settings))}><Download size={16} /> Download</button>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="receipt-paper">
          <div className="receipt-store">
            <img src="/brand/mace-logo.png" alt={settings.storeName} />
            <h2>{settings.storeName}</h2>
            <span>{settings.address}</span>
            <span>{settings.phone} / {settings.email}</span>
          </div>
          <div className="receipt-meta">
            <div><span>Receipt</span><strong>{sale.receiptNo}</strong></div>
            <div><span>Date</span><strong>{sale.date} {sale.time}</strong></div>
            <div><span>Cashier</span><strong>{sale.cashierName}</strong></div>
            <div><span>Customer</span><strong>{sale.customerName}</strong></div>
          </div>
          <table className="receipt-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.productId}>
                  <td><strong>{item.name}</strong><span>{item.sku} @ {money.format(item.unitPrice)}</span></td>
                  <td>{item.qty}</td>
                  <td>{money.format(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="receipt-totals">
            <div><span>Subtotal</span><strong>{money.format(sale.subtotal)}</strong></div>
            <div><span>Discount</span><strong>-{money.format(sale.itemDiscount + sale.cartDiscount)}</strong></div>
            <div><span>Tax</span><strong>{money.format(sale.tax)}</strong></div>
            {sale.refundTotal > 0 && <div><span>Refunded</span><strong>-{money.format(sale.refundTotal)}</strong></div>}
            <div className="receipt-grand"><span>Total</span><strong>{money.format(sale.total)}</strong></div>
            <div><span>Paid</span><strong>{money.format(sale.paid)}</strong></div>
            <div><span>Change</span><strong>{money.format(sale.change)}</strong></div>
          </div>
          <div className="receipt-payments">
            {sale.payments.map((payment, index) => <span key={`${payment.method}-${index}`}>{payment.method}: {money.format(payment.amount)}</span>)}
          </div>
          <p>{settings.receiptFooter}</p>
        </div>
      </aside>
    </div>
  );
}

function DataTable({ rows, columns, pageSize = 7 }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize]);

  return (
    <div className="smart-table retail-table">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={row.id ?? row.number ?? row.receiptNo ?? `${index}`}>
                {columns.map((column) => (
                  <td key={column.key} data-label={column.label}>{column.render ? column.render(row) : String(row[column.key] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleRows.length && <EmptyState title="No records found" copy="Change filters or create a new record." />}
      </div>
      <div className="pagination">
        <span>{rows.length} result{rows.length === 1 ? "" : "s"}</span>
        <div>
          <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <strong>{page} / {pageCount}</strong>
          <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon"><Icon size={20} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SectionHeader({ icon: Icon, title, action }) {
  return (
    <div className="section-header">
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      {action && <span>{action}</span>}
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{status}</span>;
}

function EmptyState({ title, copy }) {
  return (
    <div className="empty-state">
      <FileText size={19} />
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}

function RecordPill({ label, value }) {
  return (
    <div className="record-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RecordItem({ label, value }) {
  return (
    <article className="record-item">
      <span>{label}</span>
      <strong>{value || "0"}</strong>
    </article>
  );
}

function MiniBars({ values }) {
  const max = Math.max(1, ...values);
  return (
    <div className="mini-bars">
      {values.map((value, index) => (
        <span key={index} style={{ height: `${Math.max(8, (value / max) * 100)}%` }} title={money.format(value)} />
      ))}
    </div>
  );
}

function RankList({ rows, formatter = (value) => value }) {
  return (
    <div className="rank-list">
      {rows.length ? rows.map((row, index) => (
        <article key={`${row.name}-${index}`}>
          <div><span>{index + 1}</span><strong>{row.name}</strong></div>
          <b>{formatter(row.count)}</b>
        </article>
      )) : <EmptyState title="No sales yet" copy="Completed checkouts will appear here." />}
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`toast ${toast.tone}`}>
      {toast.tone === "error" ? <AlertCircle size={17} /> : <Check size={17} />}
      <span>{toast.message}</span>
    </div>
  );
}

function tallyProductSales(sales) {
  const tally = {};
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      tally[item.name] = (tally[item.name] || 0) + Number(item.qty || 0);
    });
  });
  return Object.entries(tally).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function tallyPayments(sales) {
  const tally = {};
  sales.forEach((sale) => {
    paymentRevenue(sale.payments, sale.change).forEach((payment) => {
      tally[payment.method] = (tally[payment.method] || 0) + Number(payment.amount || 0);
    });
  });
  return Object.entries(tally).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function lastSevenDays(sales) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      total: sales.filter((sale) => sale.date === key).reduce((sum, sale) => sum + Number(sale.total || 0) - Number(sale.refundTotal || 0), 0),
    };
  });
}

function calculateShiftCashSales(shift, sales) {
  return sales
    .filter((sale) => sale.shiftId === shift.id && sale.status !== "Void")
    .reduce((sum, sale) => {
      const cashPayment = paymentRevenue(sale.payments, sale.change).filter((payment) => payment.method === "Cash").reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0);
      return sum + cashPayment;
    }, 0);
}

function calculateShiftExpected(shift, sales) {
  const adjustments = (shift.adjustments ?? []).reduce((sum, adjustment) => {
    return sum + (adjustment.type === "Cash out" ? -Number(adjustment.amount || 0) : Number(adjustment.amount || 0));
  }, 0);
  return Number(shift.startingCash || 0) + calculateShiftCashSales(shift, sales) + adjustments;
}
