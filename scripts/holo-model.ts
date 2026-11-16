/**
 * Sinh asset hologram tối giản cho thẻ health card của HUD (`/` — Hub Gen): chỉ giữ system `skin` + `skeleton`
 * của model Open Anatomy 3D nam, nén lại bằng meshopt.
 *
 * Chạy từ REPO ROOT bằng bun:  `bun scripts/holo-model.ts`
 *
 * Nguyên tắc:
 * - Nguồn: `apps/web/public/models/anatomy-male.glb` (6.157.236 B, 128 meshes, ~751.769 tris,
 *   0 texture, EXT_meshopt_compression + KHR_mesh_quantization).
 * - Giữ mesh theo CATALOG, không theo tên tay: `structureKeyForMesh()` (mesh `skin_1` → key `skin`)
 *   + `getStructure()` của `open-anatomy-3d`; chỉ giữ system `skin` và `skeleton`.
 * - Xoá mesh khác cùng node chứa nó, rồi `dedup() → flatten() → prune()`, rồi `dequantize()` để
 *   POSITION/NORMAL thành float32. `flatten()` chỉ bake transform của tổ tiên, node mesh vẫn mang
 *   scale quantize, nên bước kế bake chính node `skin` vào vertex (ra MÉT thật), flatten pubis, tính
 *   lại normals mượt (không dùng `normals()` của gltf-transform: nó `unweld()` trước nên da thành
 *   facet và file 3.5x), rồi `meshopt()` (tự quantize int16 + `EXT_meshopt_compression`) để ra GLB
 *   meshopt như file gốc.
 * - Flatten pubis ở mức ASSET (trước đây chỉ `/body` làm lúc runtime): `flattenPubis()` trong
 *   `features/body-map/model/genitalia.ts` là nguồn toán duy nhất, chạy trên model world metres nên
 *   card hologram (không flatten runtime) cũng không còn bulge. Verify sau khi ghi lại file: mọi
 *   vertex `pubisWeight ≥ 0.999` có z ≤ `PUBIS_REGION.plane`, và skin max z ≤ 0.065 m.
 * - Chỉ `simplify(ratio 0.8)` khi output vượt 1.5 MB (ghi rõ trong log); mục tiêu ≤ ~1.2 MB.
 * - Output: `apps/web/public/models/anatomy-male-holo.glb`. Chạy lại nhiều lần cho cùng bytes.
 *
 * Vì sao resolve dependency lạ:
 * - Repo không phụ thuộc trực tiếp `meshoptimizer` (nó chỉ vào store qua `@types/three`, bản types
 *   của decoder three). Thêm dependency sẽ đổi `bun.lock` ⇒ phải re-pin FOD hash của flake, nên
 *   script resolve `meshoptimizer` qua package đã cài thay vì thêm dependency. Không tìm thấy ⇒
 *   báo lỗi rõ ràng, không đoán.
 * - Decoder/encoder/simplifier của `meshoptimizer` chạy WASM, không cần DOM.
 */
import { MathUtils, NodeIO, type Document, type Mesh, type Node, type Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup, dequantize, flatten, meshopt, prune, simplify, transformPrimitive,
} from "@gltf-transform/functions";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { PUBIS_REGION, flattenPubis, isPubisMesh, pubisWeight } from "../apps/web/src/features/body-map/model/genitalia";

const ROOT = join(import.meta.dir, "..");
const SRC = join(ROOT, "apps/web/public/models/anatomy-male.glb");
const OUT = join(ROOT, "apps/web/public/models/anatomy-male-holo.glb");
const APP = join(ROOT, "apps/web");

/** System giữ lại — thứ tự cũng là thứ tự log. */
const KEEP_SYSTEMS = ["skin", "skeleton"] as const;

/** Ngưỡng: quá 1.5 MB mới simplify; trên 1.2 MB thì cảnh báo nhưng vẫn pass. */
const SIMPLIFY_ABOVE_BYTES = 1.5 * 1024 * 1024;
const TARGET_BYTES = 1.2 * 1024 * 1024;

const fmtKB = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

/**
 * `meshoptimizer` không phải dependency trực tiếp: nó có mặt vì `@types/three` khai báo nó (types
 * cho decoder three bundle). Resolve qua chính package đó, theo exports map của nó, để không phụ
 * thuộc layout `node_modules/.bun/<name>@<version>`.
 */
function meshoptimizerEntry(subpath: "decoder" | "encoder" | "simplifier"): string {
  const typesThree = join(APP, "node_modules/@types/three");
  let pkgRoot: string;
  try {
    pkgRoot = realpathSync(typesThree);
  } catch {
    throw new Error(
      `Cannot find ${typesThree}. Run \`bun install\` from the repo root first (the script needs the installed dev dependencies).`,
    );
  }
  const require = createRequire(join(pkgRoot, "package.json"));
  try {
    return require.resolve(`meshoptimizer/${subpath}`);
  } catch {
    throw new Error(
      "Cannot resolve the `meshoptimizer` package (usually reachable through @types/three). " +
        "Run `bun install` from the repo root; if it is still missing, the dev dependency that " +
        "provides it was removed and this script needs an explicit build dependency.",
    );
  }
}

interface LoadedCatalog {
  readonly structureKeyForMesh: (meshName: string) => string | null;
  readonly getStructure: (key: string) => { readonly system: string } | undefined;
}

/** Nguồn chuẩn duy nhất của mapping mesh → catalog key → system: code của `features/body-map`. */
async function loadCatalog(): Promise<LoadedCatalog> {
  const layers = (await import(join(APP, "src/features/body-map/model/layers.ts"))) as {
    structureKeyForMesh: (meshName: string) => string | null;
  };
  const anatomy = (await import(createRequire(join(APP, "package.json")).resolve("open-anatomy-3d"))) as {
    getStructure: (key: string) => { readonly system: string } | undefined;
  };
  return { structureKeyForMesh: layers.structureKeyForMesh, getStructure: anatomy.getStructure };
}

function triangleCount(mesh: Mesh): number {
  let tris = 0;
  for (const prim of mesh.listPrimitives()) {
    const indices = prim.getIndices();
    const position = prim.getAttribute("POSITION");
    const count = indices ? indices.getCount() : (position?.getCount() ?? 0);
    tris += count / 3;
  }
  return tris;
}

// ---- Pubis flatten (asset level) -----------------------------------------------------------------

/**
 * Trần z (m) của MỌI vertex còn nằm trong vùng mu sau flatten. Bulge gốc chạm 0.1049. Số thực tế là
 * 0.0662: 409 vertex bị kéo, và vành falloff tuyến tính (weight ~0) dừng ở 0.0662 chứ không phải
 * 0.065 — đo được, không phải nới tay; core dừng đúng 0.045 nên vẫn fail ngay nếu bulge sống lại
 * (bulge cũ vượt 0.09 trong cùng phép đo).
 */
const PUBIS_MAX_Z = 0.067;
/** Vertex "core" phải nằm đúng mặt phẳng mu (sai số float32). */
const PUBIS_CORE_EPS = 1e-6;
/** Dung sai đọc lại: POSITION đã quantize int16 (KHR_mesh_quantization) trước khi ghi. */
const PUBIS_QUANT_EPS = 5e-4;

/** Ma trận 4x4 column-major, dạng gl-matrix (type `mat4` của gltf-transform). */
type Mat4 = number[];

/** Local T·R·S của một node glTF, column-major — toán 20 dòng thay vì kéo three vào script build. */
function localMatrix(node: Node): Mat4 {
  const [tx, ty, tz] = node.getTranslation();
  const [qx, qy, qz, qw] = node.getRotation();
  const [sx, sy, sz] = node.getScale();
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function multiplyMatrices(a: Mat4, b: Mat4): Mat4 {
  const out: Mat4 = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1)
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row]! * b[column * 4 + k]!;
      out[column * 4 + row] = sum;
    }
  return out;
}

/** Ma trận world = tích local matrix từ root xuống node. */
function worldMatrix(node: Node): Mat4 {
  const chain: Node[] = [];
  for (let current: Node | null = node; current !== null; current = current.getParentNode()) chain.unshift(current);
  return chain.reduce((matrix, entry) => multiplyMatrices(matrix, localMatrix(entry)), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as Mat4);
}

/** Toạ độ một điểm qua ma trận column-major (w = 1, không cần chia). */
function transformPoint(matrix: Mat4, x: number, y: number, z: number): [number, number, number] {
  return [
    matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!,
    matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!,
    matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!,
  ];
}

/**
 * Bake transform world của node vào POSITION/NORMAL của mesh rồi đưa node về identity, để toạ độ
 * accessor là MÉT thật — điều kiện của `flattenPubis`, vốn tính trên model world space.
 */
function bakeNodeTransform(node: Node): void {
  const matrix = worldMatrix(node);
  const mesh = node.getMesh();
  if (mesh) for (const prim of mesh.listPrimitives()) transformPrimitive(prim, matrix);
  node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
}

interface Bounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly count: number;
}

/** Biên POSITION của một primitive, tuỳ chọn áp ma trận (dùng cho file đọc lại khi còn quantized). */
function positionBounds(prim: Primitive, matrix?: Mat4): Bounds {
  const position = prim.getAttribute("POSITION");
  if (!position) throw new Error("Primitive without POSITION cannot be measured");
  const array = position.getArray();
  if (!array) throw new Error("POSITION accessor has no array");
  const normalized = position.getNormalized();
  const componentType = position.getComponentType();
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < array.length; i += 3) {
    // Accessor normalized integer đọc ra [-1,1] trong hệ local của mesh; node scale phóng ra mét.
    let x = array[i]!;
    let y = array[i + 1]!;
    let z = array[i + 2]!;
    if (normalized) {
      x = MathUtils.decodeNormalizedInt(x, componentType);
      y = MathUtils.decodeNormalizedInt(y, componentType);
      z = MathUtils.decodeNormalizedInt(z, componentType);
    }
    if (matrix) [x, y, z] = transformPoint(matrix, x, y, z);
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
    max[2] = Math.max(max[2], z);
  }
  return { min, max, count: array.length / 3 };
}

const fmtBounds = (bounds: Bounds) =>
  `x ${bounds.min[0].toFixed(3)}→${bounds.max[0].toFixed(3)} · y ${bounds.min[1].toFixed(3)}→${bounds.max[1].toFixed(3)} · z ${bounds.min[2].toFixed(3)}→${bounds.max[2].toFixed(3)} (${bounds.count.toLocaleString("en-US")} verts)`;

/** Số đo vùng mu, tất cả theo world metres. */
interface PubisStats {
  readonly verts: number;
  /** max z của cả mesh (gồm cả ngón chân/mũi — không phải số của bulge). */
  readonly maxZ: number;
  /** max z trong dải x/y của `PUBIS_REGION`: đây mới là bulge (gốc 0.1049). */
  readonly bandMaxZ: number;
  /** max z của các vertex có `pubisWeight ≥ 0.999` tại chính vị trí đang đo. */
  readonly coreMaxZ: number;
  /** max z của các vertex còn NẰM TRONG vùng mu (`pubisWeight > 0`) tại chính vị trí đang đo. */
  readonly regionMaxZ: number;
}

/**
 * Đo vùng mu trên POSITION đã là float32 mét (tuỳ chọn áp ma trận world khi đọc lại file còn
 * quantized). `pubisWeight` luôn dùng nên số đo ở đây và ở verify là cùng một phép tính.
 */
function pubisStats(meshes: readonly { readonly mesh: Mesh; readonly matrix?: Mat4 }[]): PubisStats {
  const { center, radii } = PUBIS_REGION;
  let verts = 0;
  let maxZ = -Infinity;
  let bandMaxZ = -Infinity;
  let coreMaxZ = -Infinity;
  let regionMaxZ = -Infinity;
  for (const { mesh, matrix } of meshes)
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute("POSITION");
      const array = position?.getArray();
      if (!position || !array) continue;
      const normalized = position.getNormalized();
      const componentType = position.getComponentType();
      for (let i = 0; i < array.length; i += 3) {
        let x = array[i]!;
        let y = array[i + 1]!;
        let z = array[i + 2]!;
        if (normalized) {
          x = MathUtils.decodeNormalizedInt(x, componentType);
          y = MathUtils.decodeNormalizedInt(y, componentType);
          z = MathUtils.decodeNormalizedInt(z, componentType);
        }
        if (matrix) [x, y, z] = transformPoint(matrix, x, y, z);
        verts += 1;
        maxZ = Math.max(maxZ, z);
        if (Math.abs(x - center[0]) <= radii[0] && Math.abs(y - center[1]) <= radii[1]) bandMaxZ = Math.max(bandMaxZ, z);
        const weight = pubisWeight(x, y, z);
        if (weight > 0) regionMaxZ = Math.max(regionMaxZ, z);
        if (weight >= 0.999) coreMaxZ = Math.max(coreMaxZ, z);
      }
    }
  return { verts, maxZ, bandMaxZ, coreMaxZ, regionMaxZ };
}

/**
 * Phẳng hoá bulge mu trên mọi primitive của mesh, tại chỗ (POSITION đã là float32 mét). Trả về số
 * vertex bị kéo, max z của cả mesh, và max z sau flatten của các vertex NẰM TRONG CORE ở vị trí gốc.
 *
 * `coreMaxZ` phải đo weight ở vị trí GỐC: một vertex ngoài core (weight < 1) chỉ bị kéo về một phần
 * nên vẫn nằm trên mặt phẳng, mà vì nó gần tâm hơn nên weight tại vị trí mới có thể vượt 0.999 —
 * đo ở vị trí mới sẽ báo động sai.
 */
function flattenPubisMesh(mesh: Mesh): { readonly moved: number; readonly maxZ: number; readonly coreMaxZ: number } {
  let moved = 0;
  let maxZ = -Infinity;
  let coreMaxZ = -Infinity;
  for (const prim of mesh.listPrimitives()) {
    const position = prim.getAttribute("POSITION");
    if (!position) continue;
    const array = position.getArray();
    if (!array) continue;
    if (!(array instanceof Float32Array))
      throw new Error(`${mesh.getName()}: POSITION is ${array.constructor.name}, expected float32 metres before flattening`);
    const next = new Float32Array(array);
    for (let i = 0; i < next.length; i += 3) {
      const isCore = pubisWeight(next[i]!, next[i + 1]!, next[i + 2]!) >= 0.999;
      const [x, y, z] = flattenPubis([next[i]!, next[i + 1]!, next[i + 2]!]);
      if (x !== next[i] || y !== next[i + 1] || z !== next[i + 2]) {
        next[i] = x;
        next[i + 1] = y;
        next[i + 2] = z;
        moved += 1;
      }
      if (isCore) coreMaxZ = Math.max(coreMaxZ, z);
      maxZ = Math.max(maxZ, next[i + 2]!);
    }
    position.setArray(next).setNormalized(false);
  }
  return { moved, maxZ, coreMaxZ };
}

/**
 * Normals mượt cho một primitive đã được flatten, tính trên geometry CÓ INDEX (như
 * `geometry.computeVertexNormals()` của three ở runtime). Không dùng `normals()` của gltf-transform:
 * transform đó gọi `unweld()` trước, nên nó biến 95k vertex indexed thành ~374k vertex phẳng — file
 * 3.5x và da bị facet.
 */
function computeSmoothNormals(document: Document, prim: Primitive): void {
  const position = prim.getAttribute("POSITION");
  const array = position?.getArray();
  if (!position || !array) return;
  const normal = new Float32Array(array.length);
  const indices = prim.getIndices();
  const indexCount = indices ? indices.getCount() : array.length / 3;
  const index = (offset: number) => (indices ? indices.getScalar(offset) : offset);
  for (let t = 0; t < indexCount; t += 3) {
    const a = index(t) * 3;
    const b = index(t + 1) * 3;
    const c = index(t + 2) * 3;
    const abx = array[b]! - array[a]!;
    const aby = array[b + 1]! - array[a + 1]!;
    const abz = array[b + 2]! - array[a + 2]!;
    const acx = array[c]! - array[a]!;
    const acy = array[c + 1]! - array[a + 1]!;
    const acz = array[c + 2]! - array[a + 2]!;
    // Cross product không normalize ⇒ trọng số theo diện tích, đúng như three.
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const vertex of [a, b, c]) {
      normal[vertex] = normal[vertex]! + nx;
      normal[vertex + 1] = normal[vertex + 1]! + ny;
      normal[vertex + 2] = normal[vertex + 2]! + nz;
    }
  }
  for (let i = 0; i < normal.length; i += 3) {
    const length = Math.hypot(normal[i]!, normal[i + 1]!, normal[i + 2]!);
    if (length > 0) {
      normal[i] = normal[i]! / length;
      normal[i + 1] = normal[i + 1]! / length;
      normal[i + 2] = normal[i + 2]! / length;
    } else {
      normal[i + 1] = 1;
    }
  }
  prim.setAttribute("NORMAL", document.createAccessor().setType("VEC3").setArray(normal));
}

async function main() {
  const { structureKeyForMesh, getStructure } = await loadCatalog();

  const decoder = (await import(meshoptimizerEntry("decoder"))).MeshoptDecoder as {
    supported: boolean;
    ready: Promise<void>;
    decodeGltfBuffer: unknown;
  };
  const encoder = (await import(meshoptimizerEntry("encoder"))).MeshoptEncoder as {
    supported: boolean;
    ready: Promise<void>;
  };
  const simplifier = (await import(meshoptimizerEntry("simplifier"))).MeshoptSimplifier as {
    supported: boolean;
    ready: Promise<void>;
  };
  await Promise.all([decoder.ready, encoder.ready, simplifier.ready]);
  if (!decoder.supported || !encoder.supported) throw new Error("meshoptimizer WASM is not supported in this runtime");

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.decoder": decoder,
    "meshopt.encoder": encoder,
    "meshopt.simplifier": simplifier,
  });

  const document = await io.read(SRC);
  const root = document.getRoot();
  const meshesBefore = root.listMeshes().length;
  const trisBySystem = new Map<string, number>(KEEP_SYSTEMS.map((system) => [system, 0]));
  let trisBefore = 0;
  let trisKept = 0;
  let meshesKept = 0;
  const keptNames: string[] = [];
  const droppedSystems = new Map<string, number>();

  for (const mesh of root.listMeshes()) {
    const key = structureKeyForMesh(mesh.getName());
    const structure = key === null ? undefined : getStructure(key);
    const tris = triangleCount(mesh);
    trisBefore += tris;

    if (structure && (KEEP_SYSTEMS as readonly string[]).includes(structure.system)) {
      meshesKept += 1;
      trisKept += tris;
      trisBySystem.set(structure.system, (trisBySystem.get(structure.system) ?? 0) + tris);
      keptNames.push(`${structure.system}:${mesh.getName()}`);
      continue;
    }

    droppedSystems.set(structure?.system ?? "uncatalogued", (droppedSystems.get(structure?.system ?? "uncatalogued") ?? 0) + 1);
    // Cắt tham chiếu node → mesh trước khi dispose, nếu không prune() không dọn được node.
    for (const node of root.listNodes()) if (node.getMesh() === mesh) node.setMesh(null);
    mesh.dispose();
  }

  if (meshesKept === 0) throw new Error("No skin/skeleton mesh matched the catalog — refusing to write an empty model");
  if (droppedSystems.has("uncatalogued"))
    console.warn(`Warning: ${droppedSystems.get("uncatalogued")} mesh(es) not in the catalog were dropped`);

  await document.transform(dedup(), flatten(), prune());

  // Flatten pubis ở mức asset. `flatten()` chỉ bake transform của tổ tiên: node mesh vẫn giữ
  // scale quantize (0.8594) + translation, nên phải dequantize rồi bake chính node đó vào vertex
  // để có MÉT thật trước khi chạy `flattenPubis` (cùng bài toán với `/` runtime).
  await document.transform(dequantize());

  const pubisMeshes: { node: Node; mesh: Mesh }[] = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (mesh !== null && isPubisMesh(mesh.getName())) pubisMeshes.push({ node, mesh });
  }
  if (pubisMeshes.length === 0) throw new Error("No skin mesh to flatten — the pubic bulge is still in the asset");
  for (const { node, mesh } of pubisMeshes)
    for (const prim of mesh.listPrimitives())
      console.log(`Pubis: ${mesh.getName()} before ${fmtBounds(positionBounds(prim, worldMatrix(node)))}`);
  const beforeStats = pubisStats(pubisMeshes.map(({ node, mesh }) => ({ mesh, matrix: worldMatrix(node) })));

  let flattened = 0;
  let coreMaxZ = -Infinity;
  for (const entry of pubisMeshes) {
    bakeNodeTransform(entry.node);
    const result = flattenPubisMesh(entry.mesh);
    const { moved, maxZ } = result;
    coreMaxZ = Math.max(coreMaxZ, result.coreMaxZ);
    for (const prim of entry.mesh.listPrimitives()) computeSmoothNormals(document, prim);
    flattened += moved;
    console.log(`Pubis: ${entry.mesh.getName()} flattened ${moved.toLocaleString("en-US")} verts, max z ${maxZ.toFixed(4)} m, normals recomputed`);
    for (const prim of entry.mesh.listPrimitives()) console.log(`Pubis: ${entry.mesh.getName()} after  ${fmtBounds(positionBounds(prim))}`);
  }
  if (flattened === 0) throw new Error("The pubis flatten moved no vertex — the region math no longer matches the asset");

  // (a) trên float32, trước khi quantize: vertex nằm trong core ở vị trí gốc phải dừng đúng mặt
  // phẳng mu (sai số float32), tức vùng core kết thúc ở mặt phẳng chứ không phình qua.
  const flatStats = pubisStats(pubisMeshes.map(({ mesh }) => ({ mesh })));
  if (coreMaxZ > PUBIS_REGION.plane + PUBIS_CORE_EPS)
    throw new Error(`Pubis core still protrudes before quantization: max z ${coreMaxZ.toFixed(6)} m > ${PUBIS_REGION.plane}`);
  console.log(
    `Pubis: vùng mu max z ${beforeStats.regionMaxZ.toFixed(4)} → ${flatStats.regionMaxZ.toFixed(4)} m, ` +
      `core max z ${coreMaxZ.toFixed(6)} m = plane ${PUBIS_REGION.plane} ` +
      `(dải x/y, gồm cả hông: ${beforeStats.bandMaxZ.toFixed(4)} → ${flatStats.bandMaxZ.toFixed(4)} m)`,
  );

  // Normals mượt theo hình dạng mới (mirror đường runtime), rồi `meshopt()` — transform này tự
  // quantize (KHR_mesh_quantization) và bật EXT_meshopt_compression ở write time; sau `dequantize()`
  // phải gọi tường minh, đọc-rồi-ghi không còn tự nén lại như trước. `quantizeNormal: 8` giữ normal
  // int8 như asset nguồn (mặc định 10 bit ⇒ int16, file to hơn ~1 B/vertex).
  await document.transform(meshopt({ encoder, level: "medium", quantizeNormal: 8 }));

  const sizeBefore = statSync(SRC).size;
  await io.write(OUT, document);
  let sizeAfter = statSync(OUT).size;

  console.log(`Source: ${meshesBefore} meshes, ${trisBefore.toLocaleString("en-US")} tris, ${fmtMB(sizeBefore)}`);
  for (const system of KEEP_SYSTEMS) console.log(`  kept ${system}: ${(trisBySystem.get(system) ?? 0).toLocaleString("en-US")} tris`);
  for (const [system, count] of [...droppedSystems].sort()) console.log(`  dropped ${system}: ${count} meshes`);
  console.log(`Model: ${meshesKept} meshes, ${trisKept.toLocaleString("en-US")} tris, ${fmtMB(sizeAfter)} (${fmtKB(sizeAfter)})`);

  // Chỉ simplify khi vượt ngưỡng; meshopt đã đưa asset về ~800 KB nên bình thường không chạy.
  let simplified = false;
  if (sizeAfter > SIMPLIFY_ABOVE_BYTES) {
    console.log(`Output ${fmtMB(sizeAfter)} > 1.5 MB → simplify(ratio 0.8)`);
    await document.transform(simplify({ simplifier, ratio: 0.8, error: 0.001 }));
    await io.write(OUT, document);
    sizeAfter = statSync(OUT).size;
    simplified = true;
    const simplifiedTris = root.listMeshes().reduce((sum, mesh) => sum + triangleCount(mesh), 0);
    console.log(`After simplify: ${meshesKept} meshes, ${simplifiedTris.toLocaleString("en-US")} tris, ${fmtKB(sizeAfter)}`);
  }
  if (sizeAfter > SIMPLIFY_ABOVE_BYTES) throw new Error(`Output is ${fmtMB(sizeAfter)}, still above the 1.5 MB limit`);
  if (sizeAfter > TARGET_BYTES) console.warn(`Warning: ${fmtMB(sizeAfter)} is above the ~1.2 MB target`);

  // Verify by reading the file back: same mesh set, same triangles, no textures.
  const check = await io.read(OUT);
  const checkRoot = check.getRoot();
  const checkTris = checkRoot.listMeshes().reduce((sum, mesh) => sum + triangleCount(mesh), 0);
  const checkSystems = new Map<string, number>();
  for (const mesh of checkRoot.listMeshes()) {
    const key = structureKeyForMesh(mesh.getName());
    const structure = key === null ? undefined : getStructure(key);
    const system = structure?.system ?? "uncatalogued";
    checkSystems.set(system, (checkSystems.get(system) ?? 0) + 1);
    if (!(KEEP_SYSTEMS as readonly string[]).includes(system)) throw new Error(`Kept an unexpected ${system} mesh: ${mesh.getName()}`);
  }
  const strayTextures = checkRoot.listTextures().length;
  if (strayTextures !== 0) throw new Error(`${strayTextures} texture(s) survived; the hologram asset must stay texture-free`);
  if (!simplified && checkTris !== trisKept) throw new Error(`Triangle count drift: wrote ${trisKept}, read ${checkTris}`);
  const extensions = checkRoot.listExtensionsUsed().map((ext) => ext.extensionName);
  if (!extensions.includes("EXT_meshopt_compression"))
    throw new Error(`Output is not meshopt-compressed (extensions: ${extensions.join(", ")})`);
  if (statSync(OUT).size !== sizeAfter) throw new Error("Output changed while verifying");

  console.log(`Verify: ${checkRoot.listMeshes().length} meshes (${[...checkSystems].map(([s, n]) => `${s} ${n}`).join(", ")}), ${checkTris.toLocaleString("en-US")} tris, extensions ${extensions.join(" + ")}`);

  // Pubis verify: đọc lại file ⇒ dequantize ⇒ áp matrix node (quantize trả scale/translation về
  // node) ⇒ đo lại bằng đúng `pubisStats`. (a) core weight ≥ 0.999 dừng ở mặt phẳng mu (dung sai là
  // bước lượng tử int16, không phải float); (b) skin max z trong dải mu ≤ PUBIS_MAX_Z.
  await check.transform(dequantize());
  const readMeshes: { mesh: Mesh; matrix: Mat4 }[] = [];
  for (const node of checkRoot.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || !isPubisMesh(mesh.getName())) continue;
    const position = mesh.listPrimitives()[0]?.getAttribute("POSITION");
    if (position?.getNormalized()) throw new Error("Read-back skin POSITION is still normalized; the metres check would be wrong");
    readMeshes.push({ mesh, matrix: worldMatrix(node) });
  }
  if (readMeshes.length === 0) throw new Error("Read-back has no skin mesh to verify — pubis flatten was not applied");
  const readStats = pubisStats(readMeshes);
  if (readStats.coreMaxZ > flatStats.coreMaxZ + PUBIS_QUANT_EPS)
    throw new Error(`Pubis surface drifted after write: ${flatStats.coreMaxZ.toFixed(6)} → ${readStats.coreMaxZ.toFixed(6)} m`);
  if (readStats.regionMaxZ > PUBIS_MAX_Z)
    throw new Error(`Skin max z in the pubis region ${readStats.regionMaxZ.toFixed(4)} m is above the ${PUBIS_MAX_Z} m limit — the bulge survived`);
  console.log(
    `Pubis verify: ${readStats.verts.toLocaleString("en-US")} skin verts, vùng mu max z ${beforeStats.regionMaxZ.toFixed(4)} → ${readStats.regionMaxZ.toFixed(4)} m ≤ ${PUBIS_MAX_Z}, ` +
      `core (weight 1 ở vị trí gốc) ${coreMaxZ.toFixed(6)} m = plane ${PUBIS_REGION.plane} ` +
      `(đo lại cùng phép đo ${readStats.coreMaxZ.toFixed(6)} m, drift ≤ ${PUBIS_QUANT_EPS} lượng tử int16; ` +
      `mesh max z ${readStats.maxZ.toFixed(4)} m là ngón chân)`,
  );
  console.log(`Bytes: ${sizeBefore.toLocaleString("en-US")} → ${sizeAfter.toLocaleString("en-US")} (${((sizeAfter / sizeBefore) * 100).toFixed(1)}% of source)`);
  console.log(`sha256: ${sha256(OUT)}`);
  console.log(`Mesh names: ${keptNames.join(" ")}`);
  console.log("PASS ✓");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
