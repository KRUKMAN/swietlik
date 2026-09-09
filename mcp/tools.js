/**
 * MCP tool catalogue.
 *
 * One entry per command registered by `src/mcp-bridge/commands/*.commands.js`.
 * Names, argument names and required-ness MUST match the in-app registry
 * exactly -- `test/mcp/tool-parity.spec.js` fails the build if they drift.
 *
 * `additionalProperties: false` everywhere, because the in-app validator
 * rejects unknown arguments rather than ignoring them.
 *
 * @module mcp/tools
 */

/**
 * Reusable 3D vector schema (metres for positions, degrees for rotations).
 *
 * @constant {Object}
 * @private
 */
const VEC3 = {
  type: 'object',
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    z: { type: 'number' },
  },
  required: ['x', 'y', 'z'],
  additionalProperties: false,
};

/**
 * Builds an object input schema.
 *
 * @param {Object} properties JSON Schema properties map
 * @param {Array<String>} [required=[]] required property names
 * @return {Object} JSON Schema object
 * @private
 */
function schema(properties, required = []) {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * Shared cue-creation properties for create_scene and create_effect.
 *
 * @constant {Object}
 * @private
 */
const CUE_PROPERTIES = {
  group_id: { type: 'integer', minimum: 0, description: 'Target group id.' },
  name: { type: 'string', description: 'Cue name. Defaults to "Cue <id>".' },
  color: { type: 'string', description: 'Hex colour, eg. "#ff8800".' },
  duration: {
    type: 'number', minimum: 0, default: 1, description: 'Duration in beats.',
  },
  trigger_style: {
    type: 'integer', enum: [0, 1], default: 0, description: '0 toggle, 1 temporary.',
  },
  loop_style: {
    type: 'integer', enum: [0, 1], default: 0, description: '0 one-shot, 1 loop.',
  },
  relative: {
    type: 'integer',
    enum: [0, 1],
    default: 0,
    description: '1 makes the cue start from the current live values.',
  },
};

/**
 * Every MCP tool exposed by the Świetlik server.
 *
 * @constant {Array<Object>}
 */
export const TOOLS = [
  {
    name: 'get_show_state',
    description: 'Compact summary of the whole show: name, BPM, save state, '
      + 'universes, patched fixtures and groups with their cues and chases. '
      + 'Start here to orient yourself.',
    inputSchema: schema({}),
  },
  {
    name: 'get_fixture',
    description: 'Full detail for one patched fixture: addressing, 3D position '
      + 'and rotation, available quick accessors and every channel value.',
    inputSchema: schema({
      id: { type: 'integer', minimum: 0, description: 'Fixture id from get_show_state.' },
    }, ['id']),
  },
  {
    name: 'search_fixture_library',
    description: 'Search the bundled Open Fixture Library (~190 manufacturers) '
      + 'by manufacturer or model substring. Returns manufacturer/model pairs '
      + 'ready to pass to patch_fixture.',
    inputSchema: schema({
      query: { type: 'string', description: 'Case-insensitive substring.' },
      limit: {
        type: 'integer', minimum: 1, maximum: 100, default: 20,
      },
    }, ['query']),
  },
  {
    name: 'patch_fixture',
    description: 'Patch a fixture from the Open Fixture Library into a universe. '
      + 'Fetches the OFL definition, builds the fixture and auto-addresses it '
      + 'unless ch_start is given.',
    inputSchema: schema({
      manufacturer: { type: 'string', description: 'OFL manufacturer folder, eg. "clay-paky".' },
      model: { type: 'string', description: 'OFL model name, eg. "sharpy".' },
      mode: { type: 'string', description: 'OFL mode name. Defaults to the first mode.' },
      name: { type: 'string', description: 'Display name for this fixture.' },
      universe: { type: 'integer', minimum: 0, default: 0 },
      ch_start: {
        type: 'integer',
        minimum: 0,
        maximum: 511,
        description: 'Explicit universe address slot. Omit to auto-address.',
      },
      position: { ...VEC3, description: 'Position in metres (Z is up).' },
      rotation: { ...VEC3, description: 'Rotation in degrees.' },
    }, ['manufacturer', 'model']),
  },
  {
    name: 'unpatch_fixture',
    description: 'Remove a fixture from its universe and from the show, freeing '
      + 'its DMX address range.',
    inputSchema: schema({
      id: { type: 'integer', minimum: 0 },
    }, ['id']),
  },
  {
    name: 'move_fixture',
    description: 'Set a patched fixture position (metres, Z up) and/or rotation '
      + '(degrees) in the 3D visualizer. At least one of the two is required.',
    inputSchema: schema({
      id: { type: 'integer', minimum: 0 },
      position: VEC3,
      rotation: VEC3,
    }, ['id']),
  },
  {
    name: 'set_channels',
    description: 'Set DMX values on one or more fixtures, either by '
      + 'fixture-relative channel index or by named quick accessor (Dimmer, '
      + 'Pan, Tilt, Zoom, Color, ...). Accessors a fixture lacks are reported '
      + 'as skipped rather than failing the call.',
    inputSchema: schema({
      fixture_ids: {
        type: 'array',
        minItems: 1,
        items: { type: 'integer', minimum: 0 },
      },
      channels: {
        type: 'array',
        description: 'Raw channel writes. index is 0-based and fixture-relative.',
        items: schema({
          index: { type: 'integer', minimum: 0 },
          value: { type: 'integer', minimum: 0, maximum: 255 },
        }, ['index', 'value']),
      },
      accessors: {
        type: 'array',
        description: 'Named quick-accessor writes.',
        items: schema({
          type: { type: 'string', description: 'Accessor name, eg. "Dimmer", "Pan".' },
          value: { type: 'integer', minimum: 0, maximum: 255 },
          index: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Which accessor of that type, for fixtures with several.',
          },
        }, ['type', 'value']),
      },
    }, ['fixture_ids']),
  },
  {
    name: 'create_group',
    description: 'Create an empty fixture group. Groups own the cues and chases '
      + 'that drive their fixtures.',
    inputSchema: schema({
      name: { type: 'string' },
      color: { type: 'string', description: 'Hex colour, eg. "#00ccff".' },
    }, ['name']),
  },
  {
    name: 'add_fixtures_to_group',
    description: 'Add patched fixtures to an existing group. Cues already in the '
      + 'group pick the new fixtures up automatically.',
    inputSchema: schema({
      group_id: { type: 'integer', minimum: 0 },
      fixture_ids: {
        type: 'array',
        minItems: 1,
        items: { type: 'integer', minimum: 0 },
      },
    }, ['group_id', 'fixture_ids']),
  },
  {
    name: 'create_scene',
    description: 'Create a scene cue (a static look that fades in over its '
      + 'duration) on a group. The group fixtures are injected automatically.',
    inputSchema: schema(CUE_PROPERTIES, ['group_id']),
  },
  {
    name: 'create_effect',
    description: 'Create an effect cue (a time-varying modulation) on a group. '
      + 'The group fixtures are injected automatically.',
    inputSchema: schema(CUE_PROPERTIES, ['group_id']),
  },
  {
    name: 'create_chase',
    description: 'Create a chase on a group -- a sequence of its cues triggered '
      + 'over time. Without cue_ids the chase takes every cue in the group.',
    inputSchema: schema({
      group_id: { type: 'integer', minimum: 0 },
      name: { type: 'string' },
      grid_index: {
        type: 'integer',
        minimum: 0,
        description: 'Column in the master grid.',
      },
      color: { type: 'string' },
      duration: { type: 'number', minimum: 0, default: 1 },
      trigger: {
        type: 'integer', enum: [0, 1], default: 0, description: '0 loop, 1 one-shot.',
      },
      cue_ids: {
        type: 'array',
        items: { type: 'integer', minimum: 0 },
      },
    }, ['group_id']),
  },
  {
    name: 'play_cue',
    description: 'Start or stop a single cue on a group.',
    inputSchema: schema({
      group_id: { type: 'integer', minimum: 0 },
      cue_id: { type: 'integer', minimum: 0 },
      state: { type: 'boolean', default: true },
    }, ['group_id', 'cue_id']),
  },
  {
    name: 'play_chase',
    description: 'Start or stop a chase on a group. Starting one stops the other '
      + 'chases in the same group.',
    inputSchema: schema({
      group_id: { type: 'integer', minimum: 0 },
      chase_id: { type: 'integer', minimum: 0 },
      state: { type: 'boolean', default: true },
    }, ['group_id', 'chase_id']),
  },
  {
    name: 'stop_all',
    description: 'Panic stop: stop every chase and every cue in every group and '
      + 'clear the master playing row.',
    inputSchema: schema({}),
  },
  {
    name: 'master_row',
    description: 'Trigger a master chase row across every group -- the '
      + 'equivalent of pressing a row button on the master grid. Toggles off '
      + 'when that row is already playing.',
    inputSchema: schema({
      row: { type: 'integer', minimum: 0 },
    }, ['row']),
  },
  {
    name: 'set_bpm',
    description: 'Set the show tempo in beats per minute (20-400). Drives every '
      + 'beat-quantised cue and chase.',
    inputSchema: schema({
      bpm: { type: 'number', minimum: 20, maximum: 400 },
    }, ['bpm']),
  },
  {
    name: 'new_show',
    description: 'Discard the current show and start a blank one with a single '
      + 'empty universe. Autosaves immediately -- this is destructive.',
    inputSchema: schema({}),
  },
  {
    name: 'save_show',
    description: 'Autosave the current show to browser localStorage and report '
      + 'the serialised size.',
    inputSchema: schema({}),
  },
  {
    name: 'load_show',
    description: 'Replace the current show, either from an inline showfile '
      + 'object or from the browser autosave. Exactly one source is required.',
    inputSchema: schema({
      data: {
        type: 'object',
        description: 'Showfile object: name, bpm, visualizer, fixtures, '
          + 'universes, groups, outputs.',
      },
      from_local_storage: { type: 'boolean', default: false },
    }),
  },
  {
    name: 'undo',
    description: 'Undo the last tracked show mutation.',
    inputSchema: schema({}),
  },
  {
    name: 'redo',
    description: 'Redo the last undone show mutation.',
    inputSchema: schema({}),
  },
  {
    name: 'screenshot_visualizer',
    description: 'Capture the 3D visualizer viewport as an image and return it '
      + 'as MCP image content. Use this to SEE the rig after changing it.',
    inputSchema: schema({
      mime_type: {
        type: 'string',
        enum: ['image/png', 'image/jpeg'],
        default: 'image/png',
      },
    }),
  },
];

/**
 * Sorted tool names.
 *
 * @constant {Array<String>}
 */
export const TOOL_NAMES = TOOLS.map((tool) => tool.name).sort();
