package com.papervest.marketdata.provider;

import com.papervest.marketdata.config.MarketDataProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class MarketDataProviderRouter {

	private static final Logger log = LoggerFactory.getLogger(MarketDataProviderRouter.class);
	private final MarketDataProperties properties;
	private final Map<MarketDataProperties.ProviderType, MarketDataProvider> providers;

	public MarketDataProviderRouter(List<MarketDataProvider> providers, MarketDataProperties properties) {
		this.properties = properties;
		Map<MarketDataProperties.ProviderType, MarketDataProvider> registry = new EnumMap<>(MarketDataProperties.ProviderType.class);
		for (MarketDataProvider provider : providers) {
			registry.put(provider.providerType(), provider);
		}
		this.providers = Map.copyOf(registry);
		log.info(
				"Market data provider registry initialized configuredProvider={} availableProviders={}",
				properties.provider(),
				this.providers.keySet()
		);
	}

	public MarketDataProvider activeProvider() {
		MarketDataProvider provider = providers.get(properties.provider());
		if (provider == null) {
			log.error("No market data provider registered for configuredProvider={}", properties.provider());
			throw new IllegalStateException("No market data provider registered for " + properties.provider());
		}
		return provider;
	}
}
