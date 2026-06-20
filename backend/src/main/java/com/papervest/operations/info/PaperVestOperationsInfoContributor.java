package com.papervest.operations.info;

import com.papervest.common.config.AccountLifecycleProperties;
import com.papervest.common.config.AppSecurityProperties;
import com.papervest.conditionalorder.config.ConditionalOrderProperties;
import com.papervest.marketdata.config.MarketDataProperties;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Map;

@Component
public class PaperVestOperationsInfoContributor implements InfoContributor {

	private final Environment environment;
	private final AppSecurityProperties securityProperties;
	private final AccountLifecycleProperties accountLifecycleProperties;
	private final MarketDataProperties marketDataProperties;
	private final ConditionalOrderProperties conditionalOrderProperties;

	public PaperVestOperationsInfoContributor(
			Environment environment,
			AppSecurityProperties securityProperties,
			AccountLifecycleProperties accountLifecycleProperties,
			MarketDataProperties marketDataProperties,
			ConditionalOrderProperties conditionalOrderProperties
	) {
		this.environment = environment;
		this.securityProperties = securityProperties;
		this.accountLifecycleProperties = accountLifecycleProperties;
		this.marketDataProperties = marketDataProperties;
		this.conditionalOrderProperties = conditionalOrderProperties;
	}

	@Override
	public void contribute(Info.Builder builder) {
		builder
				.withDetail("application", Map.of(
						"name", "PaperVest API",
						"activeProfiles", Arrays.asList(environment.getActiveProfiles())
				))
				.withDetail("security", Map.of(
						"authRateLimitEnabled", securityProperties.authRateLimit().enabled(),
						"authRateLimitWindow", securityProperties.authRateLimit().window().toString(),
						"allowedOriginsCount", securityProperties.allowedOrigins().size(),
						"cookieSecure", securityProperties.authCookie().secure(),
						"cookieSameSite", securityProperties.authCookie().sameSite()
				))
				.withDetail("accountLifecycle", Map.of(
						"webBaseUrl", accountLifecycleProperties.webBaseUrl(),
						"emailVerificationTokenTtl", accountLifecycleProperties.emailVerificationTokenTtl().toString(),
						"passwordResetTokenTtl", accountLifecycleProperties.passwordResetTokenTtl().toString()
				))
				.withDetail("marketData", Map.of(
						"provider", marketDataProperties.provider().name(),
						"requestTimeout", marketDataProperties.requestTimeout().toString(),
						"quoteCacheTtl", marketDataProperties.quoteCacheTtl().toString(),
						"quoteStaleGraceTtl", marketDataProperties.quoteStaleGraceTtl().toString(),
						"historyCacheTtl", marketDataProperties.historyCacheTtl().toString(),
						"historyStaleGraceTtl", marketDataProperties.historyStaleGraceTtl().toString(),
						"searchCacheTtl", marketDataProperties.searchCacheTtl().toString(),
						"searchStaleGraceTtl", marketDataProperties.searchStaleGraceTtl().toString(),
						"allowPartialHomeResults", marketDataProperties.allowPartialHomeResults(),
						"homeSymbolsCount", marketDataProperties.homeSymbols().size()
				))
				.withDetail("conditionalOrders", Map.of(
						"schedulerEnabled", conditionalOrderProperties.scheduler().enabled(),
						"schedulerBatchSize", conditionalOrderProperties.scheduler().batchSize(),
						"schedulerFixedDelayMs", conditionalOrderProperties.scheduler().fixedDelayMs(),
						"listenerEnabled", conditionalOrderProperties.messaging().listenerEnabled(),
						"exchange", conditionalOrderProperties.messaging().exchange(),
						"queue", conditionalOrderProperties.messaging().queue(),
						"routingKey", conditionalOrderProperties.messaging().routingKey()
				));
	}
}
