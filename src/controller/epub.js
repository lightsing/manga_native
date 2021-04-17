import {Episode} from "./episode";
import {preset, type} from "./constants";
import {Notifier} from "./notifier";

export class Epub extends Episode {
    constructor(handle, module, webrtc) {
        super(handle, module, webrtc);
        // Type definition
        this.type = type.epub;
    }

    async init() {
        await this.load();
        Notifier.info(preset.INFO_EPUB_LOADED);
        if (this.files.length == 0) Notifier.error(preset.ERR_NO_FILES);
    }

    async load() {
        Notifier.loading();
        this._flush();
        const file = await this.handle.getFile();
        let buffer = await file.arrayBuffer();
        this.module.FS.writeFile('tmp.epub', new Uint8Array(buffer)); // Unicode filename not supported
        this.api.epub_open('tmp.epub');
        this.title['episode'] = this.handle.name;
        this._load_files();
        this.toggle_nav();
        this._update();
        this._reset_content();
        this._init_vertical();
        this._webrtc_transmit_meta();
    }

    _load_files() {
        this.files = Array(this.api.epub_count()).fill().map((_, i) => ({
            scope: this.index,
            getFile: async _ => (new Blob([await this.module.epub_image(i)]))
        }));
    }
}