FROM node:23 AS install
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn
COPY . .
CMD ["yarn", "dev"]

EXPOSE 3000

FROM install AS build

RUN yarn build

FROM nginx:alpine AS release

COPY --from=build /app /usr/share/nginx/html/

EXPOSE 80