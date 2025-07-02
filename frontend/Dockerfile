FROM node:18 AS build

WORKDIR /app
COPY . .
RUN npm install && npm run build

# Serve with a lightweight web server
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
