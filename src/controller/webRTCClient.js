import {Manga} from "./manga";
import {preset, type} from "./constants";
import {Notifier} from "./notifier";
import {Base} from "../base";

export class WebRTCClient extends Base {
    constructor(module, webrtc) {
        super(module, webrtc);
        // WebRTC Client
        this.client = true;
        // Episode list
        this.episodes = new Array();
        // Episode index
        this.index = 0;
        // Episode promise resolve
        this.resolve;
    }

    get sync() {
        // return this.type == type.manga ? Manga.prototype.sync : Episode.prototype.sync;
    }

    get episode_up() {
        return Manga.prototype.episode_up;
    }

    get episode_down() {
        return Manga.prototype.episode_down;
    }

    get episode_switch() {
        return Manga.prototype.episode_switch;
    }

    get episode_scrolldown() {
        return Manga.prototype.episode_scrolldown;
    }

    get page_up() {
        return this.type == type.manga ? Manga.prototype.page_up : super.page_up;
    }

    get page_down() {
        return this.type == type.manga ? Manga.prototype.page_down : super.page_down;
    }

    get page_arrowleft() {
        return this.type == type.manga ? Manga.prototype.page_arrowleft : super.page_arrowleft;
    }

    get page_arrowright() {
        return this.type == type.manga ? Manga.prototype.page_arrowright : super.page_arrowright;
    }

    get _page_move() {
        return this.type == type.manga ? Manga.prototype._page_move : super._page_move;
    }

    get _content() {
        return Manga.prototype._content;
    }

    get _episode_check() {
        return Manga.prototype._episode_check;
    }

    get _init_contents() {
        return Manga.prototype._init_contents;
    }

    get _init_vertical() {
        return this.type == type.manga ? Manga.prototype._init_vertical : super._init_vertical;
    }

    get _update() {
        return this.type == type.manga ? Manga.prototype._update : super._update;
    }

    get _update_contents() {
        return Manga.prototype._update_contents;
    }

    get _update_nav() {
        return Manga.prototype._update_nav;
    }

    async load() {
        this._webrtc_parse_meta();
        this.toggle_nav();
        this._reset(true);
        switch (this.type) {
            case type.manga:
                await this._episode_move(0);
                this._init_contents();
                this._update();
                break;
            case type.episode:
            case type.epub:
                await this._load_files(this.index);
                this.title['episode'] = this.meta.episode;
                this._update();
                this._reset_content();
                break;
        }
    }

    async _episode_move(offset) {
        if (offset == -1) Notifier.info(preset.INFO_PREVIOUS_EPISODE);
        if (offset == 1) Notifier.info(preset.INFO_NEXT_EPISODE);
        if (this._episode_check(this.index + offset)) {
            this.index += offset;
            this._reset(offset);
            await this._load_files(this.index);
            this._init_vertical();
            if (this.vertical) this._scale();
        } else if (this.index + offset < 0) {
            Notifier.error(preset.ERR_ALREADY_FIRST_EPISODE);
        } else if (this.index + offset >= this.episodes.length) {
            Notifier.error(preset.ERR_ALREADY_LAST_EPISODE);
        }
    }

    async _webrtc_dc_callback(event) {
        const channel = event.channel;
        switch (channel.label) {
            case 'file':
            case 'file_abstract':
                this.webrtc.channels.set(channel.id, channel);
                break;
            case 'meta':
                await this._webrtc_store_meta(channel);
                this.load();
                break;
        }
    }

    async _webrtc_control_callback(event) {
        let msg = JSON.parse(event.data);
        if (msg.target == this.webrtc.target.host) return;
        switch (msg.cmd) {
            case 'episode':
                this._webrtc_load_files(msg.args);
                break;
            default:
                console.error('Unexpected command.')
        }
    }

    async _webrtc_request_episode(index) {
        let args = {
            index: index,
        };
        this.webrtc.scope = index;
        this.webrtc.cmd('episode', this.webrtc.target.host, args);
        return new Promise((resolve) => this.resolve = resolve);
    }

    _webrtc_request_meta() {
        this.webrtc.cmd('meta', this.webrtc.target.host);
    }

    _webrtc_parse_meta() {
        if (this.meta == null) return;
        this.type = this.meta.type;
        this.episodes = this.meta.episodes;
        this.index = 0;
    }

    _webrtc_load_files(args) {
        this.files = Array(args.length).fill().map((_, i) => ({
            index: i,
            scope: this.webrtc.scope,
            getFile: async _ => (new Blob(await this.webrtc.file(i))),
        }));
        this.resolve();
    }

    async _load_files(index) {
        await this._webrtc_request_episode(index);
    }

    async* _file_abstract() {
        let data = new Blob(await this.webrtc.file_abstract());
        for (let i = 0; i < this.files.length; i++) {
            let start = i * 2048, end = start + 2048;
            yield await data.slice(start, end, data.type);
        }
    }

    _update_info() {
        if (this.meta == null) return;
        switch (this.type) {
            case type.manga:
                this.title['manga'] = this.meta.manga || '';
                this.title['episode'] = this.episodes[this.index]?.name || '';
                break;
            case type.episode:
            case type.epub:
                this.title['episode'] = this.meta.episode || '';
                break;
        }
        super._update_info();
    }
}