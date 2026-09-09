/**
 * zh translations for the insights feature group (写作心得 / writing studio).
 * Keys are the exact English source strings used in components +
 * engine-returned label keys (writing-insights.ts) + the writing-studio
 * dialog titles. Owned exclusively by this feature group.
 */
export const dictInsights: Record<string, string> = {
  // ——— writing studio dialog (titles live here; the tab file is frozen) ———
  "Writing studio": "写作工作室",
  "Writing studio tabs": "写作工作室标签页",
  "Writing journey": "写作历程",
  "Writing insights": "写作心得",

  // ——— shared ———
  "This document is empty — start writing and insights will appear here.":
    "文档为空，开始写作后这里会展示分析。",
  "Click a sentence to locate it in the document.": "点击句子可在文档中定位。",

  // ——— overview ———
  "Overview": "总览",
  "Sentences": "句子",
  "Words": "字数",
  "Paragraphs": "段落数",
  "Avg. sentence length": "平均句长",
  "{n} words": "{n} 词",
  "{n} chars": "{n} 字",

  // ——— 1. text complexity ———
  "Text complexity": "文本复杂性",
  "Chinese": "中文",
  "Flesch–Kincaid": "弗莱士-金凯德",
  "Suitable for grade {grade}": "适合 {grade} 年级",
  "/ 100 · {band}": "/ 100 · {band}",
  "Beginner": "入门",
  "Easy": "偏易",
  "Moderate": "适中",
  "Challenging": "偏难",
  "Very challenging": "高难",
  "Reading-level estimate — scores have no good or bad, they only hint at how complex the text is. (Flesch–Kincaid readability test.)":
    "阅读难度估计——分数没有优劣，仅提示文章的复杂程度。（弗莱士-金凯德可读性测试。）",
  "Chinese difficulty estimate — scores have no good or bad, they only hint at how complex the text is. Weighted from average sentence length, rare-character rate and the share of very long sentences.":
    "中文难度估计——分数没有优劣，仅提示文章的复杂程度。（由平均句长、生僻字率与超长句占比加权得出。）",
  "Chinese difficulty is driven mainly by sentence length — past 30 chars per sentence it rises sharply, past 40 it is almost always hard.":
    "中文难度主要由句长决定——句长超过 30 字难度明显上升，超过 40 字几乎必然偏难。",

  // ——— 2. vocabulary diversity ———
  "Vocabulary diversity": "词汇多样性",
  "{pct}% unique words": "{pct}% 独特词",
  "{pct}% unique word forms": "独特词形 {pct}%",
  "Unique words as a share of all words (type-token ratio).":
    "独特词占全部词的比例（类符形符比）。",
  "Unique word forms as a share of all word forms — Chinese is approximated with character-pair (bigram) types, a type-token ratio.":
    "独特词形占全部词形的比例（中文以相邻二字组合近似计算，即类符形符比）。",

  // ——— 3. sentence lengths ———
  "Sentence lengths": "句子长度",
  "How sentences distribute across length bands.": "句子在各长度区间的分布。",
  "Short (≤5 words)": "短句（≤5 词）",
  "Medium (6–14 words)": "中句（6–14 词）",
  "Long (15–25 words)": "长句（15–25 词）",
  "Very long (>25 words)": "超长句（>25 词）",
  "Short (≤15 chars)": "短句（≤15 字）",
  "Medium (16–30 chars)": "中句（16–30 字）",
  "Long (31–40 chars)": "长句（31–40 字）",
  "Very long (>40 chars)": "超长句（>40 字）",

  // ——— 4. sentence rhythm ———
  "Sentence rhythm": "句子节奏",
  "One bar per sentence — height is word count. Hover or click a bar to locate the sentence in the document.":
    "每句一根柱，高度为词数。悬停或点击柱条可在文档中定位该句。",
  "Sentence {n} · {w} words": "第 {n} 句 · {w} 词",
  "Sentence {n} · {w} chars": "第 {n} 句 · {w} 字",
  "Showing first 120 sentences": "已显示前 120 句",

  // ——— 5. paragraph density ———
  "Paragraph density": "段落密度",
  "Each dot is a paragraph, colored by reading density. Hover to locate it in the document.":
    "每个圆点代表一个段落，颜色表示阅读密度。悬停可在文档中定位该段。",
  "Paragraph {n} · {label}": "第 {n} 段 · {label}",
  "Simple": "简单",
  "Medium": "中等",
  "Complex": "复杂",
  "Dense": "密集",

  // ——— 6. sentence openers ———
  "Sentence openers": "句子开头",
  "What kinds of words your sentences start with.": "句子以哪类词开头。",
  "Pronoun": "代词",
  "Article": "冠词",
  "Conjunction": "连词",
  "Other": "其他",

  // ——— 7. passive voice ———
  "Passive voice": "被动语态",
  "Be-verb + past participle. Fine in moderation — worth a look if it piles up.":
    "be 动词 + 过去分词。适度使用没有问题，堆积时值得留意。",
  "Chinese passive markers (被 / 受到 / 遭到 / 为…所…). Fine in moderation — worth a look if it piles up.":
    "中文被动式（被、受到、遭到、为…所 等标志）。适度使用没有问题，堆积时值得留意。",
  "{n} sentences": "{n} 句",
  "{pct}% of sentences": "{pct}% 的句子",
  "No passive constructions detected": "未检测到被动结构",

  // ——— 8. adverbs ———
  "Adverbs": "副词",
  "{n} per 1,000 words": "每千词 {n} 次",
  "-ly adverbs and 地-adverbials. Great for nuance, easy to overuse.":
    "以 -ly 结尾的副词与「地」字短语。擅长细微差别，也容易被滥用。",
  "Chinese adverbs (非常、十分、特别… and 地-adverbials). Great for nuance, easy to overuse.":
    "中文高频副词（非常、十分、特别 等）与「地」字短语。擅长细微差别，也容易被滥用。",
  "No adverbs detected": "未检测到副词",

  // ——— 9. word frequency ———
  "Word frequency": "词频",
  "Most repeated content words (stopwords excluded).": "重复最多的内容词（已排除停用词）。",
  "Most repeated content word groups — Chinese pairs adjacent characters into word-like groups (stopwords excluded).":
    "重复最多的内容词与高频二字词组（已排除停用词）。",
  "Not enough repeated words yet": "重复的词还不够多",

  // ——— 10. word echo ———
  "Word echo": "词语回声",
  "{n} echoes": "{n} 次回声",
  "Adjacent sentences that share content words — can read as an intentional refrain or as an accidental echo.":
    "相邻句子共享内容词——可能读起来像刻意的呼应，也可能像无意的回声。",
  "Shared words": "共享词",
  "No echoes between adjacent sentences": "相邻句子之间没有回声",

  // ——— 11. repeated phrases ———
  "Repeated phrases": "重复的短语",
  "Phrases of 2–6 words appearing 3+ times.": "出现 3 次及以上的 2–6 词短语。",
  "No phrase repeats 3+ times": "没有重复 3 次及以上的短语",

  // ——— 12. dialogue balance ———
  "Dialogue balance": "对话平衡",
  "{pct}% dialogue": "对话 {pct}%",
  "Share of characters inside quotes vs. narration.": "引号内字符与旁白的占比。",
  "Dialogue": "对话",
  "Narration": "旁白",
  "Sentences with quotes": "含引号的句子",
  "No dialogue detected": "未检测到对话",

  // ——— 13. point of view ———
  "Point of view": "观点看法",
  "The person each sentence is told from (first marker wins).":
    "每句话叙述的人称（以最先出现的标志为准）。",
  "First person": "第一人称",
  "Second person": "第二人称",
  "Third person": "第三人称",

  // ——— 14. punctuation habits (labels come from the engine) ———
  "Punctuation habits": "标点符号习惯",
  "How often each mark appears per 1,000 words.": "各种标点每千词的出现频率。",
  "Exclamation marks": "感叹号",
  "Question marks": "问号",
  "Semicolons": "分号",
  "Colons": "冒号",
  "Dashes": "破折号",
  "Enumeration commas": "顿号",
  "Periods": "句号",
  "Ellipses": "省略号",
  "Quotation marks": "引号",
  "Parentheses": "括号",
  "No notable punctuation habits": "暂无明显的标点习惯",

  // ——— live insights sidebar (Ellipsus-style right rail) ———
  "Analyzing…": "分析中…",
  "Live": "实时",
  "Close writing insights": "关闭写作洞察",
  "Show writing insights": "显示写作洞察",
  "Hide writing insights": "隐藏写作洞察",
}
