/**
 * Media conversion helpers for the Hermes WhatsApp bridge.
 *
 * Exposed separately so unit tests can exercise the ffmpeg path without
 * booting the full HTTP server / Baileys socket.
 */

import path from 'path';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';
import { spawn } from 'child_process';
import { tmpdir } from 'os';

// Convert a GIF file to MP4 using ffmpeg. WhatsApp stores "animated GIFs" as
// MP4 videos with a gifPlayback flag, so raw .gif bytes sent as video will be
// rejected. We shell out to ffmpeg; if it's missing or fails, the caller
// decides how to fall back.
export function convertGifToMp4(gifPath, { ffmpegBin = 'ffmpeg', outDir = tmpdir() } = {}) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(outDir, `hermes-gif-${randomBytes(6).toString('hex')}.mp4`);
    const ff = spawn(ffmpegBin, [
      '-y', '-i', gifPath,
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-an',
      outPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    ff.stderr.on('data', (d) => { stderr += d.toString(); });
    ff.on('error', (err) => reject(err));
    ff.on('close', (code) => {
      if (code === 0 && existsSync(outPath)) resolve(outPath);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}
