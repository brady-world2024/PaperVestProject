package com.papervest.trading.dto;

import java.util.List;

public record TradeHistoryResponse(List<TradeExecutionResponse> trades) {
}
