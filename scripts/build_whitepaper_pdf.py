#!/usr/bin/env python3
"""Convert WHITEPAPER.md to a polished branded PDF using weasyprint."""

from pathlib import Path
import markdown
from weasyprint import HTML, CSS

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "WHITEPAPER.md"
DST = ROOT / "Nox-Whitepaper.pdf"

md_text = SRC.read_text(encoding="utf-8")

html_body = markdown.markdown(
    md_text,
    extensions=[
        "extra",            # tables, fenced code, abbr, def-list
        "codehilite",       # syntax highlighted code blocks
        "toc",              # heading anchors
        "sane_lists",
        "smarty",
    ],
    extension_configs={
        "codehilite": {"guess_lang": False, "noclasses": False, "css_class": "code"},
        "toc": {"anchorlink": False, "permalink": False},
    },
    output_format="html5",
)

css = """
@page {
  size: A4;
  margin: 22mm 18mm 22mm 18mm;
  background: #ffffff;
  @bottom-right {
    content: counter(page) " / " counter(pages);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 9pt;
    color: #9CA3AF;
  }
  @bottom-left {
    content: "NOX Whitepaper · v0.1";
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 9pt;
    color: #9CA3AF;
  }
}

@page :first {
  @bottom-left { content: ""; }
  @bottom-right { content: ""; }
}

* { box-sizing: border-box; }

html, body {
  font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: #1F1A3A;
  background: #ffffff;
  hyphens: auto;
}

h1, h2, h3, h4, h5 {
  font-family: 'Inter', system-ui, sans-serif;
  color: #2A1B5E;
  font-weight: 700;
  line-height: 1.2;
  margin-top: 1.4em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
}

h1 {
  font-size: 26pt;
  background: linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  border-bottom: 3px solid #7C3AED;
  padding-bottom: 0.3em;
  margin-top: 0;
}

h2 {
  font-size: 17pt;
  color: #5B21B6;
  border-bottom: 1px solid #E5E0F5;
  padding-bottom: 0.25em;
  page-break-before: auto;
}

h3 { font-size: 13pt; color: #5B21B6; }
h4 { font-size: 11pt; color: #5B21B6; }

p {
  margin: 0.6em 0;
  text-align: justify;
}

a {
  color: #7C3AED;
  text-decoration: none;
  word-break: break-word;
}
a:hover { text-decoration: underline; }

ul, ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

li { margin: 0.2em 0; }

strong { color: #2A1B5E; font-weight: 600; }
em { color: #4C1D95; }

code {
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace;
  background: #F3F0FA;
  color: #5B21B6;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.9em;
  word-break: break-word;
}

pre {
  background: #0B0B17;
  color: #E5E7EB;
  padding: 12px 14px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 8.5pt;
  line-height: 1.45;
  margin: 1em 0;
  border-left: 3px solid #7C3AED;
  page-break-inside: avoid;
}

pre code {
  background: transparent;
  color: inherit;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
  white-space: pre;
  word-break: normal;
}

/* Pygments token colors (dark theme) */
.code .k, .code .kd, .code .kn, .code .kt { color: #A78BFA; }
.code .s, .code .s1, .code .s2 { color: #FCD34D; }
.code .c, .code .c1, .code .cm { color: #6B7280; font-style: italic; }
.code .nb { color: #60A5FA; }
.code .nf, .code .nx { color: #C4B5FD; }
.code .mi, .code .mf { color: #34D399; }
.code .o { color: #F472B6; }
.code .p { color: #E5E7EB; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 9.5pt;
  page-break-inside: avoid;
}

th {
  background: linear-gradient(135deg, #5B21B6 0%, #3B82F6 100%);
  color: #ffffff;
  font-weight: 600;
  text-align: left;
  padding: 8px 10px;
  font-size: 9pt;
  letter-spacing: 0.02em;
}

td {
  padding: 7px 10px;
  border-bottom: 1px solid #E5E0F5;
  vertical-align: top;
}

tr:nth-child(even) td { background: #F9F7FE; }

blockquote {
  border-left: 3px solid #A78BFA;
  background: #F3F0FA;
  margin: 1em 0;
  padding: 0.8em 1em;
  color: #2A1B5E;
  border-radius: 0 6px 6px 0;
}

hr {
  border: none;
  border-top: 1px solid #E5E0F5;
  margin: 1.6em 0;
}

/* Cover-page styling for the top section */
.cover {
  text-align: center;
  padding-top: 60mm;
  page-break-after: always;
}

.cover-title {
  font-size: 48pt;
  font-weight: 800;
  background: linear-gradient(135deg, #A78BFA 0%, #7C3AED 50%, #3B82F6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 0.04em;
  margin: 0 0 0.2em 0;
  line-height: 1;
}

.cover-subtitle {
  font-size: 14pt;
  color: #5B21B6;
  font-style: italic;
  margin-bottom: 4em;
  font-weight: 400;
}

.cover-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10pt;
  color: #6B7280;
  line-height: 1.9;
}

.cover-meta strong { color: #2A1B5E; }

.cover-tagline {
  margin-top: 6em;
  font-size: 18pt;
  font-style: italic;
  color: #7C3AED;
  font-weight: 300;
}

/* Compact pages */
section { page-break-inside: auto; }

/* Avoid orphan headings */
h1, h2, h3 { break-after: avoid-page; }
"""

cover_html = """
<div class="cover">
  <svg width="120" height="120" viewBox="0 0 32 32" style="margin-bottom: 1em;">
    <defs>
      <linearGradient id="noxg" x1="0" y1="0" x2="32" y2="32">
        <stop offset="0" stop-color="#A78BFA"/>
        <stop offset="0.5" stop-color="#7C3AED"/>
        <stop offset="1" stop-color="#3B82F6"/>
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="11" fill="none" stroke="url(#noxg)" stroke-width="1.5"/>
    <path d="M22.5 11 A 7 7 0 1 0 22.5 21 A 5.5 5.5 0 1 1 22.5 11 Z" fill="url(#noxg)"/>
  </svg>
  <h1 class="cover-title">NOX</h1>
  <div class="cover-subtitle">Privacy-themed token launch on Base</div>
  <div class="cover-meta">
    <div><strong>Whitepaper</strong> · Versione 0.1</div>
    <div>Maggio 2026</div>
    <div>Chain target: Base (Ethereum L2)</div>
    <div>github.com/wayne97dev/nox</div>
  </div>
  <div class="cover-tagline">"Pay in the dark."</div>
</div>
"""

# Strip the original H1 from the markdown body since the cover page now carries it
import re
body_no_title = re.sub(r"^<h1[^>]*>NOX.*?</h1>\s*", "", html_body, count=1, flags=re.DOTALL)

full_html = f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>NOX Whitepaper</title>
</head>
<body>
{cover_html}
{body_no_title}
</body>
</html>
"""

HTML(string=full_html, base_url=str(ROOT)).write_pdf(
    str(DST),
    stylesheets=[CSS(string=css)],
)

print(f"PDF generato: {DST}")
print(f"Dimensione: {DST.stat().st_size / 1024:.1f} KB")
