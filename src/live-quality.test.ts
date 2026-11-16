/**
 * Smoke checks for live quality profiles (node --import tsx).
 * Run: npx tsx src/live-quality.test.ts
 */
import assert from "node:assert/strict";

import {
  LIVE_QUALITY_PROFILES,
  PORTRAIT_SIMULCAST_LOW,
  PORTRAIT_SIMULCAST_MID,
  buildLiveRoomOptions,
  captureOptionsForProfile,
  encodingForProfile,
  DEFAULT_LIVE_QUALITY,
} from "./live-quality.ts";

assert.equal(DEFAULT_LIVE_QUALITY, "standard");
assert.equal(LIVE_QUALITY_PROFILES.high.maxBitrate, 3_500_000);
assert.ok(LIVE_QUALITY_PROFILES.high.maxBitrate < 6_000_000);

const capture = captureOptionsForProfile("high");
assert.equal(capture.resolution?.width, 1080);
assert.equal(capture.resolution?.height, 1920);

const enc = encodingForProfile("standard");
assert.ok(enc.maxBitrate >= 1_700_000 && enc.maxBitrate <= 2_500_000);

assert.equal(PORTRAIT_SIMULCAST_LOW.width, 360);
assert.equal(PORTRAIT_SIMULCAST_LOW.height, 640);
assert.equal(PORTRAIT_SIMULCAST_MID.width, 540);
assert.equal(PORTRAIT_SIMULCAST_MID.height, 960);

const room = buildLiveRoomOptions("standard");
assert.deepEqual(room.adaptiveStream, { pixelDensity: "screen" });
assert.equal(room.dynacast, true);
assert.equal(room.publishDefaults.simulcast, true);
assert.equal(room.publishDefaults.videoSimulcastLayers.length, 2);
assert.ok(
  room.publishDefaults.videoEncoding.maxBitrate < 6_000_000,
  "primary bitrate must stay below the old 6 Mbps cap",
);

console.log("live-quality.test.ts: ok");
