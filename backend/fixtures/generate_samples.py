from pathlib import Path

from PIL import Image, ImageDraw
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def generate_sample_pdf(
    output_path: Path,
    date_str: str = "2024-03-15",
    *,
    include_date: bool = True,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output_path), pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    # Title
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1E3A8A"),
    )
    story.append(Paragraph("QUEST DIAGNOSTICS - CLINICAL REPORT", title_style))
    story.append(Spacer(1, 10))

    # Header metadata
    normal_style = styles["Normal"]
    date_line = (
        f"<b>Collection Date:</b> {date_str}"
        if include_date
        else "<b>Collection Date:</b> [NOT SPECIFIED / MISSING]"
    )
    meta_data = [
        [
            Paragraph("<b>Patient:</b> Jane Doe", normal_style),
            Paragraph(date_line, normal_style),
        ],
        [
            Paragraph("<b>DOB:</b> 1985-05-12", normal_style),
            Paragraph("<b>Specimen:</b> Blood / Serum", normal_style),
        ],
        [
            Paragraph("<b>Provider:</b> Dr. Robert Smith, MD", normal_style),
            Paragraph("<b>Status:</b> Final", normal_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[250, 250])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("PADDING", (0, 0), (-1, -1), 6),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 15))

    # Test Results
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
    )
    story.append(Paragraph("LIPID PANEL & METABOLIC RESULTS", section_style))
    story.append(Spacer(1, 8))

    table_data = [
        ["Test Name", "Result", "Flag", "Reference Range", "Units"],
        ["Glucose", "94", "", "70 - 99", "mg/dL"],
        ["Triglycerides", "165", "H", "< 150", "mg/dL"],
        ["Total Cholesterol", "210", "H", "< 200", "mg/dL"],
        ["HDL Cholesterol", "46", "L", "> 50", "mg/dL"],
        ["LDL Cholesterol", "131", "H", "< 100", "mg/dL"],
        ["Creatinine", "0.92", "", "0.6 - 1.2", "mg/dL"],
        ["Blood Urea Nitrogen", "15", "", "7 - 20", "mg/dL"],
        ["Total Protein", "7.1", "", "6.0 - 8.3", "g/dL"],
        ["Albumin", "4.4", "", "3.5 - 5.0", "g/dL"],
        ["Calcium", "9.5", "", "8.6 - 10.2", "mg/dL"],
        ["Vitamin D (25-OH)", "34", "", "30 - 100", "ng/mL"],
    ]

    t = Table(table_data, colWidths=[160, 70, 50, 110, 80])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#F8FAFC")],
                ),
                ("ALIGN", (1, 1), (-1, -1), "CENTER"),
                (
                    "TEXTCOLOR",
                    (2, 2),
                    (2, 2),
                    colors.HexColor("#DC2626"),
                ),  # Triglycerides H
                (
                    "TEXTCOLOR",
                    (2, 3),
                    (2, 3),
                    colors.HexColor("#DC2626"),
                ),  # Total Chol H
                (
                    "TEXTCOLOR",
                    (2, 4),
                    (2, 4),
                    colors.HexColor("#D97706"),
                ),  # HDL L
                (
                    "TEXTCOLOR",
                    (2, 5),
                    (2, 5),
                    colors.HexColor("#DC2626"),
                ),  # LDL H
            ]
        )
    )
    story.append(t)
    doc.build(story)
    print(f"Generated PDF: {output_path}")


def generate_sample_image(
    output_path: Path, date_str: str = "2024-08-20"
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    draw.rectangle([(0, 0), (800, 60)], fill=(37, 99, 235))
    draw.text((20, 18), "LABCORP - BLOOD TEST REPORT", fill=(255, 255, 255))

    draw.text((20, 80), f"Date of Service: {date_str}", fill=(30, 41, 59))
    draw.text(
        (20, 100), "Patient: Jane Doe | DOB: 1985-05-12", fill=(30, 41, 59)
    )

    # Results Table Header
    draw.rectangle([(20, 140), (780, 170)], fill=(241, 245, 249))
    draw.text((30, 148), "Analyte", fill=(15, 23, 42))
    draw.text((280, 148), "Value", fill=(15, 23, 42))
    draw.text((380, 148), "Flag", fill=(15, 23, 42))
    draw.text((460, 148), "Reference Interval", fill=(15, 23, 42))
    draw.text((640, 148), "Units", fill=(15, 23, 42))

    rows = [
        ("Glucose", "99", "Normal", "70 - 99", "mg/dL"),
        ("Triglycerides", "145", "Normal", "< 150", "mg/dL"),
        ("Total Cholesterol", "195", "Normal", "< 200", "mg/dL"),
        ("HDL Cholesterol", "52", "Normal", "> 50", "mg/dL"),
        ("LDL Cholesterol", "114", "H", "< 100", "mg/dL"),
        ("Creatinine", "0.88", "Normal", "0.6 - 1.2", "mg/dL"),
        ("Vitamin D (25-OH)", "42", "Normal", "30 - 100", "ng/mL"),
    ]

    y = 180
    for analyte, val, flag, ref, units in rows:
        draw.text((30, y), analyte, fill=(30, 41, 59))
        draw.text((280, y), val, fill=(30, 41, 59))
        color = (
            (220, 38, 38)
            if flag == "H"
            else ((217, 119, 6) if flag == "L" else (22, 101, 52))
        )
        draw.text((380, y), flag, fill=color)
        draw.text((460, y), ref, fill=(100, 116, 139))
        draw.text((640, y), units, fill=(71, 85, 105))
        draw.line([(20, y + 25), (780, y + 25)], fill=(226, 232, 240))
        y += 35

    img.save(output_path)
    print(f"Generated Image: {output_path}")


if __name__ == "__main__":
    fixtures_dir = Path(__file__).parent
    generate_sample_pdf(
        fixtures_dir / "sample_quest_lab.pdf",
        date_str="2024-03-15",
        include_date=True,
    )
    generate_sample_pdf(
        fixtures_dir / "sample_lab_2024_06.pdf",
        date_str="2024-06-10",
        include_date=True,
    )
    generate_sample_pdf(
        fixtures_dir / "sample_no_date_lab.pdf", include_date=False
    )
    generate_sample_image(
        fixtures_dir / "sample_labcorp_lab.png", date_str="2024-08-20"
    )
