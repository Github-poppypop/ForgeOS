#!/usr/bin/env python3
"""Generate accurate per-feature README docs for ForgeOS brain-console.

Reads the actual feature modules (server feat-*.ts and client feat-*.tsx) and
emits a README.md beside each one, plus a top-level docs/FEATURES.md catalog.
Nothing is fabricated: descriptions come from the module's leading comment
block, server routes from router.<method>('...') declarations, and the client
mount path/label/category from the default export.
"""
import os
import re
import sys

ROOT = sys.argv[1]  # path to apps/brain-console
SERVER_DIR = os.path.join(ROOT, "src", "server", "features")
CLIENT_DIR = os.path.join(ROOT, "src", "client", "src", "features")
DOCS_DIR = os.path.join(ROOT, "docs")

route_re = re.compile(r"""router\.(get|post|put|delete|patch|use)\(\s*['"`]([^'"`]+)['"`]""")
fetch_re = re.compile(r"""fetch\(\s*['"]\s*([^'"]+)""")
field_re = {k: re.compile(r"""%s\s*:\s*['"`]([^'"`]+)['"`]""" % k) for k in ("path", "label", "category")}


def top_comment(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if s.startswith("//"):
                out.append(s[2:].strip())
            elif s == "":
                if out:
                    break
            else:
                break
    return " ".join(out).strip()


def client_fields(text):
    return {k: (field_re[k].search(text).group(1) if field_re[k].search(text) else None) for k in field_re}


def client_apis(text):
    return sorted(set(fetch_re.findall(text)))


def server_apis(text):
    return sorted(set(re.findall(r"""/api/[A-Za-z0-9_/:.\-${}-]*""", text)))


def header(title, sub):
    return f"# {title}\n\n> {sub}\n"


catalog = []  # (name, kind, mount_or_none, label, category, desc, route_count)

# ---- Server features ----
for fn in sorted(os.listdir(SERVER_DIR)):
    if not (fn.startswith("feat-") and (fn.endswith(".ts") or fn.endswith(".js"))):
        continue
    fp = os.path.join(SERVER_DIR, fn)
    text = open(fp, encoding="utf-8").read()
    desc = top_comment(fp)
    routes = route_re.findall(text)
    name = fn[:-3]
    lines = [header(name, f"Server feature — `src/server/features/{fn}`")]
    if desc:
        lines.append(desc + "\n")
    lines.append("## Endpoints\n")
    if routes:
        lines.append("| Method | Path |")
        lines.append("|--------|------|")
        for method, p in routes:
            if method == "use":
                lines.append(f"| USE (mw) | `{p}` |")
            else:
                lines.append(f"| {method.upper()} | `{p}` |")
    else:
        lines.append("_No `router.*` HTTP routes declared in this module._")
    lines.append("")
    lines.append("---\n")
    lines.append("_Auto-generated from source. Edit the module to change behaviour._\n")
    outp = os.path.join(SERVER_DIR, name + ".md")
    with open(outp, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    catalog.append((name, "server", None, None, None, desc, len(routes)))

# ---- Client features ----
for fn in sorted(os.listdir(CLIENT_DIR)):
    if not (fn.startswith("feat-") and fn.endswith(".tsx")):
        continue
    fp = os.path.join(CLIENT_DIR, fn)
    text = open(fp, encoding="utf-8").read()
    desc = top_comment(fp)
    fields = client_fields(text)
    apis = client_apis(text)
    name = fn[:-4]
    lines = [header(name + " (client)", f"Client feature — `src/client/src/features/{fn}`")]
    meta = []
    if fields.get("path"):
        meta.append(f"**Mounts at:** `{fields['path']}`")
    if fields.get("label"):
        meta.append(f"**Label:** {fields['label']}")
    if fields.get("category"):
        meta.append(f"**Category:** {fields['category']}")
    if meta:
        lines.append(" · ".join(meta))
    lines.append("")
    if desc:
        lines.append(desc + "\n")
    if apis:
        lines.append("## API calls\n")
        for a in apis:
            lines.append(f"- `{a}`")
        lines.append("")
    lines.append("---\n")
    lines.append("_Auto-generated from source. Edit the module to change behaviour._\n")
    outp = os.path.join(CLIENT_DIR, name + ".md")
    with open(outp, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    catalog.append((name, "client", fields.get("path"), fields.get("label"), fields.get("category"), desc, len(apis)))

# ---- Top-level catalog ----
os.makedirs(DOCS_DIR, exist_ok=True)
cat_lines = ["# ForgeOS Brain Console — Feature Catalog\n",
             "Auto-generated index of the conflict-free feature modules under "
             "`src/server/features/` and `src/client/src/features/`.\n"]
cat_lines.append("## Server features (API)\n")
cat_lines.append("| Module | Endpoints | Description |")
cat_lines.append("|--------|-----------|-------------|")
for name, kind, mount, label, cat, desc, n in catalog:
    if kind != "server":
        continue
    d = (desc[:90] + "…") if desc and len(desc) > 90 else desc
    cat_lines.append(f"| [`{name}.ts`](src/server/features/{name}.md) | {n} | {d or '—'} |")
cat_lines.append("")
cat_lines.append("## Client features (UI)\n")
cat_lines.append("| Module | Mount | Label | Category | API calls |")
cat_lines.append("|--------|-------|-------|----------|-----------|")
for name, kind, mount, label, cat, desc, n in catalog:
    if kind != "client":
        continue
    cat_lines.append(f"| [`{name}.tsx`](src/client/src/features/{name}.md) | `{mount or '—'}` | {label or '—'} | {cat or '—'} | {n} |")
cat_lines.append("")
cat_lines.append("---\n")
cat_lines.append("_Generated by `scripts/gen-feature-readmes.py`. Regenerate after adding features._\n")

with open(os.path.join(DOCS_DIR, "FEATURES.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(cat_lines))

print(f"Generated {sum(1 for c in catalog if c[1]=='server')} server + "
      f"{sum(1 for c in catalog if c[1]=='client')} client feature READMEs + docs/FEATURES.md")
