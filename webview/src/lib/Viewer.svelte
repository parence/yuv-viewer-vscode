<script lang="ts">
  import { fade } from "svelte/transition";
  import Play from "./icons/play.svelte";
  import Pause from "./icons/pause.svelte";
  import Rewind from "./icons/rewind.svelte";
  import Forward from "./icons/forward.svelte";
  import Spinner from "./icons/loading.svelte";
  import Stop from "./icons/stop.svelte";
  import FrameBuffer from "./FrameBuffer";

  const setFrame = async (idx?: number) => {
    if (loading) return;
    if (frame_idx < 0 || frame_idx >= nr_frames) return;
    loading = true;

    if (idx !== frame_idx) {
      frame_idx = idx;
    }
    frame = await buffer.get(frame_idx);
    window.requestAnimationFrame(() => {
      canvas.getContext("2d").putImageData(frame, 0, 0);
    });

    loading = false;
  };

  const play = async () => {
    playing = !playing;
    if (loading) return;
    if (frame_idx >= nr_frames - 1) frame_idx = 0;

    while (playing && frame_idx < nr_frames - 1) {
      await setFrame(frame_idx + 1);
      await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    }
    playing = false;
  };

  const stop = () => {
    playing = false;
    frame_idx = 0;
  };

  export const refresh = () => {
    buffer.clear();
    setFrame(0);
  };
  export let loadFrame: (idx: number) => Promise<ImageData>;
  export let frame_idx = 0;
  export let nr_frames = 1;
  export let fps = 30;
  export let parallel = 8;
  export let bufferSize = 500; // in MB
  let frame: ImageData;
  let canvas: HTMLCanvasElement;

  let playing = false;
  let loading = false;

  const buffer = new FrameBuffer(loadFrame, 50, parallel);

  $: setFrame(frame_idx);
  $: buffer.maxLoaders = parallel;
  $: buffer.size = frame
    ? Math.round(bufferSize / ((frame.width * frame.height) / 1024 / 1024))
    : 50;
  $: nr_frames = Math.round(nr_frames);
</script>

<div
  style="height:{frame ? frame.height : '500'}px; width: {frame
    ? frame.width
    : '500'}px"
  class="group relative flex justify-center bg-black"
>
  <div class="absolute top-0">
    <canvas
      bind:this={canvas}
      on:click={play}
      width={frame ? frame.width : 500}
      height={frame ? frame.height : 500}
    />
  </div>
  {#if loading}
    <div
      transition:fade
      class="absolute inset-1/2 -translate-x-1/2 -translate-y-3/4 w-28 h-28 bg-transparent text-gray-200"
    >
      <div class="animate-spin">
        <Spinner />
      </div>
    </div>
  {/if}
  <div
    class="transition duration-500 group-hover:duration-150 ease-in group-hover:opacity-100 opacity-0 absolute bottom-0 h-12 w-full text-gray-400 flex flex-col justify-between"
  >
    <div
      style="width:{((frame_idx + 1) / nr_frames) * 100}%"
      class="h-1/6 bg-red-700"
    />
    <div class="flex justify-start items-center h-5/6 w-full bg-gray-900">
      <div class="h-full w-1/3 flex justify-start items-center divide-x">
        <div
          on:click={play}
          class="h-full w-16 m-0 hover:cursor-pointer hover:text-gray-100"
        >
          {#if playing}
            <Pause />
          {:else}
            <Play />
          {/if}
        </div>
        <div
          on:click={stop}
          class="h-6 w-14 hover:cursor-pointer hover:text-gray-100"
        >
          <Stop />
        </div>
        <div class="flex-grow" />
      </div>
      <div class="w-1/3 flex space-x-2 justify-center items-center">
        <div
          class="h-6 w-8 hover:cursor-pointer hover:text-gray-100"
          on:click={() => {
            setFrame(frame_idx > 0 ? frame_idx - 1 : 0);
          }}
        >
          <Rewind />
        </div>
        <div class="w-48 select-none flex justify-center">
          frame:
          <select
            name="frame"
            id="frame"
            bind:value={frame_idx}
            class="bg-gray-900 hover:bg-gray-700 rounded-md ml-2"
          >
            {#each { length: nr_frames } as _, idx}
              <option selected={idx == frame_idx}>{idx}</option>
            {/each}
          </select>
        </div>
        <div
          class="h-6 w-8 hover:cursor-pointer hover:text-gray-100"
          on:click={() => {
            setFrame(frame_idx < nr_frames - 1 ? frame_idx + 1 : nr_frames - 1);
          }}
        >
          <Forward />
        </div>
      </div>
      <div class="w-1/3" />
    </div>
  </div>
</div>
