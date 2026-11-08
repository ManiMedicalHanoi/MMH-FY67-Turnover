"""Ảnh sản phẩm cho app Dự trù NPP — thu nhỏ từ kho riêng tư mmh-library (ảnh marketing / catalogue, KHÔNG lấy Confidential/).
Chạy: python3 -I du-tru/tools/build_img.py <đường dẫn mmh-library> du-tru/img
  img/g/<khoá>.webp   ảnh đại diện nhóm sản phẩm (khung 4:3, nền trắng, rộng 360 px)
  img/dia/<mẫu>.webp  ảnh từng mẫu DIA-BURS (cắt từ DIA-BURS Shape Table của wiki) + img/dia/list.json
"""
import sys, os, json, shutil
from PIL import Image

LIB, OUT = sys.argv[1], sys.argv[2]
D, M = os.path.join(LIB, 'Dental product'), os.path.join(LIB, 'MMG product', 'Product pictures')
W = os.path.join(LIB, 'wiki', 'public', 'img')
G = {
  'kfiles': f'{D}/K-Files pictures/Ảnh K files 1.webp',
  'hfiles': f'{D}/H-Files pictures/Ảnh H files 1.webp',
  'reamers': f'{D}/Reamers pictures/Ảnh reamer 1.webp',
  'jizai': f'{W}/nha-khoa/jizai-5.webp',
  'gates': f'{D}/Gates Drills pictures/Gate drills.webp',
  'peeso': f'{D}/Peeso Reamers pictures/Peeso reamer.webp',
  'carbide': f'{D}/Carbide Burs pictures/Carbide Burs.webp',
  'mi': f'{D}/MI Stainless Burs pictures/MI Stainess Burs.webp',
  'hardss': f'{D}/Hard Stainless Burs pictures/Hard stainless Burs.webp',
  'flare': f'{D}/Flare Files pictures/Flare files.webp',
  'rt': f'{D}/RT Files pictures/RT files.webp',
  'engine': f'{D}/Engine Reamers pictures/Engine Reamer.webp',
  'dfinder': f'{D}/D Finders & Glide Finders pictures/D finders.webp',
  'glide': f'{D}/D Finders & Glide Finders pictures/Glide finder.webp',
  'barbed': f'{D}/Barbed & Square Broaches pictures/Baberd broached.webp',
  'square': f'{D}/Barbed & Square Broaches pictures/Square broaches.webp',
  'ufiles': f'{D}/U-Files pictures/U - files (Ultrasonic files).webp',
  'super': f'{D}/Super Files pictures/Super files.webp',
  'surgical': f'{D}/Surgical Burs pictures/Surgical Burs.webp',
  'sutures': f'{D}/Dental Sutures pictures/Dental suture.webp',
  'diaburs': f'{D}/Dia Burs pictures/Dia Burs 1.webp',
  'ipr': f'{D}/IPR-01EF pictures/IPR 01 EF.png',
  'handfiles': f'{W}/nha-khoa/hand-files.webp',
  'composite': f'{M}/Bao bì cũ/Composite/Mani EG Composite - hộp.png',
  'flow': f'{M}/Bao bì cũ/Composite/Mani Flo-V - hộp và tuýp.png',
  'bond': f'{M}/Bao bì cũ/Bond/Mani Bond - hộp và lọ.png',
  'bleach': f'{M}/Bao bì cũ/Bleach n Shine/Bleach n Shine - bộ 3 tuýp.png',
  'bl_gingiva': f'{M}/Bao bì cũ/Bleach n Shine/Mani Gingiva Protector - tuýp.png',
  'bl_office': f'{M}/Bao bì cũ/Bleach n Shine/Mani Bleach Office - tuýp.png',
  'bl_after': f'{M}/Bao bì cũ/Bleach n Shine/Mani After Bleach Care - tuýp.png',
  'eyesut': f'{W}/chi/hero.webp',
}
os.makedirs(f'{OUT}/g', exist_ok=True); os.makedirs(f'{OUT}/dia', exist_ok=True)
for k, p in G.items():
    if not os.path.exists(p): print('THIẾU', k, p); continue
    im = Image.open(p).convert('RGBA')
    bb = im.getbbox()                                   # bỏ viền trong suốt
    if bb: im = im.crop(bb)
    bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[3]); im = bg
    w, h = im.size; tw, th = 360, 270                   # khung 4:3, giữ tỉ lệ, đệm trắng
    s = min(tw / w, th / h); im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    c = Image.new('RGB', (tw, th), 'white'); c.paste(im, ((tw - im.width) // 2, (th - im.height) // 2))
    c.save(f'{OUT}/g/{k}.webp', 'WEBP', quality=80)
models = []
for f in sorted(os.listdir(f'{W}/dia')):
    if f.startswith('m-') and f.endswith('.webp'):
        shutil.copy(f'{W}/dia/{f}', f'{OUT}/dia/{f[2:]}'); models.append(f[2:-5])
json.dump(models, open(f'{OUT}/dia/list.json', 'w'))
print(len(G), 'ảnh nhóm ·', len(models), 'mẫu DIA-BURS')
