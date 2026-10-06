FROM ghcr.io/cirruslabs/flutter:stable AS dependencies

WORKDIR /app

COPY pubspec.yaml pubspec.lock ./
RUN flutter config --enable-web && flutter pub get

FROM ghcr.io/cirruslabs/flutter:stable AS runtime

WORKDIR /app

COPY --from=dependencies /root/.pub-cache /root/.pub-cache
COPY --from=dependencies /app/.dart_tool /app/.dart_tool
COPY pubspec.yaml pubspec.lock ./

COPY . .

EXPOSE 8081

CMD ["flutter", "run", "-d", "web-server", "--web-hostname", "0.0.0.0", "--web-port", "8081", "--dart-define=API_BASE_URL=http://localhost:5000", "--dart-define=SOCKET_URL=http://localhost:5000"]
