package com.papervest.account.dto;

import java.util.List;

public record CashFlowListResponse(
		List<CashFlowResponse> cashFlows
) {
}
