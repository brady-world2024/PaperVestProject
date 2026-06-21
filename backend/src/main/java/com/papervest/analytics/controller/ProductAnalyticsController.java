package com.papervest.analytics.controller;

import com.papervest.analytics.dto.TrackProductAnalyticsEventRequest;
import com.papervest.analytics.service.ProductAnalyticsService;
import com.papervest.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class ProductAnalyticsController {

	private final ProductAnalyticsService productAnalyticsService;

	public ProductAnalyticsController(ProductAnalyticsService productAnalyticsService) {
		this.productAnalyticsService = productAnalyticsService;
	}

	@PostMapping("/events")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void trackEvent(
			@AuthenticationPrincipal AuthenticatedUser currentUser,
			@Valid @RequestBody TrackProductAnalyticsEventRequest request
	) {
		productAnalyticsService.trackWebEvent(currentUser.userId(), request);
	}
}
