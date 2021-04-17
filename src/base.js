import {preset, type} from "./controller/constants";
import {Notifier} from "./controller/notifier";
import {webrtc_connect_callback} from "./controller/webRTC";

export class Base {
    constructor(module, webrtc) {
        // Wasm api
        this.api = {
            // Image processing Section
            analyse: module.cwrap('analyse', 'number', ['string']),
            rotate: module.cwrap('rotate', 'number', ['array', 'number']),
            version: module.cwrap('version', '', []),

            // ePub processing Section
            epub_open: module.cwrap('epub_open', 'number', ['string']),
            epub_count: module.cwrap('epub_count', '', []),
            // epub_bundle: module.cwrap('epub_bundle', '', []),
            // epub_image: module.cwrap('epub_image', 'number', ['number'])
        };
        // WebRTC Host
        this.client = false;
        // Current page & offset
        this.cur = this._offset = 0;
        // File list
        this.files = [];
        // Right-to-Left Order (Left-to-Right -1)
        this.ltr = -1;
        // Messagebox timer
        this.message = null;
        // Meta data
        this.meta = null;
        // Wasm module
        this.module = module;
        // Observer
        this.observer = {'image': null, 'step': null};
        // Enum image container
        this.pos = Object.freeze({
            primary: Symbol('primary'),
            secondary: Symbol('secondary')
        });
        // Scale ratio
        this.ratio = 1;
        // Rotate switch
        this.rotate_flags = Object.freeze({
            default: -1,
            rotate_90_clockwise: 0,
            rotate_180: 1,
            rotate_90_counterclockwise: 2
        });
        this.rotate = this.rotate_flags.default;
        // Page step
        this.step = 2;
        // Title
        this.title = {'episode': '', 'manga': ''}
        // Enum type
        this.type = type.undefined;
        // Vertical mode
        this.vertical = false;
        // Viewport
        this.viewport = new Map();
        // WebRTC submodule
        this.webrtc = webrtc;
        this.webrtc.pc.onconnectionstatechange = webrtc_connect_callback.bind(this);
        this.webrtc.pc.ondatachannel = this._webrtc_dc_callback.bind(this);
        this.webrtc.ctrl.onmessage = this._webrtc_control_callback.bind(this);

        this._init_observer();
        this._observe_step();
        this._read_setting();
    }

    get offset() {
        if (this.rotate === this.rotate_flags.default) return this._offset
        else return 0;
    }

    set offset(value) {
        this._offset = value;
    }

    get primary() {
        return this.cur - this.offset;
    }

    get secondary() {
        return this.cur - this.offset + 1;
    }

    get rtl() {
        return -this.ltr;
    }

    get viewtop() {
        return [...this.viewport.keys()].sort((a, b) => b - a)[0];
    }

    get URL() {
        return window.URL || window.webkitURL;
    }

    async open_webrtc() {
        // TODO: Working flow should be reconsidered
        if (!this.webrtc.connected) this.toggle_webrtc();
    }

    page_up() {
        this._page_move(-this.step);
        this._update();
    }

    page_down() {
        this._page_move(this.step);
        this._update();
    }

    page_drag(event) {
        const index = event.target.value - 1;
        if (this.vertical) {
            document.getElementById('image-list').children[index].scrollIntoView();
            this.viewport.clear();
            this.viewport.set(index, 1);
        } else {
            this.cur = index * this.step;
            this._update();
        }
    }

    page_arrowleft() {
        this._page_move(-this.ltr * this.step);
        this._update();
    }

    page_arrowright() {
        this._page_move(this.ltr * this.step);
        this._update();
    }

    scale_up() {
        if (this._to_fixed(this.ratio, 1) === 2) return;
        this.ratio += 0.1;
        this._scale();
        this._update_scale();
    }

    scale_down() {
        if (this._to_fixed(this.ratio, 1) === 0.5) return;
        this.ratio -= 0.1;
        this._scale();
        this._update_scale();
    }

    scale_reset() {
        this.ratio = 1;
        this._scale();
        this._update_scale();
    }

    copy_text(span) {
        let input = span.children[0];
        input.select();
        // Clipboard API requires SECURE context, aka HTTPS connection or localhost
        // Fallback to deprecated method document.execCommand
        if (navigator.clipboard) {
            document.execCommand("copy");
        } else {
            navigator.clipboard?.writeText(input.value);
        }
        if (input.id === 'answer-responsed') this._webrtc_connecting();
    }

    async paste_text(span) {
        let input = span.children[0];
        input.select();
        // Clipboard API requires SECURE context, aka HTTPS connection or localhost
        // There is no way to fallback
        input.value = await navigator.clipboard?.readText();
        if (input.id === 'offer-provided') this.receive_offer();
        if (input.id === 'answer-replied') this.receive_answer();
    }

    toggle_contents() {
        document.getElementById('manga-contents').classList.toggle('hidden');
    }

    toggle_fullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    toggle_webrtc() {
        let dialog = document.getElementById('dialog-webrtc');
        let elements = Array.from(dialog.getElementsByClassName('hidden')).concat(dialog);
        elements.forEach(element => (element.classList.toggle('hidden')));
        document.getElementById('dialog-close-webrtc').addEventListener('click', event => (
            elements.forEach(element => (element.classList.toggle('hidden')))
        ), {once: true});
    }

    toggle_help() {
        let dialog = document.getElementById('dialog-help');
        let elements = Array.from(dialog.getElementsByClassName('hidden')).concat(dialog);
        elements.forEach(element => (element.classList.toggle('hidden')));
        document.getElementById('dialog-close-help').addEventListener('click', event => (
            elements.forEach(element => (element.classList.toggle('hidden')))
        ), {once: true});
    }

    toggle_nav() {
        if (this.type === type.manga === document.getElementById('content-button').disabled) {
            Array.from(document.querySelectorAll('[data-navigator] button')).forEach(element => (
                element.disabled = !element.disabled
            ));
            document.getElementById('alt-previous-episode').disabled = this.type !== type.manga;
            document.getElementById('alt-next-episode').disabled = this.type !== type.manga;
        }
    }

    toggle_rotate(event) {
        Notifier.loading();
        this._flush();
        let button = event.target;
        if (button.tagName.toLowerCase() !== 'button') button = button.parentNode;
        if (this.rotate === this.rotate_flags.default) {
            button.classList.remove('default');
            button.classList.add('rotate_90_clockwise');
            this.rotate = this.rotate_flags.rotate_90_clockwise;
            this.toggle_single(true);
        } else {
            button.classList.remove('rotate_90_clockwise');
            button.classList.add('default');
            this.rotate = this.rotate_flags.default;
            this.toggle_single(false);
        }
    }

    toggle_settings() {
        document.getElementById('reader-setting').classList.toggle('hidden');
    }

    toggle_single(value) {
        if (this.step == 1 !== value) {
            const container = document.getElementById('images-container');
            container.classList.toggle('single-page');
            container.classList.toggle('double-page');
            this._update();
        }
    }

    toggle_ui() {
        let ui = document.getElementById('reader-ui');
        if (ui.classList.contains('v-hidden')) {
            ui.classList.remove('v-hidden');
            ui.classList.add('autohide');
        } else {
            ui.classList.add('a-fade-out');
            ui.classList.remove('autohide');
        }
    }

    toggle_offset() {
        this.offset = (this.offset + 1) % 2;
        this._update();
    }

    toggle_rtl(value) {
        if (this.ltr !== (value ? -1 : 1)) {
            document.getElementById('images-container').classList.toggle('use-rtl');
            document.getElementById('current-page').classList.toggle('left-position');
            document.getElementById('current-page').classList.toggle('right-position');
            document.getElementById('next-page').classList.toggle('left-position');
            document.getElementById('next-page').classList.toggle('right-position');
            document.getElementById('message-image-container').classList.toggle('flip');
            Notifier.show_dir();
        }
        this.ltr = value ? -1 : 1;
        this._reset_hinter();
        if (this.type !== type.undefined) this._update();
    }

    toggle_vertical(value, event) {
        if (this.vertical !== value) {
            document.getElementById('reader-body').classList.toggle('horizontal-mode');
            document.getElementById('reader-body').classList.toggle('vertical-mode');
            document.getElementById('offset').disabled = !this.vertical;
            document.getElementById('rotate').disabled = !this.vertical;
            [...event.target.parentNode.parentNode.parentNode.children]
                .filter(child => child !== event.target.parentNode.parentNode && child.nodeType === 1)
                .forEach(element => element.classList.toggle('hidden'));
            this.vertical = value;
            this._reset_hinter();
        }
    }

    toggle_theme() {
        document.documentElement.classList.toggle('theme-dark');
        document.documentElement.classList.toggle('theme-light');
    }

    // WebRTC Signaling
    async create_offer() {
        let offer = document.getElementById('offer-generated');
        await this.webrtc.pc.setLocalDescription(await this.webrtc.pc.createOffer());
        this.webrtc.pc.onicecandidate = ({candidate}) => {
            if (candidate) return;
            offer.value = this.webrtc.pc.localDescription.sdp;
            offer.select();
        };
    }

    async receive_offer() {
        let offer = document.getElementById('offer-provided');
        let answer = document.getElementById('answer-responsed');
        // if (this.webrtc.pc.signalingState != "stable") return;
        if (!offer.value.endsWith('\n')) offer.value += '\n';
        await this.webrtc.pc.setRemoteDescription({type: "offer", sdp: offer.value});
        await this.webrtc.pc.setLocalDescription(await this.webrtc.pc.createAnswer());
        this.webrtc.pc.onicecandidate = ({candidate}) => {
            if (candidate) return;
            answer.focus();
            answer.value = this.webrtc.pc.localDescription.sdp;
            answer.select();
        };
        // TODO: Action needed if working redesigned
        this.client = true;
    };

    receive_answer() {
        let answer = document.getElementById('answer-replied');
        if (this.webrtc.pc.signalingState !== "have-local-offer") return;
        if (!answer.value.endsWith('\n')) answer.value += '\n';
        this.webrtc.pc.setRemoteDescription({type: "answer", sdp: answer.value});
        this._webrtc_connecting();
    };

    async _load_files(handle) {
        for await (let [_, entry] of handle.entries()) {
            entry.scope = this.index;
            if (entry.kind === 'file') this.files.push(entry);
        }
        this.files.sort((a, b) => (a.name.localeCompare(b.name, {}, {numeric: true})));
    }

    async _file(index) {
        return this._rotate_wrapper(await this.files[index].getFile());
    }

    async* _file_abstract() {
        for (const handle of this.files) {
            let file = await handle.getFile();
            yield await file.slice(0, 2048, file.type);
        }
    }

    async _init_vertical() {
        let iter = this._file_abstract();
        let list = document.getElementById('image-list');
        let next = document.getElementById('load-next-btn');
        Array.from(list.children).forEach(element => (
            list.removeChild(element)
        ));
        list.id = "image-list";
        list.classList.add('image-list', 'm-auto', 'over-hidden');
        next.disabled = true;
        for (const [index, handle] of this.files.entries()) {
            let image = document.createElement('img');
            let meta = new Image();
            image.dataset.index = index;
            meta.onload = _ => (image.width = meta.width, image.height = meta.height);
            meta.src = this.URL.createObjectURL((await iter.next()).value);
            this.observer['image'].observe(image);
            this.observer['progress'].observe(image);
            let container = document.createElement('div');
            container.classList.add('img-container', 'w-100', 'h-100');
            let item = document.createElement('div');
            item.dataset.index = index;
            item.classList.add('image-item', 'p-relative', 'unselectable');
            container.appendChild(image);
            item.appendChild(container);
            // If switch forward and backward instantly, there will be redundant entries
            // However it's far beyond normal user behavior, so won't fix
            if (handle.scope === (this.client ? this.webrtc.scope : this.index)) list.appendChild(item);
        }
    }

    _init_observer() {
        this.observer['image'] = new IntersectionObserver((entries, observer) => (
            entries.forEach(async entry => {
                if (entry.isIntersecting) {
                    const image = entry.target;
                    const index = parseInt(image.dataset.index, 10);
                    image.src = this.URL.createObjectURL(await this.files[index].getFile());
                    image.parentNode.parentNode.classList.add('image-loaded');
                    observer.unobserve(entry.target);
                }
            })
        ));
        this.observer['step'] = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                controller.step = entry.intersectionRatio === 0 ? 1 : 2;
                // When step changes from 1 to 2, whatever this.offset is, this.cur should NOT BE odd
                // Or the first page becomes unreachable
                if (controller.step === 2 && controller.cur % 2) {
                    controller.cur += -2 * controller.offset + 1;
                    controller.toggle_offset();
                }
                // When step changes from 2 to 1, if this.offset is 1, this.cur should NOT BE 0
                // Or the first page becomes blank
                if (controller.step === 1 && controller.offset === 1 && controller.cur === 0) {
                    controller.cur = 1;
                }
                if (controller.type !== type.undefined) controller._update();
                controller._reset_hinter();
            })
        });
        this.observer['progress'] = new IntersectionObserver((entries, observer) => (
            entries.forEach(entry => {
                const image = entry.target;
                const index = parseInt(image.dataset.index, 10);
                if (entry.intersectionRatio > 0) this.viewport.set(index, entry.intersectionRatio);
                if (entry.intersectionRatio === 0) this.viewport.delete(index);
                controller._update_hinter();
                controller._update_progress();
            })
        ));
    }

    _observe_step() {
        const secondary = document.getElementById('image-secondary');
        this.observer['step'].observe(secondary);
    }

    async _rotate_wrapper(blob) {
        if (this.rotate >= 0) {
            let buffer = await blob.arrayBuffer();
            this.module.FS.writeFile('image', new Uint8Array(buffer));
            blob = new Blob([await this.module.rotate_image('image', this.rotate)]);
        }
        return blob;
    }

    async _update_images(e) {
        document.getElementById('image-primary').src = this._validate(this.pos.primary) ? this.URL.createObjectURL(await this._file(this.primary)) : '';
        if (this.step === 2) document.getElementById('image-secondary').src = this._validate(this.pos.secondary) ? this.URL.createObjectURL(await this._file(this.secondary)) : '';
        if (this.files.length === 0) Notifier.error(preset.ERR_NO_FILES);
    }

    _flush() {
        document.getElementById('image-primary').src = '';
        document.getElementById('image-secondary').src = '';
    }

    _ltr(pos = this.pos.primary) {
        return (((pos === this.pos.secondary) ? 1 : -1) * this.ltr + 1) / 2;
    }

    _page_check(after) {
        if (after - this.step % 2 * this.offset < 0) Notifier.error(preset.ERR_ALREADY_FIRST_PAGE)
        else if (after >= this.files.length + this.offset) Notifier.error(preset.ERR_ALREADY_LAST_PAGE);
        return after - this.step % 2 * this.offset >= 0 && after < this.files.length + this.offset;
    }

    _page_move(offset) {
        if (this.vertical) return;
        if (this._page_check(this.cur + offset)) this.cur += offset;
    }

    _read_setting() {
        Array.from(document.getElementById('reader-setting').querySelectorAll('button.selected')).forEach(element => {
            if (element.dataset.setting > 4) this.vertical = element.dataset.setting == 5;
            if (element.dataset.setting < 2) this.ltr = element.dataset.setting == 1 ? -1 : 1;
        });
    }

    _reset(full = false) {
        this.files = new Array();
        this.viewport.clear();
        if (full) this.cur = 0;
    }

    _reset_hinter() {
        let hinter = document.getElementById('hinter-image');
        hinter.classList.remove('flip', 'rotate');
        hinter.parentNode.classList.remove('double', 'single');
        if (this.ltr == -1) hinter.classList.add('flip');
        if (this.step == 1 || this.vertical) hinter.parentNode.classList.add('single')
        else hinter.parentNode.classList.add('double');
        if (this.vertical) hinter.classList.add('rotate');
    }

    _reset_content() {
        document.getElementById('manga-contents').classList.add('hidden');
    }

    _scale() {
        let container = document.getElementById('images-container');
        let parent = container.parentNode;
        let list = document.getElementById('image-list');
        let button = document.getElementById('load-next-btn-container');

        // Horizontal scale
        Array.from(container.querySelectorAll('img')).forEach(element => (
            element.style.transform = `scale(${this.ratio})`
        ));
        if (this.ratio >= 1) {
            container.style.width = `${Math.round(this.ratio * 100)}%`;
            parent.scrollLeft = (parent.clientWidth / 2) * (this.ratio - 1);
        }
        // Vertical scale
        list.style.transform = `scale(${this.ratio})`;
        list.scrollIntoView();
        if (this.vertical) {
            let translate = list.clientHeight * (this.ratio - 1);
            button.style.transform = `translateY(${translate}px)`;
        }
    }

    _scroll_vertical_visibile(element) {
        let bounding = element.getBoundingClientRect();
        return (
            bounding.top <= (window.innerHeight || document.documentElement.clientHeight) &&
            bounding.bottom >= 0 &&
            this.vertical
        )
    };

    _to_fixed(value, float) {
        if (float <= 0 || Math.round(float) != float) throw {
            msg: 'Value must be an interger which is greater than 0.',
            value: float
        };
        return (Math.round(parseFloat(value) * 10 * float) / (10 * float));
    }

    _validate(pos = this.pos.primary) {
        return ((pos === this.pos.primary && this.primary >= 0 && this.primary < this.files.length) ||
            (pos === this.pos.secondary && this.secondary >= 0 && this.secondary < this.files.length)) && this.files.length > 0;
    }

    _update() {
        this._update_images();
        this._update_info();
        this._update_progress();
        this._update_hinter();
        this._update_scale();
    }

    _update_hinter() {
        let current_page = document.getElementById('current-page');
        let next_page = document.getElementById('next-page');
        current_page.innerHTML = !this._validate(this.pos.primary) ? '' : this.primary + 1;
        next_page.innerHTML = !this._validate(this.pos.secondary) ? '' : this.secondary + 1;
        if (this.vertical) current_page.innerHTML = isNaN(this.viewtop) ? '' : this.viewtop + 1;
    }

    _update_info() {
        let manga = document.getElementById('manga-title');
        manga.innerHTML = this.title['manga'];
        manga.title = this.title['manga'];
        let episode = document.getElementById('episode-title');
        episode.innerHTML = this.title['episode'];
        episode.title = this.title['episode'];
        document.getElementById('page-count').innerHTML = this.files.length || '';
        // TODO: Change to logged location [Low priority]
    }

    _update_progress() {
        let value = this.vertical ? (isNaN(this.viewtop) ? 1 : this.viewtop + 1) : (Math.floor((this.cur + this.offset) / this.step) + 1);
        let max = Math.round((this.files.length + this.offset) / this.step);
        document.getElementsByClassName('progress-indicator')[0].innerHTML = `${value} / ${max}`;
        let progress = document.getElementById('progress-indicator');
        progress.value = value;
        progress.max = max;
    }

    _update_scale() {
        document.getElementById('scale-percentage').innerHTML = `${Math.round(this.ratio * 100)}%`;
    }

    _webrtc_connecting() {
        document.querySelectorAll('[id^="answer"]').forEach(element => (
            element.parentNode.classList.add('loading')
        ));
    }

    _webrtc_connected() {
        document.querySelectorAll('[id^="answer"]').forEach(element => {
            element.parentNode.classList.remove('loading');
            element.parentNode.classList.add('accomplished');
        });
        setTimeout(() => (document.getElementById('dialog-webrtc').classList.add('hidden')), 3000);
    }


    _webrtc_dc_callback(event) {
        const channel = event.channel;
        if (['file', 'file_abstract'].includes(channel.label)) this.webrtc.channels.set(channel.id, channel);
    }

    async _webrtc_control_callback(event) {
        let msg = JSON.parse(event.data);
        if (msg.target == this.webrtc.target.client) return;
        switch (msg.cmd) {
            case 'abstract':
                await this._webrtc_reply_abstract(msg.args);
                break;
            case 'episode':
                this._webrtc_reply_episode(msg.args);
                break;
            case 'fetch':
                await this._webrtc_reply_file(msg.args);
                break;
            default:
                console.error('Unexpected command.')
        }
    }

    async _webrtc_store_meta(rx) {
        return new Promise((resolve) => (
            rx.onmessage = (event) => {
                const payload = JSON.parse(event.data);
                this.meta = payload;
                resolve();
            }
        ))
    }

    async _webrtc_reply_episode(args) {
        let episode = {
            name: '',
            length: 0,
        };
        switch (this.type) {
            case type.manga:
                let files = new Array();
                for await (const [_, entry] of this.episodes[args.index].entries()) {
                    if (entry.kind === 'file') files.push(entry);
                }
                ;
                episode.name = this.episodes[args.index].name;
                episode.length = files.length;
                break;
            case type.episode:
            case type.epub:
                episode.name = this.title['episode'];
                episode.length = this.files.length;
                break;
        }
        this.webrtc.scope = args.index;
        this.webrtc.cmd('episode', this.webrtc.target.client, episode);
    }

    async _webrtc_reply_abstract(args) {
        let files = null;
        let data = null;
        switch (this.type) {
            case type.manga:
                files = new Array();
                for await (const [_, entry] of this.episodes[args.scope].entries()) {
                    if (entry.kind === 'file') files.push(entry);
                }
                ;
                files.sort((a, b) => (a.name.localeCompare(b.name, {}, {numeric: true})));
                break;
            case type.episode:
            case type.epub:
                files = this.files;
                break;
        }

        data = await new Blob(await Promise.all(files.map(async handle => {
            let file = await handle.getFile();
            return await file.slice(0, 2048, file.type);
        }))).arrayBuffer();
        this.webrtc._transmit_data(data, args.channel);
    }

    async _webrtc_reply_file(args) {
        let file = null;
        let data = null;
        switch (this.type) {
            case type.manga:
                let files = new Array();
                for await (const [_, entry] of this.episodes[args.scope].entries()) {
                    if (entry.kind === 'file') files.push(entry);
                }
                ;
                files.sort((a, b) => (a.name.localeCompare(b.name, {}, {numeric: true})));
                file = await files[args.index].getFile();
                break;
            case type.episode:
            case type.epub:
                file = await this.files[args.index].getFile();
                break;
        }
        data = await file.arrayBuffer();
        this.webrtc._transmit_data(data, args.channel);
    }

    _webrtc_transmit_meta() {
        if (this.webrtc.pc.connectionState != 'connected') return;
        let meta = {
            manga: this.title.manga,
            episode: this.title.episode,
            type: this.type,
            episodes: this.episodes ? this.episodes.map(episode => ({name: episode.name})) : null,
        };
        this.webrtc._transmit_meta(meta);
    }
}

let controller = null;
Object.defineProperty(this, 'controller', {
    get() {
        return controller;
    },
    set(v) {
        controller = v;
    }
});