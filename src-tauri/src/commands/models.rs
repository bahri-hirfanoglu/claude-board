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

#[tauri::command]
pub fn list_models() -> Result<Vec<ModelEntry>, String> {
    // All models live in the editable custom_models table (seeded with the
    // defaults on first run), so the whole list is user-editable from settings.
    let db = db::get_db();
    let out = custom_models::list(&db)
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
    Ok(out)
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

#[tauri::command]
pub fn delete_custom_model(id: i64) -> Result<(), String> {
    let db = db::get_db();
    custom_models::delete(&db, id)
}
