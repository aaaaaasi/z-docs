/**
 * 写作心得 analysis engine (Ellipsus-style, 15 metrics) — pure functions.
 * No React, no i18n: every user-facing string the engine returns is an
 * ENGLISH SOURCE KEY that the UI translates with t().
 *
 * Mixed zh/en handling:
 * - Sentences end at 。！？!? … and "." (guarded against decimals like 3.14 and
 *   common abbreviations like Dr./e.g.), plus newlines; runs of terminators
 *   ("?!", "...", "……") and glued closers (”」』）) are swallowed into one break.
 * - Tokenization: maximal Latin letter runs (incl. apostrophe/hyphen words)
 *   are words; every CJK char ([\u4e00-\u9fff]) counts as one word.
 */

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

export interface TextComplexity {
  /** Flesch–Kincaid grade (en) or weighted sentence-length estimate (zh). */
  grade: number
  /** English source key: "Suitable for grade {grade}" (translated by the UI). */
  label: string
  isCJK: boolean
}

export interface LengthBucket {
  count: number
  pct: number
}

export interface SentenceLengths {
  short: LengthBucket
  medium: LengthBucket
  long: LengthBucket
  veryLong: LengthBucket
}

export interface RhythmSentence {
  sentence: string
  wordCount: number
}

export type DensityScore = "simple" | "medium" | "complex" | "dense"

export interface ParagraphDensityItem {
  text: string
  score: DensityScore
}

export interface SentenceOpeners {
  pronoun: number
  article: number
  conjunction: number
  other: number
}

export interface PassiveVoiceResult {
  /** number of be-verb + participle constructions */
  count: number
  /** deduped sentences containing at least one */
  sentences: string[]
}

export interface AdverbsResult {
  count: number
  per1000: number
  /** unique adverbs (lowercased latin / raw zh 地-phrases), first 60 */
  words: string[]
}

export interface FrequencyWord {
  word: string
  count: number
}

export interface EchoPair {
  a: string
  b: string
  shared: string[]
}

export interface WordEchoResult {
  /** adjacent sentence pairs sharing ≥1 content item */
  count: number
  /** first 12 examples */
  pairs: EchoPair[]
}

export interface RepeatedPhrase {
  phrase: string
  count: number
}

export interface DialogueBalanceResult {
  dialoguePct: number
  narrationPct: number
  dialogueSentences: string[]
}

export interface PointOfViewResult {
  first: number
  second: number
  third: number
  total: number
  examples: { first: string[]; second: string[]; third: string[] }
}

export interface PunctuationHabit {
  char: string
  /** English source key translated by the UI */
  label: string
  per1000: number
}

export interface SummaryResult {
  sentences: number
  words: number
  paragraphs: number
  avgSentenceLen: number
}

export interface InsightsResult {
  summary: SummaryResult
  textComplexity: TextComplexity
  /** type-token ratio in percent */
  vocabDiversity: number
  sentenceLengths: SentenceLengths
  sentenceRhythm: RhythmSentence[]
  paragraphDensity: ParagraphDensityItem[]
  sentenceOpeners: SentenceOpeners
  passiveVoice: PassiveVoiceResult
  adverbs: AdverbsResult
  wordFrequency: FrequencyWord[]
  wordEcho: WordEchoResult
  repeatedPhrases: RepeatedPhrase[]
  dialogueBalance: DialogueBalanceResult
  pointOfView: PointOfViewResult
  punctuationHabits: PunctuationHabit[]
}

// ---------------------------------------------------------------------------
// Tokenization (mixed zh/en)
// ---------------------------------------------------------------------------

const CJK_RE = /[\u4e00-\u9fff]/
const TOKEN_RE = /[A-Za-z]+(?:['\u2019-][A-Za-z]+)*|[\u4e00-\u9fff]/g
const SENTENCE_WORD_RE = /[A-Za-z0-9\u4e00-\u9fff]/

function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? []
}

function isLatinToken(token: string): boolean {
  return !CJK_RE.test(token)
}

const r1 = (x: number): number => Math.round(x * 10) / 10

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

// ---------------------------------------------------------------------------
// Sentence splitting
// ---------------------------------------------------------------------------

/** 。！？!? … */
const TERMINATORS = new Set(["\u3002", "\uff01", "\uff1f", "!", "?", "\u2026"])
/** closers that may be glued to the end of a finished sentence */
const TRAILING_CLOSERS = new Set([
  "\u201d", "\u2019", "\u300d", "\u300f", "\uff09", "\uff5d", "\u3011", "]", ")", '"', "'",
])

const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g", "i.e",
  "fig", "no", "inc", "ltd", "co", "dept", "univ", "approx", "al", "u.s", "u.k", "u.s.a",
])

/**
 * Does `buf` (which already ends with the candidate char) end a sentence?
 * next1/next2 are the two chars that follow in the source text.
 */
function endsSentence(buf: string, next1: string, next2: string): boolean {
  const ch = buf[buf.length - 1]
  if (ch === undefined) return false
  if (TERMINATORS.has(ch)) return true
  if (ch !== ".") return false
  const prev = buf[buf.length - 2] ?? ""
  if (/[0-9]/.test(prev) && /[0-9]/.test(next1)) return false // 3.14
  const m = /([A-Za-z][A-Za-z.]*)$/.exec(buf)
  if (m) {
    const candidate = m[1].replace(/\.+$/, "").toLowerCase()
    if (ABBREVIATIONS.has(candidate)) return false
    // first dot of "e.g." / "i.e."
    if (candidate === "e" && next1 === "g" && next2 === ".") return false
    if (candidate === "i" && next1 === "e" && next2 === ".") return false
  }
  return true
}

function isPlainPeriod(text: string, j: number): boolean {
  const prev = text[j - 1] ?? ""
  const next = text[j + 1] ?? ""
  return !(prev >= "0" && prev <= "9" && next >= "0" && next <= "9")
}

function splitSentences(text: string): string[] {
  const out: string[] = []
  let buf = ""
  const push = () => {
    const s = buf.trim()
    buf = ""
    if (s && SENTENCE_WORD_RE.test(s)) out.push(s)
  }
  const n = text.length
  let i = 0
  while (i < n) {
    const ch = text[i]
    if (ch === "\n" || ch === "\r") {
      push()
      i++
      continue
    }
    buf += ch
    if (endsSentence(buf, text[i + 1] ?? "", text[i + 2] ?? "")) {
      // swallow terminator runs ("?!", "...", "。……") and glued closers (”」』）
      let j = i + 1
      while (j < n) {
        const c = text[j]
        if (c === "\n" || c === "\r") break
        const isTerm = TERMINATORS.has(c) || (c === "." && isPlainPeriod(text, j))
        if (!isTerm && !TRAILING_CLOSERS.has(c)) break
        buf += c
        j++
      }
      push()
      i = j
      continue
    }
    i++
  }
  push()
  return out
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => SENTENCE_WORD_RE.test(p))
}

// ---------------------------------------------------------------------------
// Stopwords / common characters
// ---------------------------------------------------------------------------

const EN_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "of", "is",
  "are", "was", "were", "it", "that", "this", "with", "as", "for", "his",
  "her", "they", "he", "she", "we", "you", "i", "not", "be", "have", "has",
  "had", "do", "does", "did", "will", "would", "can", "could",
])

const ZH_STOPWORDS = new Set(
  "的了在是和也不有就这那都而及与或但把被从对为以于等个一们中上下里还会要能着过很更最再又才只已并".split("")
)

function isStopword(token: string): boolean {
  const t = token.toLowerCase()
  return EN_STOPWORDS.has(t) || ZH_STOPWORDS.has(t)
}

/** Frequently-used simplified characters — everything else counts as "rare". */
const COMMON_ZH = new Set(
  (
    "的了在是和也不有就这那都而及与或但把被从对为以于等个一们中上下里还会要能着过很更最再又才只已并" +
    "的一是了我在人有他这上们来到时地大为子中你说生国年着就那和要出也得里后自以会家可下而过天去能对小多然于心学么之都好起发当没成只如事把还用第样道想作种开美总从情己面最女但现前些所同日手又行方动头经长儿回位分爱老因很给名法间知什次使身者被高已亲其进此话与活正感见明问力理点文几定本公特做外孩相西果走将月十向声车全信重三机工物气每并别真打太新比才书部水像眼等体加电主界门利海受听表少代员先口由写安性马光白或住难望教命花结乐色更东神记处让直字场平报友关放张认接告入笑内军候民岁往何度山觉路带万男边风解叫金快原吃变通师立数四失满战远士音轻目条呢病始达深完今提求清王化空业思切非找片罗钱语喜离飞科言干约各指合反题该论交终林请医晚制传读强专件助史图管跟志似够包怕苦尽饭连端识热谈复河单价树块备需需操务整步织决温压置院差答久负除随演买江弱节宿消底卡犯版弄雨讨态尘迫念击式沿省伤曲秋城功习喊检映收境若液桥社租败背孔镇尺护麦福略掉派准酸雷印滑甚笔稳留宜圆粒朗例困免革显紧须杂称互培木火虫鱼鸟龙凤虎猫狗竹梅兰菊柳荷湖海洋岛屿乡村街道楼房纸笔琴棋书画诗舞戏剧影电视电脑网络电话手机衣服鞋帽饭菜茶酒米蔬果草树日月星云雪雷电虹春夏早午晚夜晨秒左右北短高近慢旧坏干湿冷温暖冻露霜雾雹闪亮黑暗红橙黄绿紫灰粉银铜铁钢塑橡绳叉勺筷碗盘锅杯壶瓶罐桶盒袋箱桌椅柜沙发窗户墙板梁梯教室校老师同课作业考试问答练习阅读翻译记忆想象情绪哀惊悲幸福疲劳渴睡醒梦希望愿目标计划安排始毕继续停休玩旅购跑步爬球康疾诊治预疫脉搏呼吸消血液皮骨肉脑经五耳朵鼻嘴巴舌牙齿眉指臂腿脚肩背胸肚脏肝肺肾肠祖亲戚邻铺市银邮餐咖宾机场站汽架领户顾员工司企业研科程技员青幼婴类微菌毒然环污保节约源煤炭太阳风力核历政经体艺美哲宗律制策规准量数价成本利润收支储投费供需竞合功败机会挑困难题解方答案原结影意义值观念建批评表扬鼓赞否肯选决断推辑析综概归纳演戏证据事真虚假对错非善恶丑爱恨离合生死存衰退攻进来去现消生展变化提降低升降涨跌波平稳称均匀简繁易困能像仅且仿另此包括组成构造成导致引起产带予帮安慰同情谅解忘起思念恋热讨厌愤怒开心伤害怕担心紧焦辛劳放松觉洗脸牙宵锻身减眠熬准迟到退请毕业入升分数绩排名竞赛获赢挫折坚持努奋斗拼勇坚强软敏感细粗认真的仔细小心谨慎大胆冒危意外故损伤建设修理拆制造生加工设计发研究探索明创造改善复习预练训指导教育培成长熟衰老年轻幼小稚嫩纯单沉含蓄直接坦率委婉礼粗温错丰贫穷富贵穷强健康快乐自由平凡特别普通一般通常偶尔经常常常时时渐渐慢迅速快急缓匆忙悠闲安静闹热热闹拥挤旷宽窄巨微庞精粗糙滑陋华丽朴素优雅俗典" +
    "森鸣忽座屋灯她看默谁浓土肥沃它吗叹吧守啊呀哦唉嗯嘛哟咦嘻嘿哇脸掌拳唇颈膝肘趾筋肤慌张迟昨晴阴冰净脏乱齐整买卖费赚亏款账据票券折贵便宜债贷巷厅顶锁钥匙凳被枕席垫裙袜围线针扣键屏铝藤胶玻瓦泥沙尘烟浊浅斜尖钝锐厚薄巨零根片团堆列群众姓龄念忆幻影像曲奏弹吹唱瞧瞅瞥嗅尝舔咬嚼吞咽饱醉哈欠咳痒残瘦胖壮愈药疗检查验证诊断症患染苗宿奶爷婆媳丈夫妻恋婚嫁娶独孤伴愁烦忧虑惧恐怖惊吓傻疯呆笨聪慧智愚雅偏差误恰准确略详顺倒正反侧旁边缘际限界端始末终径途轨迹象况景境遇场合适舒畅快意满足欲求索获报损息租税捐项资产珍稀闻著称声誉荣耻辱羞愧傲谦温良慈严苛勤勉劲乏顿沉浮流浪潮涌退起坐蹲跪爬滚跳奔追赶逃躲避隐藏显现没逝衰钟柜亮暗纱衬衫裤鞋帽坏垂挂披裹甩拧掰搅拌切剁削缝绣编织拆洗晒晾扫擦抹掸掸搂抱搀扶拉拽推挤靠依偎趴仰俯卧蜷缩僵硬瘫麻酸痒痛疼晕眩胀腹泻秘便秘尿屎屁屁嗝噎呛咳嗽喘呕吐沫涕唾涎沫泡珠球蛋卵胎胚婴幼雏崽爪蹄角尾巴羽翼翅翎壳鳞甲壳细胞纤维氨基酸蛋白质脂肪糖淀粉维量元素钙铁锌硒碘钠钾镁磷硫氯氢氧氮碳硅铜铅汞镭"
  ).split("")
)

function zhRareRate(tokens: string[]): number {
  let total = 0
  let rare = 0
  for (const tk of tokens) {
    if (!CJK_RE.test(tk)) continue
    total++
    if (!COMMON_ZH.has(tk)) rare++
  }
  return total > 0 ? rare / total : 0
}

// ---------------------------------------------------------------------------
// 1. Text complexity
// ---------------------------------------------------------------------------

const LABEL_SUITABLE_GRADE = "Suitable for grade {grade}"

function countSyllables(word: string): number {
  const w = word.toLowerCase()
  if (!/^[a-z]+$/.test(w)) return 1
  if (w.length <= 3) return 1
  // silent trailing e (table/sea keep theirs)
  const base = /e$/.test(w) && !/(le|ee|ye)$/.test(w) ? w.slice(0, -1) : w
  const groups = base.match(/[aeiouy]+/g)
  return Math.max(1, groups ? groups.length : 1)
}

function computeTextComplexity(tokens: string[], sentences: string[]): TextComplexity {
  if (tokens.length === 0) return { grade: 0, label: LABEL_SUITABLE_GRADE, isCJK: true }
  const latinTokens = tokens.filter(isLatinToken)
  const isCJK = latinTokens.length / tokens.length <= 0.5
  if (isCJK) {
    // weighted estimate: avg sentence length (chars count as words) + rare-char rate
    const avgLen = sentences.length > 0 ? tokens.length / sentences.length : tokens.length
    const grade = avgLen * 1.0 + zhRareRate(tokens) * 15
    return { grade: r1(clamp(grade, 1, 16)), label: LABEL_SUITABLE_GRADE, isCJK: true }
  }
  // Flesch–Kincaid grade level
  const wps = sentences.length > 0 ? latinTokens.length / sentences.length : latinTokens.length
  const syllables = latinTokens.reduce((s, w) => s + countSyllables(w), 0)
  const spw = latinTokens.length > 0 ? syllables / latinTokens.length : 1
  const grade = 0.39 * wps + 11.8 * spw - 15.59
  return { grade: r1(clamp(grade, 1, 20)), label: LABEL_SUITABLE_GRADE, isCJK: false }
}

// ---------------------------------------------------------------------------
// 2. Vocabulary diversity
// ---------------------------------------------------------------------------

function computeVocabDiversity(tokens: string[]): number {
  if (tokens.length === 0) return 0
  const uniq = new Set(tokens.map((t) => t.toLowerCase()))
  return r1((uniq.size / tokens.length) * 100)
}

// ---------------------------------------------------------------------------
// 3. Sentence lengths / 4. sentence rhythm
// ---------------------------------------------------------------------------

function computeSentenceLengths(sentences: string[]): SentenceLengths {
  const counts = { short: 0, medium: 0, long: 0, veryLong: 0 }
  for (const s of sentences) {
    const wc = tokenize(s).length
    if (wc <= 5) counts.short++
    else if (wc <= 14) counts.medium++
    else if (wc <= 25) counts.long++
    else counts.veryLong++
  }
  const total = sentences.length
  const pct = (c: number): number => (total > 0 ? r1((c / total) * 100) : 0)
  return {
    short: { count: counts.short, pct: pct(counts.short) },
    medium: { count: counts.medium, pct: pct(counts.medium) },
    long: { count: counts.long, pct: pct(counts.long) },
    veryLong: { count: counts.veryLong, pct: pct(counts.veryLong) },
  }
}

// ---------------------------------------------------------------------------
// 5. Paragraph density
// ---------------------------------------------------------------------------

function computeParagraphDensity(text: string): ParagraphDensityItem[] {
  const out: ParagraphDensityItem[] = []
  for (const para of splitParagraphs(text)) {
    const sentences = splitSentences(para)
    const tokens = tokenize(para)
    if (sentences.length === 0 || tokens.length === 0) continue
    const avgSentenceLen = tokens.length / sentences.length
    const latinTokens = tokens.filter(isLatinToken)
    const latinRatio = latinTokens.length / tokens.length
    let weight: number
    if (latinRatio > 0.5) {
      // long latin words raise the load
      const avgWordLen =
        latinTokens.reduce((s, t) => s + t.length, 0) / Math.max(1, latinTokens.length)
      weight = clamp(avgWordLen / 4.7, 0.6, 1.8)
    } else {
      // rescale CJK chars (≈1.8 chars/word) + rare-char complexity
      weight = 0.55 * (1 + zhRareRate(tokens) * 2)
    }
    const load = avgSentenceLen * weight
    const score: DensityScore =
      load < 7 ? "simple" : load < 13 ? "medium" : load < 20 ? "complex" : "dense"
    out.push({ text: para, score })
  }
  return out
}

// ---------------------------------------------------------------------------
// 6. Sentence openers
// ---------------------------------------------------------------------------

const OPENER_PRONOUNS_EN = new Set([
  "i", "you", "he", "she", "it", "we", "they", "my", "his", "her", "our", "their",
])
const OPENER_ARTICLES_EN = new Set(["a", "an", "the"])
const OPENER_CONJUNCTIONS_EN = new Set([
  "and", "but", "or", "so", "yet", "for", "nor", "because", "although", "while", "when",
])
const OPENER_PRONOUNS_ZH = [
  "我们", "你们", "他们", "她们", "它们", "我的", "你的", "他的", "我", "你", "他", "她", "它",
]
const OPENER_CONJUNCTIONS_ZH = [
  "所以", "因为", "虽然", "然而", "不过", "于是", "然后", "如果", "而", "但", "或",
]
const OPENER_STRIP_RE = /^[\s"'\u201c\u2018\u300c\u300e\uff08(\u3010[\u00b7\u2014\u2013\u2026-]+/

type OpenerKind = keyof SentenceOpeners

function classifyOpener(sentence: string): OpenerKind {
  const stripped = sentence.replace(OPENER_STRIP_RE, "")
  const first = tokenize(stripped)[0]
  if (first === undefined) return "other"
  if (isLatinToken(first)) {
    const w = first.toLowerCase()
    if (OPENER_PRONOUNS_EN.has(w)) return "pronoun"
    if (OPENER_ARTICLES_EN.has(w)) return "article"
    if (OPENER_CONJUNCTIONS_EN.has(w)) return "conjunction"
    return "other"
  }
  if (OPENER_PRONOUNS_ZH.some((p) => stripped.startsWith(p))) return "pronoun"
  if (OPENER_CONJUNCTIONS_ZH.some((p) => stripped.startsWith(p))) return "conjunction"
  return "other"
}

function computeSentenceOpeners(sentences: string[]): SentenceOpeners {
  const out: SentenceOpeners = { pronoun: 0, article: 0, conjunction: 0, other: 0 }
  for (const s of sentences) out[classifyOpener(s)]++
  return out
}

// ---------------------------------------------------------------------------
// 7. Passive voice (English)
// ---------------------------------------------------------------------------

const BE_VERBS = new Set(["is", "are", "was", "were", "been", "being", "am", "be"])
const IRREGULAR_PARTICIPLES = new Set([
  "done", "gone", "seen", "known", "taken", "given", "made", "found", "thought",
  "told", "said", "put", "set", "kept", "left", "sent", "brought", "built",
  "bought", "caught", "taught", "written", "driven", "eaten", "fallen", "felt",
  "fought", "held", "hurt", "paid", "read", "run", "sold", "spent", "sung",
  "sat", "slept", "stood", "struck", "swum", "torn", "thrown", "won", "worn",
  "broken", "chosen", "drawn", "forgotten", "hidden", "shown", "spoken",
  "stolen", "born", "cut", "hit", "lost", "met", "shut", "beaten", "become",
  "begun", "bent", "bitten", "blown", "dealt", "dug", "fed", "fled", "flung",
  "ground", "laid", "led", "lit", "meant", "risen", "shaken", "shot", "spread",
  "stuck", "stung", "sunk", "swept", "understood", "woven", "misheard",
  "overseen", "redone", "rewritten", "undone",
])
/** -ed words that are NOT participles after a be-verb */
const ED_NOT_PARTICIPLE = new Set([
  "indeed", "sacred", "wicked", "ragged", "wretched", "hundred", "speed",
  "seed", "feed", "need", "bed",
])
const PASSIVE_SKIPS = new Set([
  "not", "never", "always", "often", "already", "just", "still", "also",
  "probably", "clearly", "really", "being",
])

function isPassiveParticiple(word: string): boolean {
  if (IRREGULAR_PARTICIPLES.has(word)) return true
  if (ED_NOT_PARTICIPLE.has(word)) return false
  return /ed$/.test(word) && word.length >= 4
}

function computePassiveVoice(sentences: string[]): PassiveVoiceResult {
  let count = 0
  const hits: string[] = []
  for (const sentence of sentences) {
    const tokens = tokenize(sentence).filter(isLatinToken).map((t) => t.toLowerCase())
    if (tokens.length < 2) continue
    let found = false
    for (let i = 0; i < tokens.length - 1; i++) {
      if (!BE_VERBS.has(tokens[i])) continue
      // allow one skip word: "was not finished" / "is often praised"
      let j = i + 1
      if (j + 1 < tokens.length && PASSIVE_SKIPS.has(tokens[j])) j++
      if (isPassiveParticiple(tokens[j])) {
        count++
        found = true
      }
    }
    if (found) hits.push(sentence)
  }
  return { count, sentences: hits }
}

// ---------------------------------------------------------------------------
// 8. Adverbs
// ---------------------------------------------------------------------------

/** -ly words that are nouns/adjectives, not adverbs */
const LY_NON_ADVERBS = new Set([
  "family", "holiday", "monopoly", "italy", "july", "rally", "alley", "jelly",
  "belly", "holly", "lily", "folly", "gully", "silly", "holy", "ugly",
  "supply", "reply", "apply", "imply", "comply", "rely", "multiply", "bully",
  "anomaly", "assembly", "cavalry", "friendly", "lovely", "lonely", "costly",
  "elderly", "cowardly", "orderly", "chilly", "wily", "hilly", "gravelly",
])

/** zh "X地" phrases that are nouns (the 地 is part of the word) */
const ZH_DE_BLOCKLIST = [
  "土地", "大地", "天地", "田地", "菜地", "场地", "基地", "领地", "湿地", "荒地",
  "用地", "当地", "本地", "腹地", "盆地", "高地", "谷地", "平地", "圣地", "洼地",
  "产地", "工地", "墓地", "驻地", "目的", "扫地", "种地", "下地", "实地", "余地",
  "福地", "草地", "林地", "耕地", "占地", "故地", "异地", "营地", "阵地", "胜地",
  "山地", "旱地", "各地", "两地", "一地", "心地", "宅地", "空地", "绿地",
]
/** chars that, when preceding 地, mark a prepositional phrase, not an adverb */
const ZH_DE_PRECEDING_BLOCK = new Set("在到从向往于就是这那".split(""))
/** 地-initial nouns (地图、地方…) — 地 preceded by a CJK char and followed by these is not an adverb */
const ZH_AFTER_DI_BLOCK = new Set(
  "图方球址区铁上下面板步位带壳狱道雷窖毯契租瓜砖摊基界矿产形势理利籍名点类样色貌".split("")
)
const ZH_DE_RE = /([\u4e00-\u9fff]{1,2}\u5730)(?=[\u4e00-\u9fffA-Za-z])/g

function matchZhDeAdverbs(text: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  ZH_DE_RE.lastIndex = 0
  while ((m = ZH_DE_RE.exec(text)) !== null) {
    const phrase = m[1]
    const stem = phrase.slice(0, -1)
    if (ZH_DE_BLOCKLIST.some((w) => phrase.endsWith(w))) continue
    const after = text[m.index + m[0].length] ?? ""
    if (ZH_AFTER_DI_BLOCK.has(after)) continue
    let blocked = false
    for (const c of ZH_DE_PRECEDING_BLOCK) {
      if (stem.endsWith(c)) {
        blocked = true
        break
      }
    }
    if (blocked) continue
    out.push(phrase)
  }
  return out
}

function computeAdverbs(text: string, tokens: string[]): AdverbsResult {
  const seen = new Set<string>()
  let count = 0
  for (const tk of tokens) {
    if (!isLatinToken(tk)) continue
    const w = tk.toLowerCase()
    if (w.length >= 4 && w.endsWith("ly") && !LY_NON_ADVERBS.has(w)) {
      count++
      seen.add(w)
    }
  }
  for (const phrase of matchZhDeAdverbs(text)) {
    count++
    seen.add(phrase)
  }
  const per1000 = tokens.length > 0 ? r1((count / tokens.length) * 1000) : 0
  return { count, per1000, words: [...seen].slice(0, 60) }
}

// ---------------------------------------------------------------------------
// 9. Word frequency
// ---------------------------------------------------------------------------

function computeWordFrequency(tokens: string[]): FrequencyWord[] {
  const counts = new Map<string, number>()
  for (const tk of tokens) {
    if (isLatinToken(tk) && tk.length < 2) continue
    const key = tk.toLowerCase()
    if (isStopword(key)) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 10)
    .map(([word, c]) => ({ word, count: c }))
}

// ---------------------------------------------------------------------------
// 10. Word echo (adjacent sentences)
// ---------------------------------------------------------------------------

function latinContentSet(sentence: string): Set<string> {
  const set = new Set<string>()
  for (const tk of tokenize(sentence)) {
    if (!isLatinToken(tk)) continue
    const w = tk.toLowerCase()
    if (w.length >= 2 && !EN_STOPWORDS.has(w)) set.add(w)
  }
  return set
}

function cjkRunsOf(sentence: string): string[] {
  return sentence.match(/[\u4e00-\u9fff]+/g) ?? []
}

/**
 * Maximal shared CJK substrings (≥2 chars, not all stopwords) between two
 * sentences — the zh counterpart of a shared content word.
 */
function sharedCjkRuns(a: string, b: string): string[] {
  const bigramsB = new Set<string>()
  for (const run of cjkRunsOf(b)) {
    for (let i = 0; i + 1 < run.length; i++) bigramsB.add(run.slice(i, i + 2))
  }
  if (bigramsB.size === 0) return []
  const raw: string[] = []
  for (const run of cjkRunsOf(a)) {
    let i = 0
    while (i + 1 < run.length) {
      if (!bigramsB.has(run.slice(i, i + 2))) {
        i++
        continue
      }
      // extend while the bigram ending at j+1 is also shared
      let j = i + 2
      while (j < run.length && bigramsB.has(run.slice(j - 1, j + 1))) j++
      const seg = run.slice(i, j)
      const hasContent = [...seg].some((c) => !ZH_STOPWORDS.has(c))
      if (hasContent) raw.push(seg)
      i = j
    }
  }
  // keep only maximal runs (longest first, drop contained ones)
  raw.sort((x, y) => y.length - x.length)
  const merged: string[] = []
  for (const seg of raw) {
    if (merged.some((r) => r.includes(seg))) continue
    merged.push(seg)
  }
  return merged
}

function computeWordEcho(sentences: string[]): WordEchoResult {
  let count = 0
  const pairs: EchoPair[] = []
  for (let i = 0; i + 1 < sentences.length; i++) {
    const a = sentences[i]
    const b = sentences[i + 1]
    const setA = latinContentSet(a)
    const setB = latinContentSet(b)
    const sharedLatin: string[] = []
    for (const w of setA) if (setB.has(w)) sharedLatin.push(w)
    const sharedCjk = sharedCjkRuns(a, b)
    if (sharedLatin.length + sharedCjk.length === 0) continue
    count++
    if (pairs.length < 12) {
      pairs.push({ a, b, shared: [...sharedLatin.slice(0, 3), ...sharedCjk.slice(0, 3)] })
    }
  }
  return { count, pairs }
}

// ---------------------------------------------------------------------------
// 11. Repeated phrases (n-grams 2..6)
// ---------------------------------------------------------------------------

function joinTokens(tokens: string[]): string {
  let out = ""
  let prevLatin = false
  for (const tk of tokens) {
    const latin = isLatinToken(tk)
    if (out && (latin || prevLatin)) out += " "
    out += tk
    prevLatin = latin
  }
  return out
}

function containsTokens(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}

const PHRASE_CHUNK_SPLIT_RE = /[,,\uff1b;\uff1a:()\uff08\uff09[\]\u3010\u3011\u2014\u2013]/

function computeRepeatedPhrases(sentences: string[]): RepeatedPhrase[] {
  const counts = new Map<string, number>()
  const displays = new Map<string, string>()
  for (const sentence of sentences) {
    // phrases should not straddle commas/parens/dashes
    for (const chunk of sentence.split(PHRASE_CHUNK_SPLIT_RE)) {
      const tokens = tokenize(chunk).map((t) => (isLatinToken(t) ? t.toLowerCase() : t))
      for (let n = 2; n <= 6; n++) {
        for (let i = 0; i + n <= tokens.length; i++) {
          const slice = tokens.slice(i, i + n)
          if (slice.every(isStopword)) continue
          const key = slice.join("\u0001")
          counts.set(key, (counts.get(key) ?? 0) + 1)
          if (!displays.has(key)) displays.set(key, joinTokens(slice))
        }
      }
    }
  }
  const entries = [...counts.entries()].filter(([, c]) => c >= 3)
  entries.sort((x, y) => {
    const lenX = x[0].split("\u0001").length
    const lenY = y[0].split("\u0001").length
    return y[1] - x[1] || lenY - lenX || (x[0] < y[0] ? -1 : 1)
  })
  const out: RepeatedPhrase[] = []
  for (const [key, c] of entries) {
    if (out.length >= 10) break
    const phrase = displays.get(key) ?? key
    const phraseTokens = key.split("\u0001")
    const subsumed = out.some(
      (kept) => kept.count >= c && containsTokens(tokenize(kept.phrase), phraseTokens)
    )
    if (subsumed) continue
    out.push({ phrase, count: c })
  }
  return out
}

// ---------------------------------------------------------------------------
// 12. Dialogue balance
// ---------------------------------------------------------------------------

const QUOTE_OPENER_TO_CLOSER: Record<string, string> = {
  "\u201c": "\u201d", // “ ”
  "\u2018": "\u2019", // ‘ ’
  "\u300c": "\u300d", // 「 」
  "\u300e": "\u300f", // 『 』
}
const CLOSER_TO_OPENER: Record<string, string> = {
  "\u201d": "\u201c",
  "\u2019": "\u2018",
  "\u300d": "\u300c",
  "\u300f": "\u300e",
}
const QUOTE_ANY_RE = /[\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f"']/

function countNonSpace(s: string): number {
  let n = 0
  for (const ch of s) if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") n++
  return n
}

function scanQuotes(text: string): { innerNonSpace: number; pairCount: number } {
  let innerNonSpace = 0
  let pairCount = 0
  const stacks = new Map<string, number[]>()
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === "'") {
      // apostrophe inside a contraction — never a quote
      const prev = text[i - 1] ?? ""
      const next = text[i + 1] ?? ""
      if (/[A-Za-z]/.test(prev) && /[A-Za-z]/.test(next)) continue
    }
    const closer = QUOTE_OPENER_TO_CLOSER[ch]
    if (closer !== undefined) {
      const stack = stacks.get(ch) ?? []
      stack.push(i)
      stacks.set(ch, stack)
      continue
    }
    const opener = CLOSER_TO_OPENER[ch]
    if (opener !== undefined) {
      const stack = stacks.get(opener)
      if (stack && stack.length > 0) {
        const start = stack.pop() as number
        innerNonSpace += countNonSpace(text.slice(start + 1, i))
        pairCount++
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      const stack = stacks.get(ch)
      if (stack && stack.length > 0) {
        const start = stack.pop() as number
        innerNonSpace += countNonSpace(text.slice(start + 1, i))
        pairCount++
      } else {
        stacks.set(ch, [i])
      }
    }
  }
  return { innerNonSpace, pairCount }
}

function computeDialogueBalance(
  text: string,
  sentences: string[]
): DialogueBalanceResult {
  const { innerNonSpace } = scanQuotes(text)
  const total = countNonSpace(text)
  const dialoguePct = total > 0 ? r1((innerNonSpace / total) * 100) : 0
  const narrationPct = Math.max(0, r1(100 - dialoguePct))
  const dialogueSentences = sentences
    .filter((s) => QUOTE_ANY_RE.test(s))
    .slice(0, 60)
  return { dialoguePct, narrationPct, dialogueSentences }
}

// ---------------------------------------------------------------------------
// 13. Point of view
// ---------------------------------------------------------------------------

const POV_FIRST_EN = /\b(i|we|me|us|my|our|mine|ours|myself|ourselves)\b/i
const POV_SECOND_EN = /\b(you|your|yours)\b/i
const POV_THIRD_EN = /\b(he|she|it|they|him|her|them|his|hers|their|theirs|its)\b/i
const POV_FIRST_ZH = ["我们", "咱们", "我"]
const POV_SECOND_ZH = ["你们", "您", "你"]
const POV_THIRD_ZH = ["他们", "她们", "它们", "他", "她", "它"]

type PovKind = "first" | "second" | "third"

function povCategory(sentence: string): PovKind | null {
  let best: PovKind | null = null
  let bestIdx = Infinity
  const latin: Array<[PovKind, RegExp]> = [
    ["first", POV_FIRST_EN],
    ["second", POV_SECOND_EN],
    ["third", POV_THIRD_EN],
  ]
  for (const [kind, re] of latin) {
    const m = re.exec(sentence)
    if (m && m.index < bestIdx) {
      bestIdx = m.index
      best = kind
    }
  }
  const zh: Array<[PovKind, string[]]> = [
    ["first", POV_FIRST_ZH],
    ["second", POV_SECOND_ZH],
    ["third", POV_THIRD_ZH],
  ]
  for (const [kind, markers] of zh) {
    for (const mk of markers) {
      const idx = sentence.indexOf(mk)
      if (idx !== -1 && idx < bestIdx) {
        bestIdx = idx
        best = kind
      }
    }
  }
  return best
}

function computePointOfView(sentences: string[]): PointOfViewResult {
  const result: PointOfViewResult = {
    first: 0,
    second: 0,
    third: 0,
    total: sentences.length,
    examples: { first: [], second: [], third: [] },
  }
  for (const s of sentences) {
    const kind = povCategory(s)
    if (!kind) continue
    result[kind]++
    const list = result.examples[kind]
    if (list.length < 5) list.push(s)
  }
  return result
}

// ---------------------------------------------------------------------------
// 14. Punctuation habits
// ---------------------------------------------------------------------------

function countMatches(text: string, re: RegExp): number {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")
  return (text.match(g) ?? []).length
}

function computePunctuationHabits(
  text: string,
  totalWords: number,
  quotePairs: number
): PunctuationHabit[] {
  const groups: Array<{ char: string; label: string; count: number }> = [
    { char: "\uff01", label: "Exclamation marks", count: countMatches(text, /[\uff01!]/g) },
    { char: "\uff1f", label: "Question marks", count: countMatches(text, /[\uff1f?]/g) },
    { char: "\uff1b", label: "Semicolons", count: countMatches(text, /[\uff1b;]/g) },
    { char: "\uff1a", label: "Colons", count: countMatches(text, /[\uff1a:]/g) },
    { char: "\u2014", label: "Dashes", count: countMatches(text, /[\u2014\u2013]/g) },
    { char: "\u3001", label: "Enumeration commas", count: countMatches(text, /\u3001/g) },
    { char: "\u3002", label: "Periods", count: countMatches(text, /\u3002/g) },
    { char: "\u2026", label: "Ellipses", count: countMatches(text, /(\u2026{1,2}|\.{3,6})/g) },
    { char: "\u201c\u201d", label: "Quotation marks", count: quotePairs },
    { char: "()", label: "Parentheses", count: countMatches(text, /[\uff08(]/g) },
  ]
  const per = (c: number): number => (totalWords > 0 ? r1((c / totalWords) * 1000) : 0)
  return groups
    .filter((g) => g.count > 0)
    .map((g) => ({ char: g.char, label: g.label, per1000: per(g.count) }))
    .sort((a, b) => b.per1000 - a.per1000)
    .slice(0, 8)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function computeInsights(text: string): InsightsResult {
  const sentences = splitSentences(text)
  const tokens = tokenize(text)
  const totalWords = tokens.length
  const paragraphs = splitParagraphs(text)

  const summary: SummaryResult = {
    sentences: sentences.length,
    words: totalWords,
    paragraphs: paragraphs.length,
    avgSentenceLen:
      sentences.length > 0 ? r1(totalWords / sentences.length) : 0,
  }

  const quoteScan = scanQuotes(text)

  return {
    summary,
    textComplexity: computeTextComplexity(tokens, sentences),
    vocabDiversity: computeVocabDiversity(tokens),
    sentenceLengths: computeSentenceLengths(sentences),
    sentenceRhythm: sentences.map((s) => ({ sentence: s, wordCount: tokenize(s).length })),
    paragraphDensity: computeParagraphDensity(text),
    sentenceOpeners: computeSentenceOpeners(sentences),
    passiveVoice: computePassiveVoice(sentences),
    adverbs: computeAdverbs(text, tokens),
    wordFrequency: computeWordFrequency(tokens),
    wordEcho: computeWordEcho(sentences),
    repeatedPhrases: computeRepeatedPhrases(sentences),
    dialogueBalance: computeDialogueBalance(text, sentences),
    pointOfView: computePointOfView(sentences),
    punctuationHabits: computePunctuationHabits(text, totalWords, quoteScan.pairCount),
  }
}
