import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, IconButton, TextField, ConversationStatusPill, KpiTile, MessageBubble, initialsOf, MoonIcon } from '../src/index.ts';

test('Button defaults to type="button" (never submits forms by accident)', () => {
  assert.match(renderToStaticMarkup(<Button>Save</Button>), /type="button"/);
});

test('loading Button is disabled and busy', () => {
  const html = renderToStaticMarkup(<Button loading loadingLabel="Loading">Save</Button>);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-busy="true"/);
});

test('IconButton always has an accessible name', () => {
  assert.match(renderToStaticMarkup(<IconButton label="Toggle dark mode" icon={<MoonIcon />} />), /aria-label="Toggle dark mode"/);
});

test('TextField links label, input and error', () => {
  const html = renderToStaticMarkup(<TextField label="Email" error="Required" />);
  const id = /<input id="([^"]+)"/.exec(html)?.[1];
  assert.ok(id);
  assert.match(html, new RegExp(`<label for="${id}"`));
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, new RegExp(`aria-describedby="${id}-error"`));
});

test('forceLtr keeps phone/email inputs left-to-right inside RTL', () => {
  assert.match(renderToStaticMarkup(<TextField label="Phone" forceLtr />), /dir="ltr"/);
});

test('status pill carries the status for testing and styling', () => {
  assert.match(renderToStaticMarkup(<ConversationStatusPill status="waiting_customer" label="x" />), /data-status="waiting_customer"/);
});

test('estimated KPI values are labelled', () => {
  assert.match(renderToStaticMarkup(<KpiTile label="Revenue" value="—" estimatedLabel="Estimated" />), /Estimated/);
});

test('message bubble uses dir="auto" so mixed-language messages render correctly', () => {
  assert.match(renderToStaticMarkup(<MessageBubble direction="inbound">مرحبا</MessageBubble>), /dir="auto"/);
});

test('initials: single letter for Arabic names, two for Latin names', () => {
  assert.equal(initialsOf('سارة محمد'), 'س');
  assert.equal(initialsOf('Sara Mohammed'), 'SM');
});
