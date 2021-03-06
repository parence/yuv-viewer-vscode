# YUV Viewer

This extension allows users to open and visualize YUV files directly within VSCode.

## Why

Developing software that deals with YUV files often requires to visually inspect those files. Being able to do so without leaving VSCode can greatly improve the developers experience and productivity. This is especially true when working on remote environments, where otherwise it would be necessary to download the files first. This extension is not intended to replace your video player and it has not been optimized for playback performance. It is intended to be used for inspecting files during software development.

## Usage

Open a YUV file with the '.yuv' file extension from within the file explorer in VSCode. This opens a YUV player in a new tab assuming the default format (720p planar YUV444 with 8 bits per sample).

The format can be changed using the Yuv-Viewer [commands](#commands) from the command palette.

![commands: change YUV parameters](https://github.com/parence/yuv-viewer-vscode/blob/main/assets/commands.gif?raw=true)


Configurations for each file are stored in the workspace i.e. reopening a previously configured YUV file will restore its configuration.

![reopen a YUV file](https://github.com/parence/yuv-viewer-vscode/blob/main/assets/reopen.gif?raw=true)

Click on the player to playback / pause the video. Hovering the player will display playback controls.

![play / pause](https://github.com/parence/yuv-viewer-vscode/blob/main/assets/play.gif?raw=true)

Seeking forwards and backwards can be done using the controls next to the frame index indicator.

![seek](https://github.com/parence/yuv-viewer-vscode/blob/main/assets/seek.gif?raw=true)

### Commands

Following commands are added by the Yuv-Viewer extension:

- Set chroma subsampling
- Set bit depth
- Set resolution
- Set width
- Set height
- Delete Cache (deletes the stored YUV files configuration from the workspace)

### Settings

- **yuv-viewer.defaultFrameConfig** new yuv files are opend with this configuration
- **yuv-viewer.resolutions** set of predefined resolutions accessible through the 'set resolution' command

### Sidebar

Information about the currently opened YUV files is shown in the YUV section in the sidebar. Apart from showing information it has currently no other functional use.


## Supported formats

Currently the extension supports visualizing planar YUV files with chroma subsampling of 444, 420 and 400 and up to 32-bits per sample. Little-endianness is assumed when more than one byte is used per sample.

Under the hood [yuvjs](https://github.com/parence/yuvjs) is used for reading YUV frames. Support for more formats (packed, different subsampling, endianness etc.) may also be requested there.

## Feature requests

Feature requests may be opened on [github](https://github.com/parence/yuv-viewer-vscode).

