/**
 * zh translations for the sheets component group.
 * Owned by the sheets i18n subagent — append entries, do not remove others.
 * Keys are the exact English source strings used in components.
 * Note: strings shared by BOTH Z-Sheets and Z-Slides (tabs, trash/copy/star
 * actions, copy titles) live here since dictSheets merges before dictSlides.
 */
export const dictSheets: Record<string, string> = {
  /* ---------- shared tabs / filters / actions (sheets + slides) ---------- */
  "All": "全部",
  "Trash is empty": "回收站为空",
  "Move to trash": "移至回收站",
  "Moved to trash": "已移至回收站",
  "Remove star": "移除星标",
  "Add star": "添加星标",
  "Make a copy": "创建副本",
  "Rename failed": "重命名失败",
  "edited {time}": "{time}编辑",
  "Copy of {title}": "{title} 的副本",
  "Delete “{title}” forever?": "永久删除“{title}”？",
  "It may have been deleted.": "它可能已被删除。",
  "Something went wrong": "出错了",

  /* ---------- sheets list ---------- */
  "Filter spreadsheets": "筛选电子表格",
  "No spreadsheets yet": "还没有电子表格",
  "Create a spreadsheet to get started.": "创建一个电子表格，开始使用吧。",
  "No matching spreadsheets": "没有匹配的电子表格",
  "Nothing matches “{q}”.": "没有与“{q}”匹配的内容。",
  "Clear search": "清除搜索",
  "No starred spreadsheets": "暂无已加星标的电子表格",
  "Star a spreadsheet to keep it close at hand.": "给电子表格加星标，方便随时取用。",
  "Deleted spreadsheets will appear here before they're gone forever.":
    "已删除的电子表格在被永久清除前会显示在这里。",
  "New spreadsheet": "新建电子表格",
  "New": "新建",
  "Back to Z-Docs": "返回 Z-Docs",
  "Search spreadsheets": "搜索电子表格",
  "All spreadsheets": "全部电子表格",
  "1 spreadsheet": "1 个电子表格",
  "{n} spreadsheets": "{n} 个电子表格",
  "This can't be undone. The spreadsheet and everything in it will be permanently removed.":
    "此操作无法撤销。该电子表格及其全部内容将被永久删除。",
  "Deleted forever": "已永久删除",
  "“{title}” is gone.": "“{title}”已被删除。",

  /* ---------- sheet card ---------- */
  "Open spreadsheet {title}": "打开电子表格 {title}",
  "Rename spreadsheet": "重命名电子表格",
  "1 cell": "1 个单元格",
  "{n} cells": "{n} 个单元格",
  "Unstar spreadsheet": "取消电子表格星标",
  "Star spreadsheet": "为电子表格加星标",
  "More actions for {title}": "“{title}”的更多操作",
  "“{title}” can be restored from Trash.": "“{title}”可以从回收站恢复。",

  /* ---------- sheet editor ---------- */
  "Spreadsheet title": "电子表格标题",
  "Rename spreadsheet (current: {title})": "重命名电子表格（当前：{title}）",
  "Unable to save": "无法保存",
  "All changes saved to Z-Drive": "所有更改已保存到 Z-Drive",
  "Active cell {ref}": "当前单元格 {ref}",
  "Enter a value or formula, e.g. =SUM(A1:A5)": "输入值或公式，例如 =SUM(A1:A5)",
  "Formula input": "公式输入",
  "Sum: {n}": "求和：{n}",
  "Avg: {n}": "平均值：{n}",
  "Count: {n}": "计数：{n}",
  "Sheet1 · {rows} rows × {cols} cols": "Sheet1 · {rows} 行 × {cols} 列",
  "Back to spreadsheets": "返回电子表格列表",
  "Spreadsheet menu": "电子表格菜单",
  "More": "更多",
  "Find spreadsheet in list": "在列表中查找该电子表格",

  /* ---------- toolbar ---------- */
  "Formatting toolbar": "格式工具栏",
  "Fill color": "填充颜色",
  "Fill": "填充",
  "Fill {hex}": "填充 {hex}",
  "None": "无",
  "Undo (Ctrl+Z)": "撤销（Ctrl+Z）",
  "Redo (Ctrl+Y)": "重做（Ctrl+Y）",
  "Bold (selection)": "加粗（所选内容）",
  "Italic (selection)": "斜体（所选内容）",
  "Align left": "左对齐",
  "Align center": "居中对齐",
  "Align right": "右对齐",
  "Clear formatting (selection)": "清除格式（所选内容）",

  /* ---------- grid ---------- */
  "Select column {col}": "选择 {col} 列",
  "Select row {n}": "选择第 {n} 行",
  "Edit cell {ref}": "编辑单元格 {ref}",
  "Select all cells": "全选所有单元格",
  "Spreadsheet grid": "电子表格网格",

  /* ---------- store / autosave (tForLang) ---------- */
  "Untitled spreadsheet": "无标题电子表格",
  "Couldn't create spreadsheet": "无法创建电子表格",
  "Please try again.": "请重试。",
  "Couldn't open spreadsheet": "无法打开电子表格",
  "Failed to load spreadsheets ({status})": "加载电子表格失败（{status}）",
  "Spreadsheet copied": "已创建电子表格副本",
  "“{title}” is ready.": "“{title}”已就绪。",
  "Couldn't copy spreadsheet": "无法复制电子表格",
  "Couldn't save spreadsheet": "无法保存电子表格",
  "Your changes are still here — try editing again.": "你的更改仍在，请再次编辑以重试。",
  "Find it under the Trash filter to restore.": "可在“回收站”标签下找到并恢复。",
}
