# Everything to build and check the desktop packages, without installing it on your own system. See make desktop-docker.
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential ca-certificates curl file git pkg-config patchelf xz-utils \
    libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libxdo-dev \
    lintian appstream desktop-file-utils rpm debhelper \
    xvfb xauth dbus-x11 xdotool xclip x11-utils imagemagick

ENV RUSTUP_HOME=/opt/rust CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:/opt/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.93.1 --component clippy,rustfmt
RUN mkdir -p /opt/node && curl -fsSL "https://nodejs.org/dist/v24.12.0/node-v24.12.0-linux-x64.tar.xz" | tar -xJ --strip-components=1 -C /opt/node
RUN npm install -g pnpm@10.34.9
