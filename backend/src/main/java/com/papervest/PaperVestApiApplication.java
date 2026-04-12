package com.papervest;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.SpringApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableCaching
@EnableScheduling
@ConfigurationPropertiesScan
public class PaperVestApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(PaperVestApiApplication.class, args);
	}

}
