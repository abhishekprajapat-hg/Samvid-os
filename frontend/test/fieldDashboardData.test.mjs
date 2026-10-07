import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConversionOverview,
  buildFieldExecutiveMetrics,
  buildWeeklyPipeline,
  getTodayTasks,
  getUpcomingSiteVisits,
} from "../src/modules/field/fieldDashboardData.js";

test("field summary counts the full assigned set, not a 50-row page", () => {
  const leads = Array.from({ length: 380 }, (_, index) => ({
    _id: String(index),
    status: index < 300 ? "NEW" : index < 350 ? "SITE_VISIT_SCHEDULED" : "CLOSED",
    brokerageReceived: index >= 350 ? 1000 : null,
  }));
  const metrics = buildFieldExecutiveMetrics(leads);
  assert.equal(metrics.leadsAssigned, 380);
  assert.equal(metrics.activeClients, 350);
  assert.equal(metrics.siteVisitsScheduled, 50);
  assert.equal(metrics.dealsClosed, 30);
  assert.equal(metrics.revenueGenerated, 30000);
});

test("weekly pipeline and conversion use lead dates and actual statuses", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const leads = [
    { createdAt: "2026-09-28T10:00:00Z", status: "NEW" },
    { createdAt: "2026-09-28T11:00:00Z", status: "CLOSED" },
    { createdAt: "2026-09-21T11:00:00Z", status: "LOST" },
  ];
  const trend = buildWeeklyPipeline(leads, 3, now);
  assert.equal(trend.reduce((sum, week) => sum + week.total, 0), 3);
  const conversion = buildConversionOverview(leads, 3, now);
  assert.deepEqual({ total: conversion.total, closed: conversion.closed, lost: conversion.lost }, { total: 3, closed: 1, lost: 1 });
});

test("today tasks and upcoming visits exclude other users and undated visits", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const tasks = [
    { _id: "a", assignedTo: { _id: "field-1" }, dueDate: "2026-09-28T13:00:00Z", status: "TODO" },
    { _id: "b", assignedTo: { _id: "field-2" }, dueDate: "2026-09-28T13:00:00Z", status: "TODO" },
  ];
  assert.deepEqual(getTodayTasks(tasks, "field-1", now).map((task) => task._id), ["a"]);
  const leads = [
    { _id: "a", status: "SITE_VISIT_SCHEDULED", nextFollowUp: "2026-09-29T13:00:00Z" },
    { _id: "b", status: "SITE_VISIT_SCHEDULED", nextFollowUp: null },
    { _id: "c", status: "SITE_VISIT_SCHEDULED", nextFollowUp: "2026-09-27T13:00:00Z" },
  ];
  assert.deepEqual(getUpcomingSiteVisits(leads, now).map((lead) => lead._id), ["a"]);
});
