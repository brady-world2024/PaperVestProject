package com.papervest.adminsupport.dto;

import java.math.BigDecimal;

public record SupportAccountSummaryResponse(
		BigDecimal initialCash,
		BigDecimal cashBalance,
		BigDecimal realizedPnl
) {
}
