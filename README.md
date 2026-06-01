# Travel Photo Map

Visualize the photos and videos of an Immich album on a **map** (with zoom-based
clustering) and a bottom **timeline**. Clicking a photo opens a large viewer with a
mini-map overlay and navigation between photos / slideshow.

## Requirements

- Node.js 18 or later.
- An Immich instance and an **API key** with read permissions.

## Configuration

1. Copy `.env.example` to `.env` and fill it in:

   ```env
   IMMICH_URL=https://immich.raular.com
   IMMICH_API_KEY=your_api_key
   ALBUM_ID=a6abb843-165a-4ff2-8ec7-132c0c5f0fae
   PORT=3000
   ```

2. The API key (Immich -> Account Settings -> API Keys) needs these permissions:
   - `album.read`
   - `asset.read`
   - `asset.view`
   - `asset.download` (to serve full-resolution originals in the viewer)

## Usage

```bash
npm install
npm start
```

Open http://localhost:3000

## Privacy & security

This app is intended to run **locally / on a private network only**. Keep these
points in mind:

- The album is served full-resolution and may contain **personal documents**
  (passports, boarding passes, tickets, etc.). Do **not** expose this server to
  the public internet without adding authentication.
- The `.env` file holds your Immich **API key** in plain text. It is read only by
  the Node backend and is **never sent to the browser** (the backend proxies all
  Immich requests), but you should still keep `.env` out of version control.
- Cached images are marked `immutable`; clear your browser cache if you need to
  remove locally cached copies of sensitive photos.

## Controls

- **Arrow Left / Right** — previous / next photo.
- **Arrow Up / Down** — jump a page of photos at a time.
- **Mouse wheel / scrollbar over the timeline** — scroll through photos; the one
  centred in the strip becomes selected (also works by touch-dragging).
- **Enter** — open the selected photo in the full-screen viewer.
- **Space** — start / pause the slideshow.
- In the viewer: **Arrow Left / Right** to navigate, **Esc** (or the
  exit-fullscreen button) to return to the split map + preview view.
- **?** — toggle the on-screen controls help.

## Features

- Dark, low-detail basemap so the photo points stand out.
- Main map with clustered markers based on the zoom level.
- Clusters with fewer than 20 photos spread their thumbnails out when clicked;
  larger clusters zoom in. A cluster that can no longer be split by zooming spreads
  its thumbnails too.
- Bottom timeline sorted by date, with slideshow (play/pause) and navigation.
- Large viewer when clicking a photo/video, showing the original-resolution image,
  a mini-map overlay and previous / next / close buttons (also with the keyboard:
  arrow keys and Esc).
- Photos **without GPS** are placed using the coordinates of the closest-in-time
  photo that does have GPS; if no album photo has GPS, they appear in the timeline only.
- The API key is never exposed to the browser: a small Node backend acts as a proxy.

## Structure

```
server.js          Backend proxy (Express) + serves the static files
public/
  index.html
  css/styles.css
  js/api.js         Access to the backend endpoints
  js/geo.js         Coordinate inference by time proximity
  js/map.js         Leaflet map + clustering + mini-map
  js/timeline.js    Timeline + slideshow
  js/viewer.js      Large viewer
  js/app.js         Orchestration
```
