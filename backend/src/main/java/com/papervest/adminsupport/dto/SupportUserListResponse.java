package com.papervest.adminsupport.dto;

import java.util.List;

public record SupportUserListResponse(List<SupportUserSummaryResponse> users) {
}
