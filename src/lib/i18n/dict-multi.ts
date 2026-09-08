/**
 * zh translations for the multi feature group (document multi-select + bulk
 * actions on the home grid). Keys are the exact English source strings used
 * in components. Keys that already exist in other groups are repeated here
 * with identical wording so this group stays self-contained (merge order
 * keeps them consistent).
 */
export const dictMulti: Record<string, string> = {
  /* selection state + controls */
  "Select {title}": "选择 {title}",
  "{n} selected": "已选 {n} 项",
  "Select all": "全选",
  "Clear selection": "取消选择",
  "Bulk actions": "批量操作",

  /* bulk-action bar */
  "Star selected": "星标所选",
  "Unstar selected": "取消所选星标",
  "Move to": "移至",
  "Home": "主页",
  "No folder": "无文件夹",
  "Move to trash": "移至回收站",
  "Restore": "恢复",
  "Delete forever": "彻底删除",
  "Close": "关闭",

  /* batch results */
  "{n} documents starred": "{n} 篇文档已加星标",
  "{n} documents unstarred": "{n} 篇文档已移除星标",
  "{n} documents moved to trash": "{n} 篇文档已移至回收站",
  "{n} documents restored": "{n} 篇文档已恢复",
  "{n} documents deleted forever": "{n} 篇文档已彻底删除",
  "{n} documents moved to “{name}”": "{n} 篇文档已移至“{name}”",
  "{n} items failed": "{n} 项操作失败",
  "Tags applied to {n} documents": "已为 {n} 篇文档添加标签",

  /* bulk tag picker dialog */
  "Add tags": "添加标签",
  "Add tags to {n} documents": "为 {n} 篇文档添加标签",
  "Existing tags": "已有标签",
  "Tag {name}": "标签 {name}",
  "No tags yet — create one below.": "还没有标签——在下方创建一个。",
  "New tag name…": "新标签名称…",
  "New tag name": "新标签名称",
  "Create tag": "创建标签",
  "Couldn’t create the tag": "无法创建标签",
  "Apply to {n} documents": "应用到 {n} 篇文档",

  /* batch delete-forever confirmation */
  "Delete {n} documents forever?": "永久删除 {n} 篇文档？",
  "This can’t be undone. The selected documents will be permanently removed.":
    "此操作无法撤销。所选文档将被永久移除。",
  "Cancel": "取消",

  /* bulk rename dialog */
  "Rename selected": "重命名所选",
  "Rename {n} documents": "重命名 {n} 篇文档",
  "Renamed {n} documents": "已重命名 {n} 篇文档",
  "Rename": "重命名",
  "Find & replace": "查找并替换",
  "Add numbering": "添加编号",
  "Find": "查找",
  "Text to find in the names…": "要查找的文字…",
  "Replace with": "替换为",
  "Replacement text…": "替换文字…",
  "Case-sensitive. Empty replacement deletes the text.": "区分大小写。替换为空即删除该文字。",
  "Name pattern": "命名模式",
  "e.g. Report {n}": "例如：报告 {n}",
  "{n} = sequence number, {title} = current name. Leave empty to use “{title} {n}”.":
    "{n} 表示序号，{title} 表示原名称。留空则使用“{title} {n}”。",
  "Start number": "起始编号",
  "Preview": "预览",
  "No change": "无变化",

  /* export progress panel */
  "Exports": "导出任务",
  "Preparing…": "正在准备…",
  "Rendering…": "正在渲染…",
  "Downloading…": "正在下载…",
  "Downloaded": "已下载",
  "Downloaded · {size}": "已下载 · {size}",
  "Export failed": "导出失败",
  "Dismiss": "关闭",
  "Export progress: {file}": "导出进度：{file}",
  "Large document — this may take a moment": "文档较大，可能需要一点时间",
  "Page {i} of {n}": "第 {i} 页，共 {n} 页",
  "Slide {i} of {n}": "第 {i} 张幻灯片，共 {n} 张",
}
