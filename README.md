# YSKJ Backpack HUD

Phone page for the 64×64 LOY / YSKJ LED backpack (`YS…` over Bluetooth). Open `index.html` in Chrome. Web Bluetooth needs a secure page, so serve this folder instead of opening the file directly:

```bash
python -m http.server 8080
```

Then on the phone open `http://<this-pc>:8080/` (Chrome treats that as a secure-enough context only for localhost; for a phone, use Chrome’s Web Bluetooth on an `https://` host, or desktop Chrome at `http://localhost:8080/`).

## What the page does

- Connects to a backpack whose name starts with `YS`.
- Mirrors the 64×64 speed and track preview onto the panel while the page stays connected.
- Flash Green lights the whole matrix for about a second.
- GPS turns the speed number into miles per hour.
- Replace Saved GIF uploads a real GIF file and leaves it looping. That deletes other clips stored on the panel, including the cat. Connecting the LOY SPACE app can copy the cat back.

The live mirror covers the saved clip while the page is connected. A black rectangle does not hide a GIF that is still playing, and pixels left unset in a bitmap stay as they were, so every frame sends a black mask and then the green HUD. Disconnecting stops that mirror and the saved clip shows again.

## Protocol

Service `0000fff0-…`, write `0000fff2-…` (no response), notify `0000fff1-…`. The backpack negotiates a large MTU. Packets are built in `yskj.js`.

```
AA 55 FF FF | length u16le | sno u16le | flags C1 | cmd | payload | sum u16le
```

`length` counts everything after the 4-byte header except itself (sno through the checksum). `cmd` is `2` for a command and `3` for a query. The checksum is the uint16 sum of every preceding byte.

Live frames are `rt_draw` bitmaps: eight 64×16 strips, a black mask and a green mask for each band. A full 64×64 bitmap does not fit in one write. Strips stay small enough for a 247-byte phone MTU.

A stored GIF is a program upload, not a raw file write:

1. Delete every stored program (`08 02 00 FF`). Without this, the panel plays the new clip once and goes back to the previous one.
2. Program header, item header, GIF chunks, play, then a SHA-1 id.
3. Chunks go out last-to-first. Each chunk’s header records the chunk size constant; the real byte count is the length after tag `13`.
4. Wait for notify type `82` before sending the next packet. Writing the whole file without waiting drops the tail.

This panel reports model `EXYB-AS#GGMJXZ180`, firmware `V2.9.1`, and a 64×64 matrix. Brightness is 0–15.
