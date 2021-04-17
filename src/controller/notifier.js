export class Notifier {
    constructor() {
    }

    static debug(debug, alt) {
        this._toast(debug || alt);
    }

    static info(info, alt) {
        this._toast(info || alt);
    }

    static error(error, alt) {
        this._toast(error || alt);
    }

    static show_dir() {
        this._dir();
    }

    static loaded() {
        document.getElementById('loading-hinter').classList.add('hidden');
    }

    static loading() {
        document.getElementById('loading-hinter').classList.remove('hidden');
    }

    static _toast(msg) {
        this._clear(this.toast, 'episode-toast');
        document.getElementById('toast-content').innerHTML = msg;
        document.getElementById('episode-toast').classList.remove('hidden');
        this.toast = setTimeout(() => (document.getElementById('episode-toast').classList.add('hidden')), 3000);
    }

    static _dir() {
        this._clear(this.dir, 'message-box');
        document.getElementById('message-box').classList.add('hidden');
        document.getElementById('message-box').classList.remove('hidden');
        this.dir = setTimeout(() => (document.getElementById('message-box').classList.add('hidden')), 3000);
    }

    static _clear(timer, id) {
        window.clearTimeout(timer);
        document.getElementById(id).classList.add('hidden');
    }
}