/**
 * Tách `ISS-stationary.glb` thành các "part" glTF nhỏ để stream (spatial streaming).
 *
 * Chạy từ REPO ROOT bằng bun:  `bun scripts/iss/split-iss.ts`
 *
 * Nguyên tắc:
 * - Dedup texture lossless TRƯỚC khi tách (`dedup({propertyTypes:[TEXTURE]})`).
 * - Mỗi part = subtree(s) của model gốc, world matrix được bake vào node gốc của part
 *   nên part có thể render độc lập trong scene tại origin.
 * - Mỗi mesh node thuộc ĐÚNG một part; tổng số mesh node = 131; `_root` (113) không vào part.
 * - Textures được viết ra `streamed/textures/<sha256>.<ext>` (ngoài part) và mọi part
 *   tham chiếu cùng file đó qua URI tương đối `../textures/…` ⇒ network tải 1 lần.
 * - Bounds tính từ accessor POSITION min/max + world matrix thật — không đo bằng mắt.
 * - Không nén lossy: part giữ nguyên bytes geometry + texture như model gốc.
 *
 * Đo thật (pre-split, sau dedup): 132 nodes / 131 meshes / 343 primitives /
 * 26 images nhúng → 19 unique textures (PNG bytes với tên .jpg), geometry ~11,9 MB.
 */
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, copyToDocument, createDefaultPropertyResolver, unpartition } from "@gltf-transform/functions";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const SRC = join(ROOT, "apps/web/public/models/iss/ISS-stationary.glb");
const OUT_DIR = join(ROOT, "apps/web/public/models/iss/streamed");
const PARTS_DIR = join(OUT_DIR, "parts");
const TEXTURES_DIR = join(OUT_DIR, "textures");

/** Bảng claim theo node INDEX (ổn định) — đã verify: union = 131 mesh node, không overlap. */
const PARTS: ReadonlyArray<{ readonly id: string; readonly nodes: readonly number[] }> = [
  // Zarya (FGB): Zvezda + PMA1 + Rassvet + panel twins (.001 gắn dưới Zvezda)
  { id: "zvezda-zarya", nodes: [25, 24, 23, 22, ...Array.from({ length: 22 }, (_, i) => i)] },
  // Unity (Node 1): Unity + Z1 + ESP1 + Destiny + Destiny window cover
  { id: "unity-destiny", nodes: [112, 26, 27, 97, 96] },
  // Harmony (Node 2): Harmony + PMA2 + Columbus + RapidScat + Kibo PSM/PSM-arm/Exposed Platform/CATS
  { id: "harmony-columbus-kibo", nodes: [95, 81, 84, 83, 82, 94, 85, 91, 90, 89, 88, 87, 86, 92, 93] },
  // Tranquility (Node 3): Tranquility + PMA3 + Cupola (+7 shutters +ISS) + Leonardo
  // và Quest (parent = Unity/112, sibling của Tranquility) + ESP2
  { id: "tranquility-cupola", nodes: [110, 100, 109, 101, 102, 103, 104, 105, 106, 107, 108, 111, 99, 98] },
  // MBS + Canadarm2 chain (52 → 51 → … → 44) + DEXTRE chains (28–43, dưới 44)
  { id: "mbs-robotics", nodes: [52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28] },
  { id: "truss-s0", nodes: [80] },
  { id: "truss-s1", nodes: [67, 66, 53] },
  { id: "truss-s3", nodes: [65, 61, 62, 63, 64] },
  { id: "truss-s4", nodes: [60, 59, 58, 57, 56, 55, 54] },
  { id: "truss-p1", nodes: [79, 68] },
  { id: "truss-p3", nodes: [78, 76, 77] },
  { id: "truss-p4", nodes: [75, 74, 72, 73, 71, 70, 69] },
  // Bộ panel/hinge "sạch" đứng ở root (114–131) — KHÔNG trùng bộ .001 ở zvezda-zarya
  { id: "panels-external", nodes: [114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131] },
];

const EXPECTED_MESH_NODES = 131;

function magicExt(bytes: Uint8Array): { ext: string; mime: string } {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { ext: ".jpg", mime: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return { ext: ".png", mime: "image/png" };
  throw new Error("Texture bytes are neither JPEG nor PNG");
}

const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

async function main() {
  // Làm sạch output cũ để report không lẫn file mồ côi
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(PARTS_DIR, { recursive: true });
  mkdirSync(TEXTURES_DIR, { recursive: true });

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const source = await io.read(SRC);
  const root = source.getRoot();

  // ---- 1. Dedup lossless TRƯỚC (texture trùng byte-for-byte → 1 bản) ----
  const texBefore = root.listTextures().length;
  await source.transform(dedup({ propertyTypes: ["Texture"] }));
  const texAfter = root.listTextures().length;
  let rawTexBytes = 0;
  for (const t of root.listTextures()) rawTexBytes += t.getImage()!.length;
  console.log(`Textures dedup: ${texBefore} → ${texAfter} unique (${fmtMB(rawTexBytes)})`);

  // ---- 2. Gán URI + mime cho texture: ../textures/<sha256><ext> ----
  // Sắp xếp theo hash để output ổn định; map dùng cho cả writer lẫn manifest.
  const textureInfo = new Map<string, { sha: string; file: string; ext: string; bytes: number; uri: string }>(); // key = sha (sau dedup mọi texture unique)
  const textureByFile = new Map<string, { sha: string; ext: string; bytes: number }>(); // key = "<sha>.<ext>"
  for (const tex of root.listTextures()) {
    const image = tex.getImage()!;
    const sha = createHash("sha256").update(image).digest("hex");
    const { ext, mime } = magicExt(image);
    const uri = `../textures/${sha}${ext}`;
    tex.setURI(uri);
    tex.setMimeType(mime);
    const file = `${sha}${ext}`;
    textureInfo.set(sha, { sha, file, ext, bytes: image.length, uri });
    textureByFile.set(file, { sha, ext, bytes: image.length });
  }
  console.log(`Textures ghi ra: ${textureInfo.size} files`);

  const nodes = root.listNodes();
  const nodeIndex = new Map(nodes.map((n, i) => [n, i] as const));
  const meshNodeCount = nodes.filter((n) => n.getMesh()).length;
  console.log(`Nodes: ${nodes.length}, mesh nodes: ${meshNodeCount}, prims: ${root.listMeshes().reduce((a, m) => a + m.listPrimitives().length, 0)}`);

  // ---- 3. Validate bảng claim (coverage + overlap) ----
  const claimedBy = new Map<number, string>();
  for (const part of PARTS) {
    for (const i of part.nodes) {
      if (i < 0 || i >= nodes.length) throw new Error(`Part ${part.id}: index ${i} out of range`);
      if (!nodes[i].getMesh()) throw new Error(`Part ${part.id}: node ${i} (${nodes[i].getName()}) has no mesh`);
      const prev = claimedBy.get(i);
      if (prev) throw new Error(`Node ${i} (${nodes[i].getName()}) claimed by both ${prev} and ${part.id}`);
      claimedBy.set(i, part.id);
    }
  }
  const meshIndices = nodes.map((n, i) => (n.getMesh() ? i : -1)).filter((i) => i >= 0);
  const missing = meshIndices.filter((i) => !claimedBy.has(i));
  if (missing.length) throw new Error(`Mesh nodes not claimed: ${JSON.stringify(missing)}`);
  if (claimedBy.size !== EXPECTED_MESH_NODES)
    throw new Error(`Claimed ${claimedBy.size} mesh nodes, expected ${EXPECTED_MESH_NODES}`);
  console.log(`Claim coverage: ${claimedBy.size}/${EXPECTED_MESH_NODES} mesh nodes, no overlap ✓`);

  // ---- 4. Tách từng part ----
  const parentOf = new Map<number, number | null>();
  for (const [i, n] of nodes.entries()) {
    parentOf.set(i, null);
    for (const c of n.listChildren()) parentOf.set(nodeIndex.get(c)!, i);
  }

  const report: Array<{
    id: string;
    bytes: number;
    geometryBytes: number;
    textureBytes: number;
    textures: string[];
    bounds: { min: number[]; max: number[] };
    nodes: number;
  }> = [];
  const seenTextureFiles = new Set<string>();
  let totalGeometryBytes = 0;

  for (const part of PARTS) {
    const claimSet = new Set(part.nodes);
    const target = new Document();
    // Extensions (nếu source dùng) phải được khai báo ở target trước khi copy
    for (const ext of root.listExtensionsUsed()) {
      const t = target.createExtension(ext.constructor as never) as { setRequired(r: boolean): void };
      if (ext.isRequired()) t.setRequired(true);
    }
    const resolver = createDefaultPropertyResolver(target, source);
    const tScene = target.createScene().setName(part.id);

    // Pass 1: tạo target nodes (chưa gắn cha/con), copy mesh qua copyToDocument
    const tNodeByIndex = new Map<number, ReturnType<typeof target.createNode>>();
    for (const i of part.nodes) {
      const sNode = nodes[i];
      const tNode = target.createNode(sNode.getName());
      tNode.setTranslation(sNode.getTranslation());
      tNode.setRotation(sNode.getRotation());
      tNode.setScale(sNode.getScale());
      if (Object.keys(sNode.getExtras()).length) tNode.setExtras({ ...sNode.getExtras() });
      const mesh = sNode.getMesh();
      if (mesh) {
        const copied = copyToDocument(target, source, [mesh], resolver).get(mesh);
        if (!copied) throw new Error(`Failed to copy mesh of node ${i}`);
        tNode.setMesh(copied);
      }
      tNodeByIndex.set(i, tNode);
    }

    // Pass 2: node gốc của part (parent KHÔNG nằm trong claim set) → bake world matrix
    const partRoots: number[] = [];
    for (const i of part.nodes) {
      const p = parentOf.get(i);
      if (p === null || p === undefined || !claimSet.has(p)) partRoots.push(i);
    }
    for (const i of partRoots) {
      const tNode = tNodeByIndex.get(i)!;
      tNode.setMatrix(nodes[i].getWorldMatrix());
    }

    // Pass 3: gắn parent ↔ child / vào scene
    for (const i of part.nodes) {
      const p = parentOf.get(i);
      const tNode = tNodeByIndex.get(i)!;
      if (p !== null && p !== undefined && claimSet.has(p)) tNodeByIndex.get(p)!.addChild(tNode);
      else tScene.addChild(tNode);
    }

    // Merge buffers của target (copyToDocument có thể tạo nhiều Buffer) trước khi export
    await target.transform(unpartition());

    // Bounds: accessor POSITION min/max, transform bởi world matrix GỐC của node
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const i of part.nodes) {
      const sNode = nodes[i];
      const mesh = sNode.getMesh();
      if (!mesh) continue;
      const world = sNode.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        const pMin = pos.getMin([]), pMax = pos.getMax([]);
        if (!pMin || !pMax) continue;
        for (const x of [pMin[0], pMax[0]]) for (const y of [pMin[1], pMax[1]]) for (const z of [pMin[2], pMax[2]]) {
          // column-major mat4 (glTF)
          const wx = world[0] * x + world[4] * y + world[8] * z + world[12];
          const wy = world[1] * x + world[5] * y + world[9] * z + world[13];
          const wz = world[2] * x + world[6] * y + world[10] * z + world[14];
          for (let k = 0; k < 3; k++) {
            const w = [wx, wy, wz][k];
            if (w < min[k]) min[k] = w;
            if (w > max[k]) max[k] = w;
          }
        }
      }
    }

    // Export .gltf + .bin (writer sẽ tự ghi texture ra ../textures/… theo URI đã gán)
    const gltfPath = join(PARTS_DIR, `${part.id}.gltf`);
    await io.write(gltfPath, target);
    const gltfSize = statSync(gltfPath).size;
    const binPath = join(PARTS_DIR, `${part.id}.bin`);
    const binSize = statSync(binPath).size;
    totalGeometryBytes += binSize;

    // Textures của part (unique), theo thứ tự sort cho ổn định
    const partTextures = [...new Set(target.getRoot().listTextures().map((t) => t.getURI()!.replace("../textures/", "")))].sort();
    const textureBytes = partTextures.reduce((sum, f) => sum + (textureByFile.get(f)?.bytes ?? 0), 0);

    // Network accounting: texture đã được part trước "trả tiền" thì part này không tính lại
    let newTextureBytes = 0;
    for (const f of partTextures) {
      if (!seenTextureFiles.has(f)) {
        newTextureBytes += textureByFile.get(f)?.bytes ?? 0;
        seenTextureFiles.add(f);
      }
    }
    const bytes = gltfSize + binSize + newTextureBytes;

    report.push({ id: part.id, bytes, geometryBytes: binSize, textureBytes, textures: partTextures, bounds: { min, max }, nodes: part.nodes.length });
    console.log(`  ✓ ${part.id}: nodes=${part.nodes.length}, bin=${fmtMB(binSize)}, gltf=${(gltfSize / 1024).toFixed(1)} KB, textures=${partTextures.length} (${fmtMB(textureBytes)} total, +${fmtMB(newTextureBytes)} new)`);
  }

  console.log(`\nTổng geometry (.bin): ${fmtMB(totalGeometryBytes)}`);
  const uniqueTexBytes = [...seenTextureFiles].reduce((s, f) => s + (textureByFile.get(f)?.bytes ?? 0), 0);
  console.log(`Tổng texture unique: ${seenTextureFiles.size} files, ${fmtMB(uniqueTexBytes)}`);

  // ---- 5. Verify texture files trên đĩa khớp hash trong URI ----
  for (const [sha, info] of textureInfo) {
    const p = join(TEXTURES_DIR, info.file);
    const data = readFileSync(p);
    const actual = createHash("sha256").update(data).digest("hex");
    if (actual !== sha) throw new Error(`Texture file ${p} hash mismatch: ${actual}`);
  }
  console.log("Texture files trên đĩa khớp sha256 ✓");

  // ---- 6. Manifest ----
  const manifest = {
    version: 1,
    overview: "/models/iss/ISS-B.glb",
    fullDetail: "/models/iss/ISS-stationary.glb",
    totalGeometryBytes,
    totalTextureBytes: uniqueTexBytes,
    parts: report.map((r) => ({
      id: r.id,
      url: `/models/iss/streamed/parts/${r.id}.gltf`,
      bytes: r.bytes,
      geometryBytes: r.geometryBytes,
      textureBytes: r.textureBytes,
      textures: r.textures,
      bounds: {
        min: r.bounds.min.map((v) => Number(v.toFixed(6))),
        max: r.bounds.max.map((v) => Number(v.toFixed(6))),
      },
      nodes: r.nodes,
    })),
  };
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const totalNetwork = report.reduce((s, r) => s + r.bytes, 0);
  console.log(`\nManifest: ${report.length} parts, tổng network (shared textures tính 1 lần): ${fmtMB(totalNetwork)}`);
  console.log("PASS ✓");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
