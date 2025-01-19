# github_webhook_server

## Config
rename .env.example into .env, set values based on your preferences

## Build
docker build -t webhook-server .

## Run
docker run -d -p 3000:3000 --name webhook-server \
  -v /path/to/deployment:/path/to/deployment \
  webhook-server
