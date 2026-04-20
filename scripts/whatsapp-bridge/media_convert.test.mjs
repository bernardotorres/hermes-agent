import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { convertGifToMp4 } from './media_convert.js';

function haveFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function writeTinyGif(destPath) {
  // Generate a real 16-frame animated GIF via ffmpeg. libx264 (used by
  // convertGifToMp4) can't encode below ~a few pixels, so 1x1 synthetic
  // bytes won't round-trip. We use testsrc so we have actual frame data.
  execSync(
    `ffmpeg -y -f lavfi -i "testsrc=size=64x64:rate=10:duration=0.3" "${destPath}"`,
    { stdio: 'ignore' },
  );
}

test('convertGifToMp4 produces a real MP4 when ffmpeg is available', { skip: !haveFfmpeg() }, async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'hermes-gif-test-'));
  const gifPath = path.join(tmp, 'tiny.gif');
  writeTinyGif(gifPath);
  try {
    const mp4Path = await convertGifToMp4(gifPath, { outDir: tmp });
    assert.ok(existsSync(mp4Path), 'mp4 file exists');
    assert.ok(statSync(mp4Path).size > 0, 'mp4 is non-empty');
    // MP4 files start with an 'ftyp' box in bytes 4-8.
    const head = readFileSync(mp4Path).subarray(4, 8).toString('ascii');
    assert.equal(head, 'ftyp', `expected ftyp header, got "${head}"`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('convertGifToMp4 rejects cleanly when ffmpeg binary is missing', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'hermes-gif-test-'));
  const gifPath = path.join(tmp, 'tiny.gif');
  writeTinyGif(gifPath);
  try {
    await assert.rejects(
      () => convertGifToMp4(gifPath, { ffmpegBin: '/nonexistent/ffmpeg-please-fail', outDir: tmp }),
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
