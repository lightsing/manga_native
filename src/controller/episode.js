import {preset, type} from "./constants";
import {Notifier} from "./notifier";
import {Base} from "../base";

export class Episode extends Base {
    constructor(handle, module, webrtc) {
        super(module, webrtc);
        // File handle
        this.handle = handle;
        // Type definition
        this.type = type.episode;
    }

    async init() {
        await this.load();
        Notifier.info(preset.INFO_EPISODE_LOADED);
        if (this.files.length == 0) Notifier.error(preset.ERR_NO_FILES);
    }

    async sync() {
        await this.load();
        Notifier.info(preset.INFO_SYNCD);
        if (this.files.length == 0) Notifier.error(preset.ERR_NO_FILES);
    }

    async load() {
        this._reset();
        this.title['episode'] = this.handle.name;
        await this._load_files(this.handle);
        this.toggle_nav();
        this._update();
        this._reset_content();
        this._init_vertical();
        this._webrtc_transmit_meta();
    }
}