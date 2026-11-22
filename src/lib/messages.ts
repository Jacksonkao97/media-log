/* Every piece of UI text, in Chinese (the default) and English. `zh` is the
 * reference: `en` is typed by it, so a missing or extra entry is a compile
 * error. Values the data stores (regions, categories, watch and series state)
 * stay Chinese in the data; these only say how they look.
 *
 * Plain module, no React or browser APIs: the server reads it too (page
 * titles), and so do lib functions that build messages (import errors). */

import type { FeedId, MovieList, Season } from "./discover/feeds";
import type { Phase } from "./discover/types";
import type { SortKey } from "./items";
import type { Category, Region, Status, Watch } from "./schema";
import type { Section } from "./view";

const zh = {
  /** This language's own name, shown on the switch that picks it. */
  langName: "中文",
  /** A list of names: 日本、韩国. */
  listSep: "、",

  region: {
    日本: "日本",
    中国: "中国",
    韩国: "韩国",
    欧美: "欧美",
  } satisfies Record<Region, string> as Record<Region, string>,
  category: {
    动画: "动画",
    漫画: "漫画",
    电影: "电影",
    电视剧: "电视剧",
  } satisfies Record<Category, string> as Record<Category, string>,
  watch: {
    未看: "未看",
    看着: "看着",
    看完了: "看完了",
  } satisfies Record<Watch, string> as Record<Watch, string>,
  status: {
    未完结: "未完结",
    完结: "完结",
  } satisfies Record<Status, string> as Record<Status, string>,
  section: { library: "片单", discover: "发现" } as Record<Section, string>,

  /* ------------------------------------------------------------ chrome */
  sectionsLabel: "版块",
  regions: "区域",
  reminders: "更新提醒",
  remindersOn: "已开启",
  installApp: "安装应用",
  installHome: "安装到主屏幕",
  more: "更多",
  legalNav: "隐私政策与服务条款",
  privacy: "隐私政策",
  terms: "服务条款",
  language: "语言",

  /* ----------------------------------------------------------- library */
  all: "全部",
  works: (n: number) => `${n} 部作品`,
  showing: (n: number) => ` · 显示 ${n} 部`,
  loading: "加载中…",
  loadingShort: "加载中",
  add: "新增",
  addWork: "新增作品",
  editWork: "编辑作品",
  watchState: "观看状态",
  categoryLabel: "分类",
  statusLabel: "状态",
  search: "搜索",
  searchPlaceholder: "搜索名称或备注",
  clearSearch: "清空搜索",
  filters: "筛选",
  sort: "排序",
  sorts: {
    name: "名称",
    progress: "进度",
    updatedAt: "最近更新",
    createdAt: "最近添加",
    status: "状态",
    category: "分类",
  } as Record<SortKey, string>,
  ascToggle: "升序（点击切换）",
  descToggle: "降序（点击切换）",
  asc: "升序",
  desc: "降序",
  clearFilters: "清除筛选",
  col: { name: "名称", progress: "进度", status: "状态", updated: "更新" },
  editAria: (name: string) => `编辑「${name}」`,
  openLinkAria: (name: string) => `打开「${name}」的链接`,
  bumpAria: (name: string) => `「${name}」进度 +1`,
  bumpTitle: "进度 +1",

  noData: "还没有数据",
  importData: "导入数据",
  addManually: "手动新增",
  noDataHint:
    "选择 data/ 文件夹里的 JSON（可以一次多选），或之前导出的备份文件。数据只保存在这个浏览器里。",
  regionEmpty: (region: string) => `${region} 还没有作品`,
  noMatches: "没有符合条件的作品",
  noMatchesHint: "换个关键词，或者去掉一些筛选条件。",

  /* ------------------------------------------------------------ editor */
  editDesc: (name: string) => `修改「${name}」`,
  addDesc: (region: string) => `添加到「${region}」`,
  name: "名称",
  namePlaceholder: "例如：全知读者视角",
  progress: "进度",
  progressHint: "「125」「第41卷」都行，+1 加第一个数字",
  progressPlaceholder: "125 / 第41卷 / 剧场版",
  regionLabel: "区域",
  moveHint: (from: string, to: string) => `保存后会从「${from}」移到「${to}」`,
  link: "链接",
  note: "备注",
  notePlaceholder: "正常更新 / 停更2年了 / 无望第二季…",
  delete: "删除",
  cancel: "取消",
  save: "保存",

  /* ------------------------------------------------------------ toasts */
  storageUnavailable: "浏览器存储不可用（隐私模式？），改动不会被保存",
  saveFailed: (why: string) => `保存失败：${why}`,
  undo: "撤销",
  saved: "已保存",
  addedTo: (region: string) => `已添加到 ${region}`,
  view: "查看",
  deleted: (name: string) => `已删除「${name}」`,
  bumped: (name: string, progress: string) => `「${name}」→ ${progress}`,

  /* ----------------------------------------------------- import/export */
  importFailed: (why: string) => `导入失败：${why}`,
  importCount: (region: string, n: number) => `${region} ${n} 条`,
  importChange: (region: string, have: number, n: number) =>
    `${region}：现有 ${have} 条 → 导入 ${n} 条${n ? "" : "（会被清空）"}`,
  importEmptied: (regions: string) => `注意：${regions} 会被清空！\n\n`,
  importConfirm: (changes: string) =>
    `将用导入的文件覆盖：\n${changes}\n\n确定继续？`,
  imported: (summary: string) => `已导入：${summary}`,
  importUndone: "已撤销导入",
  exported: (n: number, file: string) => `已导出 ${n} 条到 ${file}`,
  import: "导入",
  export: "导出",
  importTitle: "导入 data/ 里的 JSON 或导出的备份",
  exportTitle: "下载所有区域的合并快照",
  exportBackup: "导出备份",
  backupDue: (days: number) => `已经 ${days} 天没有导出备份了`,
  backupWhy:
    "没有登录 Google 同步时，数据只存在这个浏览器里，清除浏览器数据就会丢失。",
  // Import errors (lib/transfer.ts).
  fileNotList: (where: string) => `${where} 不是作品列表`,
  fileNotItem: (where: string, i: number) => `${where} 第 ${i} 条不是作品`,
  fileNoName: (where: string, i: number) => `${where} 第 ${i} 条没有名称`,
  fileNotJson: (file: string) => `${file} 不是合法的 JSON`,
  fileRegion: (file: string, region: string) => `${file}「${region}」`,
  fileNoRegions: (file: string) => `${file} 里没有任何区域`,
  fileWhichRegion: (file: string) => `无法判断 ${file} 属于哪个区域`,
  fileNotMediaLog: (file: string) => `${file} 不是 MediaLog 的数据文件`,

  /* ---------------------------------------------------- account, sync */
  local: {
    loading: "加载中…",
    saving: "保存中…",
    saved: "已保存在本浏览器",
    error: "保存失败",
    unavailable: "浏览器存储不可用，改动不会保存",
  },
  syncing: "正在同步到 Google Drive…",
  synced: (when: string) => `已同步到 Google Drive · ${when}`,
  offline: "离线，联网后自动同步",
  syncFailed: (why: string) => `同步失败：${why}`,
  needReauth: "需要重新登录 Google",
  signInSync: "登录 Google 同步",
  accountMenu: "账号与同步",
  signInAgain: "重新登录",
  retry: "重试",
  reauthGoogle: "重新登录 Google",
  syncNow: "立即同步",
  openDrive: "在 Google Drive 中打开",
  signOut: "退出登录",
  pulledAdded: (n: number) => `新增 ${n}`,
  pulledUpdated: (n: number) => `更新 ${n}`,
  pulledRemoved: (n: number) => `删除 ${n}`,
  pulled: (parts: string) => `已从 Google Drive 同步：${parts}`,
  pushed: "已上传到 Google Drive",
  upToDate: "已是最新",
  networkError: "网络错误，稍后会自动重试",
  driveScopeMissing:
    "登录时没有允许访问 Google Drive，请重新登录并勾选 Drive 权限",
  sessionExpired: "Google 登录已失效，请重新登录",
  sessionUnavailable:
    "无法获取登录状态：服务器的登录配置可能有误（见服务器日志）",
  signOutFailed: "退出登录失败，请联网后再试",
  signedOut: "已退出登录。数据仍保存在这个浏览器里",
  driveCorrupt: (name: string) =>
    `Drive 上的 ${name} 不是合法的 JSON，请检查或删除它`,

  /* --------------------------------------------------------------- PWA */
  newVersion: "MediaLog 有新版本",
  reload: "刷新",
  installed: "已安装 MediaLog",
  iosWhy: "装好后像 App 一样从主屏幕打开，全屏显示，离线也能用。",
  iosStep1: ["1. 点浏览器工具栏里的 ", "分享", " 按钮"] as [
    string,
    string,
    string,
  ],
  iosStep2: ["2. 往下找到 ", "添加到主屏幕", "，再点 ", "添加"] as [
    string,
    string,
    string,
    string,
  ],
  gotIt: "知道了",

  /* ------------------------------------------------------------- dates */
  today: "今天",
  yesterday: "昨天",
  tomorrow: "明天",
  daysAgo: (n: number) => `${n} 天前`,
  justNow: "刚刚",
  minutesAgo: (n: number) => `${n} 分钟前`,
  hoursAgo: (n: number) => `${n} 小时前`,
  inMinutes: (n: number) => `${n} 分钟后`,
  inHours: (n: number) => `${n} 小时后`,
  aired: "已更新",
  weekdays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
  /** A release date, as far as it is known; the year only when not this one. */
  date: (y: number, m?: number, d?: number, thisYear?: boolean) =>
    !m
      ? `${y}年`
      : d
        ? `${thisYear ? "" : `${y}年`}${m}月${d}日`
        : `${y}年${m}月`,

  /* ------------------------------------------------------------ 发现 */
  feeds: {
    airing: {
      label: "新番时间表",
      short: "时间表",
      blurb: "这一周每天更新的动画，按你的时区排",
    },
    season: {
      label: "季度新番",
      short: "新番",
      blurb: "一季开播的动画，按人气排",
    },
    manga: {
      label: "热门漫画",
      short: "漫画",
      blurb: "最近最多人在看的漫画",
    },
    movies: {
      label: "电影",
      short: "电影",
      blurb: "正在上映和即将上映的电影",
    },
  } as Record<FeedId, { label: string; short: string; blurb: string }>,
  /** "2026年10月": how Chinese sites name a season (by its first month). */
  season: (season: Season, year: number) =>
    `${year}年${["WINTER", "SPRING", "SUMMER", "FALL"].indexOf(season) * 3 + 1}月`,
  movieLists: {
    now_playing: "正在热映",
    upcoming: "即将上映",
    trending: "本周热门",
  } as Record<MovieList, string>,
  day: "日期",
  mineOnly: "只看片单里的",
  noneFromLibrary: "片单里的动画这天都不更新",
  noneThisDay: "这一天没有动画更新",
  hiddenAiring: (n: number) =>
    `这天有 ${n} 部更新，关掉「只看片单里的」可以看到。`,
  seasonLabel: "季度",
  thisSeason: "本季",
  seasonEmpty: "这一季还没有公布作品",
  country: "国家",
  list: "榜单",
  nothingYet: "暂时没有数据",
  moviesNotSetUp: "电影资讯还没有配置",
  moviesNotSetUpHint:
    "电影数据来自 TMDB，需要一个免费的 API key：在服务器上设置环境变量 TMDB_API_KEY，步骤见 README「新番 / 电影资讯」。",
  loadFailed: "加载失败",
  openOwned: (name: string) => `打开片单里的「${name}」`,
  addToLibrary: (title: string) => `把「${title}」加入片单`,
  viewOn: (site: string, title: string) => `在 ${site} 查看「${title}」`,
  viewOnShort: (site: string) => `在 ${site} 查看`,
  episode: (n: number) => `第 ${n} 集`,
  episodes: (n: number) => `${n} 集`,
  chapters: (n: number) => `${n} 话`,
  inLibrary: "在片单",
  inCinemas: (date: string) => `${date}上映`,
  releaseTba: "上映日期未定",
  premieres: (date: string) => `${date}开播`,
  comingSoon: "即将开播",
  nextEpisode: (weekday: string, time: string, n: number) =>
    `${weekday} ${time} 更新第 ${n} 集`,
  /** AniList formats, as the API route names them (lib/discover/anilist.ts). */
  format: {} as Record<string, string>,
  phase: {
    anime: {
      upcoming: "未开播",
      releasing: "放送中",
      hiatus: "停播中",
      finished: "已完结",
      cancelled: "已中止",
    },
    manga: {
      upcoming: "未开始",
      releasing: "连载中",
      hiatus: "休刊中",
      finished: "已完结",
      cancelled: "已腰斩",
    },
  } as Record<"anime" | "manga", Record<Phase, string>>,
  tmdbCredit: "电影数据来自 TMDB。",
  dataFrom: "数据来自",
  noNetwork: "没有网络，联网后再试",
  serverUnreachable: "连不上服务器，请稍后再试",
  serverError: (status: number) => `服务器出错（${status}）`,
};

export type Messages = typeof zh;

const en: Messages = {
  langName: "English",
  listSep: ", ",

  region: { 日本: "Japan", 中国: "China", 韩国: "Korea", 欧美: "West" },
  category: {
    动画: "Anime",
    漫画: "Manga",
    电影: "Movie",
    电视剧: "TV series",
  },
  watch: { 未看: "To watch", 看着: "Watching", 看完了: "Watched" },
  status: { 未完结: "Ongoing", 完结: "Ended" },
  section: { library: "Library", discover: "Discover" },

  sectionsLabel: "Section",
  regions: "Regions",
  reminders: "Update reminders",
  remindersOn: "On",
  installApp: "Install app",
  installHome: "Add to Home Screen",
  more: "More",
  legalNav: "Privacy policy and terms",
  privacy: "Privacy",
  terms: "Terms",
  language: "Language",

  all: "All",
  works: (n) => (n === 1 ? "1 title" : `${n} titles`),
  showing: (n) => ` · showing ${n}`,
  loading: "Loading…",
  loadingShort: "Loading",
  add: "Add",
  addWork: "Add title",
  editWork: "Edit title",
  watchState: "Watch state",
  categoryLabel: "Category",
  statusLabel: "Status",
  search: "Search",
  searchPlaceholder: "Search names or notes",
  clearSearch: "Clear search",
  filters: "Filters",
  sort: "Sort",
  sorts: {
    name: "Name",
    progress: "Progress",
    updatedAt: "Recently updated",
    createdAt: "Recently added",
    status: "Status",
    category: "Category",
  },
  ascToggle: "Ascending (click to switch)",
  descToggle: "Descending (click to switch)",
  asc: "Ascending",
  desc: "Descending",
  clearFilters: "Clear filters",
  col: {
    name: "Name",
    progress: "Progress",
    status: "Status",
    updated: "Updated",
  },
  editAria: (name) => `Edit “${name}”`,
  openLinkAria: (name) => `Open the link for “${name}”`,
  bumpAria: (name) => `“${name}” progress +1`,
  bumpTitle: "Progress +1",

  noData: "No data yet",
  importData: "Import data",
  addManually: "Add manually",
  noDataHint:
    "Choose the JSON files from the data/ folder (several at once is fine), or a backup you exported earlier. Data is kept only in this browser.",
  regionEmpty: (region) => `Nothing in ${region} yet`,
  noMatches: "No matching titles",
  noMatchesHint: "Try another search, or remove some filters.",

  editDesc: (name) => `Edit “${name}”`,
  addDesc: (region) => `Add to ${region}`,
  name: "Name",
  namePlaceholder: "e.g. Omniscient Reader’s Viewpoint",
  progress: "Progress",
  progressHint: "“125” or “Vol. 41” both work; +1 adds to the first number",
  progressPlaceholder: "125 / Vol. 41 / Movie",
  regionLabel: "Region",
  moveHint: (from, to) => `Saving moves it from ${from} to ${to}`,
  link: "Link",
  note: "Note",
  notePlaceholder:
    "Updates weekly / On hiatus for 2 years / No season 2 in sight…",
  delete: "Delete",
  cancel: "Cancel",
  save: "Save",

  storageUnavailable:
    "Browser storage isn’t available (private mode?), so changes won’t be saved",
  saveFailed: (why) => `Couldn’t save: ${why}`,
  undo: "Undo",
  saved: "Saved",
  addedTo: (region) => `Added to ${region}`,
  view: "View",
  deleted: (name) => `Deleted “${name}”`,
  bumped: (name, progress) => `“${name}” → ${progress}`,

  importFailed: (why) => `Import failed: ${why}`,
  importCount: (region, n) => `${region} ${n}`,
  importChange: (region, have, n) =>
    `${region}: ${have} now → ${n} imported${n ? "" : " (will be emptied)"}`,
  importEmptied: (regions) => `Warning: ${regions} will be emptied!\n\n`,
  importConfirm: (changes) =>
    `The imported files will replace:\n${changes}\n\nContinue?`,
  imported: (summary) => `Imported: ${summary}`,
  importUndone: "Import undone",
  exported: (n, file) =>
    `Exported ${n} ${n === 1 ? "title" : "titles"} to ${file}`,
  import: "Import",
  export: "Export",
  importTitle: "Import JSON from data/ or an exported backup",
  exportTitle: "Download one snapshot of every region",
  exportBackup: "Export backup",
  backupDue: (days) => `It’s been ${days} days since your last backup`,
  backupWhy:
    "Without Google sync, your data lives only in this browser and is lost if you clear its data.",
  fileNotList: (where) => `${where} is not a list of titles`,
  fileNotItem: (where, i) => `Item ${i} in ${where} is not a title`,
  fileNoName: (where, i) => `Item ${i} in ${where} has no name`,
  fileNotJson: (file) => `${file} is not valid JSON`,
  fileRegion: (file, region) => `${file} (${region})`,
  fileNoRegions: (file) => `${file} has no regions in it`,
  fileWhichRegion: (file) => `Can’t tell which region ${file} belongs to`,
  fileNotMediaLog: (file) => `${file} isn’t a MediaLog data file`,

  local: {
    loading: "Loading…",
    saving: "Saving…",
    saved: "Saved in this browser",
    error: "Couldn’t save",
    unavailable: "Browser storage unavailable; changes won’t be saved",
  },
  syncing: "Syncing to Google Drive…",
  synced: (when) => `Synced to Google Drive · ${when}`,
  offline: "Offline; syncs when you’re back online",
  syncFailed: (why) => `Sync failed: ${why}`,
  needReauth: "Google sign-in needed",
  signInSync: "Sign in to sync with Google",
  accountMenu: "Account and sync",
  signInAgain: "Sign in again",
  retry: "Retry",
  reauthGoogle: "Sign in to Google again",
  syncNow: "Sync now",
  openDrive: "Open in Google Drive",
  signOut: "Sign out",
  pulledAdded: (n) => `${n} added`,
  pulledUpdated: (n) => `${n} updated`,
  pulledRemoved: (n) => `${n} removed`,
  pulled: (parts) => `Synced from Google Drive: ${parts}`,
  pushed: "Uploaded to Google Drive",
  upToDate: "Already up to date",
  networkError: "Network error; will retry automatically",
  driveScopeMissing:
    "Google Drive access wasn’t allowed at sign-in. Sign in again and tick the Drive box.",
  sessionExpired: "Your Google sign-in has expired. Please sign in again.",
  sessionUnavailable:
    "Couldn’t get the sign-in status: the server’s sign-in setup may be wrong (see the server logs).",
  signOutFailed: "Couldn’t sign out. Try again when you’re online.",
  signedOut: "Signed out. Your data is still saved in this browser.",
  driveCorrupt: (name) =>
    `${name} on Drive isn’t valid JSON. Check it or delete it.`,

  newVersion: "A new version of MediaLog is available",
  reload: "Reload",
  installed: "MediaLog installed",
  iosWhy:
    "Once added, it opens from your Home Screen like an app, full screen, and works offline.",
  iosStep1: ["1. Tap ", "Share", " in the browser toolbar"],
  iosStep2: ["2. Scroll down to ", "Add to Home Screen", ", then tap ", "Add"],
  gotIt: "Got it",

  today: "Today",
  yesterday: "Yesterday",
  tomorrow: "Tomorrow",
  daysAgo: (n) => (n === 1 ? "1 day ago" : `${n} days ago`),
  justNow: "just now",
  minutesAgo: (n) => (n === 1 ? "1 min ago" : `${n} min ago`),
  hoursAgo: (n) => (n === 1 ? "1 hour ago" : `${n} hours ago`),
  inMinutes: (n) => `in ${n} min`,
  inHours: (n) => (n === 1 ? "in 1 hour" : `in ${n} hours`),
  aired: "Aired",
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  date: (y, m, d, thisYear) => {
    if (!m) return `${y}`;
    const month = MONTHS[m - 1];
    if (!d) return `${month} ${y}`;
    return thisYear ? `${month} ${d}` : `${month} ${d}, ${y}`;
  },

  feeds: {
    airing: {
      label: "Airing schedule",
      short: "Schedule",
      blurb: "Anime airing each day this week, in your time zone",
    },
    season: {
      label: "Seasonal anime",
      short: "Season",
      blurb: "A season’s new anime, by popularity",
    },
    manga: {
      label: "Trending manga",
      short: "Manga",
      blurb: "The manga most people are reading right now",
    },
    movies: {
      label: "Movies",
      short: "Movies",
      blurb: "In cinemas now and coming soon",
    },
  },
  season: (season, year) =>
    `${{ WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" }[season]} ${year}`,
  movieLists: {
    now_playing: "Now playing",
    upcoming: "Upcoming",
    trending: "Trending this week",
  },
  day: "Day",
  mineOnly: "Only my library",
  noneFromLibrary: "Nothing from your library airs this day",
  noneThisDay: "No anime airs this day",
  hiddenAiring: (n) =>
    `${n} ${n === 1 ? "show airs" : "shows air"} this day; turn off “Only my library” to see ${n === 1 ? "it" : "them"}.`,
  seasonLabel: "Season",
  thisSeason: "now",
  seasonEmpty: "Nothing announced for this season yet",
  country: "Country",
  list: "List",
  nothingYet: "Nothing here right now",
  moviesNotSetUp: "Movies aren’t set up yet",
  moviesNotSetUpHint:
    "Movie data comes from TMDB, which needs a free API key: set the TMDB_API_KEY environment variable on the server (see the README).",
  loadFailed: "Couldn’t load",
  openOwned: (name) => `Open “${name}” in your library`,
  addToLibrary: (title) => `Add “${title}” to your library`,
  viewOn: (site, title) => `View “${title}” on ${site}`,
  viewOnShort: (site) => `View on ${site}`,
  episode: (n) => `Ep ${n}`,
  episodes: (n) => (n === 1 ? "1 ep" : `${n} eps`),
  chapters: (n) => (n === 1 ? "1 ch." : `${n} ch.`),
  inLibrary: "In library",
  inCinemas: (date) => `In cinemas ${date}`,
  releaseTba: "Release date TBA",
  premieres: (date) => `Premieres ${date}`,
  comingSoon: "Coming soon",
  nextEpisode: (weekday, time, n) => `Ep ${n} on ${weekday} ${time}`,
  format: {
    短篇: "Short",
    剧场版: "Movie",
    特别篇: "Special",
    网络: "ONA",
  },
  phase: {
    anime: {
      upcoming: "Not yet aired",
      releasing: "Airing",
      hiatus: "On hiatus",
      finished: "Finished",
      cancelled: "Cancelled",
    },
    manga: {
      upcoming: "Not yet started",
      releasing: "Publishing",
      hiatus: "On hiatus",
      finished: "Finished",
      cancelled: "Cancelled",
    },
  },
  tmdbCredit: "Movie data comes from TMDB.",
  dataFrom: "Data from",
  noNetwork: "You’re offline. Try again once you’re connected.",
  serverUnreachable: "Can’t reach the server. Try again later.",
  serverError: (status) =>
    status === 502
      ? "The data source didn’t answer. Try again later."
      : `Server error (${status})`,
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const MESSAGES: Record<Locale, Messages> = { zh, en };
