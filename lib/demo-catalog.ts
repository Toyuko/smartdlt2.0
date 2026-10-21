import { SAMPLE_GUIDANCE_NOTE } from "@/lib/demo-notice";

const guidance = (items: { en: string; th: string }[]) => ({
  summary_en: SAMPLE_GUIDANCE_NOTE,
  summary_th:
    "รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ",
  items,
});

export const vehicleCategorySeed = [
  { slug: "car", name: "Car", name_th: "รถยนต์", sort_order: 1 },
  { slug: "motorcycle", name: "Motorcycle", name_th: "รถจักรยานยนต์", sort_order: 2 },
  { slug: "other", name: "Other demo category", name_th: "หมวดสาธิตอื่น", sort_order: 3 },
];

export const officeSeed = [
  {
    slug: "riverside",
    name: "SmartDLT2.0 Riverside Demo",
    name_th: "SmartDLT2.0 สาขาสาธิตริมน้ำ",
    province: "Chiang Mai",
    province_th: "เชียงใหม่",
    demo_label: "Demo location — not an official DLT office",
  },
  {
    slug: "canal",
    name: "SmartDLT2.0 Canal Demo",
    name_th: "SmartDLT2.0 สาขาสาธิตคลอง",
    province: "Bangkok",
    province_th: "กรุงเทพมหานคร",
    demo_label: "Demo location — not an official DLT office",
  },
  {
    slug: "coastal",
    name: "SmartDLT2.0 Coastal Demo",
    name_th: "SmartDLT2.0 สาขาสาธิตชายฝั่ง",
    province: "Phuket",
    province_th: "ภูเก็ต",
    demo_label: "Demo location — not an official DLT office",
  },
  {
    slug: "campus",
    name: "SmartDLT2.0 Campus Demo",
    name_th: "SmartDLT2.0 สาขาสาธิตวิทยาเขต",
    province: "Khon Kaen",
    province_th: "ขอนแก่น",
    demo_label: "Demo location — not an official DLT office",
  },
];

const categoryChecklist = guidance([
  {
    en: "Follow the single checklist for the booking category you select. This service does not add another requirement list.",
    th: "ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด",
  },
]);

export const serviceSeed = [
  {
    slug: "new-car",
    name: "First-time application — car",
    name_th: "คำขอครั้งแรก — รถยนต์",
    category: "new-thai-licence",
    category_th: "ใบอนุญาตขับขี่ไทยใหม่",
    requires_vehicle: false,
    sort_order: 1,
    active: true,
    document_guidance: categoryChecklist,
  },
  {
    slug: "new-motorcycle",
    name: "First-time application — motorcycle",
    name_th: "คำขอครั้งแรก — รถจักรยานยนต์",
    category: "new-thai-licence",
    category_th: "ใบอนุญาตขับขี่ไทยใหม่",
    requires_vehicle: false,
    sort_order: 2,
    active: true,
    document_guidance: categoryChecklist,
  },
  {
    slug: "renewal-car",
    name: "Renewal — car",
    name_th: "ต่ออายุ — รถยนต์",
    category: "thai-renewal",
    category_th: "ต่ออายุใบอนุญาตขับขี่ไทย",
    requires_vehicle: false,
    sort_order: 3,
    active: true,
    document_guidance: categoryChecklist,
  },
  {
    slug: "renewal-motorcycle",
    name: "Renewal — motorcycle",
    name_th: "ต่ออายุ — รถจักรยานยนต์",
    category: "thai-renewal",
    category_th: "ต่ออายุใบอนุญาตขับขี่ไทย",
    requires_vehicle: false,
    sort_order: 4,
    active: true,
    document_guidance: categoryChecklist,
  },
  {
    slug: "conversion",
    name: "Convert a foreign licence",
    name_th: "แปลงใบอนุญาตต่างประเทศ",
    category: "foreign-conversion",
    category_th: "แปลงใบอนุญาตต่างประเทศ",
    requires_vehicle: false,
    sort_order: 5,
    active: true,
    document_guidance: categoryChecklist,
  },
  {
    slug: "change-type",
    name: "Change licence type",
    name_th: "เปลี่ยนประเภทใบอนุญาต",
    category: "change-or-replace",
    category_th: "เปลี่ยนหรือออกใบแทน",
    requires_vehicle: true,
    sort_order: 6,
    active: true,
    document_guidance: categoryChecklist,
  },
  {
    slug: "replace-card",
    name: "Replace a lost or damaged licence",
    name_th: "ออกใบแทนกรณีสูญหายหรือชำรุด",
    category: "change-or-replace",
    category_th: "เปลี่ยนหรือออกใบแทน",
    requires_vehicle: false,
    sort_order: 7,
    active: true,
    document_guidance: categoryChecklist,
  },
  {
    slug: "update-details",
    name: "Update details",
    name_th: "แก้รายละเอียด",
    category: "change-or-replace",
    category_th: "เปลี่ยนหรือออกใบแทน",
    requires_vehicle: false,
    sort_order: 8,
    active: true,
    document_guidance: categoryChecklist,
  },
  {
    slug: "class-upgrade",
    name: "Upgrade a licence class",
    name_th: "เพิ่มชั้นใบอนุญาต",
    category: "change-or-replace",
    category_th: "เปลี่ยนหรือออกใบแทน",
    requires_vehicle: true,
    sort_order: 9,
    active: false,
    document_guidance: categoryChecklist,
  },
  {
    slug: "idp",
    name: "International driving permit",
    name_th: "ใบอนุญาตขับขี่ระหว่างประเทศ",
    category: "international-permit",
    category_th: "ใบอนุญาตขับขี่ระหว่างประเทศ",
    requires_vehicle: true,
    sort_order: 10,
    active: true,
    document_guidance: categoryChecklist,
  },
  {
    slug: "vehicle-counter",
    name: "Vehicle counter demonstration",
    name_th: "สาธิตเคาน์เตอร์ยานพาหนะ",
    category: "other-demo",
    category_th: "บริการสาธิตอื่น",
    requires_vehicle: true,
    sort_order: 11,
    active: true,
    document_guidance: categoryChecklist,
  },
  {
    slug: "general-counter",
    name: "General counter demonstration",
    name_th: "สาธิตเคาน์เตอร์ทั่วไป",
    category: "other-demo",
    category_th: "บริการสาธิตอื่น",
    requires_vehicle: false,
    sort_order: 12,
    active: true,
    document_guidance: categoryChecklist,
  },
];

export const SAMPLE_REFERENCES = {
  confirmed: "VD-SAMP-CONF",
  checkedIn: "VD-SAMP-CHKD",
  completed: "VD-SAMP-DONE",
  cancelled: "VD-SAMP-CANC",
  expired: "VD-SAMP-EXPR",
} as const;

export const SLOT_PERIODS = [
  ["08:30", "09:30"],
  ["09:30", "10:30"],
  ["13:00", "14:00"],
  ["14:00", "15:00"],
] as const;

export const SLOT_CAPACITY = 4;
