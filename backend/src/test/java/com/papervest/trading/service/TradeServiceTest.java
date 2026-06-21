package com.papervest.trading.service;

import com.papervest.analytics.model.ProductAnalyticsEventName;
import com.papervest.analytics.service.ProductAnalyticsService;
import com.papervest.common.exception.InvalidTradeException;
import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.portfolio.service.PortfolioHistoryService;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.portfolio.repository.UserAccountRepository;
import com.papervest.trading.dto.TradeExecutionResponse;
import com.papervest.trading.dto.TradeOrderRequest;
import com.papervest.trading.model.Holding;
import com.papervest.trading.model.Trade;
import com.papervest.trading.repository.HoldingRepository;
import com.papervest.trading.repository.TradeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TradeServiceTest {

	@Mock
	private UserAccountRepository userAccountRepository;

	@Mock
	private HoldingRepository holdingRepository;

	@Mock
	private TradeRepository tradeRepository;

	@Mock
	private MarketDataService marketDataService;

	@Mock
	private PlatformTransactionManager transactionManager;

	@Mock
	private PortfolioHistoryService portfolioHistoryService;

	@Mock
	private ProductAnalyticsService productAnalyticsService;

	@Mock
	private TransactionStatus transactionStatus;

	private TradeService tradeService;

	@BeforeEach
	void setUp() {
		lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class))).thenReturn(transactionStatus);
		tradeService = new TradeService(
				userAccountRepository,
				holdingRepository,
				tradeRepository,
				marketDataService,
				portfolioHistoryService,
				productAnalyticsService,
				transactionManager
		);
	}

	@Test
	void buyDebitsCashAndCreatesHolding() {
		UUID userId = UUID.randomUUID();
		UserAccount account = new UserAccount(userId, new BigDecimal("100000.00"));
		TradeOrderRequest request = new TradeOrderRequest("AAPL", "Apple Inc.", new BigDecimal("10"));

		when(tradeRepository.findByUserIdAndIdempotencyKey(userId, "buy-1")).thenReturn(Optional.empty());
		when(userAccountRepository.findByUserIdForUpdate(userId)).thenReturn(Optional.of(account));
		when(holdingRepository.findByUserIdAndSymbolForUpdate(userId, "AAPL")).thenReturn(Optional.empty());
		when(marketDataService.getQuote("AAPL", "Apple Inc.")).thenReturn(stockQuote(new BigDecimal("100.0000")));
		when(tradeRepository.save(any(Trade.class))).thenAnswer(invocation -> invocation.getArgument(0));

		TradeExecutionResponse response = tradeService.buy(userId, request, "buy-1");

		ArgumentCaptor<Holding> holdingCaptor = ArgumentCaptor.forClass(Holding.class);
		verify(holdingRepository).save(holdingCaptor.capture());

		assertThat(account.getCashBalance()).isEqualByComparingTo("99000.00");
		assertThat(holdingCaptor.getValue().getSymbol()).isEqualTo("AAPL");
		assertThat(holdingCaptor.getValue().getQuantity()).isEqualByComparingTo("10.0000");
		assertThat(response.grossAmount()).isEqualByComparingTo("1000.00");
		assertThat(response.side().name()).isEqualTo("BUY");
		verify(portfolioHistoryService).recordTradeExecutionSnapshot(eq(userId), any());
		verify(productAnalyticsService).trackDomainEvent(eq(userId), eq(ProductAnalyticsEventName.TRADE_EXECUTED), any());
	}

	@Test
	void sellRejectsOversell() {
		UUID userId = UUID.randomUUID();
		UserAccount account = new UserAccount(userId, new BigDecimal("100000.00"));
		Holding holding = new Holding(userId, "AAPL", "Apple Inc.", new BigDecimal("2"), new BigDecimal("100.0000"));
		TradeOrderRequest request = new TradeOrderRequest("AAPL", "Apple Inc.", new BigDecimal("3"));

		when(userAccountRepository.findByUserIdForUpdate(userId)).thenReturn(Optional.of(account));
		when(holdingRepository.findByUserIdAndSymbolForUpdate(userId, "AAPL")).thenReturn(Optional.of(holding));
		when(marketDataService.getQuote("AAPL", "Apple Inc.")).thenReturn(stockQuote(new BigDecimal("110.0000")));

		assertThatThrownBy(() -> tradeService.sell(userId, request, null))
				.isInstanceOf(InvalidTradeException.class)
				.hasMessageContaining("sell more shares");

		verify(tradeRepository, never()).save(any(Trade.class));
	}

	@Test
	void buyRejectsWhenRegularMarketIsClosed() {
		UUID userId = UUID.randomUUID();
		TradeOrderRequest request = new TradeOrderRequest("AAPL", "Apple Inc.", new BigDecimal("1"));

		when(marketDataService.getQuote("AAPL", "Apple Inc."))
				.thenReturn(stockQuote(new BigDecimal("100.0000"), MarketSessionState.AFTER_HOURS));

		assertThatThrownBy(() -> tradeService.buy(userId, request, null))
				.isInstanceOf(InvalidTradeException.class)
				.hasMessageContaining("regular market hours");

		verify(userAccountRepository, never()).findByUserIdForUpdate(userId);
		verify(tradeRepository, never()).save(any(Trade.class));
	}

	private StockQuote stockQuote(BigDecimal price) {
		return stockQuote(price, MarketSessionState.OPEN);
	}

	private StockQuote stockQuote(BigDecimal price, MarketSessionState marketSession) {
		return new StockQuote(
				"AAPL",
				"Apple Inc.",
				price,
				new BigDecimal("1.5000"),
				new BigDecimal("1.25"),
				new BigDecimal("99.0000"),
				new BigDecimal("101.0000"),
				new BigDecimal("98.0000"),
				new BigDecimal("98.5000"),
				Instant.parse("2026-01-02T15:00:00Z"),
				false,
				marketSession,
				marketSession == MarketSessionState.OPEN,
				"America/New_York"
		);
	}
}
