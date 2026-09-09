// الأدوار مبنية على فرق المقصد الأربعة المعلنة + الإدارة + بوابة المالك
export const ROLES = {
  ADMIN: "ADMIN",
  FINANCE: "FINANCE",
  OPERATIONS: "OPERATIONS",
  LEGAL: "LEGAL",
  MAINTENANCE: "MAINTENANCE",
  OWNER: "OWNER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "مدير النظام",
  FINANCE: "الفريق المالي",
  OPERATIONS: "الفريق الإداري والتشغيل",
  LEGAL: "الفريق القانوني",
  MAINTENANCE: "فريق الصيانة",
  OWNER: "مالك / مستثمر",
};

/** الصلاحيات: مفتاح لكل قدرة، وقائمة الأدوار المسموح لها */
export const PERMISSIONS = {
  "owners.view": ["ADMIN", "FINANCE", "OPERATIONS", "LEGAL"],
  "owners.edit": ["ADMIN", "OPERATIONS"],
  "properties.view": ["ADMIN", "FINANCE", "OPERATIONS", "LEGAL", "MAINTENANCE"],
  "properties.edit": ["ADMIN", "OPERATIONS"],
  "leases.view": ["ADMIN", "FINANCE", "OPERATIONS", "LEGAL"],
  "leases.edit": ["ADMIN", "OPERATIONS", "LEGAL"],
  "invoices.view": ["ADMIN", "FINANCE", "OPERATIONS"],
  "invoices.edit": ["ADMIN", "FINANCE"],
  "payments.edit": ["ADMIN", "FINANCE"],
  "expenses.view": ["ADMIN", "FINANCE", "OPERATIONS", "MAINTENANCE"],
  "expenses.edit": ["ADMIN", "FINANCE", "MAINTENANCE"],
  "payouts.view": ["ADMIN", "FINANCE"],
  "payouts.edit": ["ADMIN", "FINANCE"],
  "documents.view": ["ADMIN", "FINANCE", "OPERATIONS", "LEGAL", "MAINTENANCE"],
  "documents.edit": ["ADMIN", "OPERATIONS", "LEGAL"],
  "users.manage": ["ADMIN"],
  "audit.view": ["ADMIN"],
  "portal.view": ["OWNER"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
