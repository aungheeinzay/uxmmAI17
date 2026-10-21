# SURFERTrack Rider UI implementation

Updated against the supplied Figma-export reference images. Includes a custom vector approximation of the SURFERTrack box/location-pin logo in `public/assets/surfertrack-logo.svg` (the reference archive did not contain an editable logo master).

Screens: dashboard and filters, QR scanner, parcel found, pickup confirmation/success, completed deliveries, delivery timeline, report issue, customer signature, and rider profile.

Existing demo/local rider store is retained. Account editing, authentication, backend submission, real rider photo and server-side signature persistence require production APIs. Camera access requires HTTPS or localhost and a browser with supported QR decoding.
