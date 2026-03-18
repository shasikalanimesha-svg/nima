FROM node:lts-bullseye

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
  apt-get install -y \
  ffmpeg \
  imagemagick \
  libwebp-dev \
  ghostscript \
  sox \
  python3 \
  python3-pip \
  git \
  curl \
  wget && \
  pip3 install yt-dlp && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .

RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 5000

CMD ["node", "start.js"]
