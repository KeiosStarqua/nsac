"""Reporting: Jinja2 HTML render, PDF when WeasyPrint is importable."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from nsac.contracts import ActionTaken, Deviation, GroundReport, ReadinessScore, utcnow

TEMPLATES_DIR = Path(__file__).parent / "templates"

_DISCLAIMER = "AI-generated, not a substitute for a physician."

_SEVERITY_EMOJI = {"green": "🟢", "yellow": "🟡", "red": "🔴"}


def _sev(sev: str) -> str:
    return _SEVERITY_EMOJI.get(sev, sev)


def _fmt_ts(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M UTC")


def render_report_html(report: GroundReport) -> str:
    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=select_autoescape(["html"]),
    )
    env.filters["sev"] = _sev
    env.filters["fmt_ts"] = _fmt_ts
    template = env.get_template("ground_report.html.j2")
    return template.render(report=report, disclaimer=_DISCLAIMER, now=utcnow())


def render_report_pdf_bytes(report: GroundReport) -> bytes:
    """Render the PDF; raises ImportError with install guidance if WeasyPrint is absent."""
    try:
        from weasyprint import HTML  # optional extra, groups.agent
    except ImportError as exc:  # pragma: no cover - depends on optional install
        raise ImportError(
            "WeasyPrint is not installed. Install with: uv sync --group agent"
        ) from exc
    html = render_report_html(report)
    return bytes(HTML(string=html).write_pdf())


__all__ = ["render_report_html", "render_report_pdf_bytes"]


def _describe_components(score: ReadinessScore | None) -> list[dict[str, Any]]:
    if score is None:
        return []
    return [component.model_dump() for component in score.components]


def _describe_actions(actions: list[ActionTaken]) -> list[dict[str, Any]]:
    return [action.model_dump() for action in actions]


def _describe_deviations(deviations: list[Deviation]) -> list[dict[str, Any]]:
    return [deviation.model_dump() for deviation in deviations]
