type LoadFunc = (idx: number) => Promise<ImageData>;

export default class FrameBuffer {
  private _load: LoadFunc;
  private size: number = 50;
  private frames: Map<number, Promise<ImageData>> = new Map();
  private nrLoaders: number = 0;
  private maxLoaders: number = 16;

  constructor(load: LoadFunc, size?: number, parallel?: number) {
    if (size !== undefined) {
      this.size = size;
    }
    if (parallel !== undefined) {
      this.maxLoaders = parallel;
    }
    this._load = load;
  }

  async get(idx: number) {
    if (!this.frames.has(idx)) {
      this.loader(idx);
    }
    this.buffering(idx + 1);
    return (await this.frames.get(idx)) as ImageData;
  }

  get loading() {
    return this.nrLoaders > 0;
  }

  clear() {
    this.frames = new Map();
  }

  private loader = async (idx: number) => {
    this.nrLoaders += 1;

    this.frames.set(idx, this._load(idx));
    const frame = (await this.frames.get(idx)) as ImageData;

    this.nrLoaders -= 1;
    return frame;
  };

  /*
  a very primitive way of buffering
  - remove an old frame if buffer is full
  - try adding a maximum of 0.75 * size future frames to the buffer
  - keep 0.75 * size for past frames
  - break if maxLoaders is exceeded (should wait for free loaders instead?)
  */
  private buffering(startIdx: number) {
    // 0.9 is to keep some frames in history for going backwards
    for (let index = 0; index < Math.round(0.75 * this.size); index++) {
      if (this.frames.has(startIdx + index)) {
        continue;
      }
      if (this.nrLoaders >= this.maxLoaders) {
        break;
      }
      // buffer is full - remove a frame
      if (this.frames.size >= this.size) {
        let smallest = Infinity;
        let largest = -Infinity;
        for (const idx of this.frames.keys()) {
          smallest = Math.min(idx, smallest);
          largest = Math.max(idx, largest);
        }

        if (largest - startIdx >= this.size) {
          // we went backwards - remove the frame with largest idx
          this.frames.delete(largest);
        } else {
          this.frames.delete(smallest);
        }
      }
      this.loader(startIdx + index);
    }
  }
}
