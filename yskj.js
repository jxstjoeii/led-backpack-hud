// YSKJ / LOY backpack link.
// Panel is 64x64. Service FFF0, write FFF2, notify FFF1.
// Live frames use rt_draw. A stored animation is a GIF program upload.
// LOY SPACE pushes its own saved clip back when the phone app connects.

const YSKJ = (() => {
  const PANEL = 64;
  const STRIP_H = 16;
  let sno = 0;

  function resetSno() {
    sno = 0;
  }

  function varLen(n) {
    if (n < 128) return [n];
    if (n < 256) return [0x81, n];
    return [0x82, n & 0xff, (n >> 8) & 0xff];
  }

  function u16(n) {
    return [n & 0xff, (n >> 8) & 0xff];
  }

  // AA 55 FF FF | length u16le | sno u16le | flags | cmd | payload | sum u16le
  // length counts sno through the checksum. flags 0xC1 means the sum is present.
  function aa55(payload, cmdType = 2) {
    sno = (sno + 1) & 0xffff;
    const bodyLen = 4 + payload.length;
    const length = bodyLen + 2;
    const packet = new Uint8Array(6 + length);
    packet[0] = 0xaa;
    packet[1] = 0x55;
    packet[2] = 0xff;
    packet[3] = 0xff;
    packet[4] = length & 0xff;
    packet[5] = (length >> 8) & 0xff;
    packet[6] = sno & 0xff;
    packet[7] = (sno >> 8) & 0xff;
    packet[8] = 0xc1;
    packet[9] = cmdType;
    packet.set(payload, 10);
    let sum = 0;
    for (let i = 0; i < packet.length - 2; i++) sum = (sum + packet[i]) & 0xffff;
    packet[packet.length - 2] = sum & 0xff;
    packet[packet.length - 1] = (sum >> 8) & 0xff;
    return packet;
  }

  function parseNotify(data) {
    if (data.length < 10 || data[0] !== 0xaa || data[1] !== 0x55) return null;
    const length = data[4] | (data[5] << 8);
    const end = Math.min(data.length, 4 + length);
    const payload = data.slice(10, end);
    let text = '';
    for (const b of payload) {
      if (b >= 32 && b < 127) text += String.fromCharCode(b);
    }
    return {
      sno: data[6] | (data[7] << 8),
      type: data[9],
      payload,
      text,
    };
  }

  function fillRect(x0, y0, x1, y1, r, g, b) {
    return new Uint8Array([
      0x32, 0x0d, 0x01, r, g, b, 0x00,
      x0 & 0xff, (x0 >> 8) & 0xff,
      y0 & 0xff, (y0 >> 8) & 0xff,
      x1 & 0xff, (x1 >> 8) & 0xff,
      y1 & 0xff, (y1 >> 8) & 0xff,
    ]);
  }

  function bitmapPayload(bits, x0, y0, x1, y1, r, g, b) {
    const inner = new Uint8Array(12 + bits.length);
    inner[0] = 0x00;
    inner[1] = r;
    inner[2] = g;
    inner[3] = b;
    const view = new DataView(inner.buffer);
    view.setUint16(4, x0, true);
    view.setUint16(6, y0, true);
    view.setUint16(8, x1, true);
    view.setUint16(10, y1, true);
    inner.set(bits, 12);
    const vl = varLen(inner.length);
    const out = new Uint8Array(1 + vl.length + inner.length);
    out[0] = 0x32;
    out.set(vl, 1);
    out.set(inner, 1 + vl.length);
    return out;
  }

  // Two masks per strip. A black filled rectangle does not cover a GIF that
  // is still playing, and unset bitmap bits leave the old pixels in place.
  // Paint the dark pixels black, then the lit pixels green, in 64x16 strips
  // so each packet stays under a 247-byte phone MTU.
  function framePackets(imageData, color = [0, 255, 102]) {
    const [r, g, b] = color;
    const px = imageData.data;
    const packets = [];
    const rowBytes = PANEL / 8;
    for (let y0 = 0; y0 < PANEL; y0 += STRIP_H) {
      const lit = new Uint8Array(rowBytes * STRIP_H);
      const dark = new Uint8Array(rowBytes * STRIP_H);
      for (let y = 0; y < STRIP_H; y++) {
        for (let x = 0; x < PANEL; x++) {
          const i = ((y0 + y) * PANEL + x) * 4;
          const mask = 1 << (7 - (x & 7));
          const at = y * rowBytes + (x >> 3);
          if (px[i] + px[i + 1] + px[i + 2] > 48) lit[at] |= mask;
          else dark[at] |= mask;
        }
      }
      const x1 = PANEL - 1;
      const y1 = y0 + STRIP_H - 1;
      packets.push(aa55(bitmapPayload(dark, 0, y0, x1, y1, 0, 0, 0)));
      packets.push(aa55(bitmapPayload(lit, 0, y0, x1, y1, r, g, b)));
    }
    return packets;
  }

  function deleteAll() {
    return new Uint8Array([0x08, 0x02, 0x00, 0xff]);
  }

  function powerOn() {
    return new Uint8Array([0x04, 0x02, 0x00, 0x01]);
  }

  function brightness(level) {
    return new Uint8Array([0x06, 0x02, 0x00, Math.max(0, Math.min(15, level))]);
  }

  function paramDev() {
    return new Uint8Array([0x0a, 0x00, 0x1b, 0x00, 0x04, 0x00, 0x06, 0x00]);
  }

  function gifSize(bytes) {
    if (bytes.length < 10 || bytes[0] !== 0x47) return null;
    return {
      w: bytes[6] | (bytes[7] << 8),
      h: bytes[8] | (bytes[9] << 8),
    };
  }

  // Stored-GIF upload. Send deleteAll() first, then these packets in order,
  // and wait for each notify ack. chunkMax 180 keeps a packet under MTU 247.
  async function gifProgramPackets(gif, opts = {}) {
    const width = opts.width || PANEL;
    const height = opts.height || PANEL;
    const progId = opts.progId || 0;
    const chunkMax = opts.chunkMax || 180;
    const ts = Math.floor(Date.now() / 1000) >>> 0;
    const hash = new Uint8Array(
      await crypto.subtle.digest('SHA-1', new TextEncoder().encode('pro1_gif_' + ts))
    );
    const total = Math.ceil(gif.length / chunkMax) || 1;

    const prog = [
      0x08, 0x02, 0x00, progId,
      0x09, 0x01, 0x01,
      0x0c, 0x01, progId,
      0x1c, 0x06, 0x00, 0x00,
      ...u16(0xffff), ...u16(3),
      0x0d, 0x01, 0x00,
      0x1d, 0x09,
      ...u16(0), ...u16(0), ...u16(width), ...u16(height),
      0x00,
    ];
    const item = [
      0x09, 0x01, 0x01, 0x0c, 0x01, progId, 0x0d, 0x01, 0x00, 0x0e, 0x01, 0x00,
      0x14, 0x03, 0x01, 0x00, 0xff,
      0x11, 0x04, 0x00, 0xff, 0xff, 0x0a,
    ];
    const chunks = [];
    for (let i = 0; i < total; i++) {
      const slice = gif.subarray(i * chunkMax, Math.min(gif.length, (i + 1) * chunkMax));
      chunks.push([
        0x09, 0x01, 0x01, 0x0c, 0x01, progId, 0x0d, 0x01, 0x00, 0x0e, 0x01, 0x00,
        0x12, 0x07,
        ...u16(total), ...u16(i), ...u16(chunkMax),
        0x00, 0x13,
        ...varLen(slice.length),
        ...slice,
      ]);
    }
    const play = [0x18, 0x04, 0x02, progId, 0x00, 0xff];
    const id = [0x35, 0x19, progId, ...hash, ...u16(ts & 0xffff), ...u16((ts >>> 16) & 0xffff)];

    const order = [prog, item];
    for (let i = chunks.length - 1; i >= 0; i--) order.push(chunks[i]);
    order.push(play, id);
    return order.map((part) => aa55(new Uint8Array(part)));
  }

  const api = {
    PANEL,
    STRIP_H,
    resetSno,
    aa55,
    parseNotify,
    fillRect,
    framePackets,
    deleteAll,
    powerOn,
    brightness,
    paramDev,
    gifSize,
    gifProgramPackets,
  };
  globalThis.YSKJ = api;
  return api;
})();
