/**
 * Sinh asset hologram tối giản cho thẻ `/?gen=0` (SkyScreen): chỉ giữ system `skin` + `skeleton`
 * của model Open Anatomy 3D nam, nén lại bằng meshopt.
 *
 * Chạy từ REPO ROOT bằng bun:  `bun scripts/holo-model.ts`
 *
 * Nguyên tắc:
 * - Nguồn: `apps/web/public/models/anatomy-male.glb` (6.157.236 B, 128 meshes, ~751.769 tris,
 *   0 texture, EXT_meshopt_compression + KHR_mesh_quantization).
 * - Giữ mesh theo CATALOG, không theo tên tay: `structureKeyForMesh()` (mesh `skin_1` → key `skin`)
 *   + `getStructure()` của `open-anatomy-3d`; chỉ giữ system `skin` và `skeleton`.
 * - Xoá mesh khác cùng node chứa nó, rồi `dedup() → flatten() → prune()`, quantize giữ nguyên như
 *   nguồn (position đã là int16), rồi `meshopt()` để ra lại GLB meshopt như file gốc.
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
import { NodeIO, type Mesh } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, meshopt, prune, simplify } from "@gltf-transform/functions";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";

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
  console.log(`Bytes: ${sizeBefore.toLocaleString("en-US")} → ${sizeAfter.toLocaleString("en-US")} (${((sizeAfter / sizeBefore) * 100).toFixed(1)}% of source)`);
  console.log(`sha256: ${sha256(OUT)}`);
  console.log(`Mesh names: ${keptNames.join(" ")}`);
  console.log("PASS ✓");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
