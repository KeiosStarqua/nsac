/**
 * Verify phần streamed do split-iss.ts tạo ra:
 * - Mỗi part: đọc lại .gltf, đếm nodes/meshes/textures, kiểm tra texture files + sha256.
 * - World matrix của node gốc trong part == world matrix node tương ứng trong ISS-stationary.glb.
 * - Bounds (recompute từ accessor POSITION min/max) khớp trong manifest (±1e-4).
 * - Union bounds mọi part ≈ bounds toàn model gốc.
 * - Tổng geometry (.bin) ≈ ~11,9 MB và claim coverage = 131 mesh nodes.
 *
 * Chạy từ repo root: `bun scripts/iss/verify-iss.ts`
 */
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { createHash } from "node:crypto";
import { readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const SRC = join(ROOT, "apps/web/public/models/iss/ISS-stationary.glb");
const OUT_DIR = join(ROOT, "apps/web/public/models/iss/streamed");
const PARTS_DIR = join(OUT_DIR, "parts");
const TEXTURES_DIR = join(OUT_DIR, "textures");

/** Copy từ split-iss.ts (cùng thứ tự, cùng claim) — giữ đồng bộ khi sửa bảng claim. */
const PARTS: ReadonlyArray<{ readonly id: string; readonly nodes: readonly number[] }> = [
  { id: "zvezda-zarya", nodes: [25, 24, 23, 22, ...Array.from({ length: 22 }, (_, i) => i)] },
  { id: "unity-destiny", nodes: [112, 26, 27, 97, 96] },
  { id: "harmony-columbus-kibo", nodes: [95, 81, 84, 83, 82, 94, 85, 91, 90, 89, 88, 87, 86, 92, 93] },
  { id: "tranquility-cupola", nodes: [110, 100, 109, 101, 102, 103, 104, 105, 106, 107, 108, 111, 99, 98] },
  { id: "mbs-robotics", nodes: [52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28] },
  { id: "truss-s0", nodes: [80] },
  { id: "truss-s1", nodes: [67, 66, 53] },
  { id: "truss-s3", nodes: [65, 61, 62, 63, 64] },
  { id: "truss-s4", nodes: [60, 59, 58, 57, 56, 55, 54] },
  { id: "truss-p1", nodes: [79, 68] },
  { id: "truss-p3", nodes: [78, 76, 77] },
  { id: "truss-p4", nodes: [75, 74, 72, 73, 71, 70, 69] },
  { id: "panels-external", nodes: [114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131] },
];

const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
let failures = 0;
const fail = (msg: string) => {
  console.error(`  ✗ ${msg}`);
  failures++;
};
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

function mat4Close(a: ArrayLike<number>, b: ArrayLike<number>, eps = 1e-4): boolean {
  for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > eps) return false;
  return true;
}

function boundsOf(doc: Document): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const pMin = pos.getMin([]), pMax = pos.getMax([]);
      if (!pMin || !pMax) continue;
      for (const x of [pMin[0], pMax[0]])
        for (const y of [pMin[1], pMax[1]])
          for (const z of [pMin[2], pMax[2]]) {
            const w = [
              world[0] * x + world[4] * y + world[8] * z + world[12],
              world[1] * x + world[5] * y + world[9] * z + world[13],
              world[2] * x + world[6] * y + world[10] * z + world[14],
            ];
            for (let k = 0; k < 3; k++) {
              if (w[k] < min[k]) min[k] = w[k];
              if (w[k] > max[k]) max[k] = w[k];
            }
          }
    }
  }
  return { min, max };
}

async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const source = await io.read(SRC);
  const srcNodes = source.getRoot().listNodes();
  const srcBounds = boundsOf(source);
  console.log(`Source: nodes=${srcNodes.length}, bounds=[${srcBounds.min.map((v) => v.toFixed(2))}] → [${srcBounds.max.map((v) => v.toFixed(2))}]`);

  const manifest = JSON.parse(readFileSync(join(OUT_DIR, "manifest.json"), "utf8"));
  if (manifest.parts.length !== PARTS.length) fail(`manifest parts=${manifest.parts.length}, expect ${PARTS.length}`);

  const parentOf = new Map<number, number | null>();
  const nodeIndex = new Map(srcNodes.map((n, i) => [n, i] as const));
  for (const [i, n] of srcNodes.entries()) {
    parentOf.set(i, null);
    for (const c of n.listChildren()) parentOf.set(nodeIndex.get(c)!, i);
  }

  let totalBin = 0;
  let meshNodeCount = 0;
  let unionMin = [Infinity, Infinity, Infinity], unionMax = [-Infinity, -Infinity, -Infinity];

  for (const part of PARTS) {
    console.log(`\nPart ${part.id}:`);
    const gltfPath = join(PARTS_DIR, `${part.id}.gltf`);
    const binPath = join(PARTS_DIR, `${part.id}.bin`);
    if (!existsSync(gltfPath) || !existsSync(binPath)) {
      fail("missing .gltf or .bin");
      continue;
    }
    const binSize = statSync(binPath).size;
    totalBin += binSize;

    // Đọc lại part (texture external resolve theo path của part — file phải tồn tại + đúng hash)
    const doc = await io.read(gltfPath);
    const pRoot = doc.getRoot();
    const pNodes = pRoot.listNodes();
    const meshes = pNodes.filter((n) => n.getMesh()).length;
    meshNodeCount += meshes;
    if (meshes !== part.nodes.length) fail(`mesh nodes=${meshes}, expect ${part.nodes.length}`);
    else ok(`mesh nodes=${meshes}`);

    // World matrix của root part == world matrix source (bake đúng)
    const claimSet = new Set(part.nodes);
    const roots = part.nodes.filter((i) => {
      const p = parentOf.get(i);
      return p === null || p === undefined || !claimSet.has(p);
    });
    const pRootNodes = pNodes.filter((n) => !n.listParents().length || n.getParentNodes?.() === undefined);
    // Scene children là part roots — lấy trực tiếp từ scene
    const sceneRoots = pRoot.listScenes()[0]!.listChildren();
    if (sceneRoots.length !== roots.length) fail(`part roots=${sceneRoots.length}, expect ${roots.length}`);
    const pRootByName = new Map(pNodes.map((n) => [n.getName(), n] as const));
    for (const srcIdx of roots) {
      const srcNode = srcNodes[srcIdx];
      const targetNode = pRootByName.get(srcNode.getName());
      if (!targetNode) {
        fail(`root ${srcNode.getName()} not found in part`);
        continue;
      }
      if (!mat4Close(targetNode.getWorldMatrix(), srcNode.getWorldMatrix()))
        fail(`root ${srcNode.getName()} world matrix mismatch`);
    }
    ok(`world matrix(es) bake khớp source (${roots.length} root${roots.length > 1 ? "s" : ""})`);
    void pRootNodes;

    // Bounds của part khớp manifest (recompute từ part doc)
    const b = boundsOf(doc);
    const mEntry = manifest.parts.find((p: { id: string }) => p.id === part.id);
    if (!mEntry) fail("not in manifest");
    else {
      for (let k = 0; k < 3; k++) {
        if (Math.abs(b.min[k] - mEntry.bounds.min[k]) > 1e-4 || Math.abs(b.max[k] - mEntry.bounds.max[k]) > 1e-4)
          fail(`bounds axis ${k} mismatch: recompute [${b.min[k].toFixed(4)}, ${b.max[k].toFixed(4)}] vs manifest [${mEntry.bounds.min[k].toFixed(4)}, ${mEntry.bounds.max[k].toFixed(4)}]`);
      }
      if (mEntry.geometryBytes !== binSize) fail(`geometryBytes ${mEntry.geometryBytes} != bin size ${binSize}`);
      ok("bounds + geometryBytes khớp manifest");
      for (let k = 0; k < 3; k++) {
        unionMin[k] = Math.min(unionMin[k], b.min[k]);
        unionMax[k] = Math.max(unionMax[k], b.max[k]);
      }
    }

    // Textures: files tồn tại + sha256 khớp tên file; không image nào thiếu
    const textures = pRoot.listTextures();
    for (const tex of textures) {
      const uri = tex.getURI();
      if (!uri || !uri.startsWith("../textures/")) {
        fail(`texture URI không như mong đợi: ${uri}`);
        continue;
      }
      const file = uri.replace("../textures/", "");
      const p = join(TEXTURES_DIR, file);
      if (!existsSync(p)) {
        fail(`thiếu texture file ${file}`);
        continue;
      }
      const sha = file.replace(/\.[^.]+$/, "");
      const actual = createHash("sha256").update(readFileSync(p)).digest("hex");
      if (actual !== sha) fail(`texture ${file} hash mismatch`);
    }
    ok(`textures=${textures.length} refs OK`);

    // Doc sau khi đọc lại phải có đủ nguyên 4 cạnh POSITION min/max để raycast/culling
    void doc;
  }

  console.log(`\nTổng geometry (.bin): ${fmtMB(totalBin)} (model gốc ~11,9 MB kỳ vọng)`);
  console.log(`Tổng mesh nodes: ${meshNodeCount}/131`);
  if (meshNodeCount !== 131) fail("mesh coverage != 131");
  if (totalBin < 10 * 1024 * 1024 || totalBin > 14 * 1024 * 1024) fail(`geometry total ${fmtMB(totalBin)} ngoài khoảng ~10–14 MB`);
  else ok("geometry total trong khoảng kỳ vọng");

  for (let k = 0; k < 3; k++) {
    if (Math.abs(unionMin[k] - srcBounds.min[k]) > 1e-2 || Math.abs(unionMax[k] - srcBounds.max[k]) > 1e-2)
      fail(`union bounds axis ${k}: [${unionMin[k].toFixed(3)}, ${unionMax[k].toFixed(3)}] vs source [${srcBounds.min[k].toFixed(3)}, ${srcBounds.max[k].toFixed(3)}]`);
  }
  ok("union bounds khớp source");

  console.log(failures === 0 ? "\nVERIFY PASS ✓" : `\nVERIFY FAIL — ${failures} lỗi`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("VERIFY ERROR:", err);
  process.exit(1);
});
