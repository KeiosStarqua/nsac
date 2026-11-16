"""API: /health, happy path, 422 khi sai hợp đồng, abstain đúng lý do, batch giữ thứ tự."""

from __future__ import annotations

import math

from conftest import fixture_row


def test_health_always_ok(client, registry) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["service"] == "sky-inference"
    assert body["modelsTotal"] == registry.total
    assert body["modelsReady"] == registry.ready
    assert isinstance(body["tasksUnavailable"], list)
    for item in body["tasksUnavailable"]:
        assert set(item) == {"task", "reason"}


def test_predict_happy_path(client, tables, manifests) -> None:
    features, _ = fixture_row("hr", tables, manifests, 0)
    response = client.post(
        "/v1/predict",
        json={"task": "hr", "subject_id": "demo-001", "features": features},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["abstain"] is False
    assert body["reasons"] == []
    assert body["subjectId"] == "demo-001"
    assert body["model"] == "ridge"
    assert body["unit"] == "bpm"
    assert isinstance(body["prediction"], float) and math.isfinite(body["prediction"])
    low, high = body["interval90"]["low"], body["interval90"]["high"]
    assert low < body["prediction"] < high


def test_predict_unknown_feature_key_is_422(client, tables, manifests) -> None:
    features, _ = fixture_row("hr", tables, manifests, 0)
    response = client.post(
        "/v1/predict",
        json={"task": "hr", "features": {**features, "not_a_feature": 1.0}},
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "unknown_feature"
    assert detail["unknown"] == ["not_a_feature"]


def test_predict_missing_feature_abstains(client, tables, manifests) -> None:
    features, _ = fixture_row("hr", tables, manifests, 0)
    features.pop("mean_all")
    body = client.post("/v1/predict", json={"task": "hr", "features": features}).json()
    assert body["abstain"] is True
    assert body["prediction"] is None
    assert body["reasons"] == ["missing_features"]


def test_predict_out_of_training_range_abstains(client, tables, manifests) -> None:
    features, _ = fixture_row("hr", tables, manifests, 0)
    features["last_value"] = 5000.0  # HR 5000 bpm: ngoài miền đã học → không ngoại suy
    body = client.post("/v1/predict", json={"task": "hr", "features": features}).json()
    assert body["abstain"] is True
    assert body["prediction"] is None
    assert body["reasons"] == ["out_of_training_range"]


def test_predict_history_task_requires_history(client) -> None:
    body = client.post("/v1/predict", json={"task": "mood", "features": {}}).json()
    assert body["abstain"] is True
    assert body["prediction"] is None
    assert body["reasons"] == ["history_required"]
    assert body["interval90"] is None


def test_predict_history_task_derives_personal_mean(client) -> None:
    """personal_mean = LastValue(column="mean_all") ⇒ dự báo = mean(history)."""
    history = [-16.0, -14.0, -12.0]
    body = client.post("/v1/predict", json={"task": "mood", "history": history}).json()
    assert body["abstain"] is False, body
    assert body["prediction"] == sum(history) / len(history)
    assert math.isfinite(body["interval90"]["low"])


def test_predict_constant_history_task_returns_train_mean_delta(client) -> None:
    """mean_delta = DummyRegressor(strategy="mean") ⇒ hằng số = trung bình target tập train."""
    body = client.post("/v1/predict", json={"task": "glucose", "history": [95.0, 97.0]}).json()
    assert body["abstain"] is False, body
    assert math.isfinite(body["prediction"])
    assert body["interval90"]["low"] < body["prediction"] < body["interval90"]["high"]


def test_predict_classification_returns_probabilities(client, tables, manifests) -> None:
    features, _ = fixture_row("sleep", tables, manifests, 0)
    response = client.post("/v1/predict", json={"task": "sleep", "features": features})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["abstain"] is False
    assert body["prediction"] is None
    assert body["interval90"] is None
    assert body["label"] in {"W", "N1", "N2", "N3", "REM"}
    assert set(body["probabilities"]) == {"W", "N1", "N2", "N3", "REM"}
    assert abs(sum(body["probabilities"].values()) - 1.0) < 1e-6


def test_batch_preserves_order(client, tables, manifests) -> None:
    hr_features, _ = fixture_row("hr", tables, manifests, 0)
    sbp_features, _ = fixture_row("vitals_sbp", tables, manifests, 0)
    items = [
        {"task": "hr", "subject_id": "a", "features": hr_features},
        {"task": "mood", "subject_id": "b", "history": [-16.0, -12.0]},
        {"task": "vitals_sbp", "subject_id": "c", "features": sbp_features},
    ]
    response = client.post("/v1/predict/batch", json={"items": items})
    assert response.status_code == 200, response.text
    results = response.json()["results"]
    assert [r["subjectId"] for r in results] == ["a", "b", "c"]
    assert [r["task"] for r in results] == ["hr", "mood", "vitals_sbp"]
    assert results[0]["prediction"] is not None and results[2]["prediction"] is not None


def test_batch_cap_is_64(client, tables, manifests) -> None:
    features, _ = fixture_row("hr", tables, manifests, 0)
    item = {"task": "hr", "features": features}
    assert client.post("/v1/predict/batch", json={"items": [item] * 64}).status_code == 200
    assert client.post("/v1/predict/batch", json={"items": [item] * 65}).status_code == 422


def test_predict_unknown_task_is_404(client) -> None:
    response = client.post("/v1/predict", json={"task": "nope", "features": {}})
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "unknown_task"


def test_predict_rejects_non_finite_feature(client) -> None:
    response = client.post("/v1/predict", json={"task": "hr", "features": {"last_value": "NaN"}})
    assert response.status_code == 422
