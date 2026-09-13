# -*- coding: utf-8 -*-
"""يبني film.html: يضمّن الخطوط والصور والأيقونات داخل ملف واحد"""
import pathlib

base = pathlib.Path(__file__).parent
html = (base / "template.html").read_text(encoding="utf-8")

html = html.replace("__REEM__", (base / "fonts/ReemKufi.b64").read_text())
html = html.replace("__CAIRO__", (base / "fonts/Cairo.b64").read_text())

for key, name in [("__IMG_RIYADH_CITY__", "riyadh-city"), ("__IMG_RIYADH_AERIAL__", "riyadh-aerial"),
                  ("__IMG_COMPOUND__", "compound"), ("__IMG_VILLA__", "villa"), ("__IMG_RESORT__", "resort")]:
    html = html.replace(key, (base / f"img/{name}.b64").read_text())

S = 'viewBox="0 0 24 24" width="50" height="50" fill="none" stroke="#D9A151" stroke-width="1.7"'
icons = {
 "__IC_HOME__":   f'<svg {S}><path d="M3 11 L12 3 L21 11"/><path d="M5.5 9.5 V21 H18.5 V9.5"/><rect x="10" y="14" width="4" height="7"/></svg>',
 "__IC_GEAR__":   f'<svg {S}><circle cx="12" cy="12" r="3.4"/><path d="M12 2.2v3M12 18.8v3M2.2 12h3M18.8 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19"/></svg>',
 "__IC_MONEY__":  f'<svg {S}><rect x="2.5" y="6" width="19" height="12" rx="1.6"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
 "__IC_MEGA__":   f'<svg {S}><path d="M3.5 9.5v5h3l6 4V5.5l-6 4z"/><path d="M17 8.6a5 5 0 0 1 0 6.8"/><path d="M19.6 6a8.6 8.6 0 0 1 0 12"/></svg>',
 "__IC_CHART__":  f'<svg {S}><path d="M3 20.5h18"/><rect x="4.5" y="12" width="3.6" height="7"/><rect x="10.2" y="7.5" width="3.6" height="11.5"/><rect x="15.9" y="4" width="3.6" height="15"/></svg>',
 "__IC_SCREEN__": f'<svg {S}><rect x="2.5" y="3.5" width="19" height="13" rx="1.6"/><path d="M8 20.5h8M12 16.5v4"/><path d="M6.5 12.5l3-3 2.6 2.6 4.4-4.6"/></svg>',
}
for k, v in icons.items():
    html = html.replace(k, v)

assert "__" not in html.replace("__", "", 0) or True
left = [t for t in ("__REEM__","__CAIRO__","__IMG_","__IC_") if t in html]
if left:
    raise SystemExit(f"placeholders not replaced: {left}")

(base / "film.html").write_text(html, encoding="utf-8")
print(f"film.html: {len(html)/1024/1024:.1f} MB")
