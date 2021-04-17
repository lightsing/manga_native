import {controller} from "../base";
import {Notifier} from "./notifier";
import {preset} from "./constants";
import {WebRTCClient} from "./webRTCClient";

export class WebRTC {
    constructor() {
        const config = {iceServers: []};
        this.pc = new RTCPeerConnection(config);
        this.ctrl = this.pc.createDataChannel("ctrl", {negotiated: true, id: 0});
        this.channels = new Map();
        this.scope = 0;
        this.target = Object.freeze({
            host: 0,
            client: 1,
            unspecified: 2,
        })
    }

    get connected() {
        return this.pc.connectionState == 'connected' && this.ctrl.readyState == 'open';
    }

    cmd(cmd, target, args = null) {
        if (this.ctrl.readyState != 'open') return;
        this.ctrl.send(JSON.stringify({cmd: cmd, target: target, args: args}));
    }

    async file(index) {
        let args = {
            scope: this.scope,
            index: index,
        };
        return await this._request_data('file', 'fetch', args);
    }

    async file_abstract() {
        let args = {
            scope: this.scope,
        };
        return await this._request_data('file_abstract', 'abstract', args)
    }

    async _request_data(channel, cmd, args) {
        let rx = this.pc.createDataChannel(channel);
        let buffer = new Array();
        let meta = null;
        let size = 0;
        args['channel'] = rx.id;
        rx.onopen = event => {
            this.channels.set(rx.id, rx);
            rx.binaryType = 'arraybuffer';
            this.cmd(cmd, this.target.host, args);
        };
        rx.onmessage = (event) => {
            const data = event.data;
            if (data instanceof ArrayBuffer) {
                buffer.push(event.data);
                size += event.data.byteLength;
                if (size == meta.size) rx.close();
                return;
            }
            const payload = JSON.parse(data);
            if (payload.type === 'meta') meta = {size: payload.size};
        };
        rx.onerror = (event) => (console.error(event.data));
        return new Promise((resolve) => (
            rx.onclose = (event) => {
                this.channels.delete(rx.id);
                resolve(buffer);
            }
        ));
    }

    _transmit_data(data, channel) {
        let offset = 0;
        let tx = this.channels.get(channel);
        if (tx.readyState != 'open') console.error('Datachannel not ready.');
        tx.send(JSON.stringify({type: 'meta', size: data.byteLength}))

        let chunk_size = this.pc.sctp.maxMessageSize;
        let low_watermark = chunk_size; // A single chunk
        let high_watermark = Math.max(chunk_size * 8, 1048576); // 8 chunks or at least 1 MiB
        tx.binaryType = 'arraybuffer';
        tx.bufferedAmountLowThreshold = low_watermark;
        tx.onbufferedamountlow = (event) => {
            // this._transmit();
        };
        while (offset < data.byteLength) {
            let buffered_amount = tx.bufferedAmount;
            tx.send(data.slice(offset, offset + chunk_size));
            offset += chunk_size;
            if (buffered_amount >= high_watermark) {
                // Nevermind
            }
        }
        // tx.close();
        tx.onclose = (event) => {
            this.channels.delete(tx.id);
        }
    }

    _transmit_meta(meta) {
        let tx = this.pc.createDataChannel('meta');
        tx.onopen = (event) => {
            tx.send(JSON.stringify(meta));
        }
        // tx.onopen = (event) => (tx.send(JSON.stringify(meta)));
    }
}

export let webrtc_connect_callback = (event) => {
    switch (event.target.connectionState) {
        case "connected":
            // The connection has become fully connected
            this._webrtc_connected();
            if (!this.client) this._webrtc_transmit_meta();
            if (this.client) controller = new WebRTCClient(this.module, this.webrtc);
            Notifier.info(preset.INFO_WEBRTC_CONNECTED);
            break;
        case "disconnected":
        case "failed":
            // One or more transports has terminated unexpectedly or in an error
            break;
        case "closed":
            // The connection has been closed
            break;
    }
}