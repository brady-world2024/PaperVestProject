package com.papervest.integration;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles({"test", "json-logs"})
class JsonLoggingProfileSmokeTest {

	@Test
	void contextLoadsWithJsonLoggingProfile() {
	}
}
