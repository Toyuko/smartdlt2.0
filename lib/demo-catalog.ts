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
    name: "Violet Desk Riverside Demo",
    name_th: "ไวโอเล็ตเดสก์ สาขาสาธิตริมน้ำ",
    province: "Chiang Mai",
    province_th: "เชียงใหม่",
    demo_label: "Demo location — not an official DLT office",
  },
  {
    slug: "canal",
    name: "Violet Desk Canal Demo",
    name_th: "ไวโอเล็ตเดสก์ สาขาสาธิตคลอง",
    province: "Bangkok",
    province_th: "กรุงเทพมหานคร",
    demo_label: "Demo location — not an official DLT office",
  },
  {
    slug: "coastal",
    name: "Violet Desk Coastal Demo",
    name_th: "ไวโอเล็ตเดสก์ สาขาสาธิตชายฝั่ง",
    province: "Phuket",
    province_th: "ภูเก็ต",
    demo_label: "Demo location — not an official DLT office",
  },
  {
    slug: "campus",
    name: "Violet Desk Campus Demo",
    name_th: "ไวโอเล็ตเดสก์ สาขาสาธิตวิทยาเขต",
    province: "Khon Kaen",
    province_th: "ขอนแก่น",
    demo_label: "Demo location — not an official DLT office",
  },
];

export const serviceSeed = [
  {
    slug: "new-car",
    name: "New licence demonstration — car",
    name_th: "สาธิตใบอนุญาตใหม่ — รถยนต์",
    category: "new_licence",
    category_th: "ใบอนุญาตขับขี่ใหม่",
    requires_vehicle: true,
    sort_order: 1,
    document_guidance: guidance([
      { en: "Bring this demonstration confirmation.", th: "นำใบยืนยันของระบบสาธิตนี้มาด้วย" },
      { en: "Use the display name from the booking. Do not write an ID number in the notes.", th: "ใช้ชื่อที่แสดงในการจอง อย่าเขียนเลขประจำตัวในช่องบันทึก" },
    ]),
  },
  {
    slug: "new-motorcycle",
    name: "New licence demonstration — motorcycle",
    name_th: "สาธิตใบอนุญาตใหม่ — รถจักรยานยนต์",
    category: "new_licence",
    category_th: "ใบอนุญาตขับขี่ใหม่",
    requires_vehicle: true,
    sort_order: 2,
    document_guidance: guidance([
      { en: "Bring this demonstration confirmation.", th: "นำใบยืนยันของระบบสาธิตนี้มาด้วย" },
    ]),
  },
  {
    slug: "renewal-car",
    name: "Renewal demonstration — car",
    name_th: "สาธิตการต่ออายุ — รถยนต์",
    category: "renewal",
    category_th: "ต่ออายุใบอนุญาตขับขี่",
    requires_vehicle: true,
    sort_order: 3,
    document_guidance: guidance([
      { en: "This demo accepts any open future slot. A real renewal window is different and must be checked officially.", th: "ระบบสาธิตนี้รับวันในอนาคตที่ยังว่าง ช่วงเวลาต่ออายุจริงแตกต่างออกไปและต้องตรวจจากช่องทางทางการ" },
      { en: "Bring the display name used for the booking.", th: "นำชื่อที่แสดงที่ใช้จองมาด้วย" },
    ]),
  },
  {
    slug: "renewal-motorcycle",
    name: "Renewal demonstration — motorcycle",
    name_th: "สาธิตการต่ออายุ — รถจักรยานยนต์",
    category: "renewal",
    category_th: "ต่ออายุใบอนุญาตขับขี่",
    requires_vehicle: true,
    sort_order: 4,
    document_guidance: guidance([
      { en: "This demo accepts any open future slot.", th: "ระบบสาธิตนี้รับวันในอนาคตที่ยังว่าง" },
    ]),
  },
  {
    slug: "conversion",
    name: "Foreign licence conversion demonstration",
    name_th: "สาธิตการแปลงใบอนุญาตต่างประเทศ",
    category: "conversion",
    category_th: "แปลงใบอนุญาตต่างประเทศ",
    requires_vehicle: true,
    sort_order: 5,
    document_guidance: guidance([
      { en: "Do not upload or type a passport or licence number. This demo stores a display name only.", th: "อย่าอัปโหลดหรือพิมพ์เลขหนังสือเดินทางหรือใบอนุญาต ระบบสาธิตนี้เก็บเพียงชื่อที่แสดง" },
    ]),
  },
  {
    slug: "vehicle-counter",
    name: "Vehicle counter demonstration",
    name_th: "สาธิตเคาน์เตอร์ยานพาหนะ",
    category: "vehicle",
    category_th: "บริการเกี่ยวกับยานพาหนะ",
    requires_vehicle: true,
    sort_order: 6,
    document_guidance: guidance([
      { en: "Choose a demo vehicle category. No registration plate is collected.", th: "เลือกหมวดยานพาหนะสาธิต ระบบนี้ไม่เก็บเลขทะเบียน" },
    ]),
  },
  {
    slug: "general-counter",
    name: "General counter demonstration",
    name_th: "สาธิตเคาน์เตอร์ทั่วไป",
    category: "other",
    category_th: "บริการสาธิตอื่น",
    requires_vehicle: false,
    sort_order: 7,
    document_guidance: guidance([
      { en: "No documents are collected by this demo. Ask an official office what a real visit requires.", th: "ระบบสาธิตนี้ไม่เก็บเอกสาร โปรดสอบถามหน่วยงานทางการว่าการติดต่อจริงต้องใช้อะไร" },
    ]),
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
