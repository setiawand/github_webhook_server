FROM node:18-alpine

RUN apk add --no-cache git

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY .env .env
EXPOSE 3000

CMD ["node", "server.js"]
