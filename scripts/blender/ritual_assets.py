"""10초 의식(씨앗 심기 → 물 주기 → 새싹 탄생)에 쓰는 그림을 Blender로 렌더링한다.

실행: blender -b -P scripts/blender/ritual_assets.py -- OUT_DIR
출력: OUT_DIR/soil_dry.png   씨앗을 심기 전의 마른 흙 언덕(가운데가 살짝 파여 있음)
      OUT_DIR/seed.png        씨앗 한 알
      OUT_DIR/sprout_0..7.png 젖은 흙에서 새싹이 올라와 잎이 펼쳐지는 8단계(같은 카메라라 겹쳐서 재생하면 자란다)

모두 배경이 투명한 PNG이며, 직접 모델링한 도형(흙, 이끼, 자갈, 씨앗, 줄기, 잎)만 쓴다.
"""
import sys, os, math
import bpy
from mathutils import Vector, noise

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "./out"
os.makedirs(OUT, exist_ok=True)
SIZE = 420


def lin(hexstr, a=1.0):
    h = hexstr.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c ** 2.2
    return (f(r), f(g), f(b), a)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 36
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = SIZE
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.compression = 90
    # 은은한 보랏빛 주변광(브랜드 색과 맞춘다)
    world = bpy.data.worlds.new("W")
    sc.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = lin("#E9E1F4")
    bg.inputs["Strength"].default_value = 0.95
    return sc


def material(name, color, rough=0.7, noise_color=None, spec=0.35):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    try:
        bsdf.inputs["Specular IOR Level"].default_value = spec
    except Exception:
        pass
    if noise_color:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = 9.0
        tex.inputs["Detail"].default_value = 6.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = lin(color)
        ramp.color_ramp.elements[1].color = lin(noise_color)
        nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = lin(color)
    return m


def smooth(obj):
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj.data.update()


def sphere(name, loc, scale, mat, seg=40, rings=20, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.data.materials.append(mat)
    smooth(o)
    return o


def mound(wet, dimple):
    """울퉁불퉁한 흙 언덕. 아래쪽은 평평하게 잘라 바닥에 놓이게 한다."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=72, ring_count=40, radius=1.6, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = "mound"
    o.scale = (1.0, 1.0, 0.42)
    for v in o.data.vertices:
        p = v.co
        n = noise.noise(Vector((p.x * 1.6, p.y * 1.6, p.z * 1.6)))
        n2 = noise.noise(Vector((p.x * 4.2 + 9, p.y * 4.2, p.z * 4.2)))
        d = 0.09 * n + 0.035 * n2
        v.co = p + p.normalized() * d
        if p.z < -0.05:
            v.co.z = -0.05  # 바닥 평탄화
        if dimple:
            r = math.hypot(p.x, p.y)
            if p.z > 0 and r < 0.38:
                v.co.z -= 0.12 * (1 - r / 0.38) ** 1.4  # 씨앗 자리의 오목한 홈
    smooth(o)
    color, ncol = ("#46301F", "#33231A") if wet else ("#7A5538", "#5E402B")
    o.data.materials.append(material("soil", color, rough=0.32 if wet else 0.92, noise_color=ncol))
    return o


def surface_z(x, y):
    """언덕 표면의 높이(구를 납작하게 눌러 만들었으므로 식으로 구한다)."""
    r2 = x * x + y * y
    return 0.42 * math.sqrt(max(0.0, 1.6 * 1.6 - r2))


def decor():
    """숲 분위기: 이끼 덩어리, 자갈, 풀잎 두 가닥. 표면에 살짝 박히도록 놓는다."""
    moss = material("moss", "#5E9A4C", rough=0.95, noise_color="#8CC465")
    stone = material("stone", "#9A9086", rough=0.55, noise_color="#756D64")
    for i, (x, y, s) in enumerate([(-0.95, -0.55, 0.36), (-0.55, 0.85, 0.26), (1.0, 0.5, 0.3), (0.6, -0.95, 0.2)]):
        sphere(f"moss{i}", (x, y, surface_z(x, y) - 0.02), (s * 1.3, s, s * 0.62), moss, 28, 14)
    for i, (x, y, s) in enumerate([(0.95, -0.55, 0.2), (-0.2, 1.1, 0.14), (-1.2, 0.1, 0.16)]):
        sphere(f"stone{i}", (x, y, surface_z(x, y) - 0.01), (s * 1.2, s, s * 0.85), stone, 28, 14, rot=(0.3, 0.2, i))
    grass = material("grass", "#78B35F", rough=0.8)
    for i, (x, y, a) in enumerate([(-1.1, -0.2, 0.4), (1.12, -0.1, -0.45), (0.3, 1.2, 0.2)]):
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.05, radius2=0.0, depth=0.5, location=(x, y, surface_z(x, y) + 0.18), rotation=(0, a, 0))
        g = bpy.context.active_object
        g.data.materials.append(grass)


def sprout(t):
    """t=0 새싹 없음 … 1 줄기와 잎 한 쌍이 활짝."""
    if t <= 0:
        return
    ease = 1 - (1 - t) ** 2.2
    h = 1.3 * ease
    base_z = surface_z(0, 0) - 0.05
    stem_m = material("stem", "#7DB86E", rough=0.5)
    leaf_m = material("leaf", "#62B867", rough=0.45, noise_color="#9AD98C", spec=0.5)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.1, radius2=0.055, depth=max(h, 0.03), location=(0, 0, base_z + h / 2))
    st = bpy.context.active_object
    st.data.materials.append(stem_m)
    smooth(st)
    top = (0, 0, base_z + h)
    sphere("bud", top, (0.085, 0.085, 0.1 + 0.05 * (1 - t)), stem_m, 24, 12)
    open_t = max(0.0, (t - 0.3) / 0.7)
    open_t = 1 - (1 - open_t) ** 2
    if open_t > 0:
        size = 0.16 + 0.62 * open_t
        up = math.radians(58 - 34 * open_t)  # 처음엔 위로 모였다가 펼쳐진다
        for side in (-1, 1):
            cx = top[0] + side * math.cos(up) * size * 0.9
            cz = top[2] + math.sin(up) * size * 0.9 - 0.02
            leaf = sphere("leaf", (cx, 0, cz), (size, size * 0.66, 0.04), leaf_m, 48, 24)
            leaf.rotation_euler = (math.radians(32), -side * up, 0)


def lights_and_camera(target=(0, 0, 0.85), dist=(0, -5.0, 4.0), lens=48):
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 3.4
    sun.angle = math.radians(14)
    sun.color = (1.0, 0.93, 0.82)
    so = bpy.data.objects.new("Sun", sun)
    bpy.context.scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(48), math.radians(8), math.radians(38))
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 170
    fill.size = 4.5
    fill.color = (0.86, 0.82, 1.0)
    fo = bpy.data.objects.new("Fill", fill)
    bpy.context.scene.collection.objects.link(fo)
    fo.location = (3.2, -3.4, 2.4)
    fo.rotation_euler = (math.radians(64), 0, math.radians(42))
    cam = bpy.data.cameras.new("Cam")
    cam.lens = lens
    co = bpy.data.objects.new("Cam", cam)
    bpy.context.scene.collection.objects.link(co)
    co.location = dist
    empty = bpy.data.objects.new("T", None)
    empty.location = target
    bpy.context.scene.collection.objects.link(empty)
    tc = co.constraints.new("TRACK_TO")
    tc.target = empty
    tc.track_axis = "TRACK_NEGATIVE_Z"
    tc.up_axis = "UP_Y"
    bpy.context.scene.camera = co


def render(name):
    bpy.context.scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print("rendered", name)


# 1) 마른 흙(씨앗 자리가 파여 있음)
reset()
mound(wet=False, dimple=True)
decor()
lights_and_camera()
render("soil_dry.png")

# 2) 씨앗 한 알 (끝이 뾰족한 해바라기씨 모양)
reset()
seed_m = material("seed", "#D2A65F", rough=0.38, noise_color="#9A6A38", spec=0.6)
tip_m = material("tip", "#8A5A2B", rough=0.45)
sphere("seed", (0, 0, 0), (0.46, 0.27, 0.25), seed_m, 56, 28)
sphere("tip", (0.4, 0, 0), (0.2, 0.12, 0.12), tip_m, 32, 16)
for o in bpy.data.objects:
    if o.type == "MESH":
        o.rotation_euler = (0.15, 0.2, -0.45)
lights_and_camera(target=(0, 0, 0), dist=(0, -2.3, 1.1), lens=50)
render("seed.png")

# 3) 새싹이 자라는 8단계(같은 카메라)
for i in range(8):
    reset()
    mound(wet=True, dimple=(i == 0))
    decor()
    sprout(i / 7)
    lights_and_camera()
    render(f"sprout_{i}.png")
