
<script lang='ts'>
    import { fade } from 'svelte/transition';
    import { onMount } from 'svelte';
    import Play from './icons/play.svelte';
    import Pause from './icons/pause.svelte';
    import Rewind from './icons/rewind.svelte';
    import Forward from './icons/forward.svelte';
    import Spinner from './icons/loading.svelte';
    import Stop from './icons/stop.svelte';

    onMount(async () => {
        await setFrame(0, 1);
    });

    const buffer = new Map<number, ImageData>();
    const buffering = async (idx: number, size: number) => {
        await Promise.all(Array(size).fill(idx).map(
            async (val, idx) => {
                if (val + idx >= nr_frames) return;
                if (!buffer.has(val + idx)) {
                    buffer.set(val + idx, await loadFrame(val + idx));
                }
            }
        ));
    };

    const setFrame = async (idx: number, bufferSize?: number) => {
        if (idx < 0 || idx >= nr_frames) return;
        if (buffer.has(idx)) {
            frame = buffer.get(idx);
            window.requestAnimationFrame(
                () => {canvas.getContext('2d').putImageData(frame, 0, 0)}
            );
            return;
        }

        loading = true;
        await buffering(idx, (bufferSize === undefined) ? offset : bufferSize);
        if (bufferSize !== undefined) {
            offset = Math.round(offset * 1.5);
        }
        loading = false;
        await setFrame(idx);
    };

    const play = async () => {
        playing = !playing;
        if (loading) return;
        if (frame_idx >= nr_frames -1) frame_idx = 0;

        while (playing && (frame_idx < nr_frames -1)) {
            await setFrame(++frame_idx);
            await new Promise(resolve => setTimeout(resolve, 1000 / fps));
        }
        playing = false;
    };

    const stop = () => {
        playing = false;
        frame_idx = 0;
        setFrame(frame_idx);
    };


    export const refresh = () => {
        buffer.clear();
        setFrame(frame_idx, 1);
    };
    export let loadFrame: (idx: number) => Promise<ImageData>;
    export let frame_idx = 0;
    export let nr_frames = 1;
    export let fps = 50;
    let frame: ImageData;
    let canvas: HTMLCanvasElement;

    let offset = fps;
    let playing = false;
    let loading = false;

    $: {
        if (frame) {
            buffering(frame_idx + offset, 1)
        }
        
    }

</script>


<div style='height:{frame ? frame.height : "500"}px; width: {frame ? frame.width : "500"}px' class='group relative flex justify-center bg-black'>
    <div class='absolute top-0'>
        <canvas 
            bind:this={canvas} on:click={play}
            width={frame ? frame.width : 500} height={frame ? frame.height : 500}
        >
        </canvas>
    </div>
    {#if loading}
    <div transition:fade class='absolute inset-1/2 -translate-x-1/2 -translate-y-3/4 w-28 h-28 bg-transparent text-gray-200'>
        <div class='animate-spin'>
            <Spinner></Spinner>
        </div>
    </div>
    {/if}
    <div class='transition duration-500 group-hover:duration-150 ease-in group-hover:opacity-100 opacity-0 absolute bottom-0 h-12 w-full text-gray-400 flex flex-col justify-between'>
        <div style='width:{(frame_idx + 1) / nr_frames * 100}%' class='h-1/6 bg-red-700'> </div>
        <div class='flex justify-between items-center h-5/6 w-full bg-gray-900'>
            <div class='h-full w-1/3 flex justify-start items-center divide-x'>
                <div on:click={play} class='h-full m-0 pr-2 hover:cursor-pointer hover:text-gray-100'>
                    {#if playing}
                        <Pause></Pause>
                    {:else}
                        <Play></Play>
                    {/if}
                </div>
                <div on:click={stop} class='h-6 pl-2 hover:cursor-pointer hover:text-gray-100'>
                    <Stop></Stop>
                </div>
                <div class='flex-grow'></div>
            </div>
            <div class='flex space-x-2 justify-center items-center '>
                <div class='h-6 hover:cursor-pointer hover:text-gray-100' on:click={() => {setFrame(frame_idx > 0 ? --frame_idx: 0)}}>
                    <Rewind></Rewind>
                </div>
                <p class='select-none'>frame: {frame_idx}</p>
                <div class='h-6 hover:cursor-pointer hover:text-gray-100' on:click={() => {setFrame(frame_idx < nr_frames -1 ? ++frame_idx : nr_frames)}}>
                    <Forward></Forward>
                </div>
            </div>
            <div class='w-1/3'></div>
        </div>
    </div>

</div>
