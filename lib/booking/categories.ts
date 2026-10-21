import { bangkokDateParts, shiftIsoDate } from "@/lib/time";

export type FieldOption = {
  value: string;
  labelEn: string;
  labelTh: string;
  active?: boolean;
};

export type ConditionalField = {
  key: string;
  labelEn: string;
  labelTh: string;
  helpEn?: string;
  helpTh?: string;
  kind: "select" | "date";
  required: boolean;
  options?: FieldOption[];
  showWhen?: { serviceSlugs?: string[] };
};

export type DocumentItem = {
  kind: "original" | "copy" | "example";
  en: string;
  th: string;
  validityEn?: string;
  validityTh?: string;
};

export type DocumentWhen = {
  applicantCategories?: Array<"thai" | "foreign">;
  serviceSlugs?: string[];
  licenceClasses?: string[];
  licenceTypes?: string[];
};

export type DocumentSet = {
  id: string;
  titleEn: string;
  titleTh: string;
  when?: DocumentWhen;
  items: DocumentItem[];
};

export type DressCodeGuidance = {
  titleEn: string;
  titleTh: string;
  noteEn: string;
  noteTh: string;
  itemsEn: string[];
  itemsTh: string[];
};

export type SavedGuidance = {
  id: string;
  titleEn: string;
  titleTh: string;
  items: DocumentItem[];
  dressCode: DressCodeGuidance | null;
};

export type RenewalWindow = {
  maxDaysBeforeExpiry: number;
  maxDaysAfterExpiry: number;
};

export type SlotRules = {
  timezone: "Asia/Bangkok";
  horizonDays: number;
  renewal?: Record<string, RenewalWindow>;
};

export type BookingCategory = {
  slug: string;
  name: string;
  nameTh: string;
  description: string;
  descriptionTh: string;
  icon: string;
  active: boolean;
  sortOrder: number;
  conditionalFields: ConditionalField[];
  documentSets: DocumentSet[];
  eligibleOfficeSlugs: string[];
  vehicleSlugs: string[];
  slotRules: SlotRules;
};

export type GuidanceContext = {
  applicantCategory: string;
  serviceSlug: string;
  licenceClass: string;
  licenceType: string;
};

export type SelectionInput = {
  officeSlug: string;
  officeActive: boolean;
  serviceSlug: string;
  serviceActive: boolean;
  requiresVehicle: boolean;
  category: BookingCategory | null;
  applicantCategory: string;
  categorySlug: string;
  vehicleCategory: string;
  answers: Record<string, string>;
  today: string;
};

export type WizardStepId =
  | "applicantCategory"
  | "office"
  | "category"
  | "service"
  | "vehicle"
  | "questions"
  | "applicant"
  | "documents"
  | "schedule"
  | "review";

const ALL_OFFICES = ["riverside", "canal", "coastal", "campus"];

const baseRules: SlotRules = { timezone: "Asia/Bangkok", horizonDays: 21 };

function item(
  kind: DocumentItem["kind"],
  en: string,
  th: string,
  validityEn?: string,
  validityTh?: string,
): DocumentItem {
  return { kind, en, th, validityEn, validityTh };
}

function renewalRules(): SlotRules {
  return {
    timezone: "Asia/Bangkok",
    horizonDays: 21,
    renewal: {
      temporary: { maxDaysBeforeExpiry: 60, maxDaysAfterExpiry: 0 },
      five_year: { maxDaysBeforeExpiry: 90, maxDaysAfterExpiry: 365 },
    },
  };
}

export const bookingCategorySeed: BookingCategory[] = [
  {
    slug: "new-thai-licence",
    name: "New Thai Driving Licence",
    nameTh: "ใบอนุญาตขับขี่ไทยใหม่",
    description: "First-time demonstration for a car or motorcycle licence. Thai and foreign applicant paths use different sample checklists.",
    descriptionTh: "สาธิตคำขอครั้งแรกสำหรับรถยนต์หรือรถจักรยานยนต์ เส้นทางผู้ขอไทยและต่างชาติใช้รายการตัวอย่างคนละชุด",
    icon: "card",
    active: true,
    sortOrder: 1,
    conditionalFields: [],
    vehicleSlugs: ["car", "motorcycle"],
    eligibleOfficeSlugs: ALL_OFFICES,
    slotRules: baseRules,
    documentSets: [
      {
        id: "new-thai-car",
        titleEn: "Sample checklist — Thai applicant, car",
        titleTh: "รายการตัวอย่าง — ผู้ขอไทย รถยนต์",
        when: { applicantCategories: ["thai"], licenceClasses: ["car"] },
        items: [
          item("original", "Use the synthetic display name from this booking. Do not bring or type a national ID number.", "ใช้ชื่อสมมติจากรายการจองนี้ อย่านำหรือพิมพ์เลขประจำตัวประชาชน"),
          item("example", "A training-certificate example is described here only. This demo does not collect or upload it.", "ตัวอย่างใบผ่านการอบรมเป็นคำอธิบายเท่านั้น ระบบสาธิตนี้ไม่เก็บและไม่ให้อัปโหลด"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
      {
        id: "new-thai-motorcycle",
        titleEn: "Sample checklist — Thai applicant, motorcycle",
        titleTh: "รายการตัวอย่าง — ผู้ขอไทย รถจักรยานยนต์",
        when: { applicantCategories: ["thai"], licenceClasses: ["motorcycle"] },
        items: [
          item("original", "Use the synthetic display name from this booking.", "ใช้ชื่อสมมติจากรายการจองนี้"),
          item("example", "Motorcycle training is a sample topic only. Nothing is uploaded here.", "การอบรมรถจักรยานยนต์เป็นหัวข้อตัวอย่างเท่านั้น ไม่มีการอัปโหลด"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
      {
        id: "new-foreign",
        titleEn: "Sample checklist — foreign applicant",
        titleTh: "รายการตัวอย่าง — ผู้ขอต่างชาติ",
        when: { applicantCategories: ["foreign"] },
        items: [
          item("example", "A stay-permission example may be discussed at a real office. Do not upload a passport, visa, or immigration document here.", "ตัวอย่างเอกสารการพำนักอาจถูกพูดถึงที่สำนักงานจริง อย่าอัปโหลดหนังสือเดินทาง วีซ่า หรือเอกสารตรวจคนเข้าเมืองที่นี่"),
          item("original", "Use a synthetic display name only.", "ใช้เฉพาะชื่อสมมติ"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
      {
        id: "new-general",
        titleEn: "Sample checklist — new Thai licence",
        titleTh: "รายการตัวอย่าง — ใบอนุญาตไทยใหม่",
        items: [
          item("example", "Choose the applicant path and licence class to see one matching checklist.", "เลือกประเภทผู้ขอและชั้นใบอนุญาตเพื่อดูรายการที่ตรงกันหนึ่งชุด"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
    ],
  },
  {
    slug: "foreign-conversion",
    name: "Foreign Licence Conversion",
    nameTh: "แปลงใบอนุญาตต่างประเทศ",
    description: "Practise converting a foreign licence. These answers do not decide legal eligibility.",
    descriptionTh: "ฝึกขั้นตอนแปลงใบอนุญาตต่างประเทศ คำตอบเหล่านี้ไม่ได้ตัดสินสิทธิ์ทางกฎหมาย",
    icon: "globe",
    active: true,
    sortOrder: 2,
    vehicleSlugs: [],
    eligibleOfficeSlugs: ALL_OFFICES,
    slotRules: baseRules,
    conditionalFields: [
      {
        key: "issuingCountry",
        labelEn: "Country that issued the existing licence",
        labelTh: "ประเทศที่ออกใบอนุญาตเดิม",
        helpEn: "Choose a sample country. This does not mean the applicant is legally eligible.",
        helpTh: "เลือกประเทศตัวอย่าง ไม่ได้หมายความว่าผู้ขอมีสิทธิ์ตามกฎหมาย",
        kind: "select",
        required: true,
        options: [
          { value: "japan", labelEn: "Japan", labelTh: "ญี่ปุ่น", active: true },
          { value: "united-kingdom", labelEn: "United Kingdom", labelTh: "สหราชอาณาจักร", active: true },
          { value: "germany", labelEn: "Germany", labelTh: "เยอรมนี", active: true },
          { value: "france", labelEn: "France", labelTh: "ฝรั่งเศส", active: true },
          { value: "australia", labelEn: "Australia", labelTh: "ออสเตรเลีย", active: true },
          { value: "united-states", labelEn: "United States", labelTh: "สหรัฐอเมริกา", active: true },
          { value: "south-korea", labelEn: "South Korea", labelTh: "เกาหลีใต้", active: true },
          { value: "other-demo", labelEn: "Other demonstration country", labelTh: "ประเทศตัวอย่างอื่น", active: true },
        ],
      },
      {
        key: "foreignLicenceClass",
        labelEn: "Existing licence covers",
        labelTh: "ใบอนุญาตเดิมครอบคลุม",
        kind: "select",
        required: true,
        options: [
          { value: "car", labelEn: "Car", labelTh: "รถยนต์", active: true },
          { value: "motorcycle", labelEn: "Motorcycle", labelTh: "รถจักรยานยนต์", active: true },
          { value: "both", labelEn: "Car and motorcycle", labelTh: "รถยนต์และรถจักรยานยนต์", active: true },
        ],
      },
      {
        key: "foreignValid",
        labelEn: "Licence validity in this demo",
        labelTh: "สถานะอายุใบอนุญาตในระบบสาธิต",
        helpEn: "A sample status only. It is not a legal finding.",
        helpTh: "เป็นสถานะตัวอย่างเท่านั้น ไม่ใช่ข้อสรุปทางกฎหมาย",
        kind: "select",
        required: true,
        options: [
          { value: "valid", labelEn: "Currently valid", labelTh: "ยังไม่หมดอายุ", active: true },
          { value: "expired", labelEn: "Expired", labelTh: "หมดอายุแล้ว", active: true },
          { value: "unsure", labelEn: "Not sure", labelTh: "ไม่แน่ใจ", active: true },
        ],
      },
      {
        key: "foreignLanguage",
        labelEn: "Language of the existing licence",
        labelTh: "ภาษาของใบอนุญาตเดิม",
        kind: "select",
        required: true,
        options: [
          { value: "english", labelEn: "English", labelTh: "อังกฤษ", active: true },
          { value: "thai", labelEn: "Thai", labelTh: "ไทย", active: true },
          { value: "other", labelEn: "Another language", labelTh: "ภาษาอื่น", active: true },
        ],
      },
    ],
    documentSets: [
      {
        id: "conversion-translation",
        titleEn: "Sample checklist — translation and foreign licence",
        titleTh: "รายการตัวอย่าง — คำแปลและใบอนุญาตต่างประเทศ",
        when: { licenceClasses: ["car", "motorcycle", "both"] },
        items: [
          item("original", "The foreign licence you already hold may be discussed. Do not type its number.", "อาจพูดถึงใบอนุญาตต่างประเทศที่ถืออยู่ อย่าพิมพ์เลขใบอนุญาต"),
          item(
            "example",
            "If the licence is not in Thai or English, a translation is a sample requirement. This demo does not accept an upload.",
            "หากใบอนุญาตไม่ใช่ภาษาไทยหรืออังกฤษ คำแปลเป็นข้อกำหนดตัวอย่าง ระบบสาธิตนี้ไม่รับไฟล์อัปโหลด",
            "Demo note only — confirm any translation period through official instructions.",
            "เป็นบันทึกสาธิตเท่านั้น โปรดตรวจระยะเวลาของคำแปลจากคำแนะนำทางการ",
          ),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
      {
        id: "conversion-general",
        titleEn: "Sample checklist — foreign licence conversion",
        titleTh: "รายการตัวอย่าง — แปลงใบอนุญาตต่างประเทศ",
        items: [
          item("example", "Answer the sample questions to see the translation note that matches the licence class.", "ตอบคำถามตัวอย่างเพื่อดูบันทึกคำแปลที่ตรงกับชั้นใบอนุญาต"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
    ],
  },
  {
    slug: "thai-renewal",
    name: "Thai Driving Licence Renewal",
    nameTh: "ต่ออายุใบอนุญาตขับขี่ไทย",
    description: "Renew a sample Thai licence. The date window below is a configurable demo rule, not a legal determination.",
    descriptionTh: "ต่ออายุใบอนุญาตไทยตัวอย่าง ช่วงวันที่ด้านล่างเป็นกฎสาธิตที่ปรับได้ ไม่ใช่ข้อกำหนดทางกฎหมาย",
    icon: "refresh",
    active: true,
    sortOrder: 3,
    vehicleSlugs: ["car", "motorcycle"],
    eligibleOfficeSlugs: ALL_OFFICES,
    slotRules: renewalRules(),
    conditionalFields: [
      {
        key: "currentLicenceType",
        labelEn: "Current licence type",
        labelTh: "ประเภทใบอนุญาตปัจจุบัน",
        helpEn: "Temporary and five-year are the options enabled for this demo.",
        helpTh: "ชั่วคราวและห้าปีเป็นตัวเลือกที่เปิดใช้ในระบบสาธิตนี้",
        kind: "select",
        required: true,
        options: [
          { value: "temporary", labelEn: "Temporary", labelTh: "ชั่วคราว", active: true },
          { value: "five_year", labelEn: "Five-year", labelTh: "ห้าปี", active: true },
          { value: "lifetime", labelEn: "Lifetime", labelTh: "ตลอดชีพ", active: false },
        ],
      },
      {
        key: "expiryDate",
        labelEn: "Current expiry date",
        labelTh: "วันหมดอายุปัจจุบัน",
        helpEn: "Use a date. If it sits outside the configured demo window, you can read the warning but not pick a slot.",
        helpTh: "ใส่วันที่ หากอยู่นอกช่วงสาธิตที่ตั้งไว้ จะเห็นคำเตือนและเลือกช่วงเวลาไม่ได้",
        kind: "date",
        required: true,
      },
    ],
    documentSets: [
      {
        id: "renewal-temporary",
        titleEn: "Sample checklist — temporary licence",
        titleTh: "รายการตัวอย่าง — ใบอนุญาตชั่วคราว",
        when: { licenceTypes: ["temporary"] },
        items: [
          item(
            "original",
            "The current temporary licence may be shown at a real counter. Do not type its number.",
            "ใบอนุญาตชั่วคราวปัจจุบันอาจต้องแสดงที่เคาน์เตอร์จริง อย่าพิมพ์เลขใบอนุญาต",
            "Demo window for a temporary licence: expiry within the configured number of days.",
            "ช่วงสาธิตของใบชั่วคราว: วันหมดอายุอยู่ในจำนวนวันที่ตั้งไว้",
          ),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
      {
        id: "renewal-five-year",
        titleEn: "Sample checklist — five-year licence",
        titleTh: "รายการตัวอย่าง — ใบอนุญาตห้าปี",
        when: { licenceTypes: ["five_year"] },
        items: [
          item(
            "original",
            "The current five-year licence may be shown at a real counter. Do not type its number.",
            "ใบอนุญาตห้าปีปัจจุบันอาจต้องแสดงที่เคาน์เตอร์จริง อย่าพิมพ์เลขใบอนุญาต",
            "Demo window for a five-year licence: inside the configured before-and-after expiry days.",
            "ช่วงสาธิตของใบห้าปี: อยู่ในจำนวนวันก่อนและหลังหมดอายุที่ตั้งไว้",
          ),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
      {
        id: "renewal-general",
        titleEn: "Sample checklist — Thai licence renewal",
        titleTh: "รายการตัวอย่าง — ต่ออายุใบอนุญาตไทย",
        items: [
          item("example", "Choose temporary or five-year to see that checklist. Lifetime is turned off in this demo.", "เลือกชั่วคราวหรือห้าปีเพื่อดูรายการนั้น ตัวเลือกตลอดชีพถูกปิดในระบบสาธิตนี้"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
    ],
  },
  {
    slug: "change-or-replace",
    name: "Change or Replace a Licence",
    nameTh: "เปลี่ยนหรือออกใบแทน",
    description: "Change the licence type, replace a lost or damaged card, or update sample details. Individual services can be switched off.",
    descriptionTh: "เปลี่ยนประเภทใบอนุญาต ออกใบแทนกรณีสูญหายหรือชำรุด หรือแก้รายละเอียดตัวอย่าง สามารถปิดบริการย่อยได้",
    icon: "replace",
    active: true,
    sortOrder: 4,
    vehicleSlugs: ["car", "motorcycle"],
    eligibleOfficeSlugs: ALL_OFFICES,
    slotRules: baseRules,
    conditionalFields: [
      {
        key: "replacementReason",
        labelEn: "What happened to the licence",
        labelTh: "เกิดอะไรขึ้นกับใบอนุญาต",
        kind: "select",
        required: true,
        showWhen: { serviceSlugs: ["replace-card"] },
        options: [
          { value: "lost", labelEn: "Lost", labelTh: "สูญหาย", active: true },
          { value: "damaged", labelEn: "Damaged", labelTh: "ชำรุด", active: true },
        ],
      },
      {
        key: "detailToUpdate",
        labelEn: "What should the demo record",
        labelTh: "ให้ระบบสาธิตบันทึกอะไร",
        helpEn: "Only a synthetic display-name note is available. Do not enter an identity number.",
        helpTh: "มีเพียงบันทึกชื่อสมมติ อย่ากรอกเลขประจำตัว",
        kind: "select",
        required: true,
        showWhen: { serviceSlugs: ["update-details"] },
        options: [
          { value: "display-name", labelEn: "Display name spelling", labelTh: "การสะกดชื่อที่แสดง", active: true },
        ],
      },
    ],
    documentSets: [
      {
        id: "change-type",
        titleEn: "Sample checklist — change licence type",
        titleTh: "รายการตัวอย่าง — เปลี่ยนประเภทใบอนุญาต",
        when: { serviceSlugs: ["change-type"] },
        items: [
          item("example", "The vehicle category you choose is the sample target class.", "หมวดยานพาหนะที่เลือกคือชั้นเป้าหมายตัวอย่าง"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
      {
        id: "replace-card",
        titleEn: "Sample checklist — replace a lost or damaged licence",
        titleTh: "รายการตัวอย่าง — ออกใบแทนกรณีสูญหายหรือชำรุด",
        when: { serviceSlugs: ["replace-card"] },
        items: [
          item("example", "A loss report is a real-world topic. This demo does not collect a report or a licence number.", "ใบแจ้งความเป็นเรื่องของโลกจริง ระบบสาธิตนี้ไม่เก็บใบแจ้งความหรือเลขใบอนุญาต"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
      {
        id: "update-details",
        titleEn: "Sample checklist — update details",
        titleTh: "รายการตัวอย่าง — แก้รายละเอียด",
        when: { serviceSlugs: ["update-details"] },
        items: [
          item("example", "Bring only the synthetic display name. Do not write an identity number in the notes.", "นำเฉพาะชื่อสมมติ อย่าเขียนเลขประจำตัวในบันทึก"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
      {
        id: "change-general",
        titleEn: "Sample checklist — change or replace",
        titleTh: "รายการตัวอย่าง — เปลี่ยนหรือออกใบแทน",
        items: [
          item("example", "Pick a reason to see the checklist for that reason only.", "เลือกเหตุผลเพื่อดูรายการของเหตุผลนั้นเท่านั้น"),
        ],
      },
    ],
  },
  {
    slug: "international-permit",
    name: "International Driving Permit",
    nameTh: "ใบอนุญาตขับขี่ระหว่างประเทศ",
    description: "A sample permit visit with one checklist and a vehicle category. Offered at selected demo offices only.",
    descriptionTh: "การติดต่อตัวอย่างสำหรับใบอนุญาตระหว่างประเทศ มีรายการเดียวและหมวดยานพาหนะ เปิดเฉพาะบางสำนักงานสาธิต",
    icon: "permit",
    active: true,
    sortOrder: 5,
    vehicleSlugs: ["car", "motorcycle"],
    eligibleOfficeSlugs: ["riverside", "canal"],
    slotRules: baseRules,
    conditionalFields: [],
    documentSets: [
      {
        id: "idp-checklist",
        titleEn: "Sample checklist — international driving permit",
        titleTh: "รายการตัวอย่าง — ใบอนุญาตขับขี่ระหว่างประเทศ",
        items: [
          item("example", "A current Thai licence is a real-world topic. This demo does not collect the licence number.", "ใบอนุญาตไทยที่ยังใช้ได้เป็นเรื่องของโลกจริง ระบบสาธิตนี้ไม่เก็บเลขใบอนุญาต"),
          item("original", "Photos are not uploaded in this demonstration.", "ระบบสาธิตนี้ไม่ให้อัปโหลดรูป"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้", "Sample note: one confirmation is enough for the demo desk.", "บันทึกตัวอย่าง: ใบยืนยันใบเดียวพอสำหรับโต๊ะสาธิต"),
        ],
      },
    ],
  },
  {
    slug: "other-demo",
    name: "Other Demonstration Services",
    nameTh: "บริการสาธิตอื่น",
    description: "Extra services configured for this desk. Not every transport-office transaction can be reserved here.",
    descriptionTh: "บริการเพิ่มที่ตั้งค่าไว้สำหรับโต๊ะนี้ ไม่ใช่ทุกธุรกรรมของสำนักงานขนส่งจะจองผ่านขั้นตอนนี้ได้",
    icon: "more",
    active: true,
    sortOrder: 6,
    vehicleSlugs: [],
    eligibleOfficeSlugs: ALL_OFFICES,
    slotRules: baseRules,
    conditionalFields: [],
    documentSets: [
      {
        id: "other-checklist",
        titleEn: "Sample checklist — other demonstration services",
        titleTh: "รายการตัวอย่าง — บริการสาธิตอื่น",
        items: [
          item("example", "Only the services listed for this category can be reserved. This is not a full catalogue of official transactions.", "จองได้เฉพาะบริการที่อยู่ในหมวดนี้ ไม่ใช่รายการธุรกรรมทางการทั้งหมด"),
          item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        ],
      },
    ],
  },
];

const defaultRules: SlotRules = { timezone: "Asia/Bangkok", horizonDays: 21 };

export function categoryBySlug(slug: string | null | undefined) {
  if (!slug) return undefined;
  return bookingCategorySeed.find((category) => category.slug === slug);
}

export function categoryToRow(category: BookingCategory) {
  return {
    slug: category.slug,
    name: category.name,
    name_th: category.nameTh,
    description: category.description,
    description_th: category.descriptionTh,
    icon: category.icon,
    active: category.active,
    sort_order: category.sortOrder,
    conditional_fields: category.conditionalFields,
    document_sets: category.documentSets,
    eligible_office_slugs: category.eligibleOfficeSlugs,
    vehicle_slugs: category.vehicleSlugs,
    slot_rules: category.slotRules,
  };
}

export function categoryFromRow(row: Record<string, unknown>): BookingCategory | null {
  const slug = String(row.slug ?? "");
  if (!slug) return null;
  const base = categoryBySlug(slug);
  return {
    slug,
    name: String(row.name ?? base?.name ?? slug),
    nameTh: String(row.name_th ?? base?.nameTh ?? slug),
    description: String(row.description ?? base?.description ?? ""),
    descriptionTh: String(row.description_th ?? base?.descriptionTh ?? ""),
    icon: String(row.icon ?? base?.icon ?? "more"),
    active: row.active !== false,
    sortOrder: Number(row.sort_order ?? base?.sortOrder ?? 0),
    conditionalFields: asFields(row.conditional_fields, base?.conditionalFields ?? []),
    documentSets: asDocumentSets(row.document_sets, base?.documentSets ?? []),
    eligibleOfficeSlugs: stringList(row.eligible_office_slugs, base?.eligibleOfficeSlugs ?? []),
    vehicleSlugs: stringList(row.vehicle_slugs, base?.vehicleSlugs ?? []),
    slotRules: row.slot_rules == null ? (base?.slotRules ?? defaultRules) : asRules(row.slot_rules, base?.slotRules ?? defaultRules),
  };
}

export function activeOptions(field: ConditionalField) {
  return (field.options ?? []).filter((option) => option.active !== false);
}

export function visibleFields(category: BookingCategory | undefined, serviceSlug: string) {
  if (!category) return [];
  return category.conditionalFields.filter((field) => {
    const limit = field.showWhen?.serviceSlugs;
    return !limit?.length || limit.includes(serviceSlug);
  });
}

export function applicableAnswers(category: BookingCategory | undefined, serviceSlug: string, answers: Record<string, string>) {
  const allowed = new Set(visibleFields(category, serviceSlug).map((field) => field.key));
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    const trimmed = value.trim();
    if (allowed.has(key) && trimmed) next[key] = trimmed;
  }
  return next;
}

export function hasConditionalQuestions(category: BookingCategory | undefined, serviceSlug: string) {
  return visibleFields(category, serviceSlug).length > 0;
}

export function buildWizardSteps(input: { requiresVehicle: boolean; hasQuestions: boolean }): WizardStepId[] {
  const steps: WizardStepId[] = ["applicantCategory", "office", "category", "service"];
  if (input.requiresVehicle) steps.push("vehicle");
  if (input.hasQuestions) steps.push("questions");
  steps.push("applicant", "documents", "schedule", "review");
  return steps;
}

export function inferLicenceClass(serviceSlug: string, answers: Record<string, string>, vehicleCategory: string) {
  if (answers.foreignLicenceClass) return answers.foreignLicenceClass;
  if (vehicleCategory === "car" || vehicleCategory === "motorcycle") return vehicleCategory;
  if (serviceSlug.endsWith("-car")) return "car";
  if (serviceSlug.endsWith("-motorcycle")) return "motorcycle";
  return "";
}

const PHYSICAL_TEST_DRESS: DressCodeGuidance = {
  titleEn: "Demo dress code for a sample physical test",
  titleTh: "การแต่งกายตัวอย่างสำหรับการทดสอบสาธิต",
  noteEn:
    "Demo guidance only. Confirm clothing rules with the office you actually visit before a real appointment. This note is not an official instruction.",
  noteTh: "เป็นคำแนะนำสาธิตเท่านั้น โปรดยืนยันกฎการแต่งกายกับสำนักงานที่ไปติดต่อจริงก่อนวันนัด นี่ไม่ใช่คำสั่งทางการ",
  itemsEn: [
    "For this sample physical-test visit, wear a shirt with sleeves.",
    "Wear trousers or a skirt that covers the legs. Shorts are outside this demo note.",
    "Wear shoes that cover the foot. This demo note excludes flip-flops and sandals.",
  ],
  itemsTh: [
    "สำหรับการทดสอบตัวอย่างนี้ ให้ใส่เสื้อมีแขน",
    "ใส่กางเกงขายาวหรือกระโปรงที่คลุมขา กางเกงขาสั้นอยู่นอกบันทึกสาธิตนี้",
    "ใส่รองเท้าที่ปิดเท้า บันทึกสาธิตนี้ไม่รวมรองเท้าแตะ",
  ],
};

export function dressCodeFor(categorySlug: string): DressCodeGuidance | null {
  if (categorySlug === "new-thai-licence") return PHYSICAL_TEST_DRESS;
  return null;
}

export function snapshotGuidance(category: BookingCategory | null, context: GuidanceContext): SavedGuidance {
  if (!category) {
    return {
      id: "demo-general",
      titleEn: "Sample checklist",
      titleTh: "รายการตัวอย่าง",
      dressCode: null,
      items: [
        item("copy", "Print or save this demonstration confirmation.", "พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"),
        item(
          "example",
          "Confirm every requirement through official channels before a real visit.",
          "โปรดตรวจข้อกำหนดผ่านช่องทางทางการก่อนไปติดต่อจริง",
        ),
      ],
    };
  }
  const set = selectDocumentSet(category, context);
  return {
    id: set.id,
    titleEn: set.titleEn,
    titleTh: set.titleTh,
    items: set.items,
    dressCode: dressCodeFor(category.slug),
  };
}

export function parseSavedGuidance(value: unknown): SavedGuidance | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.titleEn !== "string" || typeof record.titleTh !== "string") return null;
  if (!Array.isArray(record.items) || record.items.length === 0) return null;
  const items = record.items.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const itemRecord = entry as Record<string, unknown>;
    const kind = itemRecord.kind;
    if (kind !== "original" && kind !== "copy" && kind !== "example") return [];
    if (typeof itemRecord.en !== "string" || typeof itemRecord.th !== "string") return [];
    return [
      {
        kind,
        en: itemRecord.en,
        th: itemRecord.th,
        validityEn: typeof itemRecord.validityEn === "string" ? itemRecord.validityEn : undefined,
        validityTh: typeof itemRecord.validityTh === "string" ? itemRecord.validityTh : undefined,
      } satisfies DocumentItem,
    ];
  });
  if (items.length === 0) return null;
  return {
    id: record.id,
    titleEn: record.titleEn,
    titleTh: record.titleTh,
    items,
    dressCode: parseDressCode(record.dressCode),
  };
}

function parseDressCode(value: unknown): DressCodeGuidance | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const itemsEn = textList(record.itemsEn);
  const itemsTh = textList(record.itemsTh);
  if (
    typeof record.titleEn !== "string" ||
    typeof record.titleTh !== "string" ||
    typeof record.noteEn !== "string" ||
    typeof record.noteTh !== "string" ||
    itemsEn.length === 0 ||
    itemsTh.length === 0
  ) {
    return null;
  }
  return {
    titleEn: record.titleEn,
    titleTh: record.titleTh,
    noteEn: record.noteEn,
    noteTh: record.noteTh,
    itemsEn,
    itemsTh,
  };
}

function textList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function selectDocumentSet(category: BookingCategory, context: GuidanceContext) {
  let best = category.documentSets[0];
  let bestScore = -1;
  for (const set of category.documentSets) {
    const score = matchScore(set.when, context);
    if (score > bestScore) {
      best = set;
      bestScore = score;
    }
  }
  if (bestScore < 0) {
    return category.documentSets.find((set) => matchScore(set.when, context) === 0) ?? category.documentSets[0];
  }
  return best;
}

export function evaluateRenewal(category: BookingCategory, answers: Record<string, string>, today: string) {
  if (!category.slotRules.renewal) return { state: "not_applicable" as const };
  const licenceType = answers.currentLicenceType ?? "";
  const window = category.slotRules.renewal[licenceType];
  if (!licenceType || !window) return { state: "missing" as const };
  const expiry = answers.expiryDate ?? "";
  if (!isIsoDate(expiry)) return { state: "invalid_date" as const };
  const days = daysBetween(today, expiry);
  if (days > window.maxDaysBeforeExpiry || days < -window.maxDaysAfterExpiry) return { state: "outside" as const };
  return { state: "ok" as const };
}

export function describeRenewalRules(rules: SlotRules, locale: "en" | "th") {
  const temporary = rules.renewal?.temporary;
  const fiveYear = rules.renewal?.five_year;
  if (!temporary || !fiveYear) return "";
  if (locale === "th") {
    return `ในระบบสาธิตนี้ ใบชั่วคราวจองได้เมื่อหมดอายุภายใน ${temporary.maxDaysBeforeExpiry} วัน ใบห้าปีจองได้เมื่อหมดอายุภายใน ${fiveYear.maxDaysBeforeExpiry} วัน หรือหมดอายุมาแล้วไม่เกิน ${fiveYear.maxDaysAfterExpiry} วัน นี่คือกฎสาธิตที่ปรับได้ ไม่ใช่ข้อกำหนดทางกฎหมาย`;
  }
  return `In this demonstration, a temporary licence can be booked only when it expires within ${temporary.maxDaysBeforeExpiry} days. A five-year licence can be booked when it expires within ${fiveYear.maxDaysBeforeExpiry} days, or when it expired no more than ${fiveYear.maxDaysAfterExpiry} days ago. This is a configurable demonstration rule, not a legal determination.`;
}

export function isWithinHorizon(isoDate: string, today: string, horizonDays: number) {
  if (isoDate < today) return false;
  return isoDate <= shiftIsoDate(today, horizonDays);
}

export function validateSelection(input: SelectionInput) {
  const errors: Record<string, string> = {};
  const category = input.category;
  if (input.applicantCategory !== "thai" && input.applicantCategory !== "foreign") {
    errors.applicantCategory = "applicant_required";
  }
  if (!input.officeActive) errors.officeId = "slot_unavailable";
  if (!input.serviceActive) errors.serviceId = "slot_unavailable";
  if (category && !category.active) errors.categorySlug = "category_inactive";
  if (input.categorySlug && category && input.categorySlug !== category.slug) errors.categorySlug = "category_mismatch";
  if (input.categorySlug && !category) errors.categorySlug = "category_mismatch";
  if (category && category.eligibleOfficeSlugs.length && !category.eligibleOfficeSlugs.includes(input.officeSlug)) {
    errors.officeId = "office_ineligible";
  }
  if (input.requiresVehicle) {
    if (!input.vehicleCategory) errors.vehicleCategory = "vehicle_required";
    else if (category && category.vehicleSlugs.length && !category.vehicleSlugs.includes(input.vehicleCategory)) {
      errors.vehicleCategory = "vehicle_required";
    }
  }

  const answers = category
    ? applicableAnswers(category, input.serviceSlug, input.answers)
    : cleanLooseAnswers(input.answers, errors);

  if (category) {
    for (const field of visibleFields(category, input.serviceSlug)) {
      const value = answers[field.key] ?? "";
      if (field.required && !value) errors[field.key] = field.kind === "date" ? "date_invalid" : "answer_required";
      if (value && field.kind === "date" && !isIsoDate(value)) errors[field.key] = "date_invalid";
      if (value && field.options) {
        const option = field.options.find((item) => item.value === value);
        if (!option || option.active === false) errors[field.key] = "answer_required";
      }
      if (value && looksLikeGovernmentNumber(value)) errors[field.key] = "no_government_id";
    }
    const renewal = evaluateRenewal(category, answers, input.today);
    if (renewal.state === "outside") errors.expiryDate = "renewal_window";
    if (renewal.state === "invalid_date") errors.expiryDate = "date_invalid";
    if (renewal.state === "missing" && !errors.currentLicenceType && !errors.expiryDate) {
      errors.currentLicenceType = "answer_required";
    }
  }

  return { ok: Object.keys(errors).length === 0, answers, fieldErrors: errors };
}

export function answerLabel(category: BookingCategory | undefined, key: string, value: string, locale: "en" | "th") {
  const field = category?.conditionalFields.find((item) => item.key === key);
  const option = field?.options?.find((item) => item.value === value);
  return {
    label: field ? (locale === "th" ? field.labelTh : field.labelEn) : key,
    value: option ? (locale === "th" ? option.labelTh : option.labelEn) : value,
  };
}

export function stringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const answers: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") answers[key] = entry;
  }
  return answers;
}

export function todayBangkok(now = new Date()) {
  return bangkokDateParts(now).isoDate;
}

function cleanLooseAnswers(answers: Record<string, string>, errors: Record<string, string>) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (looksLikeGovernmentNumber(trimmed)) errors[key] = "no_government_id";
    else next[key] = trimmed;
  }
  return next;
}

function looksLikeGovernmentNumber(value: string) {
  return /\d{9,}/.test(value.replace(/[\s-]/g, ""));
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function daysBetween(today: string, expiry: string) {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${expiry}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}

function matchScore(when: DocumentWhen | undefined, context: GuidanceContext) {
  if (!when || !hasConstraint(when)) return 0;
  let score = 0;
  if (when.applicantCategories?.length) {
    if (context.applicantCategory !== "thai" && context.applicantCategory !== "foreign") return -1;
    if (!when.applicantCategories.includes(context.applicantCategory)) return -1;
    score += 4;
  }
  if (when.serviceSlugs?.length) {
    if (!when.serviceSlugs.includes(context.serviceSlug)) return -1;
    score += 4;
  }
  if (when.licenceClasses?.length) {
    if (!context.licenceClass || !when.licenceClasses.includes(context.licenceClass)) return -1;
    score += 2;
  }
  if (when.licenceTypes?.length) {
    if (!context.licenceType || !when.licenceTypes.includes(context.licenceType)) return -1;
    score += 2;
  }
  return score;
}

function hasConstraint(when: DocumentWhen) {
  return Boolean(when.applicantCategories?.length || when.serviceSlugs?.length || when.licenceClasses?.length || when.licenceTypes?.length);
}

function stringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value.map(String);
}

function asFields(value: unknown, fallback: ConditionalField[]): ConditionalField[] {
  if (!Array.isArray(value)) return fallback;
  if (value.length === 0) return [];
  const fields = value.flatMap((entry) => parseField(entry));
  return fields.length ? fields : fallback;
}

function parseField(entry: unknown): ConditionalField[] {
  if (!entry || typeof entry !== "object") return [];
  const field = entry as Record<string, unknown>;
  if (typeof field.key !== "string" || (field.kind !== "select" && field.kind !== "date")) return [];
  const showWhenRecord = field.showWhen && typeof field.showWhen === "object" ? (field.showWhen as Record<string, unknown>) : undefined;
  return [
    {
      key: field.key,
      labelEn: String(field.labelEn ?? field.key),
      labelTh: String(field.labelTh ?? field.key),
      helpEn: field.helpEn ? String(field.helpEn) : undefined,
      helpTh: field.helpTh ? String(field.helpTh) : undefined,
      kind: field.kind,
      required: field.required !== false,
      options: Array.isArray(field.options) ? field.options.flatMap((option) => parseOption(option)) : undefined,
      showWhen: showWhenRecord
        ? { serviceSlugs: Array.isArray(showWhenRecord.serviceSlugs) ? showWhenRecord.serviceSlugs.map(String) : undefined }
        : undefined,
    },
  ];
}

function parseOption(entry: unknown): FieldOption[] {
  if (!entry || typeof entry !== "object") return [];
  const option = entry as Record<string, unknown>;
  if (typeof option.value !== "string") return [];
  return [
    {
      value: option.value,
      labelEn: String(option.labelEn ?? option.value),
      labelTh: String(option.labelTh ?? option.value),
      active: option.active !== false,
    },
  ];
}

function asDocumentSets(value: unknown, fallback: DocumentSet[]): DocumentSet[] {
  if (!Array.isArray(value)) return fallback;
  if (value.length === 0) return [];
  const sets = value.flatMap((entry) => parseDocumentSet(entry));
  return sets.length ? sets : fallback;
}

function parseDocumentSet(entry: unknown): DocumentSet[] {
  if (!entry || typeof entry !== "object") return [];
  const set = entry as Record<string, unknown>;
  if (typeof set.id !== "string" || !Array.isArray(set.items)) return [];
  const when = set.when && typeof set.when === "object" ? (set.when as DocumentWhen) : undefined;
  return [
    {
      id: set.id,
      titleEn: String(set.titleEn ?? set.id),
      titleTh: String(set.titleTh ?? set.id),
      when,
      items: set.items.flatMap((item) => parseDocumentItem(item)),
    },
  ];
}

function parseDocumentItem(entry: unknown): DocumentItem[] {
  if (!entry || typeof entry !== "object") return [];
  const item = entry as Record<string, unknown>;
  if (item.kind !== "original" && item.kind !== "copy" && item.kind !== "example") return [];
  return [
    {
      kind: item.kind,
      en: String(item.en ?? ""),
      th: String(item.th ?? ""),
      validityEn: item.validityEn ? String(item.validityEn) : undefined,
      validityTh: item.validityTh ? String(item.validityTh) : undefined,
    },
  ];
}

function asRules(value: unknown, fallback: SlotRules): SlotRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const horizonDays = Number(record.horizonDays ?? fallback.horizonDays);
  let renewal: SlotRules["renewal"];
  if (record.renewal && typeof record.renewal === "object" && !Array.isArray(record.renewal)) {
    renewal = {};
    for (const [key, window] of Object.entries(record.renewal as Record<string, unknown>)) {
      if (!window || typeof window !== "object") continue;
      const item = window as Record<string, unknown>;
      renewal[key] = {
        maxDaysBeforeExpiry: Number(item.maxDaysBeforeExpiry ?? 0),
        maxDaysAfterExpiry: Number(item.maxDaysAfterExpiry ?? 0),
      };
    }
  }
  return {
    timezone: "Asia/Bangkok",
    horizonDays: Number.isFinite(horizonDays) ? horizonDays : fallback.horizonDays,
    renewal,
  };
}
