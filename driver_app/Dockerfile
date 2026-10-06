FROM ghcr.io/cirruslabs/flutter:stable AS build

WORKDIR /app

COPY pubspec.yaml pubspec.lock ./
RUN flutter config --enable-web && flutter pub get

COPY . .

RUN flutter build web --release --pwa-strategy=none \
    --dart-define=API_BASE_URL=http://localhost:5000/api \
    --dart-define=SOCKET_URL=http://localhost:5000 \
    --dart-define=APP_MODE=simulation \
    --dart-define=LOCATION_PROVIDER=simulation

FROM nginx:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/web /usr/share/nginx/html

EXPOSE 8080
