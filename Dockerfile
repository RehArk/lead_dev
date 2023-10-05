FROM node:alpine
COPY . /app
WORKDIR /app-test
CMD node ./app/server.js