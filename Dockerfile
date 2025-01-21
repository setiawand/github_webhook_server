FROM node:18-alpine

RUN apk add --no-cache git
RUN apk add --no-cache curl

RUN curl -SL https://github.com/docker/compose/releases/download/v2.22.0/docker-compose-linux-x86_64 \
    -o /usr/local/bin/docker-compose && \
    chmod +x /usr/local/bin/docker-compose

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY .env .env

EXPOSE 3000

CMD ["node", "server.js"]
