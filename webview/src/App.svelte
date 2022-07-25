<script lang="ts" context="module">
  interface IVscode {
    postMessage(message: any): void;
  }

  declare const _vscode: IVscode;
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import decompress from "brotli/decompress";
  import Viewer from "./lib/Viewer.svelte";

  let vscode: IVscode;
  // for local dev of webview outside of vscode
  try {
    vscode = _vscode;
  } catch (error) {
    vscode = {
      postMessage: (message: any) => {},
    };
  }

  let nr_frames = 1;
  let width = 500;
  let refresh: () => {};
  let frame_idx;
  let maxWorkers = 8;
  let bufferSize = 500;

  onMount(() => {
    window.addEventListener("message", (event) => {
      if (event.data.type === "refresh") {
        width = event.data.body.width;
        refresh();
      }
      if (event.data.type === "updateFrameCount") {
        nr_frames = event.data.body.nrFrames;
      }
      if (event.data.type === "updateWidth") {
        width = event.data.body.width;
      }
      if (event.data.type === "setMaxWorkers") {
        maxWorkers = event.data.body.maxWorkers;
      }
      if (event.data.type === "setBufferSize") {
        bufferSize = event.data.body.bufferSize;
      }
      if (event.data.type === "setFrame") {
        const idx = parseInt(event.data.body.idx);
        if (!isNaN(idx)) {
          frame_idx = Math.min(idx, nr_frames - 1);
        }
      }
    });
    vscode.postMessage({ type: "init" });
  });

  const loadFrame = async (idx: number) => {
    vscode.postMessage({ type: "load", idx: idx });
    let yuv = await new Promise<Uint8ClampedArray>((resolve) => {
      const listener = (event: MessageEvent) => {
        const { type, body } = event.data;
        if (type === `load-${idx}`) {
          window.removeEventListener("message", listener);
          const data = body.data;
          const compressed = !!body.compressed;
          const frame = compressed
            ? new Uint8ClampedArray(decompress(data))
            : data;

          resolve(frame);
        }
      };
      window.addEventListener("message", listener);
    });

    return new ImageData(yuv, width);
  };
</script>

<div class="w-full min-h-screen flex justify-center items-center">
  <!-- <div class="icon"><i class="codicon codicon-account"></i> account</div> -->
  <Viewer
    bind:refresh
    bind:frame_idx
    {loadFrame}
    {nr_frames}
    parallel={maxWorkers}
    {bufferSize}
  />
</div>
