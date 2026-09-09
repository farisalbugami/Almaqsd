/**
 * بيانات تجريبية لمنظومة المقصد
 * أرقام تقريبية مبنية على ما هو معلن في almaqsd.co (أصول تتجاوز 600 مليون ريال، +300 وحدة)
 * الغرض: تشغيل النظام واختباره — تُستبدل ببيانات الشركة الفعلية.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const d = (s: string) => new Date(s + "T00:00:00.000Z");
const rnd = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  console.log("تنظيف البيانات السابقة…");
  await db.auditLog.deleteMany();
  await db.payment.deleteMany();
  await db.invoice.deleteMany();
  await db.lease.deleteMany();
  await db.expense.deleteMany();
  await db.payout.deleteMany();
  await db.document.deleteMany();
  await db.unit.deleteMany();
  await db.property.deleteMany();
  await db.managementContract.deleteMany();
  await db.tenant.deleteMany();
  await db.user.deleteMany();
  await db.owner.deleteMany();

  const pass = await bcrypt.hash("123456", 10);

  // ═══ المُلاك ═══
  console.log("إنشاء المُلاك…");
  const owners = await Promise.all([
    db.owner.create({ data: { code: "OWN-001", name: "صندوق الرياض العقاري (ريت)", type: "REIT", idNumber: "1010XXXXXX", phone: "0112000100", email: "reit@example.com", iban: "SA0380000000608010167519", bankName: "البنك الأهلي السعودي" } }),
    db.owner.create({ data: { code: "OWN-002", name: "شركة النخبة للاستثمار العقاري", type: "COMPANY", idNumber: "1010445566", phone: "0112000200", email: "info@example.com", iban: "SA4420000001234567891234", bankName: "مصرف الراجحي" } }),
    db.owner.create({ data: { code: "OWN-003", name: "عبدالله بن سعد الشمري", type: "INDIVIDUAL", idNumber: "1023456789", phone: "0555100200", email: "owner@example.com", iban: "SA0310000012345678901234", bankName: "بنك الرياض" } }),
    db.owner.create({ data: { code: "OWN-004", name: "ورثة محمد العتيبي", type: "INDIVIDUAL", idNumber: "1098765432", phone: "0555300400", iban: "SA6510000098765432109876", bankName: "البنك السعودي الفرنسي" } }),
  ]);

  // ═══ عقود الإدارة ═══
  console.log("إنشاء عقود الإدارة…");
  const contractSpecs = [
    { o: 0, type: "PERCENT_COLLECTED", rate: 5, limit: 50_000 },
    { o: 1, type: "PERCENT_COLLECTED", rate: 6, limit: 25_000 },
    { o: 2, type: "PERCENT_COLLECTED", rate: 7.5, limit: 10_000 },
    { o: 3, type: "FIXED_MONTHLY", rate: 12_000, limit: 15_000 },
  ];
  for (const [i, c] of contractSpecs.entries()) {
    await db.managementContract.create({
      data: {
        number: `MGT-2025-${String(i + 1).padStart(4, "0")}`,
        ownerId: owners[c.o].id,
        startDate: d("2025-01-01"),
        endDate: d("2027-12-31"),
        commissionType: c.type,
        commissionRate: c.rate,
        spendLimit: c.limit,
        scope: "تشغيل وتأجير وتحصيل وصيانة وتسويق العقارات المشمولة",
        status: "ACTIVE",
      },
    });
  }

  // ═══ العقارات والوحدات ═══
  console.log("إنشاء العقارات والوحدات…");
  const propSpecs = [
    { code: "PRP-001", name: "برج المقصد التجاري", owner: 0, type: "COMMERCIAL", city: "الرياض", district: "العليا", value: 185_000_000, units: 48, unitType: "SHOP", rent: [180_000, 420_000], area: [90, 260], floors: 12 },
    { code: "PRP-002", name: "مجمع الواحة المكتبي", owner: 0, type: "OFFICE", city: "الرياض", district: "الملقا", value: 142_000_000, units: 60, unitType: "OFFICE", rent: [95_000, 240_000], area: [70, 190], floors: 9 },
    { code: "PRP-003", name: "مجمع ندى السكني", owner: 1, type: "RESIDENTIAL", city: "الرياض", district: "النرجس", value: 88_000_000, units: 72, unitType: "APARTMENT", rent: [42_000, 78_000], area: [110, 200], floors: 6 },
    { code: "PRP-004", name: "أبراج القصر السكنية", owner: 1, type: "RESIDENTIAL", city: "جدة", district: "الشاطئ", value: 96_000_000, units: 64, unitType: "APARTMENT", rent: [48_000, 92_000], area: [120, 230], floors: 8 },
    { code: "PRP-005", name: "مجمع الياسمين التجاري", owner: 2, type: "COMMERCIAL", city: "الرياض", district: "الياسمين", value: 54_000_000, units: 26, unitType: "SHOP", rent: [130_000, 280_000], area: [80, 180], floors: 3 },
    { code: "PRP-006", name: "مكاتب الصحافة", owner: 2, type: "OFFICE", city: "الرياض", district: "الصحافة", value: 38_000_000, units: 30, unitType: "OFFICE", rent: [72_000, 155_000], area: [55, 130], floors: 5 },
    { code: "PRP-007", name: "شاليهات المقصد", owner: 3, type: "HOSPITALITY", city: "الدرعية", district: "طريق الملك", value: 27_000_000, units: 14, unitType: "CHALET", rent: [150_000, 260_000], area: [180, 340], floors: 1 },
    { code: "PRP-008", name: "مستودعات الصناعية", owner: 3, type: "COMMERCIAL", city: "الرياض", district: "الصناعية الثانية", value: 31_000_000, units: 12, unitType: "WAREHOUSE", rent: [200_000, 400_000], area: [500, 1200], floors: 1 },
  ];

  const allUnits: { id: string; type: string; rent: number; propertyIdx: number }[] = [];

  for (const [pi, p] of propSpecs.entries()) {
    const property = await db.property.create({
      data: {
        code: p.code, name: p.name, ownerId: owners[p.owner].id, type: p.type,
        city: p.city, district: p.district, deedNumber: `31010${rnd(100000, 999999)}`,
        landArea: rnd(1200, 9000), builtArea: rnd(2000, 26000), floors: p.floors,
        buildYear: rnd(2012, 2023), marketValue: p.value, valuedAt: d("2026-01-15"),
        status: "ACTIVE",
      },
    });

    for (let i = 1; i <= p.units; i++) {
      const floor = p.floors > 1 ? String(Math.ceil(i / Math.ceil(p.units / p.floors))) : "الأرضي";
      const rent = rnd(p.rent[0], p.rent[1]);
      // ~85% إشغال
      const status = Math.random() < 0.85 ? "LEASED" : Math.random() < 0.6 ? "VACANT" : "MAINTENANCE";
      const u = await db.unit.create({
        data: {
          propertyId: property.id,
          code: `${p.code.split("-")[1]}-${String(i).padStart(3, "0")}`,
          type: p.unitType, floor, area: rnd(p.area[0], p.area[1]),
          rooms: p.unitType === "APARTMENT" ? rnd(2, 5) : null,
          baths: p.unitType === "APARTMENT" ? rnd(1, 3) : null,
          marketRent: rent, status,
          meterElec: `E${rnd(1000000, 9999999)}`, meterWater: `W${rnd(100000, 999999)}`,
        },
      });
      if (status === "LEASED") allUnits.push({ id: u.id, type: p.unitType, rent, propertyIdx: pi });
    }

    // وثائق العقار
    await db.document.create({
      data: {
        title: `رخصة بلدية — ${p.name}`, type: "LICENSE", entityType: "PROPERTY",
        entityId: property.id, propertyId: property.id, number: `LIC-${rnd(10000, 99999)}`,
        issueDate: d("2025-03-01"), expiryDate: d(pi < 2 ? "2026-10-15" : "2027-03-01"),
      },
    });
    await db.document.create({
      data: {
        title: `وثيقة تأمين — ${p.name}`, type: "INSURANCE", entityType: "PROPERTY",
        entityId: property.id, propertyId: property.id, number: `INS-${rnd(100000, 999999)}`,
        issueDate: d("2025-09-01"), expiryDate: d(pi === 2 ? "2026-09-30" : "2026-12-31"),
      },
    });
  }
  console.log(`  ${propSpecs.length} عقاراً، ${propSpecs.reduce((a, p) => a + p.units, 0)} وحدة`);

  // ═══ المستأجرون ═══
  console.log("إنشاء المستأجرين…");
  const companyNames = [
    "شركة الأفق للتجارة", "مؤسسة نماء التقنية", "شركة البيان للاستشارات", "مجموعة الخليج الطبية",
    "شركة رواد الحلول", "مؤسسة الصفوة للمقاولات", "شركة المدى للتسويق", "مكتب الإتقان الهندسي",
    "شركة درة الشرق", "مؤسسة الوفاء التجارية", "شركة تكامل اللوجستية", "مركز النور الطبي",
    "شركة سما للأغذية", "مؤسسة الرافد للخدمات", "شركة الجود العقارية",
  ];
  const personNames = [
    "خالد بن فهد القحطاني", "سارة بنت عبدالعزيز الدوسري", "محمد بن ناصر الحربي", "نورة بنت سعود المطيري",
    "فيصل بن تركي الغامدي", "ريم بنت أحمد الزهراني", "سلطان بن ماجد العنزي", "هند بنت خالد الشهري",
    "عمر بن يوسف البقمي", "لطيفة بنت محمد السبيعي", "بندر بن راشد الرشيد", "منال بنت علي العمري",
    "ياسر بن سالم الحارثي", "أمل بنت فهد الخالدي", "طلال بن عبدالله السهلي",
  ];

  const tenants = [];
  for (const [i, n] of [...companyNames, ...personNames].entries()) {
    tenants.push(
      await db.tenant.create({
        data: {
          code: `TEN-${String(i + 1).padStart(3, "0")}`,
          name: n,
          type: i < companyNames.length ? "COMPANY" : "INDIVIDUAL",
          idNumber: i < companyNames.length ? `10104${rnd(10000, 99999)}` : `1${rnd(100000000, 999999999)}`,
          phone: `05${rnd(10000000, 99999999)}`,
        },
      }),
    );
  }

  // ═══ العقود والفواتير والتحصيل ═══
  console.log("إنشاء عقود الإيجار والفواتير…");
  let leaseSeq = 1, invSeq = 1, paySeq = 1;
  const today = new Date("2026-09-09");

  for (const u of allUnits) {
    const tenant = tenants[rnd(0, tenants.length - 1)];
    const commercial = ["SHOP", "OFFICE", "WAREHOUSE", "SHOWROOM"].includes(u.type);
    const vatRate = commercial ? 0.15 : 0;
    const installments = commercial ? 4 : Math.random() < 0.5 ? 2 : 1;

    // بدايات موزعة على آخر 14 شهراً
    const startOffset = rnd(0, 420);
    const startDate = new Date(today.getTime() - startOffset * 86_400_000);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    endDate.setDate(endDate.getDate() - 1);

    const lease = await db.lease.create({
      data: {
        number: `LSE-2026-${String(leaseSeq++).padStart(4, "0")}`,
        unitId: u.id, tenantId: tenant.id, startDate, endDate,
        annualRent: u.rent, installments, deposit: r2(u.rent * 0.05), vatRate,
        ejarNumber: Math.random() < 0.75 ? `EJ${rnd(1000000, 9999999)}` : null,
        status: "ACTIVE",
      },
    });

    const per = u.rent / installments;
    const gap = 12 / installments;
    for (let k = 0; k < installments; k++) {
      const due = new Date(startDate);
      due.setMonth(due.getMonth() + Math.round(gap * k));
      const amount = r2(per);
      const vat = r2(amount * vatRate);
      const total = r2(amount + vat);

      const inv = await db.invoice.create({
        data: {
          number: `INV-2026-${String(invSeq++).padStart(5, "0")}`,
          leaseId: lease.id, issueDate: due, dueDate: due,
          amount, vatAmount: vat, total, period: `الدفعة ${k + 1} من ${installments}`,
        },
      });

      // التحصيل: المستحقة سابقاً تُحصَّل بنسبة ~88%
      if (due <= today) {
        const roll = Math.random();
        if (roll < 0.88) {
          const paidAt = new Date(due.getTime() + rnd(0, 20) * 86_400_000);
          await db.payment.create({
            data: {
              number: `RCV-2026-${String(paySeq++).padStart(5, "0")}`,
              invoiceId: inv.id, paidAt: paidAt > today ? today : paidAt, amount: total,
              method: ["BANK_TRANSFER", "BANK_TRANSFER", "CHEQUE", "SADAD", "MADA"][rnd(0, 4)],
              reference: `TRX${rnd(100000, 999999)}`,
              bankName: ["مصرف الراجحي", "البنك الأهلي السعودي", "بنك الرياض", "البنك السعودي الفرنسي"][rnd(0, 3)],
            },
          });
          await db.invoice.update({ where: { id: inv.id }, data: { paidTotal: total, status: "PAID" } });
        } else if (roll < 0.94) {
          const part = r2(total * 0.5);
          await db.payment.create({
            data: {
              number: `RCV-2026-${String(paySeq++).padStart(5, "0")}`,
              invoiceId: inv.id, paidAt: new Date(due.getTime() + rnd(0, 15) * 86_400_000),
              amount: part, method: "BANK_TRANSFER", reference: `TRX${rnd(100000, 999999)}`,
            },
          });
          await db.invoice.update({ where: { id: inv.id }, data: { paidTotal: part, status: "PARTIAL" } });
        }
      }
    }
  }
  console.log(`  ${leaseSeq - 1} عقداً، ${invSeq - 1} فاتورة، ${paySeq - 1} سند قبض`);

  // ═══ المصروفات ═══
  console.log("إنشاء المصروفات…");
  const properties = await db.property.findMany({ select: { id: true } });
  const expenseSpecs = [
    { cat: "MAINTENANCE", desc: "صيانة دورية للمصاعد", vendor: "شركة أوتيس للمصاعد", range: [8000, 35000] },
    { cat: "MAINTENANCE", desc: "صيانة أنظمة التكييف المركزي", vendor: "مؤسسة التبريد الحديث", range: [12000, 48000] },
    { cat: "MAINTENANCE", desc: "إصلاح تسربات المياه", vendor: "مؤسسة الإتقان للسباكة", range: [3000, 15000] },
    { cat: "UTILITIES", desc: "فاتورة الكهرباء للمرافق المشتركة", vendor: "الشركة السعودية للكهرباء", range: [15000, 70000] },
    { cat: "UTILITIES", desc: "فاتورة المياه", vendor: "شركة المياه الوطنية", range: [4000, 18000] },
    { cat: "SECURITY", desc: "عقد الحراسات الأمنية الشهري", vendor: "شركة حراسات الأمن", range: [18000, 45000] },
    { cat: "CLEANING", desc: "عقد النظافة الشهري", vendor: "مؤسسة النقاء للخدمات", range: [9000, 28000] },
    { cat: "GOVERNMENT", desc: "رسوم تجديد الرخصة البلدية", vendor: "أمانة المنطقة", range: [3000, 12000] },
    { cat: "INSURANCE", desc: "قسط التأمين على المبنى", vendor: "شركة التعاونية للتأمين", range: [22000, 85000] },
    { cat: "MARKETING", desc: "حملة تسويقية لتأجير الوحدات الشاغرة", vendor: "وكالة المدى للإعلان", range: [8000, 30000] },
  ];

  let expSeq = 1;
  for (const p of properties) {
    for (let m = 0; m < 9; m++) {
      const count = rnd(1, 3);
      for (let c = 0; c < count; c++) {
        const spec = expenseSpecs[rnd(0, expenseSpecs.length - 1)];
        const amount = rnd(spec.range[0], spec.range[1]);
        const spentAt = new Date(2026, m, rnd(1, 28));
        if (spentAt > today) continue;
        await db.expense.create({
          data: {
            number: `EXP-2026-${String(expSeq++).padStart(5, "0")}`,
            propertyId: p.id, category: spec.cat, spentAt, amount,
            vatAmount: r2(amount * 0.15), vendor: spec.vendor,
            chargeTo: Math.random() < 0.82 ? "OWNER" : "COMPANY",
            description: spec.desc,
            status: Math.random() < 0.93 ? "APPROVED" : "PENDING",
          },
        });
      }
    }
  }
  console.log(`  ${expSeq - 1} مصروفاً`);

  // ═══ وثائق الشركة ═══
  await db.document.createMany({
    data: [
      { title: "السجل التجاري للشركة", type: "CERTIFICATE", entityType: "COMPANY", number: "1010XXXXXX", issueDate: d("2024-02-01"), expiryDate: d("2027-02-01") },
      { title: "رخصة الوساطة العقارية — الهيئة العامة للعقار", type: "LICENSE", entityType: "COMPANY", number: "FAL-XXXXXX", issueDate: d("2025-05-01"), expiryDate: d("2026-11-01") },
      { title: "شهادة الزكاة والدخل", type: "CERTIFICATE", entityType: "COMPANY", number: "ZK-2026-001", issueDate: d("2026-01-10"), expiryDate: d("2026-10-20") },
      { title: "شهادة التسجيل في ضريبة القيمة المضافة", type: "CERTIFICATE", entityType: "COMPANY", number: "3001XXXXXXXXX", issueDate: d("2024-02-15") },
      { title: "شهادة السعودة — نطاقات", type: "CERTIFICATE", entityType: "COMPANY", number: "NT-2026-88", issueDate: d("2026-03-01"), expiryDate: d("2026-12-01") },
    ],
  });

  // ═══ التوريدات ═══
  console.log("إنشاء التوريدات…");
  let payoutSeq = 1;
  for (const [i, o] of owners.entries()) {
    for (const [mFrom, mTo] of [[5, 5], [6, 6]] as const) {
      const from = new Date(2026, mFrom, 1);
      const to = new Date(2026, mTo + 1, 0, 23, 59, 59);
      const payments = await db.payment.findMany({
        where: { paidAt: { gte: from, lte: to }, invoice: { lease: { unit: { property: { ownerId: o.id } } } } },
        select: { amount: true },
      });
      const expenses = await db.expense.findMany({
        where: { spentAt: { gte: from, lte: to }, chargeTo: "OWNER", status: "APPROVED", property: { ownerId: o.id } },
        select: { amount: true, vatAmount: true },
      });
      const collected = r2(payments.reduce((a, p) => a + p.amount, 0));
      const exp = r2(expenses.reduce((a, e) => a + e.amount + e.vatAmount, 0));
      if (collected === 0 && exp === 0) continue;
      const spec = contractSpecs[i];
      const commission = spec.type === "FIXED_MONTHLY" ? spec.rate : r2(collected * (spec.rate / 100));
      await db.payout.create({
        data: {
          number: `PAY-2026-${String(payoutSeq++).padStart(4, "0")}`,
          ownerId: o.id, periodFrom: from, periodTo: to,
          collected, expenses: exp, commission, netAmount: r2(collected - exp - commission),
          status: mFrom === 5 ? "PAID" : "APPROVED",
          paidAt: mFrom === 5 ? new Date(2026, 6, 5) : null,
          reference: mFrom === 5 ? `TRF${rnd(100000, 999999)}` : null,
        },
      });
    }
  }

  // ═══ المستخدمون ═══
  console.log("إنشاء المستخدمين…");
  await db.user.createMany({
    data: [
      { name: "مدير النظام", email: "admin@almaqsd.co", passwordHash: pass, role: "ADMIN", phone: "0582002000" },
      { name: "محاسب الشركة", email: "finance@almaqsd.co", passwordHash: pass, role: "FINANCE" },
      { name: "مسؤول التشغيل", email: "ops@almaqsd.co", passwordHash: pass, role: "OPERATIONS" },
      { name: "المستشار القانوني", email: "legal@almaqsd.co", passwordHash: pass, role: "LEGAL" },
      { name: "مشرف الصيانة", email: "maintenance@almaqsd.co", passwordHash: pass, role: "MAINTENANCE" },
    ],
  });
  await db.user.create({
    data: { name: owners[2].name, email: "owner@example.com", passwordHash: pass, role: "OWNER", ownerId: owners[2].id },
  });

  const counts = {
    owners: await db.owner.count(),
    properties: await db.property.count(),
    units: await db.unit.count(),
    leases: await db.lease.count(),
    invoices: await db.invoice.count(),
    payments: await db.payment.count(),
    expenses: await db.expense.count(),
  };
  console.log("\n✔ تم تجهيز البيانات:", counts);
  console.log("  الدخول: admin@almaqsd.co / 123456");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
