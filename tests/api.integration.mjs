import assert from "node:assert/strict";

const base = process.env.YUCAFISH_BASE_URL || "http://localhost:3001";
const post = async (body, headers = {}) => {
  const response = await fetch(`${base}/api/yucafish`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { response, body: await response.json() };
};

const health = await fetch(`${base}/api/health`);
assert.equal(health.status, 200);
const title = `Integración ${Date.now()}`;
const created = await post({ op: "createTrip", title, port: "Sisal", fishingDate: "2026-07-22", status: "DRAFT" });
assert.equal(created.response.status, 200);
assert.ok(created.body.id);
const tripId = created.body.id;

const caught = await post({ op: "createCatch", tripId, species: "Mero", weight: 4.25, weightUnit: "kg", releaseStatus: "RELEASED" });
assert.equal(caught.response.status, 200);
const catchId = caught.body.id;
assert.ok(catchId);

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const form = new FormData();
form.set("tripId", tripId);
form.set("catchId", catchId);
form.set("file", new File([png], "captura.png", { type: "image/png" }));
const uploaded = await fetch(`${base}/api/media`, { method: "POST", body: form });
assert.equal(uploaded.status, 200);
const uploadedBody = await uploaded.json();
const mediaResponse = await fetch(`${base}${uploadedBody.url}`);
assert.equal(mediaResponse.status, 200);
assert.match(mediaResponse.headers.get("content-type") || "", /^image\/png/);
const removedMedia = await fetch(`${base}/api/media?id=${uploadedBody.id}`, { method: "DELETE" });
assert.equal(removedMedia.status, 200);

const forbidden = await post({ op: "deleteTrip", id: tripId }, { "oai-authenticated-user-email": "otro@yucafish.test" });
assert.equal(forbidden.response.status, 403);
const removedCatch = await post({ op: "deleteCatch", id: catchId });
assert.equal(removedCatch.response.status, 200);
const removedTrip = await post({ op: "deleteTrip", id: tripId });
assert.equal(removedTrip.response.status, 200);
console.log("YucaFish API integration flow passed");
