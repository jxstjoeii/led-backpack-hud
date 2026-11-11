# Standalone HUD parts checklist

Parts to run the HUD without the phone. A small ESP32-S3 board rides in the backpack, reads its own GPS and motion sensor, and talks to the stock YSKJ panel over Bluetooth with the same packets as `yskj.js`. The panel and its controller stay as they are.

Prices were checked on 2026-11-10 in USD, before tax and shipping. AliExpress prices change often, especially during sales.

## Core parts

- [ ] **Controller: Adafruit ESP32-S3 Feather (4MB flash, 2MB PSRAM), #5477**: about $17.50
  - [Adafruit](https://www.adafruit.com/product/5477) (out of stock when checked) · [DigiKey](https://www.digikey.com/en/products/detail/adafruit-industries-llc/5477/16583982)
  - Bluetooth LE and Wi-Fi, USB-C, a built-in LiPo charger, and a MAX17048 battery gauge, so the HUD can show battery %.
  - It has a STEMMA QT / Qwiic port, so the motion sensor plugs in without soldering.

- [ ] **GPS: Beitian BE-280 (u-blox M10)**: about $13.63
  - [AliExpress, BEITIAN Official Store](https://www.aliexpress.us/item/3256804219378009.html). Pick **BE-280** in the Color list.
  - Listing rating: 4.8 from 72 reviews, 700+ sold. Store: 96.5% positive feedback.
  - The BE-280 has the 25 mm antenna, which picks up satellites better than the smaller BE-180 and BE-220. Any M10 model works.
  - Wiring: UART (TX/RX) to the Feather's RX/TX pins, plus 3.3 V and GND. Set it to 10 Hz with UBX-NAV-PVT for faster brake detection.
  - Mount it facing the sky, at the top of the pack, and not behind the LED panel.

- [ ] **Motion sensor (accelerometer + gyroscope): Adafruit BNO085 9-DOF, #4754**: $29.50
  - [Adafruit](https://www.adafruit.com/product/4754)
  - It removes gravity on the chip and outputs linear acceleration directly, the same data the page now reads from the phone's `devicemotion` event.
  - Skip the $2–7 "BNO085" boards on AliExpress. That price is below the cost of a genuine chip, and the cheap listings have low review counts.
  - Bolt or glue it solidly to the pack frame or enclosure. A loose sensor reads every bounce as braking.

- [ ] **STEMMA QT / Qwiic cable, 100 mm, #4210**: $0.95
  - [Adafruit](https://www.adafruit.com/product/4210). Connects the BNO085 to the Feather.

## Power

- [ ] **USB power meter: FNIRSI FNB58**: about $25.58. **Buy this first.**
  - [AliExpress, FNIRSI Official Store](https://www.aliexpress.us/item/3256804478930060.html). The "WO Bluetooth" version is enough.
  - Listing rating: 4.9 from 240 reviews, 1,000+ sold. Store: 98.5% positive feedback.
  - Put it between the battery and the panel. Measure the normal HUD and the red brake flash before choosing a battery. The panel's real draw is the biggest unknown in this build.

- [ ] **Battery for the panel**, choose one:
  - **Keep the backpack's current power bank** if the meter shows it never shuts off. Many banks cut power below about 50–100 mA, so test with the ESP32 plugged in.
  - **[Voltaic V50](https://voltaicsystems.com/v50/)**: $74, 13,400 mAh / 48 Wh. Its Always On mode has no low-current cutoff on the two USB-A ports, and it charges while powering the pack. Use the USB-A ports for output in this mode, not USB-C.

- [ ] **Battery for the controller: Adafruit 3.7 V 2500 mAh LiPo, #328**: $14.95
  - [Adafruit](https://www.adafruit.com/product/328). It plugs into the Feather's JST-PH port.
  - It keeps the controller running if the panel's bank switches off, and it lasts roughly 10+ hours on the controller, GPS and sensor alone.
  - Skip it if you power the Feather from an always-on bank.

## Enclosure and controls

These are generic parts, so no single listing stands out. The links are AliExpress searches sorted by orders. Choose a listing rated **4.7+ with 1,000+ sold**, preferably sold by a "Choice" or official store.

- [ ] **IP65 enclosure, about 100×68×50 mm**: about $2–6. [Search](https://www.aliexpress.us/w/wholesale-ip65-abs-junction-box-100x68x50.html?sortType=total_tranpro_desc)
  - Big enough for the Feather, the BNO085 and the 2500 mAh LiPo. The GPS can sit on the lid or outside.
- [ ] **16 mm waterproof momentary push buttons, ×3**: mode, brake test and brightness. [Search](https://www.aliexpress.us/w/wholesale-16mm-waterproof-momentary-push-button.html?sortType=total_tranpro_desc)
- [ ] **Waterproof rocker or toggle power switch, ×1**: [Search](https://www.aliexpress.us/w/wholesale-waterproof-mini-rocker-switch.html?sortType=total_tranpro_desc)
- [ ] **PG7 cable glands**: seal the USB and GPS cables where they enter the box. [Search](https://www.aliexpress.us/w/wholesale-pg7-cable-gland.html?sortType=total_tranpro_desc)
- [ ] **Short right-angle USB-C cable**: from the power bank to the Feather. Any decent one works.
- [ ] **Small parts**: hookup wire, heat-shrink, double-sided foam tape or M2.5 standoffs, and zip ties.

## Totals

| Setup | Approx. cost |
|---|---|
| Core parts (Feather, BE-280, BNO085, cable) | ~$62 |
| Plus the power meter and controller LiPo, using your current bank | ~$102 |
| Plus enclosure, buttons, switch and glands | ~$115 |
| Plus a Voltaic V50 always-on bank | ~$190 |

## Not needed (for now)

- **LTE modem**: on an iPhone, the controller reads the song over Bluetooth through Apple Media Service (AMS). That needs no internet or Spotify login. Android has no built-in equivalent, so an Android phone would need its hotspot and the Spotify API instead.
- **Solar panel**: a 5–10 W backpack panel gives maybe 2–5 W in real sun. That can stretch daytime runtime but won't replace charging.
- **Directly driving the LED panel (HUB75)**: only worth considering if you open the backpack and the panel turns out to be a standard HUB75 matrix. That hasn't been checked.
