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

  /* batch delete-forever confirmation */
  "Delete {n} documents forever?": "永久删除 {n} 篇文档？",
  "This can’t be undone. The selected documents will be permanently removed.":
    "此操作无法撤销。所选文档将被永久移除。",
  "Cancel": "取消",
}
