 #!/bin/bash
# Example of concatenating 3 mp4s together with 1-second transitions between them.
EFFECT=$1
"/Users/yasin/Library/Application Support/woqi-pc/VideoSDK/ffmpeg" \
  -i media/0.mp4 \
  -i media/1.mp4 \
  -filter_complex " \
    [0:v]split[v000][v010]; \
    [1:v]split[v100][v110]; \
    [v000]trim=0:1[v001]; \
    [v010]trim=1:4[v011t]; \
    [v011t]setpts=PTS-STARTPTS[v011]; \
    [v100]trim=0:3[v101]; \
    [v110]trim=3:4[v111t]; \
    [v111t]setpts=PTS-STARTPTS[v111]; \
    [v011][v101]gltransition=duration=3:source=/Volumes/data/data/program/nodejs/FFCreatorLite/plugins/FFCreatorLite/lib/animate/transitions/$EFFECT.glsl[vt0]; \
    [v001][vt0][v111]concat=n=3[outv]" \
  -map "[outv]" \
  -c:v libx264 -profile:v baseline -preset slow -movflags faststart -pix_fmt yuv420p -loglevel debug \
  -y $EFFECT.mp4
mv $EFFECT.mp4 /home/xarenwo/
