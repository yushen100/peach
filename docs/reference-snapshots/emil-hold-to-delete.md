# 长按删除

取证日期为 2026-11-17。来源为 Emil Kowalski 的 [Building a Hold to Delete Component](https://emilkowal.ski/ui/building-a-hold-to-delete-component)。本文件为人工取证笔记。

实测网页 HTML 的 SHA-256 为 `D74DC85CC90BA4B0777629B61AF3FC87D0B147EF843791BB62D3C856AE2AA4EF`。页面示例使用 `clip-path` 控制覆盖层，按住时两秒线性填充，释放后以 200ms 复位。

Peach 复用上述填充与复位时序。提交由独立的两秒计时器触发，松开、移出、失焦、页面隐藏或按钮进入忙态时取消。原有范围说明继续展示，资料删除在同一弹窗内提供三个执行范围。红色与尺寸沿用 Peach 当前组件语义。

本文件记录人工核对的交互与 Peach 取舍，包含说明和实测摘要。它没有单一可重抓的上游正文副本，因此不登记为 docs/reference-sources.json 的自动更新快照。
