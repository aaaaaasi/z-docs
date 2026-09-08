/**
 * zh translations for the apps component group (activity + settings).
 * Owned by the apps i18n subagent — append entries, do not remove others.
 * Keys are the exact English source strings used in components.
 */
export const dictApps: Record<string, string> = {
  // activity — header & states
  "Recent activity": "近期动态",
  "Everything you and your collaborators touched": "你和协作者的所有操作",
  "Back to home": "返回首页",
  "Refresh activity": "刷新动态",
  "Refresh": "刷新",
  "Filter activity by app": "按应用筛选动态",
  "Loading activity": "正在加载动态",
  "Loading activity…": "正在加载动态…",
  "No activity yet": "暂无动态",
  "Create a document, spreadsheet or form and it will show up here": "创建文档、表格或表单后，动态就会显示在这里",
  "Couldn’t load activity": "无法加载动态",
  "Something went wrong": "出了点问题",
  "Someone": "有人",

  // activity — filter chips (app names; APP_META chips stay English in data)
  "Docs": "文档",
  "Sheets": "表格",
  "Slides": "幻灯片",
  "Forms": "表单",

  // activity — day groups
  "Today": "今天",
  "Yesterday": "昨天",

  // activity — verbs (KIND_META verbs stay English in data, rendered via t())
  "created": "创建了",
  "edited": "编辑了",
  "renamed": "重命名了",
  "starred": "已加星标",
  "unstarred": "已取消星标",
  "trashed": "已移至回收站",
  "restored": "已恢复",
  "duplicated": "创建了副本",
  "commented on": "评论了",
  "responded to": "回复了",
  "shared": "分享了",

  // settings — tabs & page
  "General": "常规",
  "Appearance": "外观",
  "Workspace defaults": "工作区默认设置",
  "Data & storage": "数据和存储",
  "About": "关于",
  "Settings sections": "设置分区",
  "Version": "版本",

  // settings — profile
  "Profile": "个人资料",
  "How you appear across the Z workspace.": "你在 Z 工作区中的显示方式。",
  "Name saved": "名称已保存",
  "Avatar preview: {initials}": "头像预览：{initials}",
  "Display name": "显示名称",
  "Your name": "你的姓名",
  "Saved automatically as you type.": "输入时自动保存。",
  "Avatar color": "头像颜色",
  "Use color {color}": "使用颜色 {color}",
  "Avatar color updated": "已更新头像颜色",
  "Your name and color appear in comments, presence and the activity feed.": "你的姓名和颜色会显示在评论、在线状态和动态中。",

  // settings — appearance
  "Choose how Z-Docs looks and feels.": "选择 Z-Docs 的外观和风格。",
  "Bright surfaces": "明亮的界面",
  "Dimmed surfaces": "深色的界面",
  "Follows your device": "跟随设备设置",
  "Accent color": "强调色",
  "Recolors buttons, links and highlights across the workspace.": "更改工作区中按钮、链接和高亮内容的颜色。",
  "Accent color: {name}": "强调色：{name}",
  "Accent set to {name}": "强调色已设为{name}",
  "Teal": "青绿",
  "Forest": "森林绿",
  "Amber": "琥珀",
  "Rose": "玫瑰红",
  "Plum": "深紫",

  // settings — language section
  "Choose the display language for the workspace.": "选择工作区的显示语言。",

  // settings — workspace defaults
  "Preferences used when creating new documents.": "创建新文档时使用的偏好设置。",
  "Default font": "默认字体",
  "Sans": "无衬线",
  "Sans (Arial)": "无衬线（Arial）",
  "Serif (Georgia)": "衬线（Georgia）",
  "Default font set to Sans": "默认字体已设为无衬线",
  "Default font set to Serif": "默认字体已设为衬线",
  "Used when creating new documents": "创建新文档时使用",
  "Default editor zoom": "默认编辑器缩放",
  "Default zoom set to {value}%": "默认缩放已设为 {value}%",

  // settings — data & storage
  "Everything you create lives in your local Z workspace database.": "你创建的所有内容都保存在本地 Z 工作区数据库中。",
  "Workspace storage": "工作区存储空间",
  "{size} used": "已用 {size}",
  "{size} quota": "共 {size}",
  "Workspace storage used": "工作区存储空间已用量",
  "Documents": "文档",
  "Spreadsheets": "表格",
  "Decks": "演示文稿",
  "Folders": "文件夹",
  "Tags": "标签",
  "Export all your data": "导出全部数据",
  "Download started": "已开始下载",
  "Your workspace is exporting as JSON.": "你的工作区正在导出为 JSON。",
  "Reset local profile": "重置本地个人资料",
  "Reset local profile?": "重置本地个人资料？",
  "This clears your saved name, avatar color, theme, accent and workspace defaults from this browser. Your documents, spreadsheets, decks and forms are kept.": "这会从此浏览器中清除已保存的姓名、头像颜色、主题、强调色和工作区默认设置。你的文档、表格、幻灯片和表单会保留。",
  "Reset & reload": "重置并重新加载",
  "Failed to load storage stats": "无法加载存储统计",

  // settings — guest local data management
  "Local data (this device only)": "本地数据（仅此设备）",
  "You are in guest mode — everything lives in this browser’s local storage. Sign in to sync it to the cloud.":
    "你正处于访客模式——所有内容都保存在此浏览器的本地存储中。登录即可同步到云端。",
  "Local database": "本地数据库",
  "{size} stored locally": "已在本地存储 {size}",
  "Comments": "评论",
  "Export backup (JSON)": "导出备份（JSON）",
  "Backup downloaded": "备份已下载",
  "Local backup": "本地备份",
  "Clear local data": "清空本地数据",
  "Clear all local data?": "清空所有本地数据？",
  "Every document, spreadsheet, deck, form and comment stored in this browser will be deleted. Export a backup first if you want to keep them.":
    "此浏览器中保存的所有文档、表格、演示文稿、表单和评论都将被删除。如需保留，请先导出备份。",
  "Clear & reload": "清空并重新加载",

  // settings — about
  "A Google-style workspace: Docs, Sheets, Slides & Forms": "Google 风格的工作区：文档、表格、幻灯片和表单",
  "Local demo — all data lives in your browser and local database.": "本地演示——所有数据都保存在你的浏览器和本地数据库中。",
}
