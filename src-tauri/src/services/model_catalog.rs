//! Derives the model catalog from the models.dev API payload.
//!
//! Upstream describes API models only, so two kinds of row are synthesized here:
//! the Claude Code CLI aliases (`opus`, `sonnet`, …) and the `[1m]` context
//! variants. Both are CLI syntax that no upstream feed carries.

use serde::{Deserialize, Serialize};

/// A model entry the UI can render.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ModelEntry {
    pub value: String,          // canonical id passed to `claude --model`
    pub label: String,
    pub color: Option<String>,  // tailwind class fragment
    pub source: String,         // "upstream" or "custom"
    pub input_cost_per_mtok: Option<f64>,
    pub output_cost_per_mtok: Option<f64>,
    pub custom_id: Option<i64>, // present for source="custom"
    pub sort_order: i64,
}

/// Tailwind classes per model family. An unrecognized family still gets a
/// readable badge, so a newly released family needs no code change.
pub fn family_color(family: &str) -> &'static str {
    match family.trim_start_matches("claude-") {
        "opus" => "bg-purple-500/20 text-purple-300",
        "sonnet" => "bg-blue-500/20 text-blue-300",
        "haiku" => "bg-green-500/20 text-green-300",
        _ => "bg-amber-500/20 text-amber-300",
    }
}

const VARIANT_COLOR: &str = "bg-fuchsia-500/20 text-fuchsia-300";
const ONE_MILLION: u64 = 1_000_000;

/// Aliases sort ahead of every pinned version.
const ALIAS_SORT_BASE: i64 = -1000;

#[derive(Deserialize)]
struct UpstreamRoot {
    anthropic: Option<UpstreamProvider>,
}

#[derive(Deserialize)]
struct UpstreamProvider {
    models: Option<std::collections::HashMap<String, UpstreamModel>>,
}

#[derive(Deserialize)]
struct UpstreamModel {
    id: Option<String>,
    name: Option<String>,
    family: Option<String>,
    release_date: Option<String>,
    limit: Option<UpstreamLimit>,
    cost: Option<UpstreamCost>,
}

#[derive(Deserialize)]
struct UpstreamLimit {
    context: Option<u64>,
}

#[derive(Deserialize)]
struct UpstreamCost {
    input: Option<f64>,
    output: Option<f64>,
}

/// A record we have enough information to render.
struct Usable {
    id: String,
    label: String,
    family: String,
    release_date: String,
    context: u64,
    input: f64,
    output: f64,
}

/// `"Claude Opus 4.8"` -> `"Opus 4.8"`, matching the labels this app has always used.
fn strip_claude_prefix(name: &str) -> String {
    name.strip_prefix("Claude ").unwrap_or(name).to_string()
}

/// Parses the payload and drops records missing an id, name, family, or cost.
fn usable_models(body: &str) -> Vec<Usable> {
    let root: UpstreamRoot = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let models = match root.anthropic.and_then(|p| p.models) {
        Some(m) => m,
        None => return vec![],
    };

    let mut out: Vec<Usable> = models
        .into_values()
        .filter_map(|m| {
            let cost = m.cost?;
            Some(Usable {
                id: m.id?,
                label: strip_claude_prefix(&m.name?),
                family: m.family?,
                release_date: m.release_date.unwrap_or_default(),
                context: m.limit.and_then(|l| l.context).unwrap_or(0),
                input: cost.input?,
                output: cost.output?,
            })
        })
        .collect();

    // Newest first; id breaks ties so the order is stable across runs (the
    // upstream payload is a map, so iteration order is not).
    out.sort_by(|a, b| {
        b.release_date
            .cmp(&a.release_date)
            .then_with(|| a.id.cmp(&b.id))
    });
    out
}

/// One alias row per family, inheriting the newest member's cost and color.
fn alias_rows(models: &[Usable]) -> Vec<ModelEntry> {
    let mut seen: Vec<&str> = Vec::new();
    let mut out = Vec::new();
    // `models` is already newest-first, so the first hit per family is the newest.
    for m in models {
        if seen.contains(&m.family.as_str()) {
            continue;
        }
        seen.push(&m.family);
        let short = m.family.trim_start_matches("claude-");
        let mut pretty = short.to_string();
        if let Some(first) = pretty.get_mut(0..1) {
            first.make_ascii_uppercase();
        }
        out.push(ModelEntry {
            value: short.to_string(),
            label: format!("{} (latest)", pretty),
            color: Some(family_color(&m.family).to_string()),
            source: "upstream".into(),
            input_cost_per_mtok: Some(m.input),
            output_cost_per_mtok: Some(m.output),
            custom_id: None,
            sort_order: ALIAS_SORT_BASE + out.len() as i64,
        });
    }
    out
}

/// Turns the models.dev payload into the full catalog: aliases first, then each
/// pinned version newest-first with its `[1m]` variant immediately after.
/// Returns an empty vector for any payload it cannot read.
pub fn derive_models(body: &str) -> Vec<ModelEntry> {
    let models = usable_models(body);
    if models.is_empty() {
        return vec![];
    }

    let mut out = alias_rows(&models);

    for (i, m) in models.iter().enumerate() {
        let color = family_color(&m.family).to_string();
        let base_sort = (i as i64) * 10;
        out.push(ModelEntry {
            value: m.id.clone(),
            label: m.label.clone(),
            color: Some(color),
            source: "upstream".into(),
            input_cost_per_mtok: Some(m.input),
            output_cost_per_mtok: Some(m.output),
            custom_id: None,
            sort_order: base_sort,
        });

        if m.context >= ONE_MILLION {
            out.push(ModelEntry {
                value: format!("{}[1m]", m.id),
                label: format!("{} (1M context)", m.label),
                color: Some(VARIANT_COLOR.to_string()),
                source: "upstream".into(),
                // Upstream publishes no premium-tier rate for the 1M window, so
                // the base rate is inherited rather than guessed at.
                input_cost_per_mtok: Some(m.input),
                output_cost_per_mtok: Some(m.output),
                custom_id: None,
                sort_order: base_sort + 1,
            });
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("testdata/models_dev_anthropic.json");

    fn find<'a>(rows: &'a [ModelEntry], value: &str) -> Option<&'a ModelEntry> {
        rows.iter().find(|r| r.value == value)
    }

    #[test]
    fn maps_id_label_and_costs() {
        let rows = derive_models(FIXTURE);
        let opus = find(&rows, "claude-opus-4-8").expect("claude-opus-4-8 missing");
        assert_eq!(opus.label, "Opus 4.8");
        assert_eq!(opus.input_cost_per_mtok, Some(5.0));
        assert_eq!(opus.output_cost_per_mtok, Some(25.0));
        assert_eq!(opus.source, "upstream");
    }

    #[test]
    fn assigns_color_by_family() {
        let rows = derive_models(FIXTURE);
        assert_eq!(find(&rows, "claude-opus-4-8").unwrap().color.as_deref(), Some("bg-purple-500/20 text-purple-300"));
        assert_eq!(find(&rows, "claude-sonnet-4-6").unwrap().color.as_deref(), Some("bg-blue-500/20 text-blue-300"));
        assert_eq!(find(&rows, "claude-haiku-4-5").unwrap().color.as_deref(), Some("bg-green-500/20 text-green-300"));
        assert_eq!(find(&rows, "claude-fable-5").unwrap().color.as_deref(), Some("bg-amber-500/20 text-amber-300"));
    }

    #[test]
    fn derives_one_alias_per_family_pointing_at_the_newest_release() {
        let rows = derive_models(FIXTURE);
        let opus = find(&rows, "opus").expect("opus alias missing");
        assert_eq!(opus.label, "Opus (latest)");
        // claude-opus-5 (2026-07-24) is newer than claude-opus-4-8 (2026-05-28).
        let newest = find(&rows, "claude-opus-5").unwrap();
        assert_eq!(opus.input_cost_per_mtok, newest.input_cost_per_mtok);
        assert_eq!(opus.color, newest.color);

        for alias in ["haiku", "sonnet", "fable"] {
            assert!(find(&rows, alias).is_some(), "{} alias missing", alias);
        }
        // One alias per family, never more.
        assert_eq!(rows.iter().filter(|r| r.value == "opus").count(), 1);
    }

    #[test]
    fn synthesizes_1m_variants_only_for_1m_capable_models() {
        let rows = derive_models(FIXTURE);
        let big = find(&rows, "claude-opus-4-8[1m]").expect("1m variant missing");
        assert_eq!(big.label, "Opus 4.8 (1M context)");
        assert_eq!(big.color.as_deref(), Some("bg-fuchsia-500/20 text-fuchsia-300"));
        // Upstream carries no premium-tier rate, so cost is inherited from the base model.
        let base = find(&rows, "claude-opus-4-8").unwrap();
        assert_eq!(big.input_cost_per_mtok, base.input_cost_per_mtok);
        assert_eq!(big.output_cost_per_mtok, base.output_cost_per_mtok);
        // claude-haiku-4-5 is a 200k-context model — no variant.
        assert!(find(&rows, "claude-haiku-4-5[1m]").is_none());
    }

    #[test]
    fn sorts_aliases_first_then_newest_release_with_variants_adjacent() {
        let rows = derive_models(FIXTURE);
        let pos = |v: &str| rows.iter().position(|r| r.value == v).unwrap();
        assert!(pos("opus") < pos("claude-opus-5"), "aliases must lead the list");
        assert_eq!(pos("claude-opus-4-8[1m]"), pos("claude-opus-4-8") + 1);
        // claude-opus-5 (2026-07-24) outranks claude-opus-4-8 (2026-05-28).
        assert!(pos("claude-opus-5") < pos("claude-opus-4-8"));
        // sort_order is monotonically non-decreasing across the returned slice.
        let mut prev = i64::MIN;
        for r in &rows {
            assert!(r.sort_order >= prev, "{} broke sort order", r.value);
            prev = r.sort_order;
        }
    }

    #[test]
    fn returns_empty_on_malformed_input_without_panicking() {
        assert!(derive_models("").is_empty());
        assert!(derive_models("not json").is_empty());
        assert!(derive_models("{}").is_empty());
        assert!(derive_models(r#"{"anthropic":{}}"#).is_empty());
        assert!(derive_models(r#"{"anthropic":{"models":{"x":{}}}}"#).is_empty());
    }

    #[test]
    fn skips_records_missing_required_fields() {
        let body = r#"{"anthropic":{"models":{
            "good": {"id":"good","name":"Claude Good","family":"claude-opus","release_date":"2026-01-01","limit":{"context":200000},"cost":{"input":1,"output":2}},
            "no_cost": {"id":"no_cost","name":"Claude NoCost","family":"claude-opus","release_date":"2026-01-01","limit":{"context":200000}}
        }}}"#;
        let rows = derive_models(body);
        assert!(rows.iter().any(|r| r.value == "good"));
        assert!(!rows.iter().any(|r| r.value == "no_cost"));
    }
}
