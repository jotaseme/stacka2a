---
title: "How to Build an A2A Agent with Spring Boot"
description: "Build an A2A-compliant agent in Java with Spring Boot, Spring AI, and spring-ai-a2a. Project setup, tool binding, agent executor, remote agent consumption, and Docker deployment."
date: "2026-02-19"
readingTime: 10
tags: ["a2a", "spring-boot", "tutorial", "java"]
relatedStacks: ["spring-boot-stack"]
---

The **Spring AI A2A** library brings full A2A server support to Java. Auto-configuration, `@Tool` annotation support, JSON-RPC endpoints — all wired up with standard Spring Boot conventions. Drop in the dependency, define a few beans, and your Spring AI agent speaks A2A.

We are building a weather assistant agent with tool-calling support, testing it over A2A, and adding remote agent consumption.

## Create the project

You need Java 17+ (21 recommended) and Maven 3.8+.

`pom.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>4.0.0</version>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>weather-agent</artifactId>
    <version>0.1.0</version>

    <properties>
        <java.version>17</java.version>
        <spring-ai.version>2.0.0-M2</spring-ai.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Web -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <!-- Spring AI A2A Server Auto-Configuration -->
        <dependency>
            <groupId>org.springaicommunity</groupId>
            <artifactId>spring-ai-a2a-server-autoconfigure</artifactId>
            <version>0.2.0</version>
        </dependency>

        <!-- Spring AI OpenAI Starter -->
        <dependency>
            <groupId>org.springframework.ai</groupId>
            <artifactId>spring-ai-starter-model-openai</artifactId>
        </dependency>
    </dependencies>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.springframework.ai</groupId>
                <artifactId>spring-ai-bom</artifactId>
                <version>${spring-ai.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

## Configure application properties

`src/main/resources/application.yml`:

```yaml
spring:
  ai:
    a2a:
      server:
        enabled: true
    openai:
      api-key: ${OPENAI_API_KEY}

server:
  port: 8080
  servlet:
    context-path: /a2a

# Optional A2A tuning
a2a:
  blocking:
    agent:
      timeout:
        seconds: 30
  executor:
    core-pool-size: 5
    max-pool-size: 50
```

`spring.ai.a2a.server.enabled: true` activates auto-configuration. The `/a2a` context path means the JSON-RPC endpoint lives at `http://localhost:8080/a2a` and the card at `http://localhost:8080/a2a/card`.

## Create the tools service

```java
package com.example.weatheragent;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Service;

@Service
public class WeatherTools {

    @Tool(description = "Get the current weather conditions for a specific location")
    public String getCurrentWeather(
            @ToolParam(description = "City name, e.g. 'London' or 'San Francisco'")
            String location) {
        // In production, call a real weather API here
        return String.format(
            "Current weather in %s: Partly cloudy, 18°C (64°F), "
            + "humidity 65%%, wind 12 km/h NW.",
            location
        );
    }

    @Tool(description = "Get a 3-day weather forecast for a specific location")
    public String getWeatherForecast(
            @ToolParam(description = "City name")
            String location,
            @ToolParam(description = "Number of days (1-7)")
            int days) {
        // In production, call a real forecast API
        StringBuilder forecast = new StringBuilder();
        forecast.append(String.format(
            "%d-day forecast for %s:%n", days, location));
        String[] conditions = {
            "Sunny, 20°C", "Partly cloudy, 18°C",
            "Light rain, 15°C", "Overcast, 17°C",
            "Clear, 22°C", "Thunderstorms, 14°C",
            "Foggy, 13°C"
        };
        for (int i = 0; i < Math.min(days, 7); i++) {
            forecast.append(String.format(
                "  Day %d: %s%n", i + 1,
                conditions[i % conditions.length]));
        }
        return forecast.toString();
    }

    @Tool(description = "Get weather alerts and warnings for a location")
    public String getWeatherAlerts(
            @ToolParam(description = "City name")
            String location) {
        // In production, check a real alerts API
        return String.format(
            "No active weather alerts for %s.", location);
    }
}
```

Each `@Tool` method becomes an LLM-callable function. The `description` and `@ToolParam` annotations give the LLM enough context to decide when and how to call each tool.

## Define the Agent Card

```java
package com.example.weatheragent;

import io.github.a2ap.core.model.AgentCard;
import io.github.a2ap.core.model.AgentCapabilities;
import io.github.a2ap.core.model.AgentProvider;
import io.github.a2ap.core.model.AgentSkill;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class AgentCardConfig {

    @Bean
    public AgentCard agentCard() {
        return AgentCard.builder()
            .name("Weather Assistant")
            .description(
                "AI weather assistant that provides current conditions, "
                + "forecasts, and weather alerts for any location worldwide."
            )
            .version("1.0.0")
            .url("http://localhost:8080/a2a")
            .provider(AgentProvider.builder()
                .organization("Weather Co")
                .url("https://weather.example.com")
                .build())
            .capabilities(AgentCapabilities.builder()
                .streaming(false)
                .pushNotifications(false)
                .build())
            .defaultInputModes(List.of("text/plain"))
            .defaultOutputModes(List.of("text/plain"))
            .skills(List.of(
                AgentSkill.builder()
                    .id("current-weather")
                    .name("Current Weather")
                    .description(
                        "Returns current weather conditions including "
                        + "temperature, humidity, and wind for any city.")
                    .tags(List.of("weather", "current", "temperature"))
                    .examples(List.of(
                        "What's the weather in Tokyo?",
                        "Current conditions in Berlin"
                    ))
                    .build(),
                AgentSkill.builder()
                    .id("forecast")
                    .name("Weather Forecast")
                    .description(
                        "Provides a multi-day weather forecast with "
                        + "daily conditions and temperatures.")
                    .tags(List.of("weather", "forecast", "planning"))
                    .examples(List.of(
                        "3-day forecast for Paris",
                        "What will the weather be like this week in NYC?"
                    ))
                    .build(),
                AgentSkill.builder()
                    .id("alerts")
                    .name("Weather Alerts")
                    .description(
                        "Checks for active weather warnings, advisories, "
                        + "and alerts for a given location.")
                    .tags(List.of("weather", "alerts", "safety"))
                    .examples(List.of(
                        "Any weather warnings for Miami?",
                        "Check storm alerts for Houston"
                    ))
                    .build()
            ))
            .build();
    }
}
```

## Implement the AgentExecutor

This is the core piece — the bridge between the A2A protocol layer and your Spring AI logic. The executor receives A2A messages, passes them to the `ChatClient`, and returns the response:

```java
package com.example.weatheragent;

import org.springaicommunity.a2a.server.DefaultAgentExecutor;
import org.springaicommunity.a2a.server.AgentExecutor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AgentExecutorConfig {

    @Bean
    public AgentExecutor agentExecutor(
            ChatClient.Builder chatClientBuilder,
            WeatherTools weatherTools) {

        ChatClient chatClient = chatClientBuilder.clone()
            .defaultSystem(
                "You are a helpful weather assistant. When users ask about "
                + "weather, use the available tools to get accurate data. "
                + "Always specify the location and provide temperatures in "
                + "both Celsius and Fahrenheit. Be concise and direct."
            )
            .defaultTools(weatherTools)
            .build();

        return new DefaultAgentExecutor(chatClient, (chat, context) -> {
            String userMessage =
                DefaultAgentExecutor.extractTextFromMessage(
                    context.getMessage());
            return chat.prompt()
                .user(userMessage)
                .call()
                .content();
        });
    }
}
```

`DefaultAgentExecutor` handles the A2A task lifecycle. The lambda extracts text from the incoming A2A message, calls the `ChatClient` (which invokes tools as needed), and returns the result. The `ChatClient` has `weatherTools` registered, so the LLM can call any `@Tool` method during processing.

## Application entry point

```java
package com.example.weatheragent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class WeatherAgentApplication {

    public static void main(String[] args) {
        SpringApplication.run(WeatherAgentApplication.class, args);
    }
}
```

## Build and run

```bash
export OPENAI_API_KEY="your-api-key-here"
mvn clean package -DskipTests
mvn spring-boot:run
```

## Verify the Agent Card

```bash
curl -s http://localhost:8080/a2a/card | python -m json.tool
```

## Test with curl

```bash
curl -X POST http://localhost:8080/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "test-1",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "type": "text",
            "text": "What is the current weather in London and the 3-day forecast?"
          }
        ]
      }
    }
  }'
```

The agent calls `getCurrentWeather` and `getWeatherForecast`, then returns the formatted response as an A2A task artifact.

## Consume a remote A2A agent

Use the A2A Java SDK client to call other A2A agents. Wrap it as a Spring AI tool so the LLM can delegate tasks:

```java
package com.example.weatheragent;

import io.github.a2ap.client.Client;
import io.github.a2ap.client.A2ACardResolver;
import io.github.a2ap.client.JdkA2AHttpClient;
import io.github.a2ap.client.transport.JSONRPCTransport;
import io.github.a2ap.core.model.Message;
import io.github.a2ap.core.model.TextPart;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RemoteAgentTools {

    @Tool(description = "Delegate a travel planning task to the remote travel agent")
    public String askTravelAgent(
            @ToolParam(description = "The travel planning question")
            String question) {

        A2ACardResolver resolver = new A2ACardResolver(
            new JdkA2AHttpClient(),
            "http://localhost:8081",
            "/.well-known/agent-card.json",
            null
        );

        var config = JSONRPCTransport.Configuration.builder()
            .url("http://localhost:8081/a2a")
            .build();

        Client client = Client.builder(resolver.getAgentCard())
            .withTransport(JSONRPCTransport.class, config)
            .build();

        var response = client.sendMessage(
            new Message.Builder()
                .role(Message.Role.USER)
                .parts(List.of(new TextPart(question)))
                .build()
        );

        return response.getText();
    }
}
```

Register this alongside `WeatherTools` so the LLM can handle weather locally and delegate travel questions to the remote agent.

## Project structure

```
weather-agent/
├── pom.xml
└── src/
    └── main/
        ├── java/com/example/weatheragent/
        │   ├── WeatherAgentApplication.java
        │   ├── WeatherTools.java
        │   ├── AgentCardConfig.java
        │   └── AgentExecutorConfig.java
        └── resources/
            └── application.yml
```

## Deployment

Standard Spring Boot JAR:

```bash
mvn clean package
java -jar target/weather-agent-0.1.0.jar
```

Docker:

```dockerfile
FROM eclipse-temurin:17-jre
COPY target/weather-agent-0.1.0.jar app.jar
ENV OPENAI_API_KEY=""
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

```bash
docker build -t weather-agent .
docker run -p 8080:8080 -e OPENAI_API_KEY="your-key" weather-agent
```

Update the `url` in your Agent Card bean to the production domain before deploying.
