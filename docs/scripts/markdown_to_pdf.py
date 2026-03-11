from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Preformatted, SimpleDocTemplate, Spacer, PageBreak
from xml.sax.saxutils import escape

root = Path.cwd()
docs_dir = root / "docs"

source_files = [
    docs_dir / "README.md",
    docs_dir / "FRONTEND_WEB_DOCUMENTATION.md",
    docs_dir / "MOBILE_APP_DOCUMENTATION.md",
    docs_dir / "BACKEND_FUNCTIONALITY_DOCUMENTATION.md",
]

output_pdf = docs_dir / "SAMVID_OS_FULL_DOCUMENTATION.pdf"

font_candidates = [
    Path("C:/Windows/Fonts/arial.ttf"),
    Path("C:/Windows/Fonts/calibri.ttf"),
]

font_name = "Helvetica"
for font_path in font_candidates:
    if font_path.exists():
        try:
            pdfmetrics.registerFont(TTFont("DocUnicode", str(font_path)))
            font_name = "DocUnicode"
            break
        except Exception:
            pass

styles = getSampleStyleSheet()
body = ParagraphStyle(
    "Body",
    parent=styles["BodyText"],
    fontName=font_name,
    fontSize=9,
    leading=13,
    spaceAfter=4,
)
h1 = ParagraphStyle(
    "H1",
    parent=styles["Heading1"],
    fontName=font_name,
    fontSize=18,
    leading=22,
    spaceAfter=8,
)
h2 = ParagraphStyle(
    "H2",
    parent=styles["Heading2"],
    fontName=font_name,
    fontSize=14,
    leading=18,
    spaceAfter=6,
)
h3 = ParagraphStyle(
    "H3",
    parent=styles["Heading3"],
    fontName=font_name,
    fontSize=11,
    leading=15,
    spaceAfter=4,
)
code_style = ParagraphStyle(
    "Code",
    parent=styles["Code"],
    fontName=font_name,
    fontSize=8,
    leading=10,
    leftIndent=5,
    rightIndent=5,
    backColor="#F5F7FA",
    spaceAfter=5,
)
meta_style = ParagraphStyle(
    "Meta",
    parent=styles["BodyText"],
    fontName=font_name,
    fontSize=8,
    textColor="#4b5563",
    spaceAfter=4,
)

story = []

for file_index, source in enumerate(source_files):
    if not source.exists():
        continue

    markdown = source.read_text(encoding="utf-8", errors="replace")
    lines = markdown.splitlines()

    story.append(Paragraph(escape(source.name), h2))
    story.append(Paragraph(escape(str(source.relative_to(root))), meta_style))
    story.append(Spacer(1, 2 * mm))

    in_code = False
    code_lines = []

    for raw_line in lines:
        line = raw_line.rstrip("\n")

        if line.strip().startswith("```"):
            if in_code:
                if code_lines:
                    story.append(Preformatted("\n".join(code_lines), code_style))
                    code_lines = []
                in_code = False
            else:
                in_code = True
                code_lines = []
            continue

        if in_code:
            code_lines.append(line)
            continue

        stripped = line.strip()
        if not stripped:
            story.append(Spacer(1, 1.5 * mm))
            continue

        if stripped.startswith("### "):
            story.append(Paragraph(escape(stripped[4:]), h3))
            continue
        if stripped.startswith("## "):
            story.append(Paragraph(escape(stripped[3:]), h2))
            continue
        if stripped.startswith("# "):
            story.append(Paragraph(escape(stripped[2:]), h1))
            continue

        if stripped.startswith("- "):
            text = escape(stripped[2:])
            story.append(Paragraph(f"• {text}", body))
            continue

        if stripped.startswith("| ") and stripped.endswith(" |"):
            story.append(Preformatted(stripped, code_style))
            continue

        story.append(Paragraph(escape(stripped), body))

    if in_code:
        if code_lines:
            story.append(Preformatted("\n".join(code_lines), code_style))

    if file_index < len(source_files) - 1:
        story.append(PageBreak())


def add_page_number(canvas, _doc):
    canvas.saveState()
    canvas.setFont(font_name, 8)
    page_num = canvas.getPageNumber()
    canvas.drawRightString(200 * mm, 10 * mm, f"Page {page_num}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(output_pdf),
    pagesize=A4,
    leftMargin=16 * mm,
    rightMargin=16 * mm,
    topMargin=16 * mm,
    bottomMargin=14 * mm,
    title="Samvid OS Full Documentation",
    author="Codex",
)

doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(output_pdf)
