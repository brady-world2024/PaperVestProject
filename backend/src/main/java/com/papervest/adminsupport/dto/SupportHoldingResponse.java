package com.papervest.adminsupport.dto;

import java.math.BigDecimal;

public record SupportHoldingResponse(
		String symbol,
		String companyName,
		BigDecimal quantity,
		BigDecimal averageCost
) {
}
