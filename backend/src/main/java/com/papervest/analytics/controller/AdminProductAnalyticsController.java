package com.papervest.analytics.controller;

import com.papervest.analytics.dto.ProductAnalyticsOverviewResponse;
import com.papervest.analytics.service.ProductAnalyticsService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/analytics")
@PreAuthorize("hasRole('ADMIN')")
public class AdminProductAnalyticsController {

	private final ProductAnalyticsService productAnalyticsService;

	public AdminProductAnalyticsController(ProductAnalyticsService productAnalyticsService) {
		this.productAnalyticsService = productAnalyticsService;
	}

	@GetMapping("/overview")
	public ProductAnalyticsOverviewResponse overview(@RequestParam(defaultValue = "30") int days) {
		return productAnalyticsService.getOverview(days);
	}
}
