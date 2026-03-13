FROM node:lts-bullseye

RUN apt-get update && \
  apt-get install -y \
  ffmpeg \
  imagemagick \
  libwebp-dev \
  python3 \
  python3-pip && \
  apt-get upgrade -y && \
  rm -rf /var/lib/apt/lists/*

COPY package.json .

RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
