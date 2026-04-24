package com.papervest.testing.cismoke;

import com.papervest.marketdata.model.MarketSessionState;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicReference;

@Component
@Profile("ci-smoke")
public class CiSmokeState {

	private final AtomicReference<MarketSessionState> marketSession = new AtomicReference<>(MarketSessionState.OPEN);

	public MarketSessionState marketSession() {
		return marketSession.get();
	}

	public void setMarketSession(MarketSessionState nextSession) {
		marketSession.set(nextSession);
	}
}
