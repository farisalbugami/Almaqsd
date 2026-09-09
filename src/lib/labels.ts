export const OWNER_TYPES: Record<string, string> = {
  INDIVIDUAL: "فرد",
  COMPANY: "شركة",
  REIT: "صندوق ريت",
};

export const PROPERTY_TYPES: Record<string, string> = {
  COMMERCIAL: "مجمع تجاري",
  OFFICE: "مبنى مكتبي",
  RESIDENTIAL: "مجمع سكني",
  HOSPITALITY: "ضيافة",
  LAND: "أرض",
};

export const UNIT_TYPES: Record<string, string> = {
  APARTMENT: "شقة",
  OFFICE: "مكتب",
  SHOP: "محل",
  SHOWROOM: "معرض",
  WAREHOUSE: "مستودع",
  CHALET: "شاليه",
  VILLA: "فيلا",
};

export const UNIT_STATUS: Record<string, string> = {
  VACANT: "شاغرة",
  LEASED: "مؤجرة",
  RESERVED: "محجوزة",
  MAINTENANCE: "تحت الصيانة",
};

export const LEASE_STATUS: Record<string, string> = {
  DRAFT: "مسودة",
  ACTIVE: "ساري",
  EXPIRED: "منتهي",
  TERMINATED: "مفسوخ",
};

export const INVOICE_STATUS: Record<string, string> = {
  UNPAID: "غير محصّلة",
  PARTIAL: "محصّلة جزئياً",
  PAID: "محصّلة",
  CANCELLED: "ملغاة",
};

export const PAYMENT_METHODS: Record<string, string> = {
  BANK_TRANSFER: "تحويل بنكي",
  CHEQUE: "شيك",
  CASH: "نقداً",
  SADAD: "سداد",
  MADA: "مدى",
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  MAINTENANCE: "صيانة",
  UTILITIES: "مرافق وخدمات",
  SECURITY: "أمن وحراسة",
  CLEANING: "نظافة",
  GOVERNMENT: "رسوم حكومية",
  INSURANCE: "تأمين",
  MARKETING: "تسويق",
  OTHER: "أخرى",
};

export const CHARGE_TO: Record<string, string> = {
  OWNER: "على المالك",
  COMPANY: "على الشركة",
};

export const COMMISSION_TYPES: Record<string, string> = {
  PERCENT_COLLECTED: "نسبة من المحصّل",
  PERCENT_CONTRACTED: "نسبة من التعاقد",
  FIXED_MONTHLY: "مبلغ شهري ثابت",
};

export const CONTRACT_STATUS: Record<string, string> = {
  DRAFT: "مسودة",
  ACTIVE: "ساري",
  EXPIRED: "منتهي",
  TERMINATED: "مفسوخ",
};

export const PAYOUT_STATUS: Record<string, string> = {
  DRAFT: "مسودة",
  APPROVED: "معتمد",
  PAID: "مورّد",
};

export const DOCUMENT_TYPES: Record<string, string> = {
  DEED: "صك",
  LICENSE: "رخصة",
  INSURANCE: "وثيقة تأمين",
  CONTRACT: "عقد",
  CERTIFICATE: "شهادة",
  OTHER: "أخرى",
};

export const ENTITY_TYPES: Record<string, string> = {
  PROPERTY: "عقار",
  OWNER: "مالك",
  LEASE: "عقد إيجار",
  UNIT: "وحدة",
  COMPANY: "الشركة",
};

export const label = (map: Record<string, string>, key: string | null | undefined) =>
  (key && map[key]) || key || "—";
