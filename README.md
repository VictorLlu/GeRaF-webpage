# GeRaF — Project Webpage

The project page for the **GeRaF** series:

- **GeRaF 1.0** — *Neural Geometry Reconstruction from Radio-Frequency Signals* (NeurIPS 2025 Spotlight)
- **GeRaF 2.0** — *Seeing through boxes: Non-Line-of-Sight 3D Reconstruction from Radar Signals* (CVPR 2026)

Authored by Jiachen Lu, Hailan Shanbhag, and Haitham Al Hassanieh (EPFL).

Static single-page site, no build step. Bulma / Font Awesome / Academicons /
Three.js are all loaded from CDNs. Total deploy size is ~42 MB.

**Live:** https://victorllu.github.io/GeRaF-webpage/ *(enable Pages on the repo
to publish; see "Deploy" below)*

## Layout

```
geraf-webpage/
├── index.html              # all page content lives here
├── static/
│   ├── css/index.css       # styles (theme variables at the top)
│   ├── js/index.js         # teaser marquee, video modal, hover preview,
│   │                       #   BibTeX copy
│   ├── js/stl-viewer.js    # Three.js mesh viewer + 3D modal logic
│   │                       #   (loads .ply preferentially, .stl supported)
│   ├── images/             # object/box reference photos, pipeline figures,
│   │                       #   favicon, OG preview
│   ├── videos/             # turntable clips, one per object
│   │   └── method/         # Method-card explanation clips
│   └── meshes/             # binary PLY meshes (decimated to ~80k tris each)
└── README.md
```

## Sections

| Section | What it does |
|---|---|
| **Hero** | Project title + two paper cards with `Paper / arXiv / Code` links each. |
| **Teaser** | Infinite right-to-left marquee of 220×220 turntable clips — non-interactive, just shows off results. |
| **Video** | YouTube embed of the full project video. |
| **Abstracts** | Two TRELLIS-style panels (one per paper version) with the trophy venue badge. |
| **Method** | Two pipeline figures + six clickable cards that each pop up a video modal explaining one method ingredient. |
| **Results** | Static grid of clickable thumbnail cards — click opens a 3D viewer modal showing the inside (gray) + outside (translucent purple) STL pair, plus the box and object reference photos. |
| **BibTeX** | Two `@inproceedings{…}` entries with copy-to-clipboard buttons. |

## Adding a new result object

This is the most common edit. Each object needs four files and two markup
blocks.

1. Drop assets under `static/`:
   ```
   static/videos/<NAME>.mp4           # 1:1 turntable clip
   static/meshes/<NAME>_in.ply        # inner mesh (binary PLY)
   static/meshes/<NAME>_out.ply       # outer box mesh (binary PLY)
   ```
   The `<NAME>` convention used here is `<object>box<version>`, e.g.
   `bunnyboxv1`, `chickenboxv3`. Decimation pipeline below.

2. Add one `<video>` to the teaser marquee in `index.html`:
   ```html
   <video class="teaser-clip" autoplay muted loop playsinline preload="auto">
     <source src="static/videos/<NAME>.mp4" type="video/mp4">
   </video>
   ```

3. Add one `<article>` to the Results grid:
   ```html
   <article class="result-card"
            data-open-stl-modal
            data-stl-outside="static/meshes/<NAME>_out.ply"
            data-stl-inside ="static/meshes/<NAME>_in.ply"
            data-stl-title  ="<Display title>"
            data-img-box   ="static/images/<box-photo>.jpg"
            data-img-object="static/images/<obj-photo>.jpg">
     <video class="result-card-video" autoplay muted loop playsinline preload="auto">
       <source src="static/videos/<NAME>.mp4" type="video/mp4">
     </video>
     <div class="result-card-thumbs" aria-hidden="true">
       <img src="static/images/<box-photo>.jpg" alt="">
       <img src="static/images/<obj-photo>.jpg" alt="">
     </div>
     <div class="result-card-body">
       <h3 class="result-card-title"><Display title></h3>
       <p class="result-card-caption">Box + hidden <object>.</p>
     </div>
   </article>
   ```

No JS or CSS changes needed — the teaser marquee re-clones on next load, and
the modal click-handler is delegated, so dynamically added cards work too.

## Mesh decimation pipeline (.stl → .ply)

Raw STLs from the SDF reconstruction can be 10–25 MB each. The page uses
binary PLY meshes decimated to ~80k triangles (~1.5 MB each) for fast loading.
Pipeline:

```bash
# inside the geraf-official venv (has trimesh + fast_simplification)
source ~/Documents/radar/arxiv-geraf/geraf-official/venv/bin/activate
python3 - <<'PY'
import os, glob, trimesh, fast_simplification, numpy as np

TARGET = 80_000
for src in glob.glob('static/meshes/*.stl'):
    m = trimesh.load(src)
    if len(m.faces) > TARGET:
        ratio = 1.0 - TARGET / len(m.faces)
        v, f = fast_simplification.simplify(
            m.vertices.astype(np.float32),
            m.faces.astype(np.int32),
            target_reduction=ratio)
        m = trimesh.Trimesh(vertices=v, faces=f)
    m.merge_vertices()
    m.export(src[:-4] + '.ply', file_type='ply', encoding='binary',
             include_attributes=False)
PY
```

The viewer picks the loader from the extension (`.ply` → `PLYLoader`,
`.stl` → `STLLoader`), so you can drop in either format and it just works.

## Adding a Method-card video clip

Each clickable card in the Method section sets `data-video` to a clip under
`static/videos/method/`. To extract a clip from the full project video:

```bash
ffmpeg -y -ss <start> -to <end> \
  -i ../geraf-media/manim_scenes/media/GeRaF-video.mp4 \
  -c:v libx264 -preset veryfast -crf 22 -movflags +faststart -an \
  static/videos/method/<clip-name>.mp4
```

`-movflags +faststart` is **required** — without it the modal scrubber stalls
on first open because the browser can't seek until the file fully downloads.

## Per-attribute reference

### Result-card / modal trigger

| Attribute               | Purpose                                       |
|-------------------------|-----------------------------------------------|
| `data-open-stl-modal`   | marker — element opens the 3D modal on click  |
| `data-stl-outside`      | path to the outer (translucent) mesh          |
| `data-stl-inside`       | path to the inner (solid) mesh                |
| `data-stl`              | single-mesh fallback if you have only one     |
| `data-stl-title`        | header text shown in the modal                |
| `data-img-box`          | square reference photo of the box             |
| `data-img-object`       | square reference photo of the object          |
| `data-outside-color`    | outer-mesh color (default `#a78bfa` modal / `#9333ea` inline) |
| `data-outside-opacity`  | outer-mesh opacity (default `0.22`)           |
| `data-inside-color`     | inner-mesh color (default `#cbd5e1` modal)    |

### Method-card video trigger

| Attribute               | Purpose                                       |
|-------------------------|-----------------------------------------------|
| `data-open-video-modal` | marker — opens the video modal on click       |
| `data-video`            | path to an `.mp4` (use `+faststart`)          |
| `data-video-title`      | header text shown in the modal                |

## Preview locally

Use a server that honors HTTP **Range requests** — `python -m http.server`
does *not*, and the video scrubber will appear stuck on first open until the
whole file downloads. Install Node once, then:

```bash
cd geraf-webpage
npx http-server -c-1 -p 8000     # `-c-1` disables caching
# open http://localhost:8000
```

Any production static host (GitHub Pages / Netlify / Vercel / Cloudflare
Pages) supports Range natively, so this only matters during local dev.

## Deploy (GitHub Pages)

Push to the repo and turn on Pages:

```bash
git push origin main
```

Then on GitHub: **Settings → Pages → Source: `main` branch, `/ (root)`**.
URL appears at `https://<user>.github.io/GeRaF-webpage/` in ~1 minute.

For other hosts:

```bash
npx surge .            # zero-config drag-and-drop equivalent
npx vercel --prod      # if you have a Vercel account
```

## Theming

CSS variables at the top of `static/css/index.css` control the whole palette:

```css
--accent:        #2563eb;
--grad-blue:     #2563eb;
--grad-purple:   #9333ea;
--grad-red:      #f97316;
--brand-gradient: linear-gradient(90deg, var(--grad-blue) 0%,
                                          var(--grad-purple) 50%,
                                          var(--grad-red) 100%);
```

The `GeRaF` title and its subtitle pick up `--brand-gradient` via
`background-clip: text`. Venue badge colours (`venue-cvpr`, `venue-neurips`)
are defined a bit further down.

## Acknowledgements

This page is built on the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template).
The GeRaF research is supported by the **Sony Faculty Innovation Fellowship**.
