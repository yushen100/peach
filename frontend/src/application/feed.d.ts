/** 首页新作卡的封面片段：本地封面、经 `/cover-image` 取的官方封面，或「抓取中」「无封面」占位。 */
export declare function feedNewCoverHtml(item: Record<string, unknown>): string;
/** 首页新作卡：番号与片名，不带版次与画质徽章——新作还没入库，没有文件可判。 */
export declare function feedNewCardHtml(item: Record<string, unknown>): string;
/** 首页那一行的状态；测试只换骨架片段。 */
export declare const feedState: { feedNewSkeletonHtml?: () => string; [key: string]: unknown };
/** 首页新作那一行在这条路径上该不该出现：设置里关掉「在首页显示新作」时一律不出现。 */
export declare function isFeedNewPath(path: string): boolean;
/** 记下首页有没有新作，首屏骨架据此铺不铺这一行。 */
export declare function rememberHomeFeed(has: boolean): void;
export declare function prepareHomeFeed(host: HTMLElement | null): void;
export declare function renderHomeFeed(): void;
/** 卸载首页新作组件、撤销在途打开并清空宿主。 */
export declare function clearHomeFeed(): void;
/** 设置里切了「在首页显示新作」：关掉卸掉那一行，打开时人在目录上（不是文件夹浏览）就当场画。 */
export declare function syncHomeFeedSetting(folders: boolean): void;
