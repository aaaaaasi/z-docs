/**
 * zh translations for the stats feature group (writing studio · 写作历程).
 * Keys are the exact English source strings used in components.
 */
export const dictStats: Record<string, string> = {
  /* writing studio shell (writing-studio.tsx) */
  "Writing studio": "写作工作室",
  "Writing studio tabs": "写作工作室标签页",
  "Writing journey": "写作历程",
  "Writing insights": "写作心得",

  /* metric card titles */
  "Total words": "总字数",
  "Effective writing time": "有效写作时间",
  "Writing sessions": "写作次数",
  "Average speed": "平均写作速度",
  "Thinking pauses": "思考停顿",
  "Total edits": "总编辑次数",
  "Words per edit": "字数与修改次数比率",
  "Paste share": "粘贴比例",

  /* metric values */
  "≈{n} words": "≈{n} 字",
  "{n} chars/min": "{n} 字/分钟",
  "{n} words/min": "{n} 词/分钟",
  "Total {duration}": "共 {duration}",
  "{h}h {m}m {s}s": "{h} 小时 {m} 分 {s} 秒",
  "{m}m {s}s": "{m} 分 {s} 秒",
  "{s}s": "{s} 秒",

  /* tooltips */
  "Only counts time while you are actually typing — pauses are excluded.":
    "仅统计实际击键时间，不含停顿",
  "A gap of more than 30 minutes starts a new writing session.":
    "间隔超过 30 分钟记为一次新的写作环节",
  "Based on your own typing only — pasted text is excluded.":
    "仅按亲自输入的内容计算，粘贴不计入速度",
  "Pauses longer than 5 seconds while writing.": "写作过程中超过 5 秒的停顿",
  "Number of saved changes since the first version.": "首个版本之后已保存的更改次数",
  "A lower number means more frequent revisions.": "数字越低说明修改越频繁",
  "Share of characters inserted by pasting.": "通过粘贴插入的字符占比",

  /* empty state */
  "Start writing and your journey will appear here.": "开始写作后，这里会展示你的写作历程。",
}
