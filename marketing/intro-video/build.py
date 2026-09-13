# -*- coding: utf-8 -*-
"""يبني ملف الفيديو HTML مع الخطوط المضمّنة"""
import pathlib

base = pathlib.Path(__file__).parent
reem = (base / "fonts/ReemKufi.b64").read_text()
cairo = (base / "fonts/Cairo.b64").read_text()

html = (base / "template.html").read_text(encoding="utf-8")
html = html.replace("__REEM__", reem).replace("__CAIRO__", cairo)
(base / "film.html").write_text(html, encoding="utf-8")
print("film.html:", len(html), "bytes")
