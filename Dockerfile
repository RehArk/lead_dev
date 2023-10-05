FROM node:alpine
COPY . /app
WORKDIR /app
RUN npm i
CMD node ./app/server.js