// Dùng chung cho trang (server) và thanh chọn kỳ (client): không đặt trong file "use client"
export const PRESETS = {
  month: "Tháng này",
  "last-month": "Tháng trước",
  "30d": "30 ngày",
  "90d": "90 ngày",
  year: "Năm nay",
} as const;

export type Preset = keyof typeof PRESETS;
