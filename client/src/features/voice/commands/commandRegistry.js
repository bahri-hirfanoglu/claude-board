/**
 * Central command registry with plugin architecture.
 * Commands register themselves at import time.
 *
 * @typedef {Object} VoiceCommand
 * @property {string} id - Unique command identifier
 * @property {RegExp[]} patterns - Intent patterns that trigger this command
 * @property {string[]} [flowStates] - Flow states this command owns
 * @property {string} description - Human-readable description
 * @property {string} hint - Short Turkish hint shown in UI
 * @property {string} [icon] - Lucide icon name for hints
 * @property {(input: string, ctx: CommandContext) => CommandResult} execute
 *
 * @typedef {Object} CommandContext
 * @property {string} flow - Current flow state
 * @property {Object} draft - Current draft data
 * @property {{ id: string, text: string }} intent - Parsed intent
 * @property {Object[]} tasks - Current tasks array
 * @property {Object|null} currentProject - Active project
 * @property {Object} refs - Mutable refs (e.g. statusTarget)
 *
 * @typedef {Object} CommandResult
 * @property {string} flow - Next flow state ('idle' to end)
 * @property {Object} [draft] - Updated draft
 * @property {string} [message] - Assistant response text
 * @property {Function} [action] - Side-effect callback: (handlers) => void
 */

/** @type {VoiceCommand[]} */
const _commands = [];
const _flowOwners = new Map();

/**
 * Register a command. Called at module load time.
 * @param {VoiceCommand} command
 */
export function registerCommand(command) {
  if (_commands.some(c => c.id === command.id)) return; // idempotent

  // Validate flow state uniqueness
  for (const state of command.flowStates || []) {
    if (_flowOwners.has(state)) {
      console.warn(`Flow state "${state}" already owned by "${_flowOwners.get(state)}"`);
    }
    _flowOwners.set(state, command.id);
  }

  _commands.push(command);
}

/**
 * Resolve which command should handle current input.
 * Priority: active flow owner > pattern match > null
 * @param {{ id: string, text: string }} intent
 * @param {string} currentFlow
 * @returns {VoiceCommand|null}
 */
export function resolveCommand(intent, currentFlow) {
  // If we're in an active flow, the owning command handles it
  if (currentFlow !== 'idle') {
    const ownerId = _flowOwners.get(currentFlow);
    if (ownerId) {
      return _commands.find(c => c.id === ownerId) || null;
    }
  }

  // Otherwise match by intent id
  if (intent?.id && intent.id !== 'freetext') {
    return _commands.find(c => c.id === intent.id) || null;
  }

  return null;
}

/** @returns {VoiceCommand[]} All registered commands */
export function getAllCommands() {
  return [..._commands];
}
