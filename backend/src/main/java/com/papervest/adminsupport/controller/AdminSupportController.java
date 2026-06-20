package com.papervest.adminsupport.controller;

import com.papervest.adminsupport.dto.SupportUserDetailResponse;
import com.papervest.adminsupport.dto.SupportUserListResponse;
import com.papervest.adminsupport.service.AdminSupportService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin/support")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSupportController {

	private final AdminSupportService adminSupportService;

	public AdminSupportController(AdminSupportService adminSupportService) {
		this.adminSupportService = adminSupportService;
	}

	@GetMapping("/users")
	public SupportUserListResponse users(@RequestParam(required = false) String query) {
		return adminSupportService.listUsers(query);
	}

	@GetMapping("/users/{userId}")
	public SupportUserDetailResponse userDetail(@PathVariable UUID userId) {
		return adminSupportService.userDetail(userId);
	}
}
