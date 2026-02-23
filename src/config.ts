export const SITE = {
  website: "https://www.oscarjiang.site/",
  author: "Oscar",
  profile: "https://www.oscarjiang.site/about/",
  desc: "创业、管理、技术",
  title: "This is Oscar",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 20,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showBackButton: true,
  editPost: {
    enabled: false,
    text: "编辑",
    url: "https://github.com/warmwind/blog/edit/main/",
  },
  dynamicOgImage: true,
  dir: "ltr",
  lang: "zh-CN",
  timezone: "Asia/Shanghai",
} as const;
