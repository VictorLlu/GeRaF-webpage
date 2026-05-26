# GeRaF 2.0 — Project Webpage

A static, single-page project website in the style of academic project pages
(e.g. [TRELLIS](https://microsoft.github.io/TRELLIS/)). No build step — just HTML,
CSS, and a small vanilla-JS file. Bulma + Font Awesome + Academicons are loaded
from CDNs.

## Files

```
geraf-webpage/
├── index.html              # the page — all content lives here
├── static/
│   ├── css/index.css       # styles (theme variables at the top)
│   ├── js/index.js         # results carousel + BibTeX copy
│   ├── js/stl-viewer.js    # Three.js-based interactive STL viewer
│   ├── images/             # figures, posters, favicon, OG preview
│   ├── videos/             # teaser + result videos
│   ├── meshes/             # .stl files for the 3D viewer section
│   └── pdfs/               # paper PDF
└── README.md
```

## Click-to-expand 3D modal

A single floating-window viewer is registered on `index.html`. Any element
with `data-open-stl-modal` becomes a trigger:

```html
<button data-open-stl-modal
        data-stl-outside="static/meshes/scene_a_outside.stl"
        data-stl-inside ="static/meshes/scene_a_inside.stl"
        data-stl-title  ="Scene A">
  …
</button>
```

When opened, the modal shows the **outer mesh as a translucent shell** and the
**inner mesh as a solid object** in the same scene — drag, scroll, right-click
to pan, `Esc` to close. The toolbar lets you toggle each mesh and auto-rotate.

The result-carousel slides on this page are already wired this way; click the
video and the modal opens with that scene's STLs.

## Adding a 3D STL viewer

The "Interactive 3D Reconstructions" section is extensible — adding a new
viewer is a two-step process:

1. Drop a mesh file under `static/meshes/`, e.g. `static/meshes/scene_a.stl`.
2. In `index.html`, copy one of the existing `<article class="stl-card">`
   blocks and edit:

   ```html
   <article class="stl-card">
     <div class="stl-viewer"
          data-stl="static/meshes/scene_a.stl"
          data-color="#7b3ff0"></div>
     <h3 class="stl-card-title">Scene A</h3>
     <p class="stl-card-caption">Caption goes here.</p>
   </article>
   ```

Supported attributes on `.stl-viewer` (see `static/js/stl-viewer.js`):

| Attribute            | Default     | Purpose                                  |
|----------------------|-------------|------------------------------------------|
| `data-stl`           | _(required)_| path to the `.stl` file                  |
| `data-color`         | `#94a3b8`   | mesh fill colour                         |
| `data-bg`            | `#f1f5f9`   | viewer background                        |
| `data-autorotate`    | `true`      | spin model until the user interacts      |
| `data-rotate-speed`  | `0.6`       | OrbitControls `autoRotateSpeed`          |
| `data-center`        | `true`      | recentre on bounding box                 |
| `data-normalize`     | `true`      | scale to unit sphere                     |

Three.js loads via an importmap from a CDN — no build step. For cards added
to the DOM dynamically, call `window.GeRaFViewer.init(element)`.

## How to fill in the template

Search `index.html` for `TODO` — every placeholder is marked. The main things:

1. **Authors / affiliations / venue** — hero section.
2. **Link buttons** — set the `href`s for Paper, arXiv, Code, Video, Dataset.
3. **Abstract** — replace the two placeholder paragraphs.
4. **Media** — drop files into `static/`:
   - `videos/teaser.mp4` + `images/teaser_poster.png`
   - `images/pipeline.png`, `images/comparison.png`
   - `videos/result1.mp4` … `result3.mp4` (+ matching `*_poster.png`)
   - `images/favicon.ico`, `images/og_preview.png` (1200×630 social card)
5. **Video embed** — replace `VIDEO_ID` with your YouTube id.
6. **BibTeX** — update the entry in the BibTeX section.

Re-theme the whole site by editing the CSS variables at the top of
`static/css/index.css` (`--accent`, `--bg`, etc.).

### Reusing existing project media

Result clips already exist in the repo under
`../geraf-media/manim_scenes/media/videos/<scene>/1080p60/*.mp4`. Copy the ones
you want into `static/videos/`, e.g.:

```bash
cp ../geraf-media/manim_scenes/media/videos/17_achievement/1080p60/Achievement.mp4 \
   static/videos/teaser.mp4
```

## Preview locally

Use a server that supports HTTP **Range requests** — otherwise the video modal
will appear "stuck" on first open because the browser has to download each
clip in full before it can seek.

```bash
# Recommended — works out of the box with byte-range serving
cd geraf-webpage && npx serve

# Or
cd geraf-webpage && npx http-server --cors
```

`python3 -m http.server` does **not** serve Range requests, so the video
scrubber won't seek into unloaded portions of a clip until the whole file is
buffered. Any production static host (GitHub Pages, Netlify, Vercel, etc.)
handles Range natively, so this only matters during local dev.

## Deploy to GitHub Pages

Push this directory to a repo and enable Pages (branch `main`, root or `/docs`).
The page is fully static, so any static host works.
