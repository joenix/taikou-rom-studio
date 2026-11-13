# ROM directory marker

New Studio-ready ROM builds carry a `TKROMD01` directory footer. Its JSON payload names the game, `profile_id`, release label, feature flags, and semantic resource entries. Each resource entry may declare its ROM offset, byte length or record stride/count, and `schema` identifier. A 32-byte binary footer points to the payload and stores its CRC-32.

`profile_id` names the data layout, not the marketing release. Multiple releases with the same profile can be loaded by the same editor adapter even when their title strings and release labels differ. In schema 1, the base-table descriptor values must match the currently implemented profile; a relocation of those tables needs one profile-adapter update, after which later releases sharing that layout reuse it. FEX1 already uses the directory's payload offset. A changed record contract requires a new resource schema/profile adapter.

The reader validates the directory CRC, supported profile, resource bounds, record counts, and known field signatures before enabling edits. A missing or unsupported marker never causes the editor to guess offsets. Existing signature-based recognition remains available for earlier files; new ROM builds should use the directory.

Rebuilds should append the directory only after all game code, map data, glyphs, and other resources have reached their final positions. Use `taikou-rebuild/tools/rom_directory.py` from build scripts, or the `embed_studio_directory.py` final packaging step. If a build shifts data after creating the marker, regenerate the marker last. In-editor append operations preserve the directory or update its pointer.

The first marked build uses `md-taikou-initial-tables-v1`; its FEX1 default payload is listed as a separate resource. `world_map.layout_id` selects the already implemented map-layout adapter independently of the ROM title, and `place_glyphs` declares the approved map-font hook override. This marker identifies and locates editable data. It does not imply that FEX1 records are consumed by game runtime logic.

## faction-overview.paint.v1

80×28 native Honshu tilemap; edit_rect [0,0,128,224] pixels. Descriptor locates master attributes, two64×28 cached pages, two16×28 stripes, private pattern IDs/data, stock atlas/validity, native palette, protected-pixel bitset and automatic source baseline. Current capacity63 safe VRAM slots, excluding frozen IDs shared by other views. Edits update master west + pageA west + stripeA plus private nonfrozen patterns atomically. Capacity overflow leaves bytes unchanged. `build.edit_policy=overview-only` permits this resource and rejects other writes. Footer payload is padded to4096-byte multiples, max65536; current companion uses8192.

## world.road-flow.v1（v1.42.23）

`src/rom/road-flow.js` reads the semantic `road_flow` resource, independent of filename, release title and file size. Validate all data sections, code bounds, the FA7C entry, optional10722 buffer hook and the RF_PREVIOUS chain to the declared legacy component resolver. `west-layout.js` checks the active road-flow entry instead of insisting that FA7C still points directly at weighted A*. Policy `lexicographic-roads-first-v2` is metadata; the two-bit direction format remains schema1.

Latest ROM has `overview-only` policy: world browsing and protected overview painting/export work. Precompiled directions are immutable in Studio. `document.js` and `rebuildWestNavigation` reject terrain/entrance changes or legacy graph regeneration for this resource with `ROAD_FLOW_REBUILD_REQUIRED`; real terrain/entrance changes require rebuild's compiler to regenerate full direction fields. This preserves the20-step runtime cache and road-first behavior. Do not silently fall back to older graph generation or enable other resources as a side effect of recognizing a new release.

Evidence: `tests/road-flow-directory.test.js` covers current159 castles/29 towns/713 people, title-independent loading, overview edit/export/reload and undo/redo with identical complete route bytes, rejected stale rebuilds and malformed hooks/ranges. Production build passes. Existing mobile browsing/password restrictions are unchanged. Local update only; no deployment performed.

## Automatic release compatibility gate

Release labels and filenames are not adapters. Compatible resources keep their schema and publish their actual locations in the directory. `resource-contracts.js` validates army navigation and the four-direction warship/personal boat assets; the personal v2 format has two animation frames per direction. Runtime code and boat assets stay read-only. An unknown optional ship schema is preserved without pretending to support editing; invalid ranges fail closed. A genuinely new record encoding still needs one schema implementation, not a patch for each marketing version.

Run `node tools/check-rom-compatibility.mjs ROM REPORT` against the artifact being packaged. It loads the actual editor engine, checks byte-identical unedited export, edits the declared overview in memory, reloads it, verifies undo/redo, and requires every byte outside the overview surfaces/checksum and all declared protected assets to remain unchanged. This includes army code, direction fields, both boat atlases and roster bindings. The ROM packager invokes this gate automatically; no source ROM is modified.

`TAIKOU_RELEASE_ROM=/path/game.bin npm test` additionally runs the release contract tests. The path is supplied by the packager/CI rather than pinned to a version filename. Legacy graph regeneration now selects weighted edge words only when the directory declares `component-weighted-astar.v1`; older graph formats retain their reserved zero words. Current precompiled direction fields still reject legacy regeneration.
