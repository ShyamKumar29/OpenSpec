"""Markdown + JSON report rendering for `EvalRunResult` (`EVL`, M1 —
docs/10-roadmap.md M1: "`make eval` produces a report with confidence
intervals"). Pure string rendering, no I/O — the CLI composition root
(`scripts/run_eval.py`) writes the returned strings to disk.
"""

from __future__ import annotations

import json

from openspec.application.usecases.run_evaluation import EvalRunResult
from openspec.domain.evl.metrics import AggregateMetrics, ConfidenceInterval
from openspec.domain.model.gold import GoldSetAvailability


def _fmt_ci(ci: ConfidenceInterval) -> str:
    return f"{ci.point:.1%} (95% CI {ci.low:.1%}–{ci.high:.1%}, n={ci.n})"


def _render_aggregate(agg: AggregateMetrics) -> list[str]:
    lov = f"{agg.lov_membership_rate:.1%}" if agg.lov_membership_rate is not None else "n/a"
    compliance = f"{agg.compliance_rate:.1%}" if agg.compliance_rate is not None else "n/a"
    return [
        f"- n = {agg.n}",
        f"- Overall accuracy: {_fmt_ci(agg.overall_accuracy)}",
        f"- Unknown rate: {agg.unknown_rate:.1%}",
        f"- Review rate: {agg.review_rate:.1%}",
        f"- Evidence coverage: {agg.evidence_coverage:.1%}",
        f"- LOV membership rate: {lov}",
        f"- Compliance rate: {compliance}",
    ]


def render_eval_markdown(result: EvalRunResult) -> str:
    lines = [
        f"# Evaluation run `{result.run_id}`",
        "",
        f"- Dataset: `{result.dataset}`",
        f"- Timestamp: {result.timestamp}",
        f"- Gold-set availability: **{result.availability.value}**",
    ]

    if result.availability is not GoldSetAvailability.GOLD_SET_AVAILABLE:
        lines += [
            "",
            "No accuracy is reported: the real gold set is unavailable or invalid. "
            "**An unavailable score is not the same as a 0% score** — see "
            "`resources/reference/unihack/gold/README.md`.",
        ]
        if result.warnings:
            lines += ["", "## Warnings"] + [f"- {w}" for w in result.warnings]
        return "\n".join(lines) + "\n"

    assert result.aggregate_all is not None
    lines += [
        f"- Rows scored: {result.row_count}",
        f"- Fields scored: {result.field_count}",
        "",
        "## Aggregate (all labels)",
        *_render_aggregate(result.aggregate_all),
        "",
        "## Aggregate (real labels only)",
    ]
    lines += (
        _render_aggregate(result.aggregate_real)
        if result.aggregate_real is not None
        else ["_No real (non-synthetic) labels in this gold set._"]
    )

    lines += [
        "",
        "## Per-field",
        "| field | n | accuracy | unknown rate | TP | FP | FN | correct abstain | over abstain |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for m in result.per_field:
        lines.append(
            f"| {m.field} | {m.n} | {_fmt_ci(m.accuracy)} | {m.unknown_rate:.1%} "
            f"| {m.tp} | {m.fp} | {m.fn} | {m.correct_abstain} | {m.over_abstain} |"
        )

    if result.failures:
        lines += ["", "## Failures (no prediction produced)"] + [f"- {f}" for f in result.failures]
    if result.warnings:
        lines += ["", "## Warnings"] + [f"- {w}" for w in result.warnings]

    return "\n".join(lines) + "\n"


def _ci_json(ci: ConfidenceInterval) -> dict[str, float | int]:
    return {"point": ci.point, "low": ci.low, "high": ci.high, "n": ci.n}


def _agg_json(agg: AggregateMetrics | None) -> dict[str, object] | None:
    if agg is None:
        return None
    return {
        "n": agg.n,
        "overall_accuracy": _ci_json(agg.overall_accuracy),
        "unknown_rate": agg.unknown_rate,
        "review_rate": agg.review_rate,
        "evidence_coverage": agg.evidence_coverage,
        "lov_membership_rate": agg.lov_membership_rate,
        "compliance_rate": agg.compliance_rate,
    }


def render_eval_json(result: EvalRunResult) -> str:
    payload: dict[str, object] = {
        "run_id": result.run_id,
        "dataset": result.dataset,
        "timestamp": result.timestamp,
        "availability": result.availability.value,
        "row_count": result.row_count,
        "field_count": result.field_count,
        "aggregate_all": _agg_json(result.aggregate_all),
        "aggregate_real": _agg_json(result.aggregate_real),
        "per_field": [
            {
                "field": m.field,
                "n": m.n,
                "accuracy": _ci_json(m.accuracy),
                "unknown_rate": m.unknown_rate,
                "tp": m.tp,
                "fp": m.fp,
                "fn": m.fn,
                "correct_abstain": m.correct_abstain,
                "over_abstain": m.over_abstain,
            }
            for m in result.per_field
        ],
        "failures": list(result.failures),
        "warnings": list(result.warnings),
    }
    return json.dumps(payload, indent=2) + "\n"
