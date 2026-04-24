package com.papervest.marketdata.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.List;

@Validated
@ConfigurationProperties("app.market-data")
public record MarketDataProperties(
		@NotNull ProviderType provider,
		@NotNull Duration requestTimeout,
		@NotNull Duration quoteCacheTtl,
		@NotNull Duration historyCacheTtl,
		@NotNull Duration searchCacheTtl,
		@NotEmpty List<@Valid HomeSymbol> homeSymbols,
		@NotNull @Valid FinnhubProperties finnhub
) {
	public enum ProviderType {
		FINNHUB,
		STATIC
	}

	public record HomeSymbol(
			@NotBlank String symbol,
			@NotBlank String companyName
	) {
	}

	public record FinnhubProperties(
			@NotBlank String baseUrl,
			@NotBlank String apiKey
	) {
	}
}
