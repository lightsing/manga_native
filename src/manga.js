import Module from './plugin';
import {Notifier} from "./controller/notifier";
import {WebRTC} from "./controller/webRTC";
import {Base, controller} from "./base";
import {preset} from "./controller/constants";
import {Manga} from "./controller/manga";
import {Episode} from "./controller/episode";
import {Epub} from "./controller/epub";

window.addEventListener('DOMContentLoaded', () => init());

let open_manga = async () => {
    const handle = await window.showDirectoryPicker().catch(err => {
        controller._update();
        Notifier.info(preset.INFO_CANCELLED);
    });
    if (handle === undefined) return;
    controller = new Manga(handle, this.module, this.webrtc);
    await controller.init();
}

let open_episode = async () => {
    const handle = await window.showDirectoryPicker().catch(err => {
        controller._update();
        Notifier.info(preset.INFO_CANCELLED);
    });
    if (handle === undefined) return;
    controller = new Episode(handle, this.module, this.webrtc);
    await controller.init();
}

let open_epub = async () => {
    const opts = {
        types: [
            {
                // description: '',
                accept: {
                    'application/epub+zip': ['.epub']
                }
            }
        ]
    };
    const [handle] = await window.showOpenFilePicker(opts).catch(err => {
        controller._update();
        Notifier.info(preset.INFO_CANCELLED);
    });
    if (handle === undefined) return;
    controller = new Epub(handle, this.module, this.webrtc);
    await controller.init();
}

let init = () => {
    let ui = document.getElementById('reader-ui');
    let body = document.getElementById('reader-body');
    let container = document.getElementById('ps-container');
    ui.addEventListener('animationend', event => {
        if (event.animationName === 'fade-out') {
            event.target.classList.add('v-hidden');
            event.target.classList.remove('a-fade-out');
        } else if (event.animationName === 'delayed-move-out-top' || event.animationName === 'delayed-move-out-bottom') {
            event.target.parentNode.classList.add('v-hidden');
            event.target.parentNode.classList.remove('autohide');
        }
    });
    ui.addEventListener('mouseleave', event => (
        event.target.classList.add('autohide')
    ));
    document.addEventListener('mousemove', event => {
        if (event.pageX < (window.innerWidth / 2)) {
            body.classList.add('arrow-left');
            body.classList.remove('arrow-right');
        } else {
            body.classList.remove('arrow-left');
            body.classList.add('arrow-right');
        }
    }, false);
    Array.from(document.querySelectorAll('button[data-setting]')).forEach(element => (
        element.addEventListener('click', event => {
            let callbacks = {
                '0': () => (controller.toggle_rtl(false)),
                '1': () => (controller.toggle_rtl(true)),
                '2': () => (controller.toggle_single(false)),
                '3': () => (controller.toggle_single(true)),
                '4': () => (controller.toggle_vertical(false, event)),
                '5': () => (controller.toggle_vertical(true, event)),
            }
            callbacks[event.target.dataset.setting]();
            if (!(event.target.disabled || event.target.classList.contains('selected'))) {
                Array.from(event.target.parentNode.children).forEach(element => {
                    element.classList.toggle('selected');
                });
            }
        })
    ));
    container.addEventListener('mouseup', event => {
        if (event.button !== 0) return;
        if (controller.vertical) return;
        if (window.innerWidth < window.innerHeight) return;
        if ((event.pageX < (window.innerWidth / 2)) === (controller.rtl === 1)) {
            controller.page_down();
        } else {
            controller.page_up();
        }
    });
    container.addEventListener('click', event => {
        document.elementsFromPoint(event.clientX, event.clientY).forEach(element => {
            if (element.classList.contains('touch-button')) element.click();
        });
    })
    document.querySelectorAll("button").forEach(button => (
        button.addEventListener('keydown', event => (event.preventDefault()))
    ));
    document.body.onkeyup = event => {
        let ops = {
            "ArrowUp": () => (controller.page_up()),
            "ArrowDown": () => (controller.page_down()),
            "ArrowLeft": () => { if (!controller.vertical) controller.page_arrowleft() },
            "ArrowRight": () => { if (!controller.vertical) controller.page_arrowright() },
            "KeyC": () => (controller.toggle_offset()),
            "PageUp": () => (controller.page_up()),
            "PageDown": () => (controller.page_down()),
            "Backspace": () => (controller.page_up()),
            "Space": () => (controller.page_down()),
            "Enter": () => (controller.toggle_ui())
        };
        (ops[event.code] || (() => void 0))();
    };
    const $ = (el) => document.querySelectorAll(el);
    $('.toggle-ui').forEach(e => e.addEventListener('click', () => controller.toggle_ui()));
    $('.toggle-theme').forEach(e => e.addEventListener('click', () => controller.toggle_theme()));
    $('.toggle-contents').forEach(e => e.addEventListener('click', () => controller.toggle_contents()));
    $('.toggle-settings').forEach(e => e.addEventListener('click', () => controller.toggle_settings()));
    $('.toggle-help').forEach(e => e.addEventListener('click', () => controller.toggle_help()));
    $('.toggle-offset').forEach(e => e.addEventListener('click', () => controller.toggle_offset()));
    $('.toggle-rotate').forEach(e => e.addEventListener('click', (event) => controller.toggle_rotate(event)));
    $('.toggle-fullscreen').forEach(e => e.addEventListener('click', () => controller.toggle_fullscreen()));

    $('.open-webrtc').forEach(e => e.addEventListener('click', () => controller.open_webrtc()));
    $('.open-manga').forEach(e => e.addEventListener('click', () => open_manga()));
    $('.open-epub').forEach(e => e.addEventListener('click', () => open_epub()));

    $('.page-arrowleft').forEach(e => e.addEventListener('click', () => controller.page_arrowleft()));
    $('.page-arrowright').forEach(e => e.addEventListener('click', () => controller.page_arrowright()));
    $('.scale-down').forEach(e => e.addEventListener('click', () => controller.scale_down()));
    $('.scale-reset').forEach(e => e.addEventListener('click', () => controller.scale_reset()));
    $('.scale-up').forEach(e => e.addEventListener('click', () => controller.scale_up()));
    $('.episode-up').forEach(e => e.addEventListener('click', () => controller.episode_up()));
    $('.episode-down').forEach(e => e.addEventListener('click', () => controller.episode_down()));
    $('.episode-switch').forEach(e => e.addEventListener('click', (event) => controller.episode_switch(event)));
    $('.episode-scrolldown').forEach(e => e.addEventListener('click', () => controller.episode_scrolldown()));

    $('.sync').forEach(e => e.addEventListener('click', () => controller.sync()));
    $('.event-download').forEach(e => e.addEventListener('click', () => window.dispatchEvent(new Event('download'))));
    $('.copy-text').forEach(e => e.addEventListener('click', () => controller.copy_text(e)));
    $('.paste-text').forEach(e => e.addEventListener('click', () => controller.copy_text(e)));
    $('.page-drag').forEach(e => e.addEventListener('input', (event) => controller.page_drag(event)));
    document.getElementById('image-secondary').addEventListener('load', () => Notifier.loaded());
    document.getElementById('image-primary').addEventListener('load', () => Notifier.loaded());

    Module().onRuntimeInitialized = async _ => {
        controller = new Base(Module(), new WebRTC());
        controller.create_offer();
        Notifier.show_dir();
    };
};
