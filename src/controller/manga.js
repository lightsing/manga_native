import {preset, type} from "./constants";
import {Notifier} from "./notifier";
import {Base} from "../base";

export class Manga extends Base {
    constructor(handle, module, webrtc) {
        super(module, webrtc);
        // Episode list
        this.episodes = new Array();
        // Episode index
        this.index = 0;
        // Root directory file handle
        this.root = handle;
        // Type definition
        this.type = type.manga;
    }

    async init() {
        await this.load();
        Notifier.info(preset.INFO_MANGA_LOADED);
        if (this.episodes.length == 0) Notifier.error(preset.ERR_NO_EPISODES);
    }

    async sync() {
        await this.load();
        Notifier.info(preset.INFO_SYNCD);
        if (this.episodes.length == 0) Notifier.error(preset.ERR_NO_EPISODES);
    }

    async load() {
        let tmp = new Array();
        for await (const [_, entry] of this.root.entries()) {
            if (entry.kind === 'directory') tmp.push(entry);
        }
        ;
        tmp.sort((a, b) => (a.name.localeCompare(b.name, {}, {numeric: true})));
        if (tmp.length != 0) this.episodes = tmp;
        await this._episode_move(0);
        this.toggle_nav();
        this._init_contents();
        this._update();
        this._webrtc_transmit_meta();
    }

    async episode_up() {
        await this._episode_move(-1);
        this._update();
    }

    async episode_down() {
        await this._episode_move(1);
        this._update();
    }

    async episode_switch(event) {
        await this._episode_move(parseInt(event.target.dataset.index, 10) - this.index);
        this._update();
    }

    async episode_scrolldown() {
        await this._episode_move(1);
        this._update();
    }

    async page_up() {
        await this._page_move(-1);
        this._update();
    }

    async page_down() {
        await this._page_move(1);
        this._update();
    }

    async page_arrowleft() {
        await this._page_move(-this.ltr);
        this._update();
    }

    async page_arrowright() {
        await this._page_move(this.ltr);
        this._update();
    }

    async _episode_move(offset) {
        if (offset == -1) Notifier.info(preset.INFO_PREVIOUS_EPISODE);
        if (offset == 1) Notifier.info(preset.INFO_NEXT_EPISODE);
        if (this._episode_check(this.index + offset)) {
            this.index += offset;
            this._reset(offset);
            await this._load_files(this.episodes[this.index]);
            this._init_vertical();
            if (this.vertical) this._scale();
        } else if (this.index + offset < 0) {
            Notifier.error(preset.ERR_ALREADY_FIRST_EPISODE);
        } else if (this.index + offset >= this.episodes.length) {
            Notifier.error(preset.ERR_ALREADY_LAST_EPISODE);
        }
    }

    async _init_vertical() {
        super._init_vertical();
        let next = document.getElementById('load-next-btn');
        next.disabled = this.index >= this.episodes.length - 1;
    }

    async _page_move(offset) {
        if (this.vertical) return;
        if (this._page_check(this.cur + offset * this.step)) {
            this.cur += offset * this.step;
        } else {
            await this._episode_move(offset);
        }
    }

    _content(title, index) {
        let label = document.createElement('div');
        label.classList.add('label');
        label.dataset.contents = null;
        label.dataset.index = index;
        label.innerHTML = title;
        let button = document.createElement('button');
        button.classList.add('list-item', 'app-button');
        button.dataset.contents = null;
        button.dataset.index = index;
        button.title = title;
        button.appendChild(label);
        return button;
    }

    _episode_check(after) {
        return after >= 0 && after < this.episodes.length;
    }

    _init_contents() {
        document.getElementById('episode-count').innerHTML = this.episodes.length;
        let old = document.getElementById('data-contents');
        let contents = document.createElement('div');
        contents.classList.add('data-list'/*, 'p-relative', 'ps' , 'ps--active-y', 'ps--scrolling-y' */);
        contents.dataset.contents = null;
        contents.id = 'data-contents';
        for (const [index, episode] of this.episodes.entries()) {
            contents.appendChild(this._content(episode.name, index));
        }
        old.parentNode.replaceChild(contents, old);
    }

    _update() {
        super._update();
        this._update_contents();
        this._update_nav();
    }

    _update_info() {
        this.title['manga'] = this.root?.name || '';
        this.title['episode'] = this.episodes[this.index]?.name || '';
        super._update_info();
    }

    _update_contents() {
        Array.from(document.getElementById('data-contents').getElementsByClassName('list-item')).forEach(element => (
            element.classList.remove('selected')
        ));
        document.querySelector(`button[data-index="${this.index}"]`)?.classList?.add('selected', 'read');
    }

    _update_nav() {
        document.getElementById('previous-episode').disabled = this.index - 1 < 0;
        document.getElementById('next-episode').disabled = this.index + 1 >= this.episodes.length;
        document.getElementById('alt-previous-episode').disabled = this.index - 1 < 0;
        document.getElementById('alt-next-episode').disabled = this.index + 1 >= this.episodes.length;
    }
}