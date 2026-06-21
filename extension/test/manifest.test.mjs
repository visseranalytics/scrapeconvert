import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

test('manifest is valid MV3 with required action + icons', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.action?.default_popup);
  for (const size of ['16', '32', '48', '128']) {
    const p = manifest.icons[size];
    assert.ok(p, `icon ${size} declared`);
    assert.ok(existsSync(join(root, p)), `${p} exists`);
  }
});

test('manifest declares the scripting permission the popup needs and no dead resources', () => {
  assert.ok(manifest.permissions.includes('scripting'), 'scripting permission present');
  assert.ok(manifest.permissions.includes('activeTab'));
  assert.ok(!manifest.permissions.includes('tabs'), 'no broad tabs permission');
  assert.equal(manifest.web_accessible_resources, undefined, 'no dead web_accessible_resources');
});

test('manifest + extension subtree carry no legacy branding', () => {
  const raw = readFileSync(join(root, 'manifest.json'), 'utf8');
  for (const bad of ['Morphix', 'GEMINI', 'aistudiocdn', '@google/genai']) {
    assert.ok(!raw.includes(bad), `manifest free of ${bad}`);
  }
});
