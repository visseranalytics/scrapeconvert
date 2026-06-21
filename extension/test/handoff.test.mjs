import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHandoffPayload, openWorkbench, DEFAULT_WORKBENCH_BASE, HANDOFF_STORAGE_KEY } from '../src/handoff.js';

const selected = [
  { url: 'https://e.com/photos/hero.png', alt: 'Hero', width: 1200, height: 800 },
  { url: 'https://e.com/a.jpg?v=2', alt: '' },
];

test('buildHandoffPayload maps selection to the ScrapedImage shape', () => {
  const out = buildHandoffPayload(selected, 'https://e.com/page', 'Page Title');
  assert.equal(out.length, 2);
  const a = out[0];
  for (const k of ['id', 'url', 'alt', 'name', 'format', 'selected', 'sourcePageUrl', 'sourcePageTitle']) {
    assert.ok(k in a, `missing ${k}`);
  }
  assert.equal(a.url, 'https://e.com/photos/hero.png');
  assert.equal(a.name, 'hero.png');
  assert.equal(a.format, 'PNG');
  assert.equal(a.selected, true);
  assert.equal(a.sourcePageUrl, 'https://e.com/page');
  assert.equal(a.sourcePageTitle, 'Page Title');
  assert.equal(out[1].format, 'JPG');
});

test('payload round-trips through JSON', () => {
  const out = buildHandoffPayload(selected, 'https://e.com', 'T');
  assert.deepEqual(JSON.parse(JSON.stringify(out)), out);
});

test('openWorkbench defaults to scrapeconvert.com/workbench and stores the payload', async () => {
  let stored = null;
  let opened = null;
  const url = await openWorkbench([{ id: '1' }], {
    storage: { set: async (o) => { stored = o; } },
    openTab: (u) => { opened = u; },
  });
  assert.equal(url, `${DEFAULT_WORKBENCH_BASE}/workbench`);
  assert.equal(opened, url);
  assert.ok(stored[HANDOFF_STORAGE_KEY]);
  assert.equal(stored[HANDOFF_STORAGE_KEY].images.length, 1);
});

test('openWorkbench respects an overridden base URL (self-host / staging)', async () => {
  const url = await openWorkbench([], { baseUrl: 'https://staging.example.com/', openTab: () => {} });
  assert.equal(url, 'https://staging.example.com/workbench');
});
