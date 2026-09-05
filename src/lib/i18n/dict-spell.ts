/**
 * zh translations for the spell feature group.
 * Keys are the exact English source strings used in components.
 */
export const dictSpell: Record<string, string> = {
  // dialog chrome
  "Spelling and grammar check": "拼写和语法检查",
  "Spelling and grammar check…": "拼写和语法检查…",
  "Scanning spelling, grammar, punctuation and style": "正在扫描拼写、语法、标点与风格",
  "Check failed": "检查失败",
  "Found {n} issues": "发现 {n} 处问题",
  "All flagged issues are fixed": "发现的问题已全部修正",
  "No spelling or grammar issues found": "未发现拼写或语法问题",
  "Only the first 12,000 characters were checked": "已检查前 12,000 个字符",
  "Your document reads clean.": "文档读起来很干净。",
  "Click the bold text to locate it in the document": "点击粗体原文可在文档中定位该处",

  // checking state
  "Checking your document…": "正在检查文档…",

  // issue cards
  "Spelling": "拼写",
  "Grammar": "语法",
  "Punctuation": "标点",
  "Style": "风格",
  "Jump to this issue in the document": "在文档中定位此问题",
  "Fix": "修正",
  "Ignore": "忽略",
  "Fix this issue": "修正此问题",
  "Ignore this issue": "忽略此问题",

  // footer / progress
  "Recheck": "重新检查",
  "Fix all": "全部修正",
  "Fixed {n} · {m} remaining": "已修正 {n} 处 · 剩余 {m} 处",
  "Fixing {i} of {total}…": "正在修正第 {i}/{total} 处…",

  // toasts
  "Fixed": "已修正",
  "Fixed {n} issues": "已修正 {n} 处问题",
  "Fixed {n} of {total} issues": "已修正 {n} 处（共 {total} 处）",
  "Couldn't find this text in the document": "无法在文档中找到该文本",
  "The document may have changed since the check — try a recheck.":
    "检查后文档可能已修改，请重新检查。",
  "Something went wrong": "出现了一些问题",

  // errors (429 / 502 / network)
  "Too many requests — wait a moment and try again shortly.": "请求过于频繁，请稍后再试。",
  "The AI service is unavailable right now.": "AI 服务目前不可用。",
  "Retry": "重试",
}
