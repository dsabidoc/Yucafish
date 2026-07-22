import assert from "node:assert/strict";

const base = process.env.YUCAFISH_BASE_URL || "http://localhost:3001";
const post = async (body, headers = {}) => {
  const response = await fetch(`${base}/api/yucafish`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
};

const health = await fetch(`${base}/api/health`);
assert.equal(health.status, 200);
const locationsResponse = await fetch(`${base}/api/weather/locations`);
assert.equal(locationsResponse.status, 200);
const locationsBody = await locationsResponse.json();
assert.equal(locationsBody.locations.length, 12);
const sisal = locationsBody.locations.find(
  (location) => location.name === "Sisal",
);
assert.ok(sisal?.id);
const forecastResponse = await fetch(
  `${base}/api/weather/locations/${sisal.id}?latitude=0&longitude=0`,
);
assert.equal(forecastResponse.status, 200);
const forecast = await forecastResponse.json();
assert.equal(forecast.location.id, sisal.id);
assert.equal(forecast.location.timezone, "America/Merida");
assert.equal(forecast.provider, "open-meteo");
assert.equal(forecast.daily.length, 7);
assert.equal(forecast.dailyFishingOutlooks.length, 7);
assert.match(
  forecast.dailyFishingOutlooks[0].condition.level,
  /^(IDEAL|FAVORABLE|CAUTION|DIFFICULT|INSUFFICIENT)$/,
);
assert.ok(forecast.hourly.length >= 24);
const dailyResponse = await fetch(
  `${base}/api/weather/locations/${sisal.id}/daily`,
);
assert.equal(dailyResponse.status, 200);
const dailyBody = await dailyResponse.json();
assert.equal(dailyBody.dailyFishingOutlooks.length, 7);
const cachedResponse = await fetch(`${base}/api/weather/locations/${sisal.id}`);
const cachedForecast = await cachedResponse.json();
assert.equal(cachedForecast.fetchedAt, forecast.fetchedAt);
const missingLocation = await fetch(
  `${base}/api/weather/locations/00000000-0000-4000-8000-000000000000`,
);
assert.equal(missingLocation.status, 404);
const title = `Integración ${Date.now()}`;
const created = await post({
  op: "createTrip",
  title,
  port: "Sisal",
  departureLocationId: sisal.id,
  fishingDate: new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
  }).format(new Date()),
  status: "DRAFT",
});
assert.equal(created.response.status, 200);
assert.ok(created.body.id);
const tripId = created.body.id;
const snapshotResponse = await fetch(
  `${base}/api/fishing-trips/${tripId}/weather-snapshot`,
  { method: "POST" },
);
assert.equal(snapshotResponse.status, 200);
const snapshotBody = await snapshotResponse.json();
assert.equal(snapshotBody.snapshot.fishingTripId, tripId);
assert.equal(snapshotBody.snapshot.provider, "open-meteo");
const foreignSnapshot = await fetch(
  `${base}/api/fishing-trips/${tripId}/weather-snapshot`,
  {
    method: "POST",
    headers: { "oai-authenticated-user-email": "otro@yucafish.test" },
  },
);
assert.equal(foreignSnapshot.status, 403);

const caught = await post({
  op: "createCatch",
  tripId,
  species: "Mero",
  weight: 4.25,
  weightUnit: "kg",
  releaseStatus: "RELEASED",
});
assert.equal(caught.response.status, 200);
const catchId = caught.body.id;
assert.ok(catchId);

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const form = new FormData();
form.set("tripId", tripId);
form.set("catchId", catchId);
form.set("file", new File([png], "captura.png", { type: "image/png" }));
const uploaded = await fetch(`${base}/api/media`, {
  method: "POST",
  body: form,
});
assert.equal(uploaded.status, 200);
const uploadedBody = await uploaded.json();
const mediaResponse = await fetch(`${base}${uploadedBody.url}`);
assert.equal(mediaResponse.status, 200);
assert.match(mediaResponse.headers.get("content-type") || "", /^image\/png/);
const removedMedia = await fetch(`${base}/api/media?id=${uploadedBody.id}`, {
  method: "DELETE",
});
assert.equal(removedMedia.status, 200);

const forbidden = await post(
  { op: "deleteTrip", id: tripId },
  { "oai-authenticated-user-email": "otro@yucafish.test" },
);
assert.equal(forbidden.response.status, 403);
const removedCatch = await post({ op: "deleteCatch", id: catchId });
assert.equal(removedCatch.response.status, 200);
const removedTrip = await post({ op: "deleteTrip", id: tripId });
assert.equal(removedTrip.response.status, 200);
console.log("YucaFish API integration flow passed");
