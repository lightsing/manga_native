export const preset = Object.freeze({
    INFO_CANCELLED: '已取消选择',
    INFO_EPUB_LOADED: '加载文件成功',
    INFO_EPISODE_LOADED: '加载章节成功',
    INFO_MANGA_LOADED: '加载漫画成功',
    INFO_PREVIOUS_EPISODE: '已切换到上一话',
    INFO_NEXT_EPISODE: '已切换至下一话',
    INFO_SYNCD: '已同步文件内容',
    INFO_WEBRTC_CONNECTED: '已建立连接',

    ERR_ALREADY_FIRST_PAGE: '已经是第一页了',
    ERR_ALREADY_LAST_PAGE: '已经是最后一页了',
    ERR_ALREADY_FIRST_EPISODE: '没有上一话了',
    ERR_ALREADY_LAST_EPISODE: '没有下一话了',
    ERR_NO_FILES: '没有可显示的图片',
    ERR_NO_EPISODES: '没有可显示的章节',

    CUSTOM: null
});
export const type = Object.freeze({
    undefined: 0,
    epub: 1,
    episode: 1,
    manga: 2
});