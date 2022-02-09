<script lang="ts">
  import { onMount } from 'svelte';
  import Viewer from './lib/Viewer.svelte'
  import { Yuv } from 'yuvjs/web';

  let refresh: () => {};
  onMount(() => {
    window.addEventListener('message', (event) => {
      if (event.data.type === 'refresh') {
        refresh()
      }
    });
  });


  /* @ts-ignore */
  const vscode = acquireVsCodeApi();

  const loadFrame = async (idx: number) => {
    vscode.postMessage({ type: "load", idx: idx });
    let yuv = await new Promise<Yuv>((resolve) => {
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
    yuv = new Yuv({y: yuv.y, u: yuv.u, v: yuv.v}, yuv.width, yuv.height, yuv.bits);
    return new ImageData(new Uint8ClampedArray(yuv.asRGBA()), yuv.height);
  };
</script>

<Viewer bind:refresh={refresh} loadFrame='{loadFrame}' nr_frames='{500}'></Viewer>
