import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
test("PWA shell keeps persistence out of the service worker",()=>{const manifest=JSON.parse(fs.readFileSync("manifest.webmanifest","utf8"));const sw=fs.readFileSync("sw.js","utf8");assert.equal(manifest.start_url,"./learn.html");assert.equal(manifest.display,"standalone");assert.ok(sw.includes("circuit-learning-shell-v1"));assert.ok(sw.includes("request.method!==\"GET\""));assert.ok(sw.includes("url.origin===self.location.origin"));assert.equal(sw.includes("localStorage"),false);assert.equal(sw.includes("indexedDB"),false);});
