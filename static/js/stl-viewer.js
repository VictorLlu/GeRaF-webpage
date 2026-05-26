/* ===================================================================
   GeRaF — STL viewer (inline + modal)
   -------------------------------------------------------------------
   Two ways to use this module:

   1. INLINE — any element matching `.stl-viewer` becomes a Three.js
      scene. Configure via data-attributes:

        <!-- single mesh -->
        <div class="stl-viewer"
             data-stl="static/meshes/foo.stl"
             data-color="#94a3b8"></div>

        <!-- combined view: transparent outer + solid inner -->
        <div class="stl-viewer"
             data-stl-outside="static/meshes/box_outside.stl"
             data-stl-inside="static/meshes/box_inside.stl"></div>

   2. MODAL — any element with `data-open-stl-modal` opens the floating
      3D viewer when clicked, loading the STLs from its data-* attributes:

        <button data-open-stl-modal
                data-stl-outside="..." data-stl-inside="..."
                data-stl-title="Scene A">…</button>

   For dynamically added cards, call:
     window.GeRaFViewer.initAll(root)
     window.GeRaFViewer.openModal({ outside, inside, single, title })

   Supported data-attributes (both inline + modal triggers):
     data-stl                  single-mesh path
     data-stl-outside          path to the outer (transparent) mesh
     data-stl-inside           path to the inner (solid) mesh
     data-color                color for single-mesh viewers   (#94a3b8)
     data-outside-color        outer mesh color                (#9333ea)
     data-outside-opacity      outer mesh opacity              (0.22)
     data-inside-color         inner mesh color                (#dc2626)
     data-bg                   viewer background               (#f1f5f9)
     data-autorotate           "true|false"                    (true)
     data-rotate-speed         OrbitControls.autoRotateSpeed   (0.6)
     data-center               re-centre on bounding box       (true)
     data-normalize            scale to unit sphere            (true)
     data-stl-title            modal header title
   =================================================================== */

import * as THREE        from 'three';
import { STLLoader }     from 'three/addons/loaders/STLLoader.js';
import { PLYLoader }     from 'three/addons/loaders/PLYLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* loader picked from file extension — supports .ply (preferred, small) and
   .stl (legacy, 5–10× larger). Both return BufferGeometry. */
function loaderFor(url) {
  return /\.ply(\?|$)/i.test(url) ? new PLYLoader() : new STLLoader();
}

const initialised = new WeakSet();

/* -------------------------------------------------------------------
   createViewer — the core engine. Returns a handle for dynamic control.
   ------------------------------------------------------------------- */
function createViewer(container, opts) {
  const {
    meshes      = [],
    autorotate  = true,
    bg          = '#f1f5f9',
    center      = true,
    normalize   = true,
    rotateSpeed = 0.6,
  } = opts;

  // scene + camera + renderer
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);

  // Z-is-up world convention. OrbitControls reads `camera.up` to decide
  // which axis is vertical, so this is all it takes — drag now orbits
  // around the vertical Z-axis instead of Y.
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
  camera.up.set(0, 0, 1);
  camera.position.set(2.5, -2.5, 1.8);   // 3/4 view, slightly above

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // lights — soft key + fill (positions in world space, key from +Z)
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key  = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(2, -2, 3);   scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-2,  2, -1); scene.add(fill);

  // controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping   = true;
  controls.dampingFactor   = 0.08;
  controls.autoRotate      = autorotate;
  controls.autoRotateSpeed = rotateSpeed;
  controls.minDistance     = 0.4;
  controls.maxDistance     = 10;
  // pause auto-rotate while the user is interacting
  let userAutorotate = autorotate;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end',   () => { controls.autoRotate = userAutorotate; });

  // multi-mesh load: share one transform so meshes stay registered
  const objects = {};          // name -> THREE.Mesh
  container.classList.add('is-loading');

  Promise.all(meshes.map(spec => new Promise((resolve, reject) => {
    loaderFor(spec.url).load(spec.url,
      g => resolve({ spec, geom: g }),
      undefined,
      err => reject({ spec, err })
    );
  })))
  .then(results => {
    // shared transform from combined bounds
    const box = new THREE.Box3();
    results.forEach(r => {
      r.geom.computeBoundingBox();
      box.union(r.geom.boundingBox);
    });
    const cen  = new THREE.Vector3(); box.getCenter(cen);
    const size = new THREE.Vector3(); box.getSize(size);
    const r    = size.length() / 2 || 1;
    const s    = normalize ? 1 / r : 1;

    results.forEach(({ spec, geom }) => {
      geom.computeVertexNormals();
      if (center)    geom.translate(-cen.x, -cen.y, -cen.z);
      if (normalize) geom.scale(s, s, s);

      const opacity     = spec.opacity != null ? spec.opacity : 1;
      const transparent = opacity < 1;
      const material = new THREE.MeshPhongMaterial({
        color:       new THREE.Color(spec.color || '#94a3b8'),
        specular:    0x222222,
        shininess:   30,
        transparent,
        opacity,
        // double-sided so we see the inner surface of the transparent shell
        side:       transparent ? THREE.DoubleSide : THREE.FrontSide,
        // transparent objects shouldn't write depth or they'll occlude the
        // inner mesh; opaque ones must write depth or they vanish on rotation
        depthWrite: !transparent,
      });
      const mesh  = new THREE.Mesh(geom, material);
      mesh.name   = spec.name || spec.url;
      // render transparent shells after opaque inner mesh
      mesh.renderOrder = transparent ? 1 : 0;
      scene.add(mesh);
      objects[mesh.name] = mesh;
    });
    container.classList.remove('is-loading');
  })
  .catch(err => {
    console.error('[stl-viewer] load error', err);
    container.classList.remove('is-loading');
    container.classList.add('stl-viewer-error');
    const url = err && err.spec ? err.spec.url : 'mesh';
    container.innerHTML =
      '<div class="stl-viewer-error-msg">Failed to load <code>' + url + '</code></div>';
  });

  // responsive sizing
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // render loop (pause when tab is hidden)
  let alive = true, raf = 0;
  function tick() {
    if (!alive) return;
    if (!document.hidden) { controls.update(); renderer.render(scene, camera); }
    raf = requestAnimationFrame(tick);
  }
  tick();

  // public handle
  return {
    setVisible(name, vis) {
      if (objects[name]) objects[name].visible = vis;
    },
    setOpacity(name, opacity) {
      const m = objects[name]; if (!m) return;
      m.material.opacity    = opacity;
      m.material.transparent = opacity < 1;
      m.material.depthWrite  = opacity >= 1;
      m.material.needsUpdate = true;
    },
    setAutorotate(v) { userAutorotate = v; controls.autoRotate = v; },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      Object.values(objects).forEach(m => {
        m.geometry.dispose();
        m.material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
  };
}

/* -------------------------------------------------------------------
   meshesFromDataset — build viewer opts from data-* attributes
   ------------------------------------------------------------------- */
function meshesFromDataset(el) {
  const d = el.dataset;
  const meshes = [];
  if (d.stl) {
    meshes.push({
      url:   d.stl,
      color: d.color || '#94a3b8',
      name:  'mesh',
    });
  }
  if (d.stlOutside) {
    meshes.push({
      url:     d.stlOutside,
      color:   d.outsideColor   || '#9333ea',
      opacity: parseFloat(d.outsideOpacity || '0.22'),
      name:    'outside',
    });
  }
  if (d.stlInside) {
    meshes.push({
      url:   d.stlInside,
      color: d.insideColor || '#9ca3af',   // neutral gray
      name:  'inside',
    });
  }
  return meshes;
}

/* -------------------------------------------------------------------
   init — wire up a single inline `.stl-viewer` element
   ------------------------------------------------------------------- */
function init(container) {
  if (initialised.has(container)) return;
  const meshes = meshesFromDataset(container);
  if (meshes.length === 0) {
    console.warn('[stl-viewer] no STL paths on', container);
    return;
  }
  initialised.add(container);
  const d = container.dataset;
  createViewer(container, {
    meshes,
    autorotate:  d.autorotate !== 'false',
    bg:          d.bg || '#f1f5f9',
    center:      d.center      !== 'false',
    normalize:   d.normalize   !== 'false',
    rotateSpeed: parseFloat(d.rotateSpeed || '0.6'),
  });
}

function initAll(root = document) {
  root.querySelectorAll('.stl-viewer').forEach(init);
}

/* -------------------------------------------------------------------
   Modal — a single floating window reused across triggers
   ------------------------------------------------------------------- */
let modalViewer = null;

function openModal(opts) {
  const modal    = document.getElementById('stl-modal');
  const viewerEl = document.getElementById('stl-modal-viewer');
  const titleEl  = document.getElementById('stl-modal-title');
  if (!modal || !viewerEl) return;

  // tear down any previous viewer
  if (modalViewer) { modalViewer.dispose(); modalViewer = null; }
  viewerEl.innerHTML = '';
  viewerEl.className = 'stl-modal-viewer';   // clear error class

  if (titleEl) titleEl.textContent = opts.title || '3D viewer';

  const meshes = [];
  if (opts.outside) meshes.push({ url: opts.outside, color: opts.outsideColor || '#a78bfa', opacity: opts.outsideOpacity != null ? opts.outsideOpacity : 0.22, name: 'outside' });
  if (opts.inside)  meshes.push({ url: opts.inside,  color: opts.insideColor  || '#cbd5e1', opacity: 1, name: 'inside'  });
  if (opts.single)  meshes.push({ url: opts.single,  color: opts.color        || '#cbd5e1', opacity: 1, name: 'mesh'    });

  modalViewer = createViewer(viewerEl, {
    meshes,
    autorotate: true,
    bg:         '#0b1220',
  });

  // 3-way picker — populate box/object thumbnails + large panes, hide
  // any choice whose image isn't provided, and reset selection to "mesh"
  const pickBox  = document.getElementById('stl-modal-pick-box');
  const pickObj  = document.getElementById('stl-modal-pick-object');
  const paneBox  = document.getElementById('stl-modal-pane-box');
  const paneObj  = document.getElementById('stl-modal-pane-object');
  const btnBox   = modal.querySelector('[data-pick="box"]');
  const btnObj   = modal.querySelector('[data-pick="object"]');
  function applyImage(src, thumbEl, paneEl, btnEl) {
    if (!btnEl) return;
    if (src) {
      if (thumbEl) thumbEl.src = src;
      if (paneEl)  paneEl.src  = src;
      btnEl.style.display = '';
    } else {
      if (thumbEl) thumbEl.removeAttribute('src');
      if (paneEl)  paneEl.removeAttribute('src');
      btnEl.style.display = 'none';
    }
  }
  applyImage(opts.imgBox,    pickBox, paneBox, btnBox);
  applyImage(opts.imgObject, pickObj, paneObj, btnObj);

  // reset to the mesh view + show toolbar
  modal.querySelectorAll('.stl-modal-pick').forEach(b => {
    b.classList.toggle('is-active', b.dataset.pick === 'mesh');
  });
  modal.querySelectorAll('.stl-modal-pane').forEach(p => {
    p.classList.toggle('is-active', p.dataset.pane === 'mesh');
  });
  const toolbar = document.getElementById('stl-modal-toolbar');
  if (toolbar) toolbar.style.display = '';

  // toolbar state — reset every open
  modal.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.classList.add('is-active');
  });
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal-open');
}

function closeModal() {
  const modal = document.getElementById('stl-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal-open');
  if (modalViewer) { modalViewer.dispose(); modalViewer = null; }
}

function bindModal() {
  // open triggers — delegated so dynamically-added cards work
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-open-stl-modal]');
    if (!trigger) return;
    e.preventDefault();
    openModal({
      outside: trigger.dataset.stlOutside,
      inside:  trigger.dataset.stlInside,
      single:  trigger.dataset.stl,
      title:   trigger.dataset.stlTitle,
      outsideColor:   trigger.dataset.outsideColor,
      outsideOpacity: trigger.dataset.outsideOpacity != null
        ? parseFloat(trigger.dataset.outsideOpacity) : null,
      insideColor:    trigger.dataset.insideColor,
      imgBox:    trigger.dataset.imgBox,
      imgObject: trigger.dataset.imgObject,
    });
  });

  // close triggers
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close-stl-modal]')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // toolbar — wired once
  const modal = document.getElementById('stl-modal');
  if (!modal) return;
  modal.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!modalViewer) return;
      btn.classList.toggle('is-active');
      const on = btn.classList.contains('is-active');
      const target = btn.dataset.toggle;
      if (target === 'autorotate') modalViewer.setAutorotate(on);
      else                          modalViewer.setVisible(target, on);
    });
  });

  // picker (mesh / box / object) — swaps which pane is visible on the left
  modal.querySelectorAll('.stl-modal-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.pick;
      modal.querySelectorAll('.stl-modal-pick').forEach(b => {
        b.classList.toggle('is-active', b === btn);
      });
      modal.querySelectorAll('.stl-modal-pane').forEach(p => {
        p.classList.toggle('is-active', p.dataset.pane === target);
      });
      // Mesh-specific toolbar is irrelevant when viewing an image
      const toolbar = document.getElementById('stl-modal-toolbar');
      if (toolbar) toolbar.style.display = target === 'mesh' ? '' : 'none';
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAll();
  bindModal();
});

// expose for dynamic / external use
window.GeRaFViewer = { init, initAll, createViewer, openModal, closeModal };