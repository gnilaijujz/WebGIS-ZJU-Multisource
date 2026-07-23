# 2DGS mesh -> a web-friendly GLB for Cesium.
# Recenter to local origin and let the app place it in ENU.
#
# Run with a Python env that has trimesh:
#   "/d/software/apps/bin/Python/envs/arcgispro-py3/python.exe" scripts/ply2glb.py
import sys
from pathlib import Path
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / '实习1-无人机摄影测量' / '2dgs' / 'fuse_post.ply'
OUT = ROOT / '实习5-WebGIS开发' / 'webgis-app' / 'public' / 'models' / 'mesh_2dgs_v8.glb'

OUT.parent.mkdir(parents=True, exist_ok=True)

print("loading ply ...")
m = trimesh.load(str(SRC), process=False)
print("  verts:", len(m.vertices), "faces:", len(m.faces))

# Vertex clustering keeps the surface continuous while reducing density.
V = np.asarray(m.vertices).astype(np.float64)
F = np.asarray(m.faces)
try:
    C = np.asarray(m.visual.vertex_colors)  # RGBA uint8
    if C is None or len(C) != len(V):
        C = None
except Exception as e:
    print("  no vertex colors:", e)
    C = None

CELL = 0.012  # grid cell size in the mesh's native units (~edge length x2)
mn = V.min(0)
ijk = np.floor((V - mn) / CELL).astype(np.int64)  # >= 0
key = (ijk[:, 0] << 42) | (ijk[:, 1] << 21) | ijk[:, 2]
_, inv, counts = np.unique(key, return_inverse=True, return_counts=True)
n_new = len(counts)

newV = np.zeros((n_new, 3))
np.add.at(newV, inv, V)
newV /= counts[:, None]

colors = None
if C is not None:
    newC = np.zeros((n_new, 4))
    np.add.at(newC, inv, C.astype(np.float64))
    newC /= counts[:, None]
    colors = np.clip(newC, 0, 255).astype(np.uint8)

# Remap faces to clustered vertices, drop degenerate triangles, dedupe.
Fn = inv[F]
good = (Fn[:, 0] != Fn[:, 1]) & (Fn[:, 1] != Fn[:, 2]) & (Fn[:, 0] != Fn[:, 2])
Fn = Fn[good]
Fn = np.unique(np.sort(Fn, axis=1), axis=0)
new_faces = Fn
verts = newV
print(f"  clustered: {len(V)}->{n_new} verts, {len(F)}->{len(new_faces)} faces (cell={CELL})")

# Remap to Y-up for Cesium.
bmin = verts.min(0)
bmax = verts.max(0)
center = (bmin + bmax) / 2.0
verts = verts - center
extent = bmax - bmin
print("  local extent (x,y,z):", extent)
verts = np.column_stack([verts[:, 0], verts[:, 2], -verts[:, 1]])

# Write a minimal GLB by hand.
import json
import struct


def pad4(b: bytes, fill: bytes = b"\x00") -> bytes:
    while len(b) % 4 != 0:
        b += fill
    return b


pos = verts.astype("<f4")
idx = new_faces.astype("<u4").reshape(-1)
if colors is not None:
    col = colors.astype("<u1")
    if col.shape[1] == 3:  # RGB -> RGBA
        col = np.concatenate([col, np.full((len(col), 1), 255, "<u1")], axis=1)
else:
    col = np.full((len(pos), 4), 200, "<u1")

pos_b = pad4(pos.tobytes())
col_b = pad4(col.tobytes())
idx_b = pad4(idx.tobytes())
buffer = pos_b + col_b + idx_b

gltf = {
    "asset": {"version": "2.0", "generator": "ply2glb.py"},
    "scene": 0,
    "scenes": [{"nodes": [0]}],
    "nodes": [{"mesh": 0}],
    # Unlit material so the mesh shows its true vertex colours (no normals needed, no
    # lighting/darkening). Ensures it renders as a solid coloured surface, not shaded dark.
    "extensionsUsed": ["KHR_materials_unlit"],
    "materials": [
        {
            "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 1},
            "extensions": {"KHR_materials_unlit": {}},
        }
    ],
    "meshes": [
        {
            "primitives": [
                {
                    "attributes": {"POSITION": 0, "COLOR_0": 1},
                    "indices": 2,
                    "material": 0,
                    "mode": 4,
                }
            ]
        }
    ],
    "buffers": [{"byteLength": len(buffer)}],
    "bufferViews": [
        {"buffer": 0, "byteOffset": 0, "byteLength": len(pos_b), "target": 34962},
        {"buffer": 0, "byteOffset": len(pos_b), "byteLength": len(col_b), "target": 34962},
        {"buffer": 0, "byteOffset": len(pos_b) + len(col_b), "byteLength": len(idx_b), "target": 34963},
    ],
    "accessors": [
        {
            "bufferView": 0, "componentType": 5126, "count": int(len(pos)), "type": "VEC3",
            "min": pos.min(0).tolist(), "max": pos.max(0).tolist(),
        },
        {"bufferView": 1, "componentType": 5121, "normalized": True, "count": int(len(col)), "type": "VEC4"},
        {"bufferView": 2, "componentType": 5125, "count": int(len(idx)), "type": "SCALAR"},
    ],
}

json_chunk = pad4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ")
bin_chunk = pad4(buffer)
glb = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(json_chunk) + 8 + len(bin_chunk))
glb += struct.pack("<I", len(json_chunk)) + b"JSON" + json_chunk
glb += struct.pack("<I", len(bin_chunk)) + b"BIN\x00" + bin_chunk

with open(OUT, "wb") as f:
    f.write(glb)
print("wrote", OUT, "bytes:", len(glb), "verts:", len(pos), "tris:", len(idx) // 3)
print("EXTENT_JSON", {"x": float(extent[0]), "y": float(extent[1]), "z": float(extent[2])})
