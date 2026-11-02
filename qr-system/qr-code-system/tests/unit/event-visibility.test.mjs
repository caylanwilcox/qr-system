// Unit tests for which events an admin's Scheduler shows. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  locationKey,
  managesLocation,
  canSeeManagedEvent,
} from '../../src/utils/eventVisibility.js';

const aurora = { title: 'Service', location: 'Aurora', createdBy: 'someone-else' };

test('locationKey ignores case and spaces', () => {
  assert.equal(locationKey('West Chicago'), 'westchicago');
  assert.equal(locationKey('aurora'), locationKey('Aurora'));
  assert.equal(locationKey(undefined), '');
});

test("managesLocation: '*' means every location, in either stored shape", () => {
  assert.equal(managesLocation({ '*': true }, 'Aurora'), true);
  assert.equal(managesLocation(['*'], 'Lyons'), true);
});

test('managesLocation matches names regardless of case or spaces', () => {
  assert.equal(managesLocation({ aurora: true }, 'Aurora'), true);
  assert.equal(managesLocation(['Westchicago'], 'West Chicago'), true);
  assert.equal(managesLocation(['Aurora'], 'Lyons'), false);
});

test('managesLocation ignores switched-off entries and blank locations', () => {
  assert.equal(managesLocation({ Aurora: false }, 'Aurora'), false);
  assert.equal(managesLocation(['Aurora'], ''), false);
  assert.equal(managesLocation(undefined, 'Aurora'), false);
});

// The live bug: a super admin whose entry is { '*': true } saw no events,
// because '*' was compared to the event's location as plain text.
test('a super admin sees every event, with or without a management entry', () => {
  assert.equal(canSeeManagedEvent(aurora, { role: 'super_admin', managedLocations: { '*': true }, userId: 'u1' }), true);
  assert.equal(canSeeManagedEvent(aurora, { role: 'SUPER_ADMIN', managedLocations: undefined, userId: 'u1' }), true);
});

test('an admin sees events at the locations they manage', () => {
  const admin = { role: 'admin', managedLocations: { aurora: true }, userId: 'u1' };
  assert.equal(canSeeManagedEvent(aurora, admin), true);
  assert.equal(canSeeManagedEvent({ ...aurora, location: 'aurora' }, admin), true);
  assert.equal(canSeeManagedEvent({ ...aurora, location: 'Lyons' }, admin), false);
});

test('an admin sees All Locations events and events they created', () => {
  const admin = { role: 'admin', managedLocations: {}, userId: 'u1' };
  assert.equal(canSeeManagedEvent({ ...aurora, location: 'All Locations' }, admin), true);
  assert.equal(canSeeManagedEvent({ ...aurora, location: 'Lyons', createdBy: 'u1' }, admin), true);
  assert.equal(canSeeManagedEvent(aurora, admin), false);
});

test('employees and unknown roles get nothing from this path', () => {
  assert.equal(canSeeManagedEvent(aurora, { role: 'employee', managedLocations: { '*': true }, userId: 'u1' }), false);
  assert.equal(canSeeManagedEvent(aurora, { role: 'owner', managedLocations: { '*': true }, userId: 'u1' }), false);
  assert.equal(canSeeManagedEvent(null, { role: 'super_admin', userId: 'u1' }), false);
});
