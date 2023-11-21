FROM node:12-alpine
RUN mkdir app
WORKDIR /app
COPY . .
RUN npm ci
CMD ["npm", "start"]
