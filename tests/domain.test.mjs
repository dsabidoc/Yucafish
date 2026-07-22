import assert from "node:assert/strict";
import test from "node:test";
import { achievements, calculateStats, normalizeName, weightFromKg, weightToKg } from "../lib/domain.mjs";

test("normalizes regional species aliases", () => { assert.equal(normalizeName(" Curél  "), "curel"); assert.equal(normalizeName("RÍO  Lagartos"), "rio lagartos"); });
test("converts weights without losing practical precision", () => { assert.ok(Math.abs(weightToKg(10, "lb") - 4.5359237) < 1e-8); assert.ok(Math.abs(weightFromKg(weightToKg(10, "lb"), "lb") - 10) < 1e-7); assert.throws(() => weightToKg(0, "kg"), /invalid_weight/); });
test("calculates user statistics from authorized catches", () => { const stats = calculateStats([{ species: "Mero", weightKg: 8, releaseStatus: "KEPT" }, { species: "Mero", weightKg: 3, releaseStatus: "RELEASED" }, { species: "Pargo", weightKg: 1, releaseStatus: "KEPT" }]); assert.deepEqual(stats, { total: 3, totalWeight: 12, averageWeight: 4, heaviest: 8, released: 1, distinctSpecies: 2, topSpecies: "Mero" }); });
test("derives achievements from real records", () => { assert.deepEqual(achievements({ trips: [{}], catches: [{ species: "Mero" }], photos: [] }), { firstTrip: true, tenTrips: false, firstPhoto: false, fiveSpecies: false }); });
