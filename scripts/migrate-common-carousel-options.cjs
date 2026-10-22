#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const definitions = Object.fromEntries(['carousel', 'slide'].map((type) => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'blocks', `${type}.liquid`), 'utf8');
  const schema = JSON.parse(source.match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
  return [type, Object.fromEntries(schema.settings.filter((setting) => setting.id).map((setting) => [setting.id, setting]))];
}));

function migrateCommonCarouselOptions(document) {
  let changed = false;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    const definition = definitions[value.type];
    if (definition && value.settings) {
      const settings = value.settings;
      if (value.type === 'slide' && settings.border_thickness == null && settings.border_type && settings.border_type !== 'none') {
        settings.border_thickness = 1;
        changed = true;
      }
      for (const [id, saved] of Object.entries(settings)) {
        const setting = definition[id];
        if (!setting) { delete settings[id]; changed = true; continue; }
        if (setting.options && !setting.options.some((option) => option.value === saved)) {
          const replacement = id === 'shadow' && ['medium', 'large'].includes(saved) ? 'small'
            : id === 'corner_radius' && ['slightly_rounded', 'pill'].includes(saved) ? 'rounded'
              : setting.default;
          settings[id] = replacement;
          changed = true;
        }
        if (setting.type === 'range' && typeof settings[id] === 'number') {
          const bounded = Math.min(setting.max, Math.max(setting.min, settings[id]));
          if (bounded !== settings[id]) { settings[id] = bounded; changed = true; }
        }
      }
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(document);
  return changed;
}

function migrateFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const prefix = source.match(/^\s*\/\*[\s\S]*?\*\/\s*/)?.[0] || '';
  const document = JSON.parse(source.slice(prefix.length));
  if (!migrateCommonCarouselOptions(document)) return false;
  fs.writeFileSync(file, prefix + JSON.stringify(document, null, 2) + '\n');
  return true;
}

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error('Pass saved template/group JSON files explicitly.');
  for (const file of files) console.log(`${migrateFile(path.resolve(file)) ? 'Migrated' : 'Unchanged'}: ${file}`);
}
module.exports = { migrateCommonCarouselOptions, migrateFile };
