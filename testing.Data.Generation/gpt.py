from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4

# Output file
file_path = "Wostup_Post_Analytics_Dashboard_MVP.pdf"

# Create PDF
doc = SimpleDocTemplate(file_path, pagesize=A4)
styles = getSampleStyleSheet()
story = []

# Title style
title_style = ParagraphStyle(
    "TitleStyle",
    parent=styles["Title"],
    alignment=1
)

# Add title
story.append(Paragraph("Wostup – Post Analytics Dashboard (MVP)", title_style))
story.append(Spacer(1, 16))

# Sections content
sections = [
    (
        "Objective",
        "Provide startups with clear, actionable analytics for the posts they publish on Wostup. "
        "This dashboard helps companies understand reach, engagement, and content effectiveness "
        "without using machine learning."
    ),

    (
        "Core Post Metrics",
        "• Total Views<br/>"
        "• Unique Viewers<br/>"
        "• Total Likes<br/>"
        "• Total Comments<br/>"
        "• Engagement Rate = (Likes + Comments) / Views"
    ),

    (
        "Time-Based Analytics",
        "• Views over time (Last 24h, 7 days, 30 days)<br/>"
        "• Engagement in first 1 hour, 6 hours, 24 hours<br/>"
        "• Post lifespan and engagement decay"
    ),

    (
        "Content Performance",
        "• Performance by media type (Video / Photo / Text-only)<br/>"
        "• Average likes per media type<br/>"
        "• Average comments per media type"
    ),

    (
        "Comment Insights",
        "• Total comments per post<br/>"
        "• Average comment length<br/>"
        "• Questions vs general comments<br/>"
        "• Interest signals (\"interested\", \"apply\", \"opening\")"
    ),

    (
        "Startup-Level Insights",
        "• Top performing posts by likes, comments, engagement<br/>"
        "• Posting frequency vs engagement trends<br/>"
        "• Posting consistency over time"
    ),

    (
        "Recommended Dashboard Widgets",
        "• KPI cards (Views, Likes, Comments, Engagement Rate)<br/>"
        "• Line charts for trends<br/>"
        "• Bar charts for comparisons<br/>"
        "• Ranked lists for top posts"
    ),

    (
        "Why This Is Ideal for MVP",
        "• Uses existing post schema only<br/>"
        "• No ML or GPU required<br/>"
        "• Easy MongoDB aggregation<br/>"
        "• Founder-friendly and actionable"
    ),

    (
        "Future Enhancements",
        "• Sentiment analysis on comments<br/>"
        "• Audience segmentation<br/>"
        "• ML-based post optimization when scale increases"
    )
]

# Add sections to PDF
for title, content in sections:
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"<b>{title}</b>", styles["Heading2"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph(content, styles["BodyText"]))

# Build PDF
doc.build(story)

print(f"PDF generated successfully: {file_path}")
