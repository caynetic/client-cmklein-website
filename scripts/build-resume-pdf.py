"""Build the downloadable résumé from resume.html (requires ReportLab)."""

from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate


@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)

    def text(self):
        value = " ".join(child.text() if isinstance(child, Node) else child for child in self.children)
        return re.sub(r"\s+", " ", value).strip().translate(str.maketrans({"–": "-", "—": "-", "‑": "-"}))

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def all(self, tag=None, cls=None, ident=None):
        return [node for node in self.walk()
                if (tag is None or node.tag == tag)
                and (cls is None or cls in node.attrs.get("class", "").split())
                and (ident is None or node.attrs.get("id") == ident)]

    def one(self, **criteria):
        matches = self.all(**criteria)
        if not matches:
            raise ValueError(f"Missing résumé content: {criteria}")
        return matches[0]


class DocumentParser(HTMLParser):
    void_tags = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in self.void_tags:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                self.stack = self.stack[:index]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def build():
    root = Path(__file__).resolve().parents[1]
    parser = DocumentParser()
    parser.feed((root / "resume.html").read_text(encoding="utf-8"))
    document = parser.root
    intro = document.one(cls="resume-intro")
    name = intro.one(tag="h1").text()
    subtitle = intro.one(cls="intro-copy").text()
    ink = colors.HexColor("#151515")
    muted = colors.HexColor("#555555")
    body = ParagraphStyle("Body", fontName="Helvetica", fontSize=10.3, leading=14, textColor=ink, spaceAfter=5)
    title = ParagraphStyle("Name", parent=body, fontName="Helvetica-Bold", fontSize=24, leading=28, spaceAfter=6)
    role = ParagraphStyle("Role", parent=body, fontName="Helvetica-Bold", fontSize=11.5, leading=15, spaceAfter=3)
    location = ParagraphStyle("Location", parent=body, fontSize=9.5, leading=13, textColor=muted, spaceAfter=16)
    section = ParagraphStyle("Section", parent=body, fontName="Helvetica-Bold", fontSize=12.5, leading=16, spaceBefore=12, spaceAfter=8, keepWithNext=True)
    job = ParagraphStyle("Job", parent=body, fontName="Helvetica-Bold", fontSize=11, leading=14, spaceBefore=8, spaceAfter=3, keepWithNext=True)
    company = ParagraphStyle("Company", parent=body, fontSize=9.3, leading=13, textColor=muted, spaceAfter=6, keepWithNext=True)
    bullet = ParagraphStyle("Bullet", parent=body, leftIndent=12, firstLineIndent=0, bulletIndent=0, bulletFontName="Helvetica", bulletFontSize=9, spaceAfter=4)
    skill = ParagraphStyle("Skill", parent=body, fontSize=10, leading=14, spaceAfter=8)
    story = [Paragraph(escape(name), title), Paragraph(escape(subtitle), role)]
    location_text = escape(intro.one(cls="resume-location").text()).replace("cmklein.com", '<link href="https://www.cmklein.com/" color="#151515">cmklein.com</link>')
    story.append(Paragraph(location_text, location))

    def heading(ident):
        story.append(Paragraph(escape(document.one(ident=ident).text()), section))

    heading("summary-title")
    story.append(Paragraph(escape(document.one(cls="resume-summary").one(tag="p").text()), body))
    heading("experience-title")
    experience = next(node for node in document.all(tag="section") if node.attrs.get("aria-labelledby") == "experience-title")
    for item in experience.all(tag="article"):
        story.append(Paragraph(escape(item.one(tag="h3").text()), job))
        employer = escape(item.one(cls="experience-company").text())
        city = escape(item.one(cls="experience-location").text())
        dates = escape(item.one(cls="experience-date").text())
        story.append(Paragraph(f"<b>{employer}</b><br/>{city} | {dates}", company))
        for point in item.all(tag="li"):
            story.append(Paragraph(escape(point.text()), bullet, bulletText="•"))

    story.append(PageBreak())
    heading("resume-projects-title")
    projects = next(node for node in document.all(tag="section") if node.attrs.get("aria-labelledby") == "resume-projects-title")
    for item in projects.all(tag="article"):
        story.append(KeepTogether([Paragraph(escape(item.one(tag="h3").text()), job), Paragraph(escape(item.one(tag="p").text()), body)]))

    heading("skills-title")
    for item in document.one(cls="skill-list").all(tag="div"):
        label = escape(item.one(tag="dt").text())
        content = escape(item.one(tag="dd").text())
        story.append(Paragraph(f"<b>{label}:</b> {content}", skill))

    heading("education-title")
    for item in document.all(cls="education-item"):
        story.append(KeepTogether([Paragraph(escape(item.one(tag="h3").text()), job), Paragraph(escape(item.one(cls="education-school").text()) + " | " + escape(item.one(cls="education-date").text()), body)]))

    heading("volunteer-title")
    volunteer = document.one(cls="resume-volunteer")
    story.append(Paragraph(escape(volunteer.one(tag="h3").text()) + " | " + escape(volunteer.one(cls="experience-date").text()), job))
    story.append(Paragraph(escape(volunteer.one(cls="experience-description").text()), body))

    output = root / "static/documents/christopher-m-klein-resume.pdf"
    output.parent.mkdir(parents=True, exist_ok=True)
    pdf = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=44, rightMargin=44, topMargin=42, bottomMargin=42, title=f"{name} - Resume", author=name, subject=subtitle, pageCompression=1)

    def page_frame(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(muted)
        canvas.drawString(44, 24, "cmklein.com")
        canvas.linkURL("https://www.cmklein.com/", (44, 21, 105, 32), relative=0)
        canvas.drawRightString(A4[0] - 44, 24, f"Page {doc.page}")
        if doc.page > 1:
            canvas.drawString(44, A4[1] - 25, name)
        canvas.restoreState()

    pdf.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    print(f"Created {output} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
