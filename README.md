# SafeBus SOS Demo

## Demo flow

1. Open `qr-points.html`, enter the administrator key, and create a point with a bus, point name, zone, and optional seat.
2. Download its QR code or open its link from the card. The QR contains only a stable point ID. Editing the point changes what future scans show without changing the printed QR.
3. Open the driver screen from the point card. It is scoped to the same bus.
4. Send two or three SOS reports from separate browser windows or devices. The driver screen keeps one case in focus and lists the others. After closing the first case, choose the next one or select cases resolved together and record a reason.

The default `passenger.html` and `driver.html` links still use bus `B-104` for the original demonstration.

## Configuration

- Set `QR_ADMIN_KEY` and `DATABASE_URL` in the Vercel project before using the QR controls or incident API. The administrator key is checked by the server and is never included in QR links.
- Production runs on Vercel with Neon Postgres. The three demo QR points and available Firebase incident history were imported with `scripts/migrate-firebase.mjs`. Imported open cases remain open in the driver queue.
- The Firebase URL in `config.js` provides faster cross-device notifications. Neon stores active cases and allows the driver screen to recover them after a refresh.

Run `npm ci`, `npm test`, and `npm run build` to verify the code. Vercel supplies the `/api/*` endpoints; a plain static file server does not.

## Scope

This remains a demonstration. The driver actions and the incident feed still need authenticated roles and access rules before real emergency use. The countdown and police contact screens are simulations; they do not contact a control center or the police.
