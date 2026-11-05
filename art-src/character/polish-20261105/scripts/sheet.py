import sys; from PIL import Image, ImageDraw
d=sys.argv[1]; import os
names=[n for n in ['front','side','back34','face_close','face_34','hand_front','hand_side','hand_34','seated_front','seated_side','seated_34','seated_game_front','seated_game_side','seated_game_34'] if os.path.exists(f'{d}/{n}.png')]
ims=[Image.open(f'{d}/{n}.png').convert('RGB').resize((384,512)) for n in names]
rows=(len(names)+3)//4; s=Image.new('RGB',(384*4,512*rows),'white')
for i,im in enumerate(ims): s.paste(im,((i%4)*384,(i//4)*512)); ImageDraw.Draw(s).text(((i%4)*384+6,(i//4)*512+4),names[i],fill='black')
s.save(f'{d}/sheet.jpg',quality=90)
