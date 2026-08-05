use crate::db::{self, custom_models};

pub use crate::services::model_catalog::ModelEntry;

/// Compiled-in catalog used only until the first successful models.dev sync
/// (see `services::model_catalog`), and as the reference list the one-time
/// `migrate_models_v2` uses to tell a formerly-seeded default apart from a row
/// the user typed. It is not a seed: nothing inserts these rows into
/// `custom_models` any more.
///
/// Tuple shape: `(model_id, label, tailwind_color, input_cost, output_cost)`.
pub fn default_seed_models() -> Vec<(&'static str, &'static str, &'static str, f64, f64)> {
    vec![
        // ── Aliases (track latest) ──
        ("haiku", "Haiku (latest)", "bg-green-500/20 text-green-300", 1.0, 5.0),
        ("sonnet", "Sonnet (latest)", "bg-blue-500/20 text-blue-300", 3.0, 15.0),
        ("opus", "Opus (latest)", "bg-purple-500/20 text-purple-300", 5.0, 25.0),
        // ── Pinned versions ──
        ("claude-haiku-4-5", "Haiku 4.5", "bg-green-500/20 text-green-300", 1.0, 5.0),
        ("claude-sonnet-4-6", "Sonnet 4.6", "bg-blue-500/20 text-blue-300", 3.0, 15.0),
        ("claude-opus-4-6", "Opus 4.6", "bg-purple-500/20 text-purple-300", 5.0, 25.0),
        ("claude-opus-4-7", "Opus 4.7", "bg-purple-500/20 text-purple-300", 5.0, 25.0),
        ("claude-opus-4-7[1m]", "Opus 4.7 (1M context)", "bg-fuchsia-500/20 text-fuchsia-300", 5.0, 25.0),
        ("claude-opus-4-8", "Opus 4.8", "bg-purple-500/20 text-purple-300", 5.0, 25.0),
        ("claude-opus-4-8[1m]", "Opus 4.8 (1M context)", "bg-fuchsia-500/20 text-fuchsia-300", 5.0, 25.0),
        ("claude-fable-5", "Fable 5", "bg-amber-500/20 text-amber-300", 10.0, 50.0),
    ]
}

/// Upstream ∪ custom. A custom row overrides the upstream row with the same id,
/// and a tombstoned id is hidden unless the user has since re-added it as a
/// custom row. Result is ordered by `sort_order`, then id, so the list is stable.
pub fn merge_catalog(
    upstream: Vec<ModelEntry>,
    custom: Vec<ModelEntry>,
    tombstones: &[String],
) -> Vec<ModelEntry> {
    let overridden: Vec<String> = custom.iter().map(|c| c.value.clone()).collect();

    let mut out: Vec<ModelEntry> = upstream
        .into_iter()
        .filter(|u| !overridden.contains(&u.value) && !tombstones.contains(&u.value))
        .collect();
    out.extend(custom);
    out.sort_by(|a, b| a.sort_order.cmp(&b.sort_order).then_with(|| a.value.cmp(&b.value)));
    out
}

/// Compiled-in catalog used only until the first successful sync.
pub fn fallback_models() -> Vec<ModelEntry> {
    default_seed_models()
        .into_iter()
        .enumerate()
        .map(|(i, (model_id, label, color, input, output))| ModelEntry {
            value: model_id.to_string(),
            label: label.to_string(),
            color: Some(color.to_string()),
            source: "upstream".into(),
            input_cost_per_mtok: Some(input),
            output_cost_per_mtok: Some(output),
            custom_id: None,
            sort_order: (i as i64) * 10,
        })
        .collect()
}

#[tauri::command]
pub fn list_models() -> Result<Vec<ModelEntry>, String> {
    let db = db::get_db();
    let custom: Vec<ModelEntry> = custom_models::list(&db)
        .into_iter()
        .map(|c| ModelEntry {
            value: c.model_id,
            label: c.label,
            color: c.color,
            source: "custom".into(),
            input_cost_per_mtok: c.input_cost_per_mtok,
            output_cost_per_mtok: c.output_cost_per_mtok,
            custom_id: Some(c.id),
            sort_order: c.sort_order,
        })
        .collect();

    let upstream = db::model_catalog::list_upstream(&db);
    let tombstones = db::model_catalog::list_tombstones(&db);

    // With no upstream cache yet (first launch, or offline since install) the
    // compiled-in defaults stand in so the dropdown is never empty.
    let upstream = if upstream.is_empty() && custom.is_empty() {
        fallback_models()
    } else {
        upstream
    };

    Ok(merge_catalog(upstream, custom, &tombstones))
}

#[tauri::command]
pub fn add_custom_model(
    model_id: String,
    label: String,
    color: Option<String>,
    input_cost_per_mtok: Option<f64>,
    output_cost_per_mtok: Option<f64>,
    sort_order: Option<i64>,
) -> Result<custom_models::CustomModel, String> {
    let model_id = model_id.trim();
    let label = label.trim();
    if model_id.is_empty() { return Err("Model id is required".into()); }
    if label.is_empty() { return Err("Label is required".into()); }

    let db = db::get_db();
    // Overriding an upstream model is allowed: only a second *custom* row for the
    // same id is rejected.
    if custom_models::list(&db).iter().any(|m| m.model_id == model_id) {
        return Err("A model with this id already exists".into());
    }
    let id = custom_models::create(
        &db, model_id, label, color.as_deref(),
        input_cost_per_mtok, output_cost_per_mtok,
        sort_order.unwrap_or(0),
    )?;
    custom_models::list(&db).into_iter().find(|m| m.id == id)
        .ok_or_else(|| "Failed to fetch created model".into())
}

#[tauri::command]
pub fn update_custom_model(
    id: i64,
    model_id: String,
    label: String,
    color: Option<String>,
    input_cost_per_mtok: Option<f64>,
    output_cost_per_mtok: Option<f64>,
    sort_order: Option<i64>,
) -> Result<custom_models::CustomModel, String> {
    let model_id = model_id.trim();
    let label = label.trim();
    if model_id.is_empty() { return Err("Model id is required".into()); }
    if label.is_empty() { return Err("Label is required".into()); }

    let db = db::get_db();
    custom_models::update(
        &db, id, model_id, label, color.as_deref(),
        input_cost_per_mtok, output_cost_per_mtok,
        sort_order.unwrap_or(0),
    )?;
    custom_models::list(&db).into_iter().find(|m| m.id == id)
        .ok_or_else(|| "Failed to fetch updated model".into())
}

/// Removes a model from the list. Drops the user's override row if there is one
/// and writes a tombstone so the next sync does not bring the model back.
#[tauri::command]
pub fn delete_model(model_id: String) -> Result<(), String> {
    let model_id = model_id.trim();
    if model_id.is_empty() {
        return Err("Model id is required".into());
    }
    let db = db::get_db();
    if let Some(row) = custom_models::list(&db).into_iter().find(|m| m.model_id == model_id) {
        custom_models::delete(&db, row.id)?;
    }
    db::model_catalog::add_tombstone(&db, model_id)
}

/// Discards a user override and any tombstone, handing the model back to the
/// upstream catalog.
#[tauri::command]
pub fn reset_model(model_id: String) -> Result<(), String> {
    let model_id = model_id.trim();
    if model_id.is_empty() {
        return Err("Model id is required".into());
    }
    let db = db::get_db();
    if let Some(row) = custom_models::list(&db).into_iter().find(|m| m.model_id == model_id) {
        custom_models::delete(&db, row.id)?;
    }
    db::model_catalog::remove_tombstone(&db, model_id)
}

/// Forces a sync now, ignoring the TTL. Backs the Refresh button in Settings.
#[tauri::command]
pub fn refresh_models() -> Result<usize, String> {
    let db = db::get_db();
    crate::services::model_catalog::sync_with(&db, crate::services::model_catalog::fetch_upstream)
}

#[tauri::command]
pub fn models_synced_at() -> Option<String> {
    db::model_catalog::synced_at(&db::get_db())
}

#[cfg(test)]
mod merge_tests {
    use super::*;

    fn row(value: &str, source: &str, sort: i64) -> ModelEntry {
        ModelEntry {
            value: value.into(),
            label: format!("{} label", value),
            color: None,
            source: source.into(),
            input_cost_per_mtok: Some(1.0),
            output_cost_per_mtok: Some(2.0),
            custom_id: if source == "custom" { Some(7) } else { None },
            sort_order: sort,
        }
    }

    #[test]
    fn unions_upstream_and_custom_in_sort_order() {
        let out = merge_catalog(
            vec![row("opus", "upstream", 10)],
            vec![row("my-model", "custom", 5)],
            &[],
        );
        assert_eq!(
            out.iter().map(|r| r.value.as_str()).collect::<Vec<_>>(),
            vec!["my-model", "opus"]
        );
    }

    #[test]
    fn custom_row_wins_over_the_upstream_row_with_the_same_id() {
        let mut custom = row("opus", "custom", 99);
        custom.label = "My Opus".into();
        let out = merge_catalog(vec![row("opus", "upstream", 10)], vec![custom], &[]);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].label, "My Opus");
        assert_eq!(out[0].source, "custom");
        assert_eq!(out[0].custom_id, Some(7));
    }

    #[test]
    fn tombstoned_upstream_rows_are_hidden() {
        let out = merge_catalog(
            vec![row("opus", "upstream", 10), row("sonnet", "upstream", 20)],
            vec![],
            &["opus".to_string()],
        );
        assert_eq!(
            out.iter().map(|r| r.value.as_str()).collect::<Vec<_>>(),
            vec!["sonnet"]
        );
    }

    #[test]
    fn a_custom_override_outranks_a_stale_tombstone() {
        // Re-adding a model the user once deleted must show up again.
        let out = merge_catalog(
            vec![row("opus", "upstream", 10)],
            vec![row("opus", "custom", 10)],
            &["opus".to_string()],
        );
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].source, "custom");
    }

    #[test]
    fn empty_upstream_still_returns_custom_rows() {
        let out = merge_catalog(vec![], vec![row("my-model", "custom", 5)], &[]);
        assert_eq!(out.len(), 1);
    }
}
