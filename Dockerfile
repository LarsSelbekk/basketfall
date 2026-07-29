FROM node:26-alpine AS install
WORKDIR /app
RUN npm install -g yarn@1
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