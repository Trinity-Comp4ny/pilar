import assert from "node:assert/strict";
import { test } from "node:test";
import { expectedJwtFlags, findJwtDrift } from "./check-edge-jwt.mjs";

test("defaults to verifying JWT and respects explicit public exceptions", () => {
  const config = [
    "project_id = \"fake\"",
    "[functions.webhook]",
    "verify_jwt = false # signed webhook",
    "[functions.private]",
    "verify_jwt = true",
    "[functions.not-configured]",
    "import_map = \"deno.json\"",
  ].join("\n");
  const actual = expectedJwtFlags(config, ["webhook", "private", "not-configured"]);
  assert.deepEqual([...actual], [["webhook", false], ["private", true], ["not-configured", true]]);
});

test("detects changed auth flags and reports undeployed functions", () => {
  const expected = new Map([["webhook", false], ["private", true], ["missing", true]]);
  const deployed = [
    { slug: "webhook", verify_jwt: true },
    { slug: "private", verify_jwt: true },
    { slug: "historical", verify_jwt: false },
  ];
  const res = findJwtDrift(expected, deployed);
  assert.equal(res.errors.length, 2);
  assert.match(res.errors[0], /webhook: esperado verify_jwt=false/);
  assert.match(res.errors[1], /missing: função não implantada/);
  assert.deepEqual(res.stale, ["historical"]);
});

test("does not treat an unparseable remote flag as a matching authorized function", () => {
  const expected = new Map([["secure", true]]);
  const res = findJwtDrift(expected, [{ slug: "secure", verify_jwt: "true" }]);
  assert.equal(res.errors.length, 1);
});

test("rejects duplicate JWT settings", () => {
  const config = "[functions.webhook]\nverify_jwt = true\nverify_jwt = false";
  assert.throws(() => expectedJwtFlags(config, ["webhook"]), /mais de uma vez/);
});

test("fails closed when API returns duplicate names with conflicting JWT flags", () => {
  assert.throws(
    () => findJwtDrift(new Map([["critical", true]]), [
      { slug: "critical", verify_jwt: true },
      { slug: "critical", verify_jwt: false },
    ]),
    /função duplicada/
  );
});
