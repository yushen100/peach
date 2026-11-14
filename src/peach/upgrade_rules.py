"""持久结果的处理规则版本；各能力只失效自己拥有的派生结果。"""

CATALOG = "catalog-v4"
PREVIEWS = "previews-v2"
LOCAL_POSTERS = PREVIEWS + ':local'
PROCESSING = "processing-v2"
FC2_METADATA = 'fc2-javdb-first-v1'
PUBLIC_SNAPSHOTS = 2
PROVIDER_EVIDENCE = 2
#: 文字补修规则。4：刮削挂上的乱码人物关联自动解除并重采（#478）；已有旧回执的库只重跑文字补修。
PROVIDER_TEXT = 4
OFFICIAL_COVER_CATALOG_MISSES = 1
#: 文件名番号判据放宽后（如 TMA 的 `T28-612`），账本里还没番号、按现行规则认得出的影片撤掉处理检查点重新处理。
#: 判据又放宽时加一。
FILENAME_CODES = 1
#: 核查差异按确定判据结算（ADR-0139）。判据改了就加一，升级时对存量候选再结算一遍。
VERIFICATION_SETTLEMENT = 1
# 旧队列保持撤下状态；新规则单独记录已取得的 SAR 测量。
DISPLAY_DIMENSIONS = 'display-dimensions-1'
DISPLAY_DIMENSIONS_SAR = 'display-dimensions-2'
#: 永久删除后悬空的资料候选与复核决定（#486）按路径改挂或撤下。判据改了就加一，升级时再对存量做一遍。
DANGLING_CANDIDATES = 1
#: JavDB 演员 id 按本机缓存的搜索卡片补记有碼／無碼（#271）。判据改了就加一，升级时再对存量做一遍。
JAVDB_ACTOR_RECORDS = 1
#: 刮削按来源 genre 挂上的分辨率标签（`4K` 等说的是官方发行版本）解除。判据改了就加一，升级时再对存量做一遍。
SOURCE_RESOLUTION_TAGS = 1
#: 按现行扩展名规则是视频、账本里还记成 other 的行改成视频（#551 的 WebM）。判据改了就加一，升级时再对存量做一遍。
VIDEO_MEDIUM = 1
#: 旧任务行与补全记录里的界面文字转成 code（ADR-0159 第五条）。模板措辞改了就加一，升级时按新措辞再认一遍。
INTERFACE_TEXT_CODES = 1
