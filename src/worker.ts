import { parentPort, workerData } from 'worker_threads';
import { read } from 'yuvjs';

parentPort?.once(
  'message', async () => {
    const frame = new Uint8ClampedArray(
      (await read(workerData?.path, workerData?.cfg)).asRGBA()
    );
    parentPort?.postMessage({ frame });
  }
);