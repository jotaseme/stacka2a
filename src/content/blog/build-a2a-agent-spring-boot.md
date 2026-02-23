---
title: "How to Build an A2A Agent with Spring Boot"
description: "Step-by-step tutorial to build an A2A-compliant agent in Java using Spring Boot, Spring AI, and the spring-ai-a2a library. From project setup to deployment with working code."
date: "2026-02-22"
readingTime: 11
tags: ["a2a", "spring-boot", "tutorial", "java"]
relatedStacks: ["spring-boot-stack"]
---

The A2A protocol is not limited to Python. The **Spring AI A2A** library brings full A2A server support to the Java ecosystem, letting you expose any Spring AI agent as an A2A-compliant service with auto-configuration, tool support, and JSON-RPC endpoints — all with the conventions Spring Boot developers expect.

This tutorial walks you through building a Java-based A2A agent from project initialization to deployment.

## What You'll Build

A **weather assistant agent** that provides current weather information and forecasts. The agent will:

- Expose an Agent Card at a configurable endpoint
- Accept A2A tasks via JSON-RPC (`message/send`)
- Use Spring AI tools for weather data retrieval
- Run as a standard Spring Boot application

## Prerequisites

- Java 17 or higher (21 recommended)
- Maven 3.8 or higher
- An OpenAI API key (or another Spring AI-supported provider)
- Basic familiarity with Spring Boot and Spring AI
- curl for testing

## Step 1: Create the Project

Use Spring Initializr or create a Maven project manually. Here is the minimal `pom.xml`:

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

## Step 2: Configure Application Properties

Create `src/main/resources/application.yml`:

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

The `spring.ai.a2a.server.enabled: true` flag activates the A2A auto-configuration. The context path `/a2a` means the JSON-RPC endpoint will be at `http://localhost:8080/a2a` and the Agent Card at `http://localhost:8080/a2a/card`.

## Step 3: Create the Tools Service

Spring AI uses the `@Tool` annotation to define functions the LLM can call. Create a weather tools service:

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

Each `@Tool` method becomes a function the LLM can invoke during a conversation. The descriptions help the LLM decide when to call each tool.

## Step 4: Define the Agent Card Bean

Create a configuration class that defines the Agent Card metadata:

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

## Step 5: Implement the Agent Executor

The `AgentExecutor` is the bridge between the A2A protocol layer and your Spring AI logic. Create an executor bean:

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

The `DefaultAgentExecutor` handles the A2A task lifecycle. The lambda receives each incoming A2A message, passes it to the `ChatClient`, and returns the response. The `ChatClient` automatically invokes the weather tools when the LLM decides it needs weather data.

## Step 6: Create the Application Entry Point

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

## Step 7: Build and Run

Set your API key and start the application:

```bash
export OPENAI_API_KEY="your-api-key-here"
mvn clean package -DskipTests
mvn spring-boot:run
```

You should see Spring Boot start up with the A2A endpoint registered.

## Step 8: Verify the Agent Card

Fetch the Agent Card:

```bash
curl -s http://localhost:8080/a2a/card | python -m json.tool
```

You should see the full Agent Card with the name, description, skills, and capabilities you defined in the configuration.

## Step 9: Test with curl

Send a weather request via A2A:

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

The agent will use the `getCurrentWeather` and `getWeatherForecast` tools, then return a formatted response as an A2A task artifact.

## Step 10: Consume a Remote A2A Agent

To call another A2A agent from your Spring Boot application, use the A2A Java SDK client. Create a tool that delegates to a remote agent:

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

Register this tool service alongside your weather tools so the LLM can delegate travel-related questions to the remote agent while handling weather questions locally.

## Project Structure

Here is the final project layout:

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

Package as a standard Spring Boot JAR and deploy:

```bash
mvn clean package
java -jar target/weather-agent-0.1.0.jar
```

For containerized deployments:

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

Update the `url` in your Agent Card bean to reflect the production domain before deploying.

## Next Steps

You now have a Spring Boot A2A agent that integrates with the Java ecosystem. For curated Java agent stacks and enterprise-ready configurations, check out [the Spring Boot stack](/stacks/spring-boot-stack) on StackA2A.
