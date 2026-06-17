package com.papervest.operations.health;

import com.papervest.marketdata.config.MarketDataProperties;
import com.papervest.marketdata.provider.MarketDataProviderRouter;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("marketDataConfiguration")
public class MarketDataConfigurationHealthIndicator implements HealthIndicator {

	private final MarketDataProperties properties;
	private final MarketDataProviderRouter providerRouter;

	public MarketDataConfigurationHealthIndicator(
			MarketDataProperties properties,
			MarketDataProviderRouter providerRouter
	) {
		this.properties = properties;
		this.providerRouter = providerRouter;
	}

	@Override
	public Health health() {
		String apiKey = properties.finnhub().apiKey();
		boolean apiKeyPlaceholder = "demo".equalsIgnoreCase(apiKey)
				|| "test-key".equalsIgnoreCase(apiKey)
				|| "smoke-key".equalsIgnoreCase(apiKey);

		return Health.up()
				.withDetail("provider", providerRouter.activeProvider().providerType().name())
				.withDetail("requestTimeout", properties.requestTimeout().toString())
				.withDetail("quoteCacheTtl", properties.quoteCacheTtl().toString())
				.withDetail("historyCacheTtl", properties.historyCacheTtl().toString())
				.withDetail("searchCacheTtl", properties.searchCacheTtl().toString())
				.withDetail("homeSymbolsCount", properties.homeSymbols().size())
				.withDetail("finnhubBaseUrl", properties.finnhub().baseUrl())
				.withDetail("finnhubApiKeyPlaceholder", apiKeyPlaceholder)
				.build();
	}
}
