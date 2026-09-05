/**
 * zh translations for the slides component group.
 * Owned by the slides i18n subagent — append entries, do not remove others.
 * Keys are the exact English source strings used in components.
 * Strings shared with Z-Sheets (All / trash / copy / star actions …) live in
 * dict-sheets.ts, which merges earlier.
 */
export const dictSlides: Record<string, string> = {
  /* ---------- app boot ---------- */
  "Loading Z-Slides": "正在加载 Z-Slides",
  "Couldn’t open that presentation": "无法打开该演示文稿",
  "Couldn’t create the presentation": "无法创建演示文稿",

  /* ---------- slides list ---------- */
  "Back to Z-Docs home": "返回 Z-Docs 首页",
  "Search presentations": "搜索演示文稿",
  "New presentation": "新建演示文稿",
  "Presentation list": "演示文稿列表",
  "Recent presentations": "最近的演示文稿",
  "1 presentation": "1 个演示文稿",
  "{n} presentations": "{n} 个演示文稿",
  " matching “{q}”": "，匹配“{q}”",
  "No starred presentations": "暂无已加星标的演示文稿",
  "No matching presentations": "没有匹配的演示文稿",
  "No presentations yet": "还没有演示文稿",
  "Presentations you delete will appear here before they’re removed forever.":
    "删除的演示文稿在被永久移除前会显示在这里。",
  "Star presentations to keep them at your fingertips.": "给演示文稿加星标，方便随时访问。",
  "Try a different search, or create a new presentation.":
    "换个关键词搜索，或创建新的演示文稿。",
  "Create your first presentation and start telling your story.":
    "创建你的第一份演示文稿，开始讲述你的故事。",

  /* ---------- deck card ---------- */
  "Open {title}": "打开 {title}",
  "Actions for {title}": "“{title}”的更多操作",
  "Presentation name": "演示文稿名称",
  "1 slide": "1 张幻灯片",
  "{n} slides": "{n} 张幻灯片",
  "In trash": "回收站中",
  "Renamed": "已重命名",
  "Copy created": "已创建副本",
  "Couldn’t create the copy": "无法创建副本",
  "Restored": "已恢复",
  "Deleted permanently": "已永久删除",
  "This can’t be undone. The presentation will be permanently removed.":
    "此操作无法撤销。该演示文稿将被永久删除。",

  /* ---------- deck editor ---------- */
  "Couldn’t save — retry": "无法保存——点击重试",
  "Speaker notes": "演讲者备注",
  "Slide {n} of {total}": "第 {n} 张，共 {total} 张",
  "Close speaker notes": "关闭演讲者备注",
  "Notes for slide {n}…": "第 {n} 张幻灯片的备注…",
  "Notes for slide {n}": "第 {n} 张幻灯片的备注",
  "No slide selected.": "未选中任何幻灯片。",
  "Back to presentations": "返回演示文稿列表",
  "Presentation title": "演示文稿标题",
  "Rename presentation": "重命名演示文稿",
  "Change layout": "更改布局",
  "Change slide layout": "更改幻灯片布局",
  "Layout": "布局",
  "Toggle speaker notes": "切换演讲者备注",
  "Present from current slide": "从当前幻灯片开始演示",
  "Present": "演示",
  "Present from this slide (Ctrl+Enter)": "从此幻灯片开始演示（Ctrl+Enter）",

  /* ---------- slide rail ---------- */
  "Actions for slide {n}": "第 {n} 张幻灯片的操作",
  "Duplicate slide": "复制幻灯片",
  "Move up": "上移",
  "Move down": "下移",
  "Slide deleted": "已删除幻灯片",
  "Delete slide": "删除幻灯片",
  "Undo the deletion": "撤销此次删除",
  "Slide thumbnails": "幻灯片缩略图",
  "Go to slide {n}": "转到第 {n} 张幻灯片",
  "No slides yet. Add one below.": "还没有幻灯片，在下方添加一张吧。",
  "Insert a new slide": "插入新幻灯片",
  "New slide": "新建幻灯片",
  "Page up and page down keys": "Page Up 和 Page Down 键",
  "Switch slides": "切换幻灯片",
  "switches slides": "可切换幻灯片",

  /* ---------- slide canvas ---------- */
  "Slide title": "幻灯片标题",
  "Slide text": "幻灯片正文",
  "Slide canvas": "幻灯片画布",
  "This presentation has no slides yet.": "此演示文稿还没有幻灯片。",
  "Add a slide": "添加幻灯片",
  "Zoom out (Ctrl minus)": "缩小（Ctrl 减号）",
  "Zoom out (Ctrl−)": "缩小（Ctrl−）",
  "Zoom in (Ctrl plus)": "放大（Ctrl 加号）",
  "Zoom in (Ctrl+)": "放大（Ctrl+）",
  "Previous slide": "上一张幻灯片",
  "Next slide": "下一张幻灯片",

  /* ---------- present mode ---------- */
  "Presenting": "正在演示",
  "End of presentation": "演示结束",
  "Press Esc or click to exit": "按 Esc 或点击退出",
  "Toggle speaker notes (n)": "切换演讲者备注（n）",
  "Previous (←)": "上一张（←）",
  "Exit presentation": "退出演示",
  "Exit (Esc)": "退出（Esc）",
  "Next (→)": "下一张（→）",
  "slide {n} of {total}": "第 {n} 张，共 {total} 张",
  "No notes for this slide.": "此幻灯片暂无备注。",

  /* ---------- layout names ---------- */
  "Title": "标题",
  "Title and body": "标题和正文",
  "Two columns": "两栏",
  "Quote": "引用",
  "Section": "章节页",
  "Blank": "空白",

  /* ---------- slide placeholders ---------- */
  "Click to add title": "点击添加标题",
  "Click to add subtitle": "点击添加副标题",
  "Click to add text": "点击添加正文",
  "Click to add quote": "点击添加引用",
  "Click to add section title": "点击添加章节标题",
  "Click to add caption": "点击添加说明文字",

  /* ---------- theme controls ---------- */
  "Theme color": "主题色",
  "Theme color ({hex})": "主题色（{hex}）",
  "{name} accent": "{name}主题色",
  "Used for rules, bullets and quotes on every slide.":
    "用于每张幻灯片上的分隔线、项目符号和引号。",
  "Theme font": "主题字体",
  "Sans-serif font": "无衬线字体",
  "Sans": "无衬线",
  "Sans-serif theme": "无衬线主题",
  "Serif font": "衬线字体",
  "Serif": "衬线",
  "Serif theme (editorial)": "衬线主题（社论风格）",
  "Teal": "青绿色",
  "Forest": "森林绿",
  "Amber": "琥珀色",
  "Rust": "锈红色",
  "Plum": "紫檀色",
  "Slate": "石板灰",

  /* ---------- slide renderer ---------- */
  "Slide preview: {title}": "幻灯片预览：{title}",

  /* ---------- deck store (tForLang) ---------- */
  "Untitled presentation": "无标题演示文稿",
  "Failed to load decks ({status})": "加载演示文稿失败（{status}）",
}
