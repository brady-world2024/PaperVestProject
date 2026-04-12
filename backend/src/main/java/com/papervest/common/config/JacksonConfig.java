package com.papervest.common.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

	@Bean
	ObjectMapper objectMapper() {
		return JsonMapper.builder()
				.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
				.findAndAddModules()
				.build();
	}
}
