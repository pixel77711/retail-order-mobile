from PIL import Image, ImageDraw

size = 1024
navy = (34, 50, 74, 255)
coral = (232, 93, 74, 255)
mint = (169, 215, 197, 255)
image = Image.new("RGBA", (size, size), navy)
draw = ImageDraw.Draw(image)

# Full-bleed geometric delivery tote.
draw.rounded_rectangle((196, 290, 828, 790), radius=76, fill=coral)
draw.rounded_rectangle((292, 176, 732, 438), radius=118, outline=mint, width=54)
draw.rectangle((250, 410, 774, 470), fill=coral)
# Minimal leaf mark inside the tote.
draw.ellipse((430, 420, 640, 680), fill=mint)
draw.polygon([(535, 638), (594, 493), (632, 441), (592, 574), (548, 680)], fill=navy)
draw.line((543, 621, 594, 493), fill=navy, width=20)

for name in ("icon.png", "splash-icon.png", "favicon.png", "android-icon-foreground.png"):
    image.save(f"/home/ubuntu/retail-order-mobile/assets/images/{name}")
