<script lang="ts">
  import { onMount } from 'svelte';
  import Viewer from './lib/Viewer.svelte'

  let nr_frames = 1;
  let width = 500;
  let refresh: () => {};
  let frame_idx;
  onMount(() => {
    window.addEventListener('message', (event) => {
      if (event.data.type === 'refresh') {
        width = event.data.body.width;
        refresh()
      }
      if (event.data.type === 'updateFrameCount') {
        nr_frames = event.data.body.nrFrames;
      }
      if (event.data.type === 'updateWidth') {
        width = event.data.body.width;
      }
      if (event.data.type === 'setFrame') {
        const idx = parseInt(event.data.body.idx);
        if (!isNaN(idx)) {
          frame_idx = idx;
        }
      }
    });
    vscode.postMessage({ type: "init" });
  });


  /* @ts-ignore */
  const vscode = acquireVsCodeApi();

  const loadFrame = async (idx: number) => {
    vscode.postMessage({ type: "load", idx: idx });
    let yuv = await new Promise<Uint8ClampedArray>((resolve) => {
      const listener = (event: MessageEvent) => {
        const { type, body } = event.data;
        if (type === `load-${idx}`) {
          window.removeEventListener('message', listener);
          resolve(body.value);
        }
      }
      window.addEventListener('message', listener);
    });

    return new ImageData(yuv, width);
  };
</script>

<div class='w-full min-h-screen flex justify-center items-center'>
  <!-- <div class="icon"><i class="codicon codicon-account"></i> account</div> -->
  <Viewer bind:refresh bind:frame_idx loadFrame='{loadFrame}' nr_frames={nr_frames}></Viewer>
</div>
