<script lang="ts">
  import Viewer from './lib/Viewer.svelte'
  // import type { Yuv } from 'yuvjs';


  const vscode = acquireVsCodeApi();

  const loadFrame = async (idx: number) => {
    vscode.postMessage({ type: "load", idx: idx });
    const yuv = await new Promise<Uint8Array>((resolve) => {
      const listener = (event: MessageEvent) => {
        const { type, body } = event.data;
        if (type === `load-${idx}`) {
          window.removeEventListener('message', listener);
          resolve(body.value);
        }
      }
      window.addEventListener('message', listener);
    });

    return new ImageData(new Uint8ClampedArray(yuv), 1280);
  };
</script>

<Viewer loadFrame='{loadFrame}' nr_frames='{500}'></Viewer>
