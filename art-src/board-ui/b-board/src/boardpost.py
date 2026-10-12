# Shared post rules for (b) — Funning 总原则：棋子/道具是焦点，边框/格子/背景往后退。
from PIL import Image, ImageFilter, ImageEnhance
def focus_grade(im):
    """pieces / specials / tools: +22% saturation, +10% contrast (alpha kept)."""
    a=im.getchannel('A'); rgb=im.convert('RGB')
    rgb=ImageEnhance.Color(rgb).enhance(1.22); rgb=ImageEnhance.Contrast(rgb).enhance(1.10)
    o=rgb.convert('RGBA'); o.putalpha(a); return o
def background(path,W=750,H=1624):
    """v2 island bg: stronger blur, lighter haze, lower saturation & contrast."""
    bg=Image.open(path).convert('RGB').resize((W,H),Image.LANCZOS)
    soft=bg.filter(ImageFilter.GaussianBlur(7.5))
    soft=ImageEnhance.Color(soft).enhance(0.72); soft=ImageEnhance.Contrast(soft).enhance(0.78)
    soft=Image.blend(soft,Image.new('RGB',(W,H),(240,244,238)),0.32)
    return soft
