# SafeBus SOS Demo

## Demo flow

1. Open `qr-points.html`, enter the administrator key, and create a point with a bus, point name, zone, and optional seat.
2. Download its QR code or open its link from the card. The QR contains only a stable point ID. Editing the point changes what future scans show without changing the printed QR.
3. Open the driver screen from the point card. It is scoped to the same bus.
4. Send two or three SOS reports from separate browser windows or devices. The driver screen keeps one case in focus and lists the others. After closing the first case, choose the next one or select cases resolved together and record a reason.

The default `passenger.html` and `driver.html` links still use bus `B-104` for the original demonstration.

## Configuration

- Set `QR_ADMIN_KEY` as a Netlify environment variable before using the create, edit, or deactivate controls. The value is checked by the server and is never included in QR links.
- Apply the database migrations under `netlify/database/migrations` when deploying.
- Set `FIREBASE_URL` in `config.js` for faster cross-device notifications. The Netlify database stores active cases and allows the driver screen to recover them after a refresh.

Run `npm ci` and `npm test` to verify the code. Use Netlify's local development environment to exercise the database endpoints locally; a plain static file server does not provide `/api/*`.

## Scope

This remains a demonstration. The driver actions and the incident feed still need authenticated roles and access rules before real emergency use. The countdown and police contact screens are simulations; they do not contact a control center or the police.
