import { campaign } from "../config.js";
import type { Lead } from "../types.js";

export interface SequenceStep {
  /** التأخير بالساعات منذ بدء المسار */
  delayHours: number;
  channel: "whatsapp" | "email";
  subject?: string;
  render: (lead: Lead) => string;
}

export interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
}

const c = campaign.company;
const offer = campaign.offers.primary;
const sig = `${c.name}\n${c.phones[0]} — ${c.email}\n${c.city} – ${c.district}`;

/** مسار الملاك والمستثمرين — محوره تقرير التقييم المجاني */
export const ownersSequence: Sequence = {
  id: "owners_audit",
  name: "مسار الملاك — تقرير تقييم أداء العقار",
  steps: [
    {
      delayHours: 0,
      channel: "whatsapp",
      render: (l) =>
        `أهلًا ${l.name} 👋\nمعك فريق ${c.shortName}. وصلنا طلبك لتقرير تقييم أداء العقار ✅\n\n` +
        `لإعداد تقرير دقيق نحتاج تأكيد أربع معلومات:\n` +
        `١. نوع العقار: ${l.property_type ?? "—"}\n` +
        `٢. الموقع: ${l.city ?? "—"}\n` +
        `٣. عدد الوحدات: ${l.units ?? "—"}\n` +
        `٤. نسبة الإشغال الحالية تقريبًا؟\n\n` +
        `يصلك التقرير خلال ${offer.slaHours} ساعة، بدون أي التزام.`,
    },
    {
      delayHours: 48,
      channel: "whatsapp",
      render: (l) =>
        `${l.name}، أرسلنا تقرير تقييم أداء عقارك 📄\n\n` +
        `إن أحببت، نخصص ٣٠ دقيقة نشرح فيها الأرقام ونعرض خيارات التحسين — بلا أي التزام بعدها.\n` +
        `أي يوم يناسبك هذا الأسبوع؟`,
    },
    {
      delayHours: 96,
      channel: "email",
      subject: "ثلاثة بنود تكلف الملاك سنويًا دون أن يلاحظوا",
      render: (l) =>
        `أستاذ ${l.name}،\n\n` +
        `من واقع تشغيلنا اليومي، أكثر ثلاثة بنود تستنزف عائد الملاك:\n\n` +
        `١. الشغور غير المحسوب — شهر واحد يساوي 8.3% من إيراد السنة.\n` +
        `٢. الصيانة الطارئة — تكلفتها تتجاوز الوقائية بأضعاف لأنها تأتي بلا تفاوض.\n` +
        `٣. الإيجار المتجمّد — إيجار لم يُراجع منذ سنتين يعني فجوة تتسع كل شهر.\n\n` +
        `الثلاثة تُعالج بنظام تشغيل واضح، لا بجهد أكبر.\n\n${sig}`,
    },
    {
      delayHours: 192,
      channel: "email",
      subject: "ماذا يرى مالك العقار في المقصد؟",
      render: (l) =>
        `أستاذ ${l.name}،\n\n` +
        `نؤمن أن المالك يجب أن يرى عقاره لا أن يُخبَر عنه.\n\n` +
        `لذلك لكل مالك لدينا صفحة Dashboard خاصة يتابع منها: الإشغال لحظة بلحظة، الإيرادات والمصاريف، حالة العقود والتجديدات، وبلاغات الصيانة ومراحلها.\n\n` +
        `الشفافية ليست تقريرًا يصل متأخرًا — هي وصول دائم.\n\n${sig}`,
    },
    {
      delayHours: 336,
      channel: "whatsapp",
      render: (l) =>
        `أستاذ ${l.name}، تحية طيبة 🌿\n` +
        `أتابع بخصوص تقرير عقارك. أدرك أن الوقت مزدحم، فأترك لك العرض في سطر:\n\n` +
        `٣٠ دقيقة نراجع فيها أرقام عقارك ونعطيك قراءة صريحة — حتى لو انتهى اللقاء دون تعاقد.\n\n` +
        `جاهزون متى ما ناسبك، ولو بعد شهر. شكرًا لوقتك.`,
    },
  ],
};

/** مسار شراكات التطوير */
export const partnersSequence: Sequence = {
  id: "partners_dev",
  name: "مسار شراكات التطوير",
  steps: [
    {
      delayHours: 0,
      channel: "whatsapp",
      render: (l) =>
        `أهلًا ${l.name} 👋\nوصلنا اهتمامك بشراكة التطوير مع ${c.shortName}.\n\n` +
        `نعمل بنموذجين:\n` +
        `١ — شراكة تطوير وتشغيل: الأرض من طرفك، والتطوير والتشغيل والتسويق من طرفنا بتوزيع عوائد متفق عليه.\n` +
        `٢ — تشغيل وتسويق بعد التسليم: للمطوّر الذي أنجز مشروعه ويحتاج مُشغّلًا يضمن الإشغال والعائد.\n\n` +
        `نبدأ بدراسة جدوى مبدئية للموقع. نحتاج: الموقع، المساحة، الاستخدام المصرّح، والمرحلة الحالية.`,
    },
    {
      delayHours: 72,
      channel: "email",
      subject: "نموذج الشراكة — من أول اجتماع إلى التشغيل",
      render: (l) =>
        `أستاذ ${l.name}،\n\n` +
        `مسار الشراكة لدينا أربع مراحل: دراسة مبدئية للموقع، تحديد الاستخدام الأعلى عائدًا، اتفاق مكتوب لتوزيع العوائد، ثم إدارة التطوير والتشغيل.\n\n` +
        `كثير من المشاريع الجيدة تتعثر بعد التسليم لا بسبب البناء، بل بسبب غياب مُشغّل.\n\n${sig}`,
    },
    {
      delayHours: 240,
      channel: "whatsapp",
      render: (l) => `${l.name}، هل ترغب أن نبدأ بالدراسة المبدئية لموقعك؟ تكفينا معلومتان: الموقع والمساحة.`,
    },
  ],
};

export const SEQUENCES: Record<string, Sequence> = {
  [ownersSequence.id]: ownersSequence,
  [partnersSequence.id]: partnersSequence,
};

export function sequenceForTrack(track: "owners" | "partners"): Sequence {
  return track === "partners" ? partnersSequence : ownersSequence;
}
