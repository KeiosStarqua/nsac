"""Registry: phát hiện đủ 26 task, kiểm SHA-256 từng mô hình ready, 404 cho task lạ."""

from __future__ import annotations

from pathlib import Path

from sky_inference import model_loader

EXPECTED_TASKS = 26


def test_registry_discovers_every_task(registry, manifests: dict[str, dict]) -> None:
    assert registry.total == EXPECTED_TASKS == len(manifests)
    assert registry.total == len(registry.tasks)
    print(
        f"\nregistry: {registry.ready}/{registry.total} ready, {registry.total - registry.ready} unavailable"
    )
    for task, reason in registry.unavailable:
        print(f"  unavailable {task}: {reason}")


def test_registry_error_is_none(registry) -> None:
    assert registry.error is None


def test_every_ready_model_matcher_manifest_sha256(
    registry, run_dirs: dict[str, Path], manifests: dict[str, dict]
) -> None:
    """SHA-256 trên đĩa phải khớp manifest — đúng thứ `sky_ml._artifacts.load_model` kiểm."""
    ready = [entry for entry in registry.tasks.values() if entry.ready]
    assert ready, "không có mô hình nào ready — kiểm SKY_DATA_ROOT"
    for entry in ready:
        manifest = manifests[entry.task]
        recorded = model_loader.manifest_entry(manifest, entry.deploy_model)["sha256"]
        path = run_dirs[entry.task] / entry.deploy_model / "final.joblib"
        assert model_loader.sha256_file(path) == recorded == entry.sha256, entry.task


def test_ready_models_have_interval_or_are_classification(registry) -> None:
    import math

    for entry in registry.tasks.values():
        if not entry.ready:
            continue
        if entry.is_classification:
            assert entry.half_width is None
            assert entry.classes
        else:
            assert entry.half_width is not None and math.isfinite(entry.half_width), entry.task


def test_unknown_task_is_404(client) -> None:
    response = client.get("/v1/models/not-a-task")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "unknown_task"


def test_models_listing_shape(client, registry) -> None:
    payload = client.get("/v1/models").json()
    assert len(payload["models"]) == registry.total
    by_task = {item["task"]: item for item in payload["models"]}
    hr = by_task["hr"]
    assert hr["model"] == "ridge"  # deploy_model, không phải best_model
    assert hr["kind"] == "regression"
    assert hr["unit"] == "bpm"
    assert hr["state"] in {"ready", "unavailable"}
    assert hr["modelVersion"].startswith("2026-")


def test_task_detail_exposes_feature_contract(client) -> None:
    detail = client.get("/v1/models/hr").json()
    assert detail["deployModel"] == "ridge"
    assert detail["featureCount"] == len(detail["features"]) == 7
    assert detail["features"][0] == "last_value"
    assert detail["historyRequired"] is False
    assert detail["unit"] == "bpm"
    assert detail["sha256"] and len(detail["sha256"]) == 64
    assert "split-conformal" in detail["provenance"]

    mood = client.get("/v1/models/mood").json()
    assert mood["historyRequired"] is True
    assert mood["historyMode"] == "derived"

    sleep = client.get("/v1/models/sleep").json()
    assert sleep["classes"] == ["W", "N1", "N2", "N3", "REM"]
    assert sleep["intervalHalfWidth90"] is None
