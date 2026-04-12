FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /workspace

COPY pom.xml mvnw ./
COPY .mvn .mvn

RUN chmod +x mvnw
RUN ./mvnw -q -DskipTests dependency:go-offline

COPY src src
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /workspace/target/backend-0.0.1-SNAPSHOT.jar /app/papervest-api.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/papervest-api.jar"]
