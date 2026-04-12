package com.papervest.common.config;

import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.papervest.marketdata.config.MarketDataProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;

@Configuration
public class SecurityBeansConfig {

	@Bean
	Clock applicationClock() {
		return Clock.systemUTC();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	SecretKey jwtSecretKey(AppSecurityProperties properties) {
		byte[] secretBytes = properties.jwtSecret().getBytes(StandardCharsets.UTF_8);
		if (secretBytes.length < 32) {
			throw new IllegalStateException("APP_JWT_SECRET must be at least 32 characters long");
		}
		return new SecretKeySpec(secretBytes, "HmacSHA256");
	}

	@Bean
	JwtEncoder jwtEncoder(SecretKey secretKey) {
		return new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(secretKey));
	}

	@Bean
	JwtDecoder jwtDecoder(SecretKey secretKey) {
		return NimbusJwtDecoder.withSecretKey(secretKey)
				.macAlgorithm(MacAlgorithm.HS256)
				.build();
	}

	@Bean
	HttpClient marketDataHttpClient(MarketDataProperties properties) {
		return HttpClient.newBuilder()
				.connectTimeout(properties.requestTimeout())
				.build();
	}
}
