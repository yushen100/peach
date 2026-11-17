# 来源图标

这些图标用于来源设置与诊断页的站点身份，归各站点所有，不用于 Peach 品牌。favicon 保留原色与画布，ICO 仅解码为 PNG；透明底单色字形例外，见 iwara.png。

| 文件 | 来源 | 获取原因 |
| --- | --- | --- |
| f95zone.png | F95zone 的公开图标缓存：`https://www.google.com/s2/favicons?domain=f95zone.to&sz=64`，SHA-256 `2558C3BBBB80F2F71D210BD17A8FECAAEE63F1F73B5EF95C4A46899646BCC149` | 官方 `assets/favicon-32x32.png` 返回 Cloudflare 验证页 |
| globe.svg | 项目已有 Lucide `i-globe` 字形，沿用 Lucide ISC 许可 | 来源图标未取得时的通用地球图标 |
| javten.png | JAVten 的公开图标缓存：`https://www.google.com/s2/favicons?domain=javten.com&sz=64` | 官方首页与图标端点返回 Cloudflare 403，favicon.ico 返回空文件 |
| fc2ppvdb.png | FC2PPV-DB 的公开图标缓存：`https://www.google.com/s2/favicons?domain=fc2ppv-db.com&sz=64` | 官方首页与图标端点返回 Cloudflare 403 |
| avwikidb.png | `https://avwikidb.com/apple-touch-icon.png` | 首页有验证页，公开图标可读取 |
| minnano-av.png | みんなのAV 的公开图标缓存：`https://www.google.com/s2/favicons?domain=minnano-av.com&sz=64`（缓存只有 32×32） | 官方 apple-touch-icon 与 favicon.ico 对 HTTP 客户端返回 Cloudflare 403 |
| github.png | `https://github.githubassets.com/favicons/favicon.svg` | 官方声明的矢量图标，经现有 `link_marks` 渲染 |
| avsox.png | `https://avsox.click/res/fonts/favicon.2a4d5d787e44d9be7614.ico` | 页面运行后动态写入的 `shortcut icon`；首页 HTML 没有声明，根 favicon 返回 HTML |
| manko.png | `https://manko.fun/images/favicon.ico` | 首页声明的 favicon；apple-touch-icon 指向正文宣传图 |
| sukebei.png | `https://sukebei.nyaa.si/static/favicon.png` | 用户指定并核实的蓝色原图 |
| dmm.png | `https://www.dmm.co.jp/age_check/images/fanza-favicon.ico` | 官方入口声明的 FANZA favicon |
| mgstage.png | `https://static.mgstage.com/mgs/favicon.ico` | 首页声明的 favicon |
| fc2cmadb.png | `https://fc2cmadb.com/favicon.ico` | 官方站点的 favicon |
| javarchive.png | `https://javarchive.com/favicon.ico` | 首页声明的 favicon |
| javdb.png | `https://javdb.com/favicon-32x32.png` | 首页声明的 favicon |
| javbus.png | `https://www.javbus.com/favicon.ico` | 官方站点的 favicon |
| avbase.png | `https://www.avbase.net/favicon.ico` | 首页需验证，公开 favicon 可读取 |
| r18dev.png | 已有 `https://r18.dev/` 站标缓存 | 复用 dev 字标；官方 favicon 核对为同一标识 |
| prestige.png | 已有 `https://www.prestige-av.com/` 站标缓存，2026-09-24 保存的 128×128 PNG | 站点维护时当前渲染版本未取得图标，复用既有红底白色 P 标识 |
| fc2.png | 已有 FC2 站标缓存；原图来源见 `site_icons.HOST_OVERRIDES['fc2.com']` | 复用用户确认的纯红色独角兽 |
| 1pondo.png | 已有 `https://www.1pondo.tv/` 站标缓存 | 复用现有一本道标识 |
| iwara.png | `https://www.iwara.tv/logo.png`（首页唯一声明的 icon，540×540，25,990 B，SHA-256 `00E00534BCD49920E030536DD83652A7B74E3DAE3C5F8C88CB298CB0F9539F05`），经 `link_marks.render_mark` 合成 | 官方 logo、manifest 的 192/512 图标与 Google 图标缓存都是透明底纯白字形，原样显示在浅色主题下看不见；按外链圆标的单色字形规则换成中性深灰圆底白字，与 `/link-mark` 的 Iwara 圆标一致 |

取证：javten、fc2ppvdb、avwikidb、github 为 2026-09-30，minnano-av 为 2026-10-01，iwara 为 2026-11-07，其余为 2026-10-19。五个既有静态入口经 `/site-icon/{name}.png` 提供；`/site-mark?source=…` 优先提供本目录中对应的已核对资源。浏览器不向外部图标服务发请求。
