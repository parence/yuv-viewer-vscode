<script lang="ts">
  import { onMount } from 'svelte';
  import Viewer from './lib/Viewer.svelte'
  import { Frame } from 'yuvjs/web';

  let nr_frames = 1;
  let refresh: () => {};
  onMount(() => {
    window.addEventListener('message', (event) => {
      if (event.data.type === 'refresh') {
        refresh()
      }
      if (event.data.type === 'updateFrameCount') {
        nr_frames = event.data.body.nrFrames;
      }
    });
  });


  /* @ts-ignore */
  const vscode = acquireVsCodeApi();

  const loadFrame = async (idx: number) => {
    vscode.postMessage({ type: "load", idx: idx });
    let yuv = await new Promise<Frame>((resolve) => {
      const listener = (event: MessageEvent) => {
        const { type, body } = event.data;
        if (type === `load-${idx}`) {
          window.removeEventListener('message', listener);
          resolve(body.value);
        }
      }
      window.addEventListener('message', listener);
    });

    /* TODO handle yuv400 case - add constructor */
    yuv = new Frame({y: yuv.y, u: yuv.u, v: yuv.v}, yuv.width, yuv.height, yuv.bits);
    return new ImageData(new Uint8ClampedArray(yuv.asRGBA()), yuv.height);
  };
</script>

<div class='w-full min-h-screen flex justify-center items-center'>
  <!-- <div class="icon"><i class="codicon codicon-account"></i> account</div> -->
  <Viewer bind:refresh={refresh} loadFrame='{loadFrame}' nr_frames={nr_frames}></Viewer>
</div>
