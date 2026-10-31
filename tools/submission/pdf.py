from pathlib import Path
import json,sys,os
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from pypdf import PdfReader
P=Path(__file__).resolve().parent;R=P.parents[1];O=R/'output/submission-rebuild/deliverables/project-brief.pdf'
O.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('YaHei',os.environ.get('VIBE_CJK_FONT','C:/Windows/Fonts/msyh.ttc')))
pdfmetrics.registerFont(TTFont('YaHeiBold',os.environ.get('VIBE_CJK_BOLD_FONT',os.environ.get('VIBE_CJK_FONT','C:/Windows/Fonts/msyhbd.ttc'))))
pdfmetrics.registerFontFamily('YaHei',normal='YaHei',bold='YaHeiBold',italic='YaHei',boldItalic='YaHeiBold')
pages=json.loads((P/'pdf-pages.json').read_text(encoding='utf8'))
c=canvas.Canvas(str(O),pagesize=(842,595));c.setTitle('Vibe-Git Research - final-20261031-v1');c.setAuthor('Vibe-Git Research team')
style=ParagraphStyle('body',fontName='YaHei',fontSize=13,leading=20,textColor=HexColor('#243349'),wordWrap='CJK')
for i,p in enumerate(pages):
 c.setFillColor(HexColor('#f7f9fc'));c.rect(0,0,842,595,fill=1,stroke=0)
 c.setFillColor(HexColor('#0b1525'));c.rect(0,480,842,115,fill=1,stroke=0)
 c.setFont('YaHeiBold',25);c.setFillColor(HexColor('#ffffff'));c.drawString(40,543,p['title'])
 c.setFont('YaHei',12);c.setFillColor(HexColor('#bdd4ee'));c.drawString(40,511,p['subtitle'])
 y=451
 for h,t in p['sections']:
  c.setFont('YaHeiBold',14);c.setFillColor(HexColor('#2161a5'));c.drawString(40,y,h);y-=10
  para=Paragraph(t,style);w,hgt=para.wrap(760,450);y-=hgt;para.drawOn(c,40,y);y-=23
 assert y>=35,(i,y)
 c.setStrokeColor(HexColor('#cad5e2'));c.line(40,35,802,35)
 c.setFont('YaHei',9);c.setFillColor(HexColor('#5c6d82'))
 c.drawString(40,20,'Vibe-Git Research | final-20261031-v1 | code dda4823 | 2026-10-31')
 c.drawRightString(802,20,f'{i+1} / 5');c.showPage()
c.save();r=PdfReader(O);assert len(r.pages)==5
print('PDF pages',len(r.pages),'bytes',O.stat().st_size,flush=True)
