import { parentPort, workerData } from "worker_threads";
import { read } from "yuvjs";
import { brotliCompressSync } from "zlib";

parentPort?.once("message", async () => {
  const frame = new Uint8ClampedArray(
    (await read(workerData?.path, workerData?.cfg)).asRGBA()
  );
  const data = workerData?.compress
    ? new Uint8ClampedArray(brotliCompressSync(frame))
    : frame;
  parentPort?.postMessage({ data });
});
