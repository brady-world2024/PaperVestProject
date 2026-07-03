package com.papervest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.papervest.common.exception.ExternalServiceException;
import com.papervest.common.web.RequestIdFilter;
import com.papervest.conditionalorder.model.ConditionalOrder;
import com.papervest.conditionalorder.model.ConditionalOrderFailureCode;
import com.papervest.conditionalorder.model.ConditionalOrderStatus;
import com.papervest.conditionalorder.model.ConditionalOrderStatusEvent;
import com.papervest.conditionalorder.repository.ConditionalOrderRepository;
import com.papervest.conditionalorder.repository.ConditionalOrderStatusEventRepository;
import com.papervest.conditionalorder.service.ConditionalOrderExecutionService;
import com.papervest.marketdata.model.MarketSessionState;
import com.papervest.marketdata.model.StockQuote;
import com.papervest.marketdata.service.MarketDataService;
import com.papervest.ledger.model.CashLedgerEntry;
import com.papervest.ledger.model.CashLedgerEntryType;
import com.papervest.ledger.model.PositionLedgerEntry;
import com.papervest.ledger.model.PositionLedgerEntryType;
import com.papervest.ledger.repository.CashLedgerEntryRepository;
import com.papervest.ledger.repository.PositionLedgerEntryRepository;
import com.papervest.orders.model.Order;
import com.papervest.orders.model.OrderSource;
import com.papervest.orders.model.OrderStatus;
import com.papervest.orders.model.OrderStatusEvent;
import com.papervest.orders.repository.OrderRepository;
import com.papervest.orders.repository.OrderStatusEventRepository;
import com.papervest.portfolio.model.UserAccount;
import com.papervest.portfolio.repository.UserAccountRepository;
import com.papervest.trading.model.Trade;
import com.papervest.trading.model.TradeSide;
import com.papervest.trading.repository.HoldingRepository;
import com.papervest.trading.repository.TradeRepository;
import com.papervest.conditionalorder.messaging.ConditionalOrderMessagePublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class ConditionalOrderFlowIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private FilterChainProxy springSecurityFilterChain;

	@Autowired
	private RequestIdFilter requestIdFilter;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private ConditionalOrderRepository conditionalOrderRepository;

	@Autowired
	private ConditionalOrderStatusEventRepository eventRepository;

	@Autowired
	private ConditionalOrderExecutionService conditionalOrderExecutionService;

	@Autowired
	private TradeRepository tradeRepository;

	@Autowired
	private OrderRepository orderRepository;

	@Autowired
	private OrderStatusEventRepository orderStatusEventRepository;

	@Autowired
	private CashLedgerEntryRepository cashLedgerEntryRepository;

	@Autowired
	private PositionLedgerEntryRepository positionLedgerEntryRepository;

	@Autowired
	private HoldingRepository holdingRepository;

	@Autowired
	private UserAccountRepository userAccountRepository;

	@MockitoBean
	private MarketDataService marketDataService;

	@MockitoBean
	private ConditionalOrderMessagePublisher messagePublisher;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.addFilters(requestIdFilter)
				.addFilters(springSecurityFilterChain)
				.build();
		reset(marketDataService, messagePublisher);
	}

	@Test
	void createListDetailAndCancelConditionalOrder() throws Exception {
		AuthSession session = registerUser();

		MvcResult createResult = mockMvc.perform(post("/api/conditional-orders")
						.header("Authorization", "Bearer " + session.accessToken())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "side": "BUY",
								  "targetPrice": 95,
								  "quantity": 3
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("ACTIVE"))
				.andExpect(jsonPath("$.executionKey").value(org.hamcrest.Matchers.startsWith("conditional-order-")))
				.andReturn();

		String orderId = objectMapper.readTree(createResult.getResponse().getContentAsString()).path("id").asText();

		mockMvc.perform(get("/api/conditional-orders")
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.orders.length()").value(1))
				.andExpect(jsonPath("$.orders[0].symbol").value("AAPL"));

		mockMvc.perform(get("/api/conditional-orders/{id}", orderId)
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.order.id").value(orderId))
				.andExpect(jsonPath("$.events.length()").value(1))
				.andExpect(jsonPath("$.events[0].reasonCode").value("ORDER_CREATED"));

		mockMvc.perform(post("/api/conditional-orders/{id}/cancel", orderId)
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELLED"))
				.andExpect(jsonPath("$.failureCode").value("ORDER_CANCELLED"));

		mockMvc.perform(post("/api/conditional-orders/{id}/cancel", orderId)
						.header("Authorization", "Bearer " + session.accessToken()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ORDER_NOT_ACTIVE"));
	}

	@Test
	void buyOrderTriggersWhenMarketPriceAtOrBelowTarget() throws Exception {
		AuthSession session = registerUser();
		ConditionalOrder order = createOrder(session.accessToken(), "BUY", "100.00", "5.0");

		when(marketDataService.getQuote("AAPL", null)).thenReturn(stockQuote("95.0000"));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();

		ConditionalOrder reloaded = conditionalOrderRepository.findById(order.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.TRIGGERED);
		assertThat(reloaded.getLastCheckedPrice()).isEqualByComparingTo("95.0000");
		verify(messagePublisher).publish(order.getId());

		List<ConditionalOrderStatusEvent> events = eventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(order.getId());
		assertThat(events).extracting(ConditionalOrderStatusEvent::getReasonCode)
				.containsExactly("ORDER_CREATED", "TARGET_PRICE_REACHED");
	}

	@Test
	void sellOrderTriggersWhenMarketPriceAtOrAboveTarget() throws Exception {
		AuthSession session = registerUser();
		createHolding(session.userId(), "AAPL", "2.0000", "100.0000");
		ConditionalOrder order = createOrder(session.accessToken(), "SELL", "100.00", "1.0");

		when(marketDataService.getQuote("AAPL", null)).thenReturn(stockQuote("101.0000"));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();

		ConditionalOrder reloaded = conditionalOrderRepository.findById(order.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.TRIGGERED);
		verify(messagePublisher).publish(order.getId());
	}

	@Test
	void orderStaysActiveWhenPriceConditionIsNotMet() throws Exception {
		AuthSession session = registerUser();
		ConditionalOrder order = createOrder(session.accessToken(), "BUY", "80.00", "2.0");

		when(marketDataService.getQuote("AAPL", null)).thenReturn(stockQuote("95.0000"));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();

		ConditionalOrder reloaded = conditionalOrderRepository.findById(order.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.ACTIVE);
		assertThat(reloaded.getLastCheckedPrice()).isEqualByComparingTo("95.0000");
		verify(messagePublisher, never()).publish(any(UUID.class));
		assertThat(eventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(order.getId())).hasSize(1);
	}

	@Test
	void orderStaysActiveWhenMarketIsClosed() throws Exception {
		AuthSession session = registerUser();
		ConditionalOrder order = createOrder(session.accessToken(), "BUY", "100.00", "2.0");

		when(marketDataService.getQuote("AAPL", null)).thenReturn(stockQuote("95.0000", MarketSessionState.AFTER_HOURS));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();

		ConditionalOrder reloaded = conditionalOrderRepository.findById(order.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.ACTIVE);
		assertThat(reloaded.getLastCheckedPrice()).isEqualByComparingTo("95.0000");
		verify(messagePublisher, never()).publish(any(UUID.class));
		assertThat(eventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(order.getId())).hasSize(1);
	}

	@Test
	void repeatedExecutionMessageDoesNotCreateDuplicateTrade() throws Exception {
		AuthSession session = registerUser();
		ConditionalOrder order = createOrder(session.accessToken(), "BUY", "100.00", "5.0");

		when(marketDataService.getQuote("AAPL", null)).thenReturn(stockQuote("99.0000"));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();
		conditionalOrderExecutionService.handleTriggeredOrder(order.getId());
		conditionalOrderExecutionService.handleTriggeredOrder(order.getId());

		ConditionalOrder reloaded = conditionalOrderRepository.findById(order.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.FILLED);
		assertThat(tradeRepository.findAll().stream().filter(trade -> order.getExecutionKey().equals(trade.getExecutionKey())).count())
				.isEqualTo(1);
		assertThat(holdingRepository.findByUserIdAndSymbol(session.userId(), "AAPL")).isPresent();
		assertThat(userAccountRepository.findByUserId(session.userId()).map(UserAccount::getCashBalance))
				.hasValueSatisfying(balance -> assertThat(balance).isEqualByComparingTo("99505.00"));
		assertThat(eventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(order.getId()))
				.extracting(ConditionalOrderStatusEvent::getToStatus)
				.containsExactly(
						ConditionalOrderStatus.ACTIVE,
						ConditionalOrderStatus.TRIGGERED,
						ConditionalOrderStatus.EXECUTING,
						ConditionalOrderStatus.FILLED
				);
	}

	@Test
	void triggeredConditionalOrderCreatesFilledOmsChildOrderAndLedgerLinks() throws Exception {
		AuthSession session = registerUser();
		ConditionalOrder conditionalOrder = createOrder(session.accessToken(), "BUY", "100.00", "5.0");

		when(marketDataService.getQuote("AAPL", null)).thenReturn(stockQuote("99.0000"));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();
		conditionalOrderExecutionService.handleTriggeredOrder(conditionalOrder.getId());

		Trade trade = tradeRepository.findByExecutionKey(conditionalOrder.getExecutionKey()).orElseThrow();
		assertThat(trade.getOrderId()).isNotNull();

		Order childOrder = orderRepository.findById(trade.getOrderId()).orElseThrow();
		assertThat(childOrder.getUserId()).isEqualTo(session.userId());
		assertThat(childOrder.getSource()).isEqualTo(OrderSource.CONDITIONAL_ORDER);
		assertThat(childOrder.getSourceRefId()).isEqualTo(conditionalOrder.getId());
		assertThat(childOrder.getStatus()).isEqualTo(OrderStatus.FILLED);
		assertThat(childOrder.getRequestedQuantity()).isEqualByComparingTo("5.0000");
		assertThat(childOrder.getFilledQuantity()).isEqualByComparingTo("5.0000");
		assertThat(childOrder.getEstimatedGrossAmount()).isEqualByComparingTo("495.00");
		assertThat(childOrder.getIdempotencyKey()).isEqualTo(conditionalOrder.getExecutionKey());

		List<OrderStatusEvent> orderEvents = orderStatusEventRepository.findByOrderIdOrderByCreatedAtAsc(childOrder.getId());
		assertThat(orderEvents).extracting(OrderStatusEvent::getToStatus)
				.containsExactly(OrderStatus.CREATED, OrderStatus.ACCEPTED, OrderStatus.FILLED);

		List<CashLedgerEntry> cashEntries = cashLedgerEntryRepository.findAll().stream()
				.filter(entry -> childOrder.getId().equals(entry.getOrderId()))
				.toList();
		assertThat(cashEntries).hasSize(1);
		assertThat(cashEntries.get(0).getTradeId()).isEqualTo(trade.getId());
		assertThat(cashEntries.get(0).getEntryType()).isEqualTo(CashLedgerEntryType.TRADE_DEBIT);
		assertThat(cashEntries.get(0).getAmount()).isEqualByComparingTo("-495.00");

		List<PositionLedgerEntry> positionEntries = positionLedgerEntryRepository.findAll().stream()
				.filter(entry -> childOrder.getId().equals(entry.getOrderId()))
				.toList();
		assertThat(positionEntries).hasSize(1);
		assertThat(positionEntries.get(0).getTradeId()).isEqualTo(trade.getId());
		assertThat(positionEntries.get(0).getEntryType()).isEqualTo(PositionLedgerEntryType.TRADE_BUY);
		assertThat(positionEntries.get(0).getQuantityDelta()).isEqualByComparingTo("5.0000");

		ConditionalOrder reloaded = conditionalOrderRepository.findById(conditionalOrder.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.FILLED);

		ConditionalOrderStatusEvent filledEvent = eventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(conditionalOrder.getId())
				.stream()
				.filter(event -> event.getToStatus() == ConditionalOrderStatus.FILLED)
				.findFirst()
				.orElseThrow();
		assertThat(filledEvent.getMetadataJson()).contains(childOrder.getId().toString(), trade.getId().toString());
	}

	@Test
	void insufficientCashFailsOrderWithStructuredFailureCode() throws Exception {
		AuthSession session = registerUser();
		ConditionalOrder order = createOrder(session.accessToken(), "BUY", "100.00", "5000.0");

		when(marketDataService.getQuote("AAPL", null)).thenReturn(stockQuote("100.0000"));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();
		conditionalOrderExecutionService.handleTriggeredOrder(order.getId());

		ConditionalOrder reloaded = conditionalOrderRepository.findById(order.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.FAILED);
		assertThat(reloaded.getFailureCode()).isEqualTo(ConditionalOrderFailureCode.INSUFFICIENT_CASH);
		assertThat(reloaded.getFailureMessage()).contains("virtual cash");
	}

	@Test
	void insufficientHoldingsFailsOrderWithStructuredFailureCode() throws Exception {
		AuthSession session = registerUser();
		ConditionalOrder order = createOrder(session.accessToken(), "SELL", "50.00", "5.0");

		when(marketDataService.getQuote("AAPL", null)).thenReturn(stockQuote("75.0000"));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();
		conditionalOrderExecutionService.handleTriggeredOrder(order.getId());

		ConditionalOrder reloaded = conditionalOrderRepository.findById(order.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.FAILED);
		assertThat(reloaded.getFailureCode()).isEqualTo(ConditionalOrderFailureCode.INSUFFICIENT_HOLDINGS);
		assertThat(reloaded.getFailureMessage()).contains("sell more shares");
	}

	@Test
	void marketDataUnavailableDuringSchedulerKeepsOrderActive() throws Exception {
		AuthSession session = registerUser();
		ConditionalOrder order = createOrder(session.accessToken(), "BUY", "100.00", "1.0");

		when(marketDataService.getQuote("AAPL", null))
				.thenThrow(new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Provider unavailable"));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();

		ConditionalOrder reloaded = conditionalOrderRepository.findById(order.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.ACTIVE);
		verify(messagePublisher, never()).publish(any(UUID.class));
		assertThat(eventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(order.getId())).hasSize(1);
	}

	@Test
	void marketDataUnavailableDuringExecutionReturnsOrderToActive() throws Exception {
		AuthSession session = registerUser();
		ConditionalOrder order = createOrder(session.accessToken(), "BUY", "100.00", "1.0");

		when(marketDataService.getQuote("AAPL", null))
				.thenReturn(stockQuote("95.0000"))
				.thenThrow(new ExternalServiceException("MARKETDATA_UNAVAILABLE", "Provider unavailable"));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();
		conditionalOrderExecutionService.handleTriggeredOrder(order.getId());

		ConditionalOrder reloaded = conditionalOrderRepository.findById(order.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.ACTIVE);
		assertThat(reloaded.getFailureCode()).isNull();
		assertThat(tradeRepository.findByExecutionKey(order.getExecutionKey())).isEmpty();
		assertThat(eventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(order.getId()))
				.extracting(ConditionalOrderStatusEvent::getReasonCode)
				.contains("MARKET_DATA_UNAVAILABLE");
	}

	@Test
	void marketClosedDuringExecutionReturnsOrderToActive() throws Exception {
		AuthSession session = registerUser();
		ConditionalOrder order = createOrder(session.accessToken(), "BUY", "100.00", "1.0");

		when(marketDataService.getQuote("AAPL", null))
				.thenReturn(stockQuote("95.0000"))
				.thenReturn(stockQuote("95.0000", MarketSessionState.AFTER_HOURS));

		conditionalOrderExecutionService.scanAndTriggerReadyOrders();
		conditionalOrderExecutionService.handleTriggeredOrder(order.getId());

		ConditionalOrder reloaded = conditionalOrderRepository.findById(order.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ConditionalOrderStatus.ACTIVE);
		assertThat(reloaded.getFailureCode()).isNull();
		assertThat(tradeRepository.findByExecutionKey(order.getExecutionKey())).isEmpty();
		assertThat(eventRepository.findByConditionalOrderIdOrderByCreatedAtAsc(order.getId()))
				.extracting(ConditionalOrderStatusEvent::getReasonCode)
				.contains("MARKET_CLOSED");
	}

	@Test
	void executionKeyUniqueConstraintIsEnforcedOnTrades() throws Exception {
		AuthSession session = registerUser();

		tradeRepository.saveAndFlush(new Trade(
				session.userId(),
				"AAPL",
				"Apple Inc.",
				TradeSide.BUY,
				new BigDecimal("1.0000"),
				new BigDecimal("100.0000"),
				new BigDecimal("100.00"),
				new BigDecimal("0.00"),
				new BigDecimal("99900.00"),
				null,
				"duplicate-execution-key"
		));

		assertThatThrownBy(() -> tradeRepository.saveAndFlush(new Trade(
				session.userId(),
				"AAPL",
				"Apple Inc.",
				TradeSide.BUY,
				new BigDecimal("1.0000"),
				new BigDecimal("100.0000"),
				new BigDecimal("100.00"),
				new BigDecimal("0.00"),
				new BigDecimal("99800.00"),
				null,
				"duplicate-execution-key"
		))).isInstanceOf(DataIntegrityViolationException.class);
	}

	private AuthSession registerUser() throws Exception {
		String email = "conditional-" + UUID.randomUUID() + "@example.com";

		MvcResult result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "SecurePass1",
								  "confirmPassword": "SecurePass1",
								  "deviceName": "Conditional Order Test"
								}
								""".formatted(email)))
				.andExpect(status().isCreated())
				.andReturn();

		JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
		return new AuthSession(
				jsonNode.path("accessToken").asText(),
				UUID.fromString(jsonNode.path("user").path("id").asText())
		);
	}

	private ConditionalOrder createOrder(String accessToken, String side, String targetPrice, String quantity) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/conditional-orders")
						.header("Authorization", "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "symbol": "AAPL",
								  "side": "%s",
								  "targetPrice": %s,
								  "quantity": %s
								}
								""".formatted(side, targetPrice, quantity)))
				.andExpect(status().isCreated())
				.andReturn();

		String orderId = objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
		return conditionalOrderRepository.findById(UUID.fromString(orderId)).orElseThrow();
	}

	private void createHolding(UUID userId, String symbol, String quantity, String averageCost) {
		holdingRepository.saveAndFlush(new com.papervest.trading.model.Holding(
				userId,
				symbol,
				symbol,
				new BigDecimal(quantity),
				new BigDecimal(averageCost)
		));
	}

	private StockQuote stockQuote(String price) {
		return stockQuote(price, MarketSessionState.OPEN);
	}

	private StockQuote stockQuote(String price, MarketSessionState marketSession) {
		return new StockQuote(
				"AAPL",
				"Apple Inc.",
				new BigDecimal(price),
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

	private record AuthSession(String accessToken, UUID userId) {
	}
}
