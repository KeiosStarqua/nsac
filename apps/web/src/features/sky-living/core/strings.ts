export const strings = {
  en: {
    simulated: "Simulated data",
    membraneTitle: "Decision membrane",
    selectNode: "Select measurement",
  },
  vi: {
    simulated: "Dữ liệu mô phỏng",
    membraneTitle: "Màng quyết định",
    selectNode: "Chọn chỉ số",
  },
} as const;

export type CoreStrings = (typeof strings)["en"];