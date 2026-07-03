package com.papervest.orders.execution.service;

import com.papervest.orders.model.Order;
import com.papervest.trading.model.TradeSide;

import java.math.BigDecimal;

public final class OrderExecutionTriggerRules {

	private OrderExecutionTriggerRules() {
	}

	public static boolean isExecutable(Order order, BigDecimal currentPrice) {
		if (currentPrice == null) {
			return false;
		}
		return switch (order.getOrderType()) {
			case LIMIT -> limitExecutable(order, currentPrice);
			case STOP -> stopExecutable(order, currentPrice);
			case STOP_LIMIT -> stopExecutable(order, currentPrice) && limitExecutable(order, currentPrice);
			case MARKET -> false;
		};
	}

	private static boolean limitExecutable(Order order, BigDecimal currentPrice) {
		if (order.getLimitPrice() == null) {
			return false;
		}
		if (order.getSide() == TradeSide.BUY) {
			return currentPrice.compareTo(order.getLimitPrice()) <= 0;
		}
		return currentPrice.compareTo(order.getLimitPrice()) >= 0;
	}

	private static boolean stopExecutable(Order order, BigDecimal currentPrice) {
		if (order.getStopPrice() == null) {
			return false;
		}
		if (order.getSide() == TradeSide.BUY) {
			return currentPrice.compareTo(order.getStopPrice()) >= 0;
		}
		return currentPrice.compareTo(order.getStopPrice()) <= 0;
	}
}
