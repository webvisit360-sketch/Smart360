# Administracija: povsod sličice, in nalaganje videa

Kjer aplikacija pokaže fotografijo, mora administracija pokazati **isto fotografijo**, ne
imena datoteke. Na nekaterih straneh je to že tako, na drugih ne — treba je poenotiti.

Poleg fotografij se v isto galerijo nalaga tudi video.

---

## Navodilo za Replit (prilepi v celoti)

```
Two related changes in the admin: show the actual picture everywhere the guest app shows
one, and allow video in the same gallery.

=====================================================================
1. A PICTURE FIELD ALWAYS SHOWS THE PICTURE
=====================================================================

Audit every media field in the admin. Wherever the value is a file name or an id, replace
it with a visual control. There must be no place left where an editor sees only text and
has to remember what that file looks like.

  ONE PICTURE (item tile, POI photo, tab photo, tenant logo):
    a 96x96 rounded thumbnail, the file name small underneath, and three actions:
    Zamenjaj / Odstrani / Odpri v polni velikosti. Empty state: a dashed 96x96 box reading
    "Ni slike" that is itself the upload button.

  A GALLERY (list of pictures):
    a grid of 96x96 thumbnails in the app's own order, each with a drag handle, a remove X,
    and a badge "1" on the first one reading "ploščica" — because the first photo of an
    item is also the tile in the guest app, and nobody guesses that from a file name.
    Drag to reorder, with the order saved on drop. An "Add" tile at the end.

  Thumbnails are served from a resized derivative (max 200 px), never the full photo. An
  admin page with 60 full-size photos on a phone connection is unusable.

  Lazy-load them (loading="lazy") and reserve the box with aspect-ratio so the page does
  not jump while they arrive.

=====================================================================
2. VIDEO IN THE SAME GALLERY
=====================================================================

The gallery holds photos AND videos in one ordered list; the guest swipes through them in
that order. Do not build a separate "videos" field — a second list means a second order and
the guest sees them in an order nobody chose.

  Upload: mp4, webm, mov. Limit 100 MB and 3 minutes; state both limits in the UI BEFORE
  the upload starts, not in an error afterwards.

  On upload, server-side:
    - transcode to H.264/AAC mp4, max 1080p, faststart (moov atom at the front, otherwise
      iOS will not start playing until the whole file has arrived)
    - extract a poster frame at 1 s as a JPEG
    - store duration and dimensions
  If transcoding is not available on the deployment, at least verify the container and
  reject anything that is not already H.264 mp4 — a HEVC clip from an iPhone plays for the
  person who uploaded it and for nobody else.

  In the admin the video appears as a thumbnail of its poster with a play badge and its
  duration ("0:34"), in the same grid as the photos, draggable in the same order.

  A video may be first in the list: then its poster is the item's tile.

=====================================================================
3. UPLOAD, GENERALLY
=====================================================================

  - Multiple files at once, and drag-and-drop onto the grid.
  - A progress bar per file, and a failed file stays in the list marked red with a retry —
    do not throw away the other nine because the third one failed.
  - Photos: strip EXIF (guest photos carry GPS), auto-rotate by the EXIF orientation flag
    BEFORE stripping it, resize to max 2000 px, save as JPEG q82 plus a 200 px thumbnail.
  - Give every uploaded file a name derived from the accommodation and the item
    (meli-pu_apart_04.jpg), not the phone's original name (IMG_6207.jpg). In half a year
    the file list has to be readable.

=====================================================================
4. VERIFY
=====================================================================

  a) Walk every admin page that has a media field: none shows a bare file name.
  b) Reorder a gallery by dragging: the guest app shows the new order, and the tile follows
     the new first item.
  c) Upload a portrait photo taken with an iPhone: it is not sideways in the app.
  d) Upload an mp4: poster and duration appear in the admin, and it plays in the guest app
     inside the media viewer.
  e) Put a video first in a gallery: its poster becomes the item's tile.
  f) Upload a 200 MB file: refused with a clear message, before the upload runs.
```
